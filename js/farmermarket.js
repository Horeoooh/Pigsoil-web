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
let currentFilter = 'My Listings';
let currentUser = null;
let unsubscribeListings = null;
let unsubscribeUnreadCount = null;

// Google Maps variables
let buyersMap = null;
let buyersMapMarkers = [];
let farmerMarker = null;
let googleMapsLoaded = false;

// Check if Google Maps is loaded
function checkGoogleMapsLoaded() {
    return typeof google !== 'undefined' && typeof google.maps !== 'undefined';
}

// Wait for Google Maps to load
function waitForGoogleMaps(maxWait = 5000) {
    return new Promise((resolve, reject) => {
        if (checkGoogleMapsLoaded()) {
            googleMapsLoaded = true;
            resolve(true);
            return;
        }
        
        const startTime = Date.now();
        const checkInterval = setInterval(() => {
            if (checkGoogleMapsLoaded()) {
                googleMapsLoaded = true;
                clearInterval(checkInterval);
                console.log('✅ Google Maps API loaded');
                resolve(true);
            } else if (Date.now() - startTime > maxWait) {
                clearInterval(checkInterval);
                console.error('❌ Google Maps API failed to load within timeout');
                reject(new Error('Google Maps API load timeout'));
            }
        }, 100);
    });
}

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
            
            // If "Nearby Buyers" is clicked, show the map modal
            if (filterText === 'Nearby Buyers') {
                openNearbyBuyersModal();
            } else {
                applyFilter(filterText);
            }
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
    
    // Nearby Buyers Modal event listeners
    setupNearbyBuyersModal();
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

// ============================================================
// COMPLETE FIX: NEARBY BUYERS MAP MODAL
// This restructured approach initializes the map AFTER the modal is visible
// ============================================================

let mapInitialized = false;

// Setup modal event listeners
function setupNearbyBuyersModal() {
    const modal = document.getElementById('nearbyBuyersModal');
    const closeBtn = document.getElementById('nearbyBuyersModalClose');
    const closeBtn2 = document.getElementById('closeNearbyBuyersModal');
    
    if (closeBtn) closeBtn.addEventListener('click', closeNearbyBuyersModal);
    if (closeBtn2) closeBtn2.addEventListener('click', closeNearbyBuyersModal);
    
    // 🔧 CRITICAL: Initialize map ONLY when modal is FULLY SHOWN
    if (modal) {
        // Remove any existing listeners first
        modal.removeEventListener('shown', handleModalShown);
        
        // Use custom event for when modal animation completes
        modal.addEventListener('shown', handleModalShown);
    }
}

// Handle modal shown event
async function handleModalShown() {
    console.log('🗺️ Modal is now fully visible, initializing map...');
    
    if (!mapInitialized) {
        try {
            await waitForGoogleMaps();
            await initializeNearbyBuyersMap();
            mapInitialized = true;
        } catch (error) {
            console.error('❌ Failed to initialize map:', error);
            const buyersInfoElement = document.getElementById('buyersInfo');
            if (buyersInfoElement) {
                buyersInfoElement.innerHTML = `
                    <p class="buyers-count" style="color: #e74c3c;">
                        ⚠️ Failed to load map. Please refresh the page.
                    </p>
                `;
            }
        }
    } else {
        // Map already initialized, just resize and re-center
        if (buyersMap) {
            google.maps.event.trigger(buyersMap, 'resize');
            const center = buyersMap.getCenter();
            buyersMap.setCenter(center);
            console.log('🔄 Map resized for reopened modal');
        }
    }
}

// Open modal function
async function openNearbyBuyersModal() {
    const modal = document.getElementById('nearbyBuyersModal');
    if (!modal) {
        console.error('❌ Modal element not found');
        return;
    }
    
    console.log('📂 Opening Nearby Buyers Modal...');
    
    // Show the modal
    modal.classList.add('show');
    
    // 🔧 FIX: Ensure map container has dimensions *before* initializing the map.
    const mapElement = document.getElementById('nearbyBuyersMap');
    if (mapElement) {
        mapElement.style.height = '500px'; // Or any other appropriate height
        mapElement.style.display = 'block';
    }

    // Use a short timeout to allow the modal to become visible and for CSS to apply.
    setTimeout(() => {
        const event = new Event('shown');
        modal.dispatchEvent(event);
    }, 150); // A small delay is often sufficient.
}

// Close modal function
function closeNearbyBuyersModal() {
    const modal = document.getElementById('nearbyBuyersModal');
    if (modal) {
        modal.classList.remove('show');
        console.log('📂 Modal closed');
    }
}

// Initialize the map (called AFTER modal is visible)
async function initializeNearbyBuyersMap() {
    console.log('🗺️ Initializing Nearby Buyers Map...');
    
    try {
        const mapElement = document.getElementById('nearbyBuyersMap');
        const buyersInfoElement = document.getElementById('buyersInfo');
        
        if (!mapElement) {
            console.error('❌ Map element not found');
            return;
        }
        
        // 🔧 CRITICAL FIX: Force explicit height to prevent zero-height issue
        // This is a common problem with maps in modals
        mapElement.style.width = '100%';
        mapElement.style.height = '500px';
        mapElement.style.minHeight = '500px';
        mapElement.style.display = 'block';
        
        // Give the browser a moment to apply the styles
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Check if element is actually visible
        const rect = mapElement.getBoundingClientRect();
        console.log('📐 Map element dimensions:', {
            width: rect.width,
            height: rect.height,
            visible: rect.width > 0 && rect.height > 0
        });
        
        if (rect.width === 0 || rect.height === 0) {
            console.error('❌ Map container still has zero dimensions after forcing size!');
            if (buyersInfoElement) {
                buyersInfoElement.innerHTML = `
                    <p class="buyers-count" style="color: #e74c3c;">
                        ⚠️ Map display error. Please refresh the page and try again.
                    </p>
                `;
            }
            return;
        }
        
        // Get current user data
        const currentUserData = getCurrentUserData();
        if (!currentUserData) {
            console.error('❌ Current user data not available');
            return;
        }
        
        // Remove loading indicator
        const loadingIndicator = mapElement.querySelector('.map-loading');
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
        
        // Get farmer's location
        let farmerLocation = null;
        
        if (currentUserData.userAddressID) {
            const addressDoc = await getDoc(doc(db, COLLECTIONS.ADDRESSES, currentUserData.userAddressID));
            
            if (addressDoc.exists()) {
                const addressData = addressDoc.data();
                farmerLocation = {
                    lat: addressData.addressLatitude,
                    lng: addressData.addressLongitude,
                    name: addressData.addressName || currentUserData.userName || 'You'
                };
            }
        }
        
        // Default to Cebu City if no location
        if (!farmerLocation) {
            farmerLocation = {
                lat: 10.3157,
                lng: 123.8854,
                name: 'You (Default Location)'
            };
        }
        
        console.log('📍 Farmer location:', farmerLocation);
        console.log('🔨 Creating Google Map instance...');
        
        // Create the map
        buyersMap = new google.maps.Map(mapElement, {
            center: farmerLocation,
            zoom: 12,
            mapTypeControl: true,
            streetViewControl: false,
            fullscreenControl: true,
            zoomControl: true,
            styles: [
                {
                    featureType: 'poi',
                    elementType: 'labels',
                    stylers: [{ visibility: 'off' }]
                }
            ]
        });
        
        console.log('✅ Map instance created');
        
        // Wait for map to be idle (fully loaded)
        await new Promise((resolve) => {
            google.maps.event.addListenerOnce(buyersMap, 'idle', () => {
                console.log('✅ Map is idle and ready');
                resolve();
            });
        });
        
        // Add farmer's marker (current user)
        farmerMarker = new google.maps.Marker({
            position: farmerLocation,
            map: buyersMap,
            title: farmerLocation.name,
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 12,
                fillColor: '#2196F3',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 3
            },
            zIndex: 1000
        });
        
        console.log('✅ Farmer marker added');
        
        // Add info window for farmer
        const farmerInfoWindow = new google.maps.InfoWindow({
            content: `
                <div class="buyer-info-window">
                    <div class="buyer-info-name">📍 ${farmerLocation.name}</div>
                    <div class="buyer-info-type">Your Location</div>
                </div>
            `
        });
        
        farmerMarker.addListener('click', () => {
            farmerInfoWindow.open(buyersMap, farmerMarker);
        });
        
        // Fetch all fertilizer buyers
        const buyersQuery = query(
            collection(db, COLLECTIONS.USERS),
            where('userType', '==', 'fertilizer_buyer')
        );
        
        const buyersSnapshot = await getDocs(buyersQuery);
        console.log(`📦 Found ${buyersSnapshot.size} fertilizer buyers`);
        
        let buyersWithLocation = 0;
        const bounds = new google.maps.LatLngBounds();
        bounds.extend(farmerLocation);
        
        // Clear existing markers
        buyersMapMarkers.forEach(marker => marker.setMap(null));
        buyersMapMarkers = [];
        
        // Add buyer markers
        for (const buyerDoc of buyersSnapshot.docs) {
            const buyerData = buyerDoc.data();
            
            console.log(`\n👤 Processing buyer: ${buyerData.userName || 'Unknown'}`);
            
            if (!buyerData.userAddressID) {
                console.warn(`   ⚠️ SKIPPED: No userAddressID`);
                continue;
            }
            
            try {
                const addressDoc = await getDoc(doc(db, COLLECTIONS.ADDRESSES, buyerData.userAddressID));
                
                if (!addressDoc.exists()) {
                    console.warn(`   ⚠️ SKIPPED: Address not found`);
                    continue;
                }
                
                const addressData = addressDoc.data();
                const lat = parseFloat(addressData.addressLatitude);
                const lng = parseFloat(addressData.addressLongitude);
                
                if (isNaN(lat) || isNaN(lng)) {
                    console.warn(`   ⚠️ SKIPPED: Invalid coordinates`);
                    continue;
                }
                
                const buyerLocation = { lat, lng };
                console.log(`   ✅ Adding marker at:`, buyerLocation);
                
                // Create buyer marker
                const buyerMarker = new google.maps.Marker({
                    position: buyerLocation,
                    map: buyersMap,
                    title: buyerData.userName || 'Organic Fertilizer Buyer',
                    icon: {
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: 10,
                        fillColor: '#4CAF50',
                        fillOpacity: 1,
                        strokeColor: '#ffffff',
                        strokeWeight: 3
                    },
                    animation: google.maps.Animation.DROP
                });
                
                // Calculate distance
                const distance = calculateDistance(
                    farmerLocation.lat,
                    farmerLocation.lng,
                    buyerLocation.lat,
                    buyerLocation.lng
                );
                
                const profilePicUrl = buyerData.userProfilePictureUrl || DEFAULT_PROFILE_PIC;

                // Create info window
                const infoWindow = new google.maps.InfoWindow({
                    content: `
                        <div class="buyer-info-window" style="display: flex; align-items: center; padding: 8px 5px; width: 280px;">
                            <img src="${profilePicUrl}" alt="${buyerData.userName || 'Buyer'}" style="width: 45px; height: 45px; border-radius: 50%; object-fit: cover; margin-right: 12px;">
                            <div class="buyer-info-details" style="flex-grow: 1;">
                                <div class="buyer-info-name" style="font-weight: bold; margin-bottom: 3px;">🌱 ${buyerData.userName || 'Organic Fertilizer Buyer'}</div>
                                <div class="buyer-info-address" style="font-size: 12px; color: #555; margin-bottom: 3px;">
                                    📍 ${distance.toFixed(1)} km away
                                </div>
                                <div class="buyer-info-type" style="font-size: 11px; color: #777; font-style: italic;">Organic Fertilizer Buyer</div>
                            </div>
                            <button onclick="viewBuyer('${buyerDoc.id}')" style="background: #4CAF50; color: white; border: none; border-radius: 4px; padding: 8px 12px; font-size: 12px; cursor: pointer; margin-left: 10px;">View</button>
                        </div>
                    `
                });
                
                // Open the info window by default
                infoWindow.open(buyersMap, buyerMarker);

                buyerMarker.addListener('click', () => {
                    infoWindow.open(buyersMap, buyerMarker);
                });
                
                buyersMapMarkers.push(buyerMarker);
                bounds.extend(buyerLocation);
                buyersWithLocation++;
                
            } catch (error) {
                console.error(`   ❌ Error:`, error);
            }
        }
        
        console.log(`\n📊 SUMMARY:`);
        console.log(`   - Total: ${buyersSnapshot.size}`);
        console.log(`   - With location: ${buyersWithLocation}`);
        console.log(`   - Skipped: ${buyersSnapshot.size - buyersWithLocation}`);
        
        // Update info text
        if (buyersInfoElement) {
            buyersInfoElement.innerHTML = `
                <p class="buyers-count">
                    Found <strong>${buyersWithLocation}</strong> organic fertilizer buyer${buyersWithLocation !== 1 ? 's' : ''} 
                    with location near you (out of ${buyersSnapshot.size} total buyers)
                </p>
            `;
        }
        
        // Fit map to show all markers
        if (buyersWithLocation > 0) {
            buyersMap.fitBounds(bounds);
            
            // Limit zoom level
            google.maps.event.addListenerOnce(buyersMap, 'idle', () => {
                if (buyersMap.getZoom() > 15) {
                    buyersMap.setZoom(15);
                }
            });
        }
        
        console.log(`✅ Map fully initialized with ${buyersWithLocation} buyer markers`);
        
    } catch (error) {
        console.error('❌ Error initializing map:', error);
        const buyersInfoElement = document.getElementById('buyersInfo');
        if (buyersInfoElement) {
            buyersInfoElement.innerHTML = `
                <p class="buyers-count" style="color: #e74c3c;">
                    ⚠️ Error loading map. Please try again.
                </p>
            `;
        }
    }
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

// Placeholder function for viewing a buyer's profile
window.viewBuyer = function(buyerId) {
    console.log(`👤 TODO: Implement navigation to buyer profile for ID: ${buyerId}`);
    // Example navigation:
    // window.location.href = `/buyer-profile.html?id=${buyerId}`;
    alert(`Viewing buyer: ${buyerId}`);
};

console.log('🐷✅ PigSoil+ Farmer Market loaded!');