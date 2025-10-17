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
    orderBy,
    onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js';

const COLLECTIONS = {
    PRODUCT_LISTINGS: 'product_listings',
    USERS: 'users',
    CONVERSATIONS: 'conversations'
};

let allListings = [];
let filteredListings = [];
let currentFilter = 'My Listings';
let currentUser = null;
let unsubscribeListings = null;
let unsubscribeUnreadCount = null;

document.addEventListener('DOMContentLoaded', async function() {
    console.log('🛒 Farmer Market initialized');
    
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
    const statusText = isAvailable ? 'Available' : 'Sold Out';
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
                <span class="listing-price">₱${pricePerKg.toFixed(2)}/kg</span>
            </div>
            <div class="listing-stats">
                <div class="stat-item">
                    <span class="stat-icon">📦</span>
                    <span>${quantityLeft.toFixed(1)}kg ${isAvailable ? 'remaining' : 'sold out'}</span>
                </div>
                ${soldAmount > 0 ? `
                    <div class="stat-item">
                        <span class="stat-icon">✅</span>
                        <span>${soldAmount.toFixed(1)}kg sold</span>
                    </div>
                ` : ''}
            </div>
            <div class="listing-meta">
                <div class="meta-item">
                    <span class="meta-icon">📅</span>
                    <span>Created: ${createdDate}</span>
                </div>
                ${updatedDate && updatedDate !== createdDate ? `
                    <div class="meta-item">
                        <span class="meta-icon">🔄</span>
                        <span>Updated: ${updatedDate}</span>
                    </div>
                ` : ''}
            </div>
            <button class="btn-view" onclick="viewListing('${listing.id}')">View & Manage</button>
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
}

function applyFilter(filterText) {
    currentFilter = filterText;
    console.log('🔍 Applying filter:', filterText);
    
    if (filterText === 'My Listings') {
        filteredListings = [...allListings];
    } else if (filterText === 'Active') {
        filteredListings = allListings.filter(listing => 
            listing.listingIsAvailable !== false
        );
    } else if (filterText === 'Sold') {
        filteredListings = allListings.filter(listing => 
            listing.listingIsAvailable === false
        );
    } else if (filterText === 'Nearby Buyers') {
        // Future feature: Show nearby buyers looking for compost
        filteredListings = [...allListings];
    }
    
    displayListings(filteredListings);
    console.log(`✅ Filtered to ${filteredListings.length} listings`);
}

function performSearch(searchTerm) {
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

console.log('🐷✅ PigSoil+ Farmer Market loaded!');