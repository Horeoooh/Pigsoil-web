// farmermarket.js - Farmer's marketplace for managing their own listings
import { auth, db } from './init.js';
import { 
    getCurrentUser, 
    getCurrentUserData, 
    getCachedUserData,
    getCachedProfilePic,
    DEFAULT_PROFILE_PIC,
    onUserDataChange
} from './shared-user-manager.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js';
import { 
    collection, 
    query, 
    where, 
    getDocs,
    getDoc,
    doc,
    orderBy,
    onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js';

// ===== USER TYPE CHECK - REDIRECT FERTILIZER BUYERS =====
function checkUserTypeAndRedirect() {
    try {
        const cachedUserData = localStorage.getItem('pigsoil_user_data');
        if (cachedUserData) {
            const userData = JSON.parse(cachedUserData);
            const userType = userData.userType;
            
            // Redirect fertilizer buyers to buyer dashboard
            if (userType === 'fertilizer_buyer' || userType === 'Organic Fertilizer Buyer') {
                console.log('🚫 Fertilizer buyer detected on farmer page, redirecting to buyer dashboard...');
                window.location.href = '/buyer-dashboard.html';
                return true; // Redirecting
            }
        }
        return false; // Not redirecting
    } catch (error) {
        console.error('❌ Error checking user type:', error);
        return false;
    }
}

// Check immediately on page load
if (checkUserTypeAndRedirect()) {
    // Stop execution if redirecting
    throw new Error('Redirecting...');
}

const COLLECTIONS = {
    PRODUCT_LISTINGS: 'product_listings',
    USERS: 'users',
    CONVERSATIONS: 'conversations',
    ADDRESSES: 'addresses'
};

let allListings = [];
let filteredListings = [];
let allBuyers = [];
let filteredBuyers = [];
let currentFilter = 'My Listings';
let currentUser = null;
let unsubscribeListings = null;
let unsubscribeUnreadCount = null;
let farmerLocation = null;

document.addEventListener('DOMContentLoaded', async function() {
    console.log('🛒 Farmer Market initialized');
    
    // Initialize i18n
    if (window.i18nManager) {
        await window.i18nManager.initialize();
    }
    
    // Load user profile immediately
    loadUserProfile();
    
    // Listen for user data changes
    onUserDataChange(() => {
        loadUserProfile();
    });
    
    // Show loading immediately
    showLoadingState();
    
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log('✅ Farmer authenticated:', user.uid);
            currentUser = user;
            
            try {
                setupRealtimeListingsListener();
                setupEventListeners();
                setupUnreadMessagesListener();
            } catch (error) {
                console.error('❌ Error initializing farmer market:', error);
                hideLoadingState();
                displayErrorState('Failed to load your listings');
            }
        } else {
            console.log('⚠️ No user authenticated, redirecting to login');
            window.location.href = '/login.html';
        }
    });
});

// Load user profile from cache or current data
function loadUserProfile() {
    const userData = getCurrentUserData() || getCachedUserData();
    const user = getCurrentUser();
    
    if (!userData && !user) {
        console.log('⏳ No user data available yet');
        return;
    }
    
    const userName = userData?.userName || user?.displayName || 'User';
    const userType = userData?.userType || 'swine_farmer';
    
    // Get profile picture with proper fallback chain
    let profilePicUrl = userData?.userProfilePictureUrl || user?.photoURL || getCachedProfilePic();
    
    // If still no profile pic or it's the default, use the DEFAULT_PROFILE_PIC
    if (!profilePicUrl || profilePicUrl === DEFAULT_PROFILE_PIC) {
        profilePicUrl = DEFAULT_PROFILE_PIC;
    }
    
    // Determine user role display
    let roleDisplay = 'Active Farmer';
    if (userType === 'swine_farmer' || userType === 'Swine Farmer') {
        roleDisplay = 'Swine Farmer';
    } else if (userType === 'fertilizer_buyer' || userType === 'Organic Fertilizer Buyer') {
        roleDisplay = 'Organic Fertilizer Buyer';
    }
    
    // Generate initials
    const initials = userName.split(' ')
        .map(word => word.charAt(0))
        .join('')
        .substring(0, 2)
        .toUpperCase();
    
    // Update header elements
    const userNameElement = document.getElementById('headerUserName');
    const userRoleElement = document.getElementById('headerUserRole');
    const userAvatarElement = document.getElementById('headerUserAvatar');
    
    if (userNameElement) userNameElement.textContent = userName;
    if (userRoleElement) userRoleElement.textContent = roleDisplay;
    
    if (userAvatarElement) {
        // Always use background image with either user's pic or default pic
        userAvatarElement.style.backgroundImage = `url(${profilePicUrl})`;
        userAvatarElement.style.backgroundSize = 'cover';
        userAvatarElement.style.backgroundPosition = 'center';
        userAvatarElement.style.backgroundRepeat = 'no-repeat';
        userAvatarElement.textContent = '';
        
        // Fallback to initials if image fails to load
        const img = new Image();
        img.onerror = () => {
            userAvatarElement.style.backgroundImage = 'none';
            userAvatarElement.textContent = initials;
        };
        img.src = profilePicUrl;
    }
    
    console.log('👤 User profile loaded:', { 
        userName, 
        roleDisplay, 
        profilePicUrl, 
        usingDefault: profilePicUrl === DEFAULT_PROFILE_PIC 
    });
}

// Set up REAL-TIME listener for farmer's own listings
function setupRealtimeListingsListener() {
    console.log('🔄 Setting up real-time listings listener for farmer...');
    
    const listingsRef = collection(db, COLLECTIONS.PRODUCT_LISTINGS);
    const q = query(
        listingsRef,
        where('listingSellerID', '==', currentUser.uid),
        orderBy('listingCreatedAt', 'desc')
    );
    
    // Listen for real-time updates
    unsubscribeListings = onSnapshot(q, async (snapshot) => {
        console.log(`📦 Received ${snapshot.size} listings from Firebase`);
        
        hideLoadingState();
        
        if (snapshot.empty) {
            console.log('⚠️ No listings found for this farmer');
            showEmptyState('You haven\'t created any listings yet');
            return;
        }
        
        allListings = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        filteredListings = [...allListings];
        displayListings(filteredListings);
        
        console.log(`✅ Loaded and displayed ${allListings.length} listings`);
    }, (error) => {
        console.error('❌ Error in real-time listener:', error);
        hideLoadingState();
        displayErrorState('Failed to load listings: ' + error.message);
    });
}

function displayListings(listings) {
    const listingsGrid = document.querySelector('.listings-grid');
    
    if (!listingsGrid) {
        console.error('❌ Listings grid element not found');
        return;
    }
    
    if (listings.length === 0) {
        showEmptyState('No listings match your filter');
        return;
    }
    
    // Clear and populate grid
    listingsGrid.innerHTML = '';
    
    listings.forEach((listing) => {
        const card = createListingCard(listing);
        listingsGrid.appendChild(card);
    });
    
    console.log(`✅ Displayed ${listings.length} listing cards`);
}

function createListingCard(listing) {
    const card = document.createElement('div');
    card.className = 'listing-card';
    card.dataset.listingId = listing.id;
    
    const productName = listing.listingProductName || 'Swine Compost';
    const pricePerKg = parseFloat(listing.listingPricePerKG || 0);
    const quantityLeft = parseFloat(listing.listingQuantityLeftKG || listing.listingQuantityKG || 0);
    const originalQuantity = parseFloat(listing.listingQuantityKG || 0);
    
    const isAvailable = listing.listingIsAvailable !== false && quantityLeft > 0;
    const statusClass = isAvailable ? 'available' : 'sold-out';
    
    // Get translations
    const statusText = isAvailable 
        ? (i18next.t ? i18next.t('farmermarket.listingCard.available') : 'Available')
        : (i18next.t ? i18next.t('farmermarket.listingCard.soldOut') : 'Sold Out');
    const statusIcon = isAvailable ? '✓' : '✗';
    
    // Calculate sold amount
    const soldAmount = originalQuantity - quantityLeft;
    
    // Date formatting
    const createdDate = listing.listingCreatedAt 
        ? formatDate(listing.listingCreatedAt) 
        : 'Unknown';
    
    const updatedDate = listing.listingUpdatedAt 
        ? formatDate(listing.listingUpdatedAt) 
        : null;
    
    const mainImage = listing.listingProductImages && listing.listingProductImages.length > 0 
        ? listing.listingProductImages[0] 
        : null;
    
    const perKgText = i18next.t ? i18next.t('farmermarket.listingCard.perKg') : 'per kg';
    const quantityLeftText = i18next.t ? i18next.t('farmermarket.listingCard.quantityLeft') : 'Quantity Left';
    const originalText = i18next.t ? i18next.t('farmermarket.listingCard.originalQuantity') : 'Original';
    const soldText = i18next.t ? i18next.t('farmermarket.listingCard.sold') : 'Sold';
    const createdText = i18next.t ? i18next.t('farmermarket.listingCard.created') : 'Created';
    const updatedText = i18next.t ? i18next.t('farmermarket.listingCard.updated') : 'Updated';
    const viewButtonText = i18next.t ? i18next.t('farmermarket.listingCard.viewButton') : 'View Details';
    
    card.innerHTML = `
        <div class="listing-image ${!isAvailable ? 'sold-out-bg' : ''}">
            ${mainImage ? 
                `<img src="${mainImage}" alt="${productName}">` :
                ''
            }
            <div class="listing-badges">
                <div class="badge ${statusClass}">
                    <span class="badge-icon">${statusIcon}</span>
                    ${statusText}
                </div>
            </div>
        </div>
        <div class="listing-details">
            <div class="listing-header">
                <h3 class="listing-title">${productName}</h3>
                <span class="listing-price">₱${pricePerKg.toFixed(2)} ${perKgText}</span>
            </div>
            <div class="listing-stats">
                <div class="stat-item">
                    <span class="stat-icon">📦</span>
                    <span>${quantityLeftText}: ${quantityLeft.toFixed(1)}kg</span>
                </div>
                <div class="stat-item">
                    <span class="stat-icon">📊</span>
                    <span>${originalText}: ${originalQuantity.toFixed(1)}kg</span>
                </div>
                ${soldAmount > 0 ? `
                    <div class="stat-item">
                        <span class="stat-icon">✅</span>
                        <span>${soldText}: ${soldAmount.toFixed(1)}kg</span>
                    </div>
                ` : ''}
            </div>
            <div class="listing-meta">
                <div class="meta-item">
                    <span class="meta-icon">📅</span>
                    <span>${createdText}: ${createdDate}</span>
                </div>
                ${updatedDate && updatedDate !== createdDate ? `
                    <div class="meta-item">
                        <span class="meta-icon">🔄</span>
                        <span>${updatedText}: ${updatedDate}</span>
                    </div>
                ` : ''}
            </div>
            <button class="btn-view" onclick="viewListing('${listing.id}')">${viewButtonText}</button>
        </div>
    `;
    
    return card;
}

function formatDate(timestamp) {
    if (!timestamp) return 'Unknown';
    
    let date;
    if (timestamp.toDate) {
        date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
        date = timestamp;
    } else {
        date = new Date(timestamp);
    }
    
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

function formatTimeAgo(timestamp) {
    if (!timestamp) return 'Recently';
    
    let date;
    if (timestamp.toDate) {
        date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
        date = timestamp;
    } else {
        date = new Date(timestamp);
    }
    
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'today';
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
}

function showLoadingState() {
    const listingsGrid = document.querySelector('.listings-grid');
    
    if (listingsGrid) {
        listingsGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px;">
                <div style="width: 50px; height: 50px; margin: 0 auto 20px; border: 4px solid #f3f3f3; border-top: 4px solid #4CAF50; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                <h3 style="font-size: 18px; margin-bottom: 8px; color: #333;">Loading your swine compost listings...</h3>
                <p style="color: #666; font-size: 14px;">Please wait while we fetch your products from the marketplace</p>
            </div>
        `;
    }
}

function hideLoadingState() {
    // Loading state will be replaced by displayListings or showEmptyState
    console.log('📤 Loading complete, displaying content');
}

function showEmptyState(message) {
    const listingsGrid = document.querySelector('.listings-grid');
    
    if (listingsGrid) {
        listingsGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px;">
                <div style="font-size: 60px; margin-bottom: 16px;">📦</div>
                <h3 style="font-size: 20px; margin-bottom: 8px; color: #333;">${message}</h3>
                <p style="color: #666; font-size: 14px; margin-bottom: 20px;">Start selling your swine compost to organic fertilizer buyers</p>
                <a href="/CreateListing.html" style="background: #4CAF50; color: white; padding: 12px 24px; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 14px; text-decoration: none; display: inline-block;">
                    + Add Your First Listing
                </a>
            </div>
        `;
    }
}

function displayErrorState(message) {
    const listingsGrid = document.querySelector('.listings-grid');
    
    if (listingsGrid) {
        listingsGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px;">
                <div style="font-size: 60px; margin-bottom: 16px;">⚠️</div>
                <h3 style="font-size: 20px; margin-bottom: 8px; color: #333;">${message}</h3>
                <p style="color: #666; font-size: 14px; margin-bottom: 20px;">Please check your connection and try again</p>
                <button onclick="location.reload()" style="background: #4CAF50; color: white; padding: 12px 24px; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 14px;">
                    Retry
                </button>
            </div>
        `;
    }
}

function setupEventListeners() {
    // Filter tabs
    const filterTabs = document.querySelectorAll('.tab-btn');
    filterTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            filterTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            const filterText = this.textContent.trim();
            applyFilter(filterText);
        });
    });
    
    // Search functionality
    const searchInput = document.querySelector('.search-input');
    let searchTimeout;
    
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                performSearch(e.target.value);
            }, 300);
        });
    }
    
    // Buyer Details Modal event listeners
    setupBuyerDetailsModal();
}

function applyFilter(filterText) {
    currentFilter = filterText;
    console.log('🔍 Applying filter:', filterText);
    
    // If "Nearby Buyers" is clicked, load buyers instead of listings
    if (filterText.includes('Nearby') || filterText.includes('Buyers')) {
        loadNearbyBuyers();
        return;
    }
    
    if (filterText === 'My Listings') {
        filteredListings = [...allListings];
    } else if (filterText === 'Available' || filterText === 'Active') {
        // Filter for available listings (listingIsAvailable !== false AND quantityLeft > 0)
        filteredListings = allListings.filter(listing => {
            const quantityLeft = parseFloat(listing.listingQuantityLeftKG || listing.listingQuantityKG || 0);
            return listing.listingIsAvailable !== false && quantityLeft > 0;
        });
    } else if (filterText === 'Sold Out' || filterText === 'Sold') {
        // Filter for sold out listings (listingIsAvailable === false OR quantityLeft <= 0)
        filteredListings = allListings.filter(listing => {
            const quantityLeft = parseFloat(listing.listingQuantityLeftKG || listing.listingQuantityKG || 0);
            return listing.listingIsAvailable === false || quantityLeft <= 0;
        });
    } else if (filterText === 'Nearby Buyers') {
        // Future feature: Show nearby buyers looking for compost
        filteredListings = [...allListings];
    }
    
    displayListings(filteredListings);
    console.log(`✅ Filtered to ${filteredListings.length} listings`);
}

function performSearch(searchTerm) {
    // Check if we're in buyers mode
    if (currentFilter.includes('Nearby') || currentFilter.includes('Buyers')) {
        if (!searchTerm.trim()) {
            filteredBuyers = [...allBuyers];
            displayBuyers(filteredBuyers);
            return;
        }
        
        const term = searchTerm.toLowerCase();
        console.log('🔍 Searching buyers for:', term);
        
        filteredBuyers = allBuyers.filter(buyer => {
            return (
                (buyer.userName || '').toLowerCase().includes(term) ||
                (buyer.address.addressName || '').toLowerCase().includes(term) ||
                (buyer.address.addressCity || '').toLowerCase().includes(term) ||
                (buyer.address.addressProvince || '').toLowerCase().includes(term)
            );
        });
        
        displayBuyers(filteredBuyers);
        console.log(`✅ Search found ${filteredBuyers.length} buyer results for "${term}"`);
        return;
    }
    
    // Default: search listings
    if (!searchTerm.trim()) {
        filteredListings = [...allListings];
        displayListings(filteredListings);
        return;
    }
    
    const term = searchTerm.toLowerCase();
    console.log('🔍 Searching for:', term);
    
    filteredListings = allListings.filter(listing => {
        return (
            (listing.listingProductName || '').toLowerCase().includes(term) ||
            (listing.listingDescription || '').toLowerCase().includes(term) ||
            (listing.compostTechnique || '').toLowerCase().includes(term)
        );
    });
    
    displayListings(filteredListings);
    console.log(`✅ Search found ${filteredListings.length} results for "${term}"`);
}

// Global function for view button - navigates to farmer-listing-view.html
window.viewListing = function(listingId) {
    console.log('👁️ Viewing farmer listing:', listingId);
    window.location.href = `/farmer-listing-view.html?id=${listingId}`;
};

// Set up REAL-TIME listener for unread messages count (like Android getTotalUnreadMessagesCount)
function setupUnreadMessagesListener() {
    if (!currentUser) {
        console.warn('⚠️ Cannot setup unread messages listener - no user');
        return;
    }
    
    console.log('🔔 Setting up real-time unread messages listener...');
    
    const conversationsRef = collection(db, COLLECTIONS.CONVERSATIONS);
    const q = query(
        conversationsRef,
        where('participants', 'array-contains', currentUser.uid),
        where('conversationIsActive', '==', true)
    );
    
    // Listen for real-time updates to conversations
    unsubscribeUnreadCount = onSnapshot(q, (snapshot) => {
        let totalUnreadCount = 0;
        
        snapshot.docs.forEach(doc => {
            const conversation = doc.data();
            const unreadCount = getUnreadMessageCount(conversation, currentUser.uid);
            totalUnreadCount += unreadCount;
        });
        
        updateMessageCountBadge(totalUnreadCount);
        console.log(`📬 Total unread messages: ${totalUnreadCount}`);
    }, (error) => {
        console.error('❌ Error in unread messages listener:', error);
    });
}

// Calculate unread message count for a conversation (like Android getUnreadMessageCount)
function getUnreadMessageCount(conversation, currentUserId) {
    const lastMessage = conversation.lastMessage;
    
    if (!lastMessage) {
        return 0;
    }
    
    // If the last message is from current user, there are no unread messages
    if (lastMessage.lastMessageSenderId === currentUserId) {
        return 0;
    }
    
    const participantDetails = conversation.participantDetails || {};
    const currentUserDetails = participantDetails[currentUserId];
    const lastReadAt = currentUserDetails?.participantLastReadAt;
    
    // If never read any messages, and there's a last message from someone else
    if (!lastReadAt) {
        return 1;
    }
    
    // If last message is after last read time, there's 1 unread message
    const lastMessageTime = lastMessage.lastMessageTimestamp;
    if (lastMessageTime && lastMessageTime.toMillis() > lastReadAt.toMillis()) {
        return 1;
    }
    
    return 0;
}

// Update the message count badge in the UI
function updateMessageCountBadge(count) {
    const messageCountElement = document.getElementById('messageCount');
    
    if (!messageCountElement) {
        console.warn('⚠️ Message count element not found');
        return;
    }
    
    if (count > 0) {
        messageCountElement.textContent = count;
        messageCountElement.classList.add('has-unread');
    } else {
        messageCountElement.textContent = '';
        messageCountElement.classList.remove('has-unread');
    }
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (unsubscribeListings) {
        unsubscribeListings();
        console.log('🔄 Unsubscribed from listings listener');
    }
    if (unsubscribeUnreadCount) {
        unsubscribeUnreadCount();
        console.log('🔄 Unsubscribed from unread count listener');
    }
});

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
    }
`;
document.head.appendChild(style);

// ============================================================
// NEARBY BUYERS - LOAD AS CARDS
// ============================================================

// Setup buyer details modal event listeners
function setupBuyerDetailsModal() {
    const modal = document.getElementById('buyerDetailsModal');
    const closeBtn = document.getElementById('buyerModalClose');
    const closeBtn2 = document.getElementById('closeBuyerModal');
    
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('show');
        });
    }
    
    if (closeBtn2) {
        closeBtn2.addEventListener('click', () => {
            modal.classList.remove('show');
        });
    }
    
    // Close on overlay click
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('show');
            }
        });
    }
}

// Load nearby buyers and display as cards
async function loadNearbyBuyers() {
    console.log('� Loading nearby buyers...');
    showLoadingState();
    
    try {
        // Get current user data
        const currentUserData = getCurrentUserData();
        if (!currentUserData) {
            console.error('❌ Current user data not available');
            displayErrorState('Unable to load user data');
            return;
        }
        
        // Get farmer's location
        if (!currentUserData.userAddressID) {
            showEmptyState('Please set your location in Settings → My Address first to see nearby buyers');
            return;
        }
        
        const addressDoc = await getDoc(doc(db, COLLECTIONS.ADDRESSES, currentUserData.userAddressID));
        
        if (!addressDoc.exists()) {
            showEmptyState('Address not found. Please update your location in Settings');
            return;
        }
        
        const addressData = addressDoc.data();
        farmerLocation = {
            lat: parseFloat(addressData.addressLatitude),
            lng: parseFloat(addressData.addressLongitude),
            name: addressData.addressName || currentUserData.userName || 'You'
        };
        
        if (isNaN(farmerLocation.lat) || isNaN(farmerLocation.lng) || 
            (farmerLocation.lat === 0 && farmerLocation.lng === 0)) {
            showEmptyState('Please set a valid location with coordinates in Settings');
            return;
        }
        
        console.log('📍 Farmer location:', farmerLocation);
        
        // Fetch buyers
        console.log('🔍 Fetching fertilizer buyers...');
        const buyersRef = collection(db, COLLECTIONS.USERS);
        const buyersQuery = query(
            buyersRef,
            where('userType', '==', 'fertilizer_buyer'),
            where('userIsActive', '==', true)
        );
        
        const buyersSnapshot = await getDocs(buyersQuery);
        console.log(`📦 Found ${buyersSnapshot.size} fertilizer buyers`);
        
        if (buyersSnapshot.empty) {
            showEmptyState('No organic fertilizer buyers found');
            return;
        }
        
        // Process buyers and calculate distances
        allBuyers = [];
        
        for (const buyerDoc of buyersSnapshot.docs) {
            const buyerData = buyerDoc.data();
            
            // Skip if no address
            if (!buyerData.userAddressID) {
                continue;
            }
            
            try {
                const buyerAddressDoc = await getDoc(doc(db, COLLECTIONS.ADDRESSES, buyerData.userAddressID));
                
                if (!buyerAddressDoc.exists()) {
                    continue;
                }
                
                const buyerAddressData = buyerAddressDoc.data();
                const buyerLat = parseFloat(buyerAddressData.addressLatitude);
                const buyerLng = parseFloat(buyerAddressData.addressLongitude);
                
                if (isNaN(buyerLat) || isNaN(buyerLng)) {
                    continue;
                }
                
                // Calculate distance using Haversine formula
                const distance = calculateDistance(
                    farmerLocation.lat,
                    farmerLocation.lng,
                    buyerLat,
                    buyerLng
                );
                
                // Only include buyers within 25km
                if (distance <= 25) {
                    allBuyers.push({
                        id: buyerDoc.id,
                        ...buyerData,
                        distance: distance,
                        address: buyerAddressData
                    });
                }
                
            } catch (error) {
                console.error(`Error processing buyer ${buyerDoc.id}:`, error);
            }
        }
        
        // Sort by distance (closest first)
        allBuyers.sort((a, b) => a.distance - b.distance);
        
        console.log(`✅ Found ${allBuyers.length} buyers within 25km`);
        
        if (allBuyers.length === 0) {
            showEmptyState('No organic fertilizer buyers within 25km of your location');
            return;
        }
        
        filteredBuyers = [...allBuyers];
        displayBuyers(filteredBuyers);
        
    } catch (error) {
        console.error('❌ Error loading nearby buyers:', error);
        displayErrorState('Failed to load nearby buyers: ' + error.message);
    }
}

// Display buyers as cards
function displayBuyers(buyers) {
    const listingsGrid = document.querySelector('.listings-grid');
    
    if (!listingsGrid) {
        console.error('❌ Listings grid element not found');
        return;
    }
    
    if (buyers.length === 0) {
        showEmptyState('No buyers match your search');
        return;
    }
    
    // Clear and populate grid
    listingsGrid.innerHTML = '';
    
    buyers.forEach((buyer) => {
        const card = createBuyerCard(buyer);
        listingsGrid.appendChild(card);
    });
    
    console.log(`✅ Displayed ${buyers.length} buyer cards`);
}

// Create a buyer card element
function createBuyerCard(buyer) {
    const card = document.createElement('div');
    card.className = 'buyer-card';
    card.dataset.buyerId = buyer.id;
    
    const buyerName = buyer.userName || 'Anonymous Buyer';
    const distance = buyer.distance.toFixed(1);
    const location = buyer.address.addressName || buyer.address.addressCity || 'Unknown Location';
    const profilePic = buyer.userProfilePictureUrl || DEFAULT_PROFILE_PIC;
    
    card.innerHTML = `
        <div class="buyer-card-header">
            <img src="${profilePic}" alt="${buyerName}" class="buyer-avatar" onerror="this.src='${DEFAULT_PROFILE_PIC}'">
            <div class="buyer-info">
                <h3 class="buyer-name">${buyerName}</h3>
                <p class="buyer-type">Organic Fertilizer Buyer</p>
            </div>
        </div>
        <div class="buyer-card-body">
            <div class="buyer-stats">
                <div class="buyer-stat-item">
                    <span class="buyer-stat-icon">📍</span>
                    <span class="buyer-distance">${distance} km away</span>
                </div>
                <div class="buyer-stat-item">
                    <span class="buyer-stat-icon">🗺️</span>
                    <span>${location}</span>
                </div>
            </div>
        </div>
    `;
    
    // Add click event to show buyer details
    card.addEventListener('click', () => {
        showBuyerDetails(buyer);
    });
    
    return card;
}

// Show buyer details modal
function showBuyerDetails(buyer) {
    const modal = document.getElementById('buyerDetailsModal');
    const buyerName = buyer.userName || 'Anonymous Buyer';
    const distance = buyer.distance.toFixed(1);
    const location = buyer.address.addressName || buyer.address.addressCity || 'Unknown Location';
    const fullLocation = [
        buyer.address.addressName,
        buyer.address.addressBarangay,
        buyer.address.addressCity,
        buyer.address.addressProvince
    ].filter(Boolean).join(', ');
    const profilePic = buyer.userProfilePictureUrl || DEFAULT_PROFILE_PIC;
    
    document.getElementById('buyerModalAvatar').src = profilePic;
    document.getElementById('buyerModalAvatar').onerror = function() { this.src = DEFAULT_PROFILE_PIC; };
    document.getElementById('buyerModalName').textContent = buyerName;
    document.getElementById('buyerModalType').textContent = 'Organic Fertilizer Buyer';
    document.getElementById('buyerModalDistance').textContent = `${distance} km away`;
    document.getElementById('buyerModalLocation').textContent = fullLocation;
    
    modal.classList.add('show');
}

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}



console.log('🐷✅ PigSoil+ Farmer Market loaded!');