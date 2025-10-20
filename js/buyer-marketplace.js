// buyer-marketplace.js - COMPLETE Firebase Version with Filter Dialog
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
    doc,
    getDoc,
    onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js';

// ===== USER TYPE CHECK - REDIRECT SWINE FARMERS =====
function checkUserTypeAndRedirect() {
    try {
        const cachedUserData = localStorage.getItem('pigsoil_user_data');
        if (cachedUserData) {
            const userData = JSON.parse(cachedUserData);
            const userType = userData.userType;
            
            // Redirect swine farmers to farmer dashboard
            if (userType === 'swine_farmer' || userType === 'Swine Farmer') {
                console.log('🚫 Swine farmer detected on buyer page, redirecting to dashboard...');
                window.location.href = '/dashboard.html';
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
    ADDRESSES: 'addresses'
};

let allListings = [];
let filteredListings = [];
let currentFilter = 'all';
let isLoading = false;
let unsubscribeListings = null;

// Show loading state
function showLoadingState() {
    const productsGrid = document.getElementById('productsGrid');
    const emptyState = document.getElementById('emptyState');
    
    if (productsGrid) productsGrid.style.display = 'none';
    if (emptyState) {
        emptyState.style.display = 'flex';
        emptyState.innerHTML = `
            <div style="text-align: center; padding: 60px 20px;">
                <div style="width: 50px; height: 50px; margin: 0 auto 20px; border: 4px solid #f3f3f3; border-top: 4px solid #4CAF50; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                <h3 style="font-size: 20px; margin-bottom: 8px; color: #333;">Loading swine compost listings...</h3>
                <p style="color: #666; font-size: 14px;">Please wait while we fetch available products from swine farmers</p>
            </div>
        `;
    }
}

function hideLoadingState() {
    const emptyState = document.getElementById('emptyState');
    if (emptyState) {
        emptyState.style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', async function() {
    console.log('🛒 Buyer Marketplace initialized');
    
    // Load cached user profile immediately for fast UI
    loadUserProfile();
    
    // Listen for user data changes
    onUserDataChange(() => {
        loadUserProfile();
    });
    
    // Show loading immediately
    showLoadingState();
    
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log('✅ Buyer authenticated:', user.uid);
            
            try {
                // Set up real-time listener for listings
                setupRealtimeListingsListener();
                setupEventListeners();
            } catch (error) {
                console.error('❌ Error initializing marketplace:', error);
                displayErrorState('Failed to load marketplace');
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
    const userType = userData?.userType || 'fertilizer_buyer';
    
    // Get profile picture with proper fallback chain
    let profilePicUrl = userData?.userProfilePictureUrl || user?.photoURL || getCachedProfilePic();
    
    // If still no profile pic or it's the default, use the DEFAULT_PROFILE_PIC
    if (!profilePicUrl || profilePicUrl === DEFAULT_PROFILE_PIC) {
        profilePicUrl = DEFAULT_PROFILE_PIC;
    }
    
    // Determine user role display
    let roleDisplay = 'Active Buyer';
    if (userType === 'fertilizer_buyer' || userType === 'Organic Fertilizer Buyer') {
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

// Set up REAL-TIME listener for product listings
function setupRealtimeListingsListener() {
    console.log('🔄 Setting up real-time listings listener...');
    
    const listingsRef = collection(db, COLLECTIONS.PRODUCT_LISTINGS);
    const q = query(
        listingsRef,
        orderBy('listingCreatedAt', 'desc')
    );
    
    // Listen for real-time updates
    unsubscribeListings = onSnapshot(q, async (snapshot) => {
        console.log(`📦 Received ${snapshot.size} listings from Firebase`);
        
        if (snapshot.empty) {
            console.log('⚠️ No listings found in product_listings collection');
            hideLoadingState();
            showEmptyState('No swine compost listings available yet');
            return;
        }
        
        allListings = [];
        
        // Process all listings
        const listingPromises = snapshot.docs.map(async (docSnap) => {
            const listing = { 
                id: docSnap.id, 
                ...docSnap.data() 
            };
            
            // Fetch seller info
            try {
                const sellerDocRef = doc(db, COLLECTIONS.USERS, listing.listingSellerID);
                const sellerDoc = await getDoc(sellerDocRef);
                
                if (sellerDoc.exists()) {
                    const sellerData = sellerDoc.data();
                    listing.sellerInfo = {
                        userName: sellerData.userName || 'Swine Farmer',
                        userEmail: sellerData.userEmail || '',
                        userPhone: sellerData.userPhone || ''
                    };
                } else {
                    listing.sellerInfo = {
                        userName: 'Swine Farmer',
                        userEmail: '',
                        userPhone: ''
                    };
                }
            } catch (error) {
                console.error('Error loading seller info:', error);
                listing.sellerInfo = {
                    userName: 'Swine Farmer'
                };
            }
            
            // Fetch address info
            try {
                if (listing.listingAddressId) {
                    const addressDocRef = doc(db, COLLECTIONS.ADDRESSES, listing.listingAddressId);
                    const addressDoc = await getDoc(addressDocRef);
                    
                    if (addressDoc.exists()) {
                        const addressData = addressDoc.data();
                        listing.addressInfo = {
                            addressName: addressData.addressName || 'Location not specified'
                        };
                    } else {
                        listing.addressInfo = {
                            addressName: 'Location not specified'
                        };
                    }
                } else {
                    listing.addressInfo = {
                        addressName: 'Location not specified'
                    };
                }
            } catch (error) {
                console.error('Error loading address info:', error);
                listing.addressInfo = {
                    addressName: 'Location not specified'
                };
            }
            
            return listing;
        });
        
        allListings = await Promise.all(listingPromises);
        
        // Apply default filter (All Available Listings)
        applyFilter(0);
        
        hideLoadingState();
        
        console.log(`✅ Loaded ${allListings.length} listings`);
        if (allListings.length > 0) {
            console.log('📍 Sample listing data:', {
                listingId: allListings[0].id,
                addressInfo: allListings[0].addressInfo,
                sellerName: allListings[0].sellerInfo?.userName,
                isAvailable: allListings[0].listingIsAvailable
            });
        }
    }, (error) => {
        console.error('❌ Error in real-time listener:', error);
        displayErrorState('Failed to load listings: ' + error.message);
    });
}

function displayListings(listings) {
    const productsGrid = document.getElementById('productsGrid');
    const emptyState = document.getElementById('emptyState');
    
    if (!productsGrid) {
        console.error('❌ Products grid element not found');
        return;
    }
    
    if (listings.length === 0) {
        productsGrid.style.display = 'none';
        if (emptyState) {
            emptyState.style.display = 'flex';
            emptyState.innerHTML = `
                <div class="empty-icon">🔍</div>
                <h3>No swine compost found</h3>
                <p>Try adjusting your filters or check back later for new listings from swine farmers</p>
            `;
        }
        return;
    }
    
    productsGrid.style.display = 'grid';
    if (emptyState) emptyState.style.display = 'none';
    
    // Clear grid and add smooth transition
    productsGrid.style.opacity = '0';
    productsGrid.innerHTML = '';
    
    listings.forEach((listing, index) => {
        const card = createProductCard(listing);
        // Stagger animation
        setTimeout(() => {
            productsGrid.appendChild(card);
        }, index * 50);
    });
    
    // Fade in
    setTimeout(() => {
        productsGrid.style.transition = 'opacity 0.3s';
        productsGrid.style.opacity = '1';
    }, 100);
    
    console.log(`✅ Displayed ${listings.length} product cards`);
}

function createProductCard(listing) {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.dataset.listingId = listing.id;
    card.style.opacity = '0';
    card.style.animation = 'fadeIn 0.3s forwards';
    
    // Extract listing data with fallbacks
    const sellerName = listing.sellerInfo?.userName || 'Swine Farmer';
    const location = listing.addressInfo?.addressName || 'Location not specified';
    
    const pricePerKg = parseFloat(listing.listingPricePerKG || 0);
    const quantity = parseFloat(listing.listingQuantityLeftKG || 0);
    const productName = listing.listingProductName || 'Premium Swine Compost';
    const isAvailable = listing.listingIsAvailable && quantity > 0;
    
    // Get main image
    const mainImage = listing.listingProductImages && listing.listingProductImages.length > 0 
        ? listing.listingProductImages[0] 
        : null;
    
    card.innerHTML = `
        <div class="product-image ${!isAvailable ? 'sold-out' : ''}">
            ${mainImage ? 
                `<img src="${mainImage}" 
                     alt="${productName}"
                     onerror="this.style.display='none'; this.parentElement.style.background='linear-gradient(45deg, #4A6741, #6B8E5F)'; this.parentElement.innerHTML+='<div style=\\'display: flex; align-items: center; justify-content: center; height: 100%; font-size:48px;opacity:0.8\\'>🌱</div>'">` :
                `<div style="display: flex; align-items: center; justify-content: center; height: 100%; background: linear-gradient(45deg, #4A6741, #6B8E5F); font-size: 48px; opacity: 0.8;">🌱</div>`
            }
            ${!isAvailable ? '<div class="sold-out-badge">SOLD OUT</div>' : ''}
        </div>
        <div class="product-info">
            <h3>${productName}</h3>
            <div class="seller-info">
                <span>👨‍🌾</span>
                <span class="seller-name">${sellerName}</span>
            </div>
            <div class="product-details">
                <div class="detail-item">
                    <span>📍</span>
                    <span>${location}</span>
                </div>
                <div class="detail-item">
                    <span>📦</span>
                    <span>${isAvailable ? `${quantity}kg available` : 'Sold out'}</span>
                </div>
            </div>
            <div class="product-footer">
                <span class="price">₱${pricePerKg.toFixed(2)}/kg</span>
                <button class="btn-view" onclick="viewListing('${listing.id}')">View Details</button>
            </div>
        </div>
    `;
    
    return card;
}

function showEmptyState(message) {
    const productsGrid = document.getElementById('productsGrid');
    const emptyState = document.getElementById('emptyState');
    
    if (productsGrid) productsGrid.style.display = 'none';
    if (emptyState) {
        emptyState.style.display = 'flex';
        emptyState.innerHTML = `
            <div style="text-align: center; padding: 60px 20px;">
                <div style="font-size: 60px; margin-bottom: 16px;">🌾</div>
                <h3 style="font-size: 20px; margin-bottom: 8px; color: #333;">${message}</h3>
                <p style="color: #666; font-size: 14px; margin-bottom: 20px;">Check back soon for new swine compost listings</p>
            </div>
        `;
    }
}

function displayErrorState(message) {
    const productsGrid = document.getElementById('productsGrid');
    const emptyState = document.getElementById('emptyState');
    
    if (productsGrid) productsGrid.style.display = 'none';
    if (emptyState) {
        emptyState.style.display = 'flex';
        emptyState.innerHTML = `
            <div style="text-align: center; padding: 60px 20px;">
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
    // Filter button
    const filterBtn = document.getElementById('filterBtn');
    if (filterBtn) {
        filterBtn.addEventListener('click', showFilterDialog);
    }
    
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
        
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                clearTimeout(searchTimeout);
                performSearch(e.target.value);
            }
        });
    }
}

// Show filter dialog (matches Android)
function showFilterDialog() {
    const dialog = document.createElement('div');
    dialog.className = 'filter-dialog-overlay';
    dialog.innerHTML = `
        <div class="filter-dialog">
            <div class="filter-dialog-header">
                <h3>Filter & Sort Listings</h3>
                <button class="close-dialog" onclick="closeFilterDialog()">✕</button>
            </div>
            <div class="filter-dialog-body">
                <div class="filter-option" data-filter="0">
                    <span>All Available Listings</span>
                    <span class="check-icon">✓</span>
                </div>
                <div class="filter-option" data-filter="1">
                    <span>Available Only</span>
                    <span class="check-icon">✓</span>
                </div>
                <div class="filter-option" data-filter="2">
                    <span>Price: Low to High</span>
                    <span class="check-icon">✓</span>
                </div>
                <div class="filter-option" data-filter="3">
                    <span>Price: High to Low</span>
                    <span class="check-icon">✓</span>
                </div>
                <div class="filter-option" data-filter="4">
                    <span>Newest First</span>
                    <span class="check-icon">✓</span>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(dialog);
    
    // Add click handlers to filter options
    const filterOptions = dialog.querySelectorAll('.filter-option');
    filterOptions.forEach(option => {
        option.addEventListener('click', function() {
            const filterIndex = parseInt(this.dataset.filter);
            applyFilter(filterIndex);
            closeFilterDialog();
        });
    });
    
    // Close on overlay click
    dialog.addEventListener('click', function(e) {
        if (e.target === dialog) {
            closeFilterDialog();
        }
    });
    
    // Animate in
    setTimeout(() => {
        dialog.classList.add('active');
    }, 10);
}

window.closeFilterDialog = function() {
    const dialog = document.querySelector('.filter-dialog-overlay');
    if (dialog) {
        dialog.classList.remove('active');
        setTimeout(() => {
            dialog.remove();
        }, 300);
    }
};

function applyFilter(filterType) {
    console.log('🔍 Applying filter:', filterType);
    
    let sortedListings = [...allListings];
    
    switch(filterType) {
        case 0: // All Available Listings - Available first (newest), then Sold Out (newest)
            // Separate available and sold out
            const available = allListings.filter(listing => {
                const quantity = parseFloat(listing.listingQuantityLeftKG || 0);
                return listing.listingIsAvailable && quantity > 0;
            });
            const soldOut = allListings.filter(listing => {
                const quantity = parseFloat(listing.listingQuantityLeftKG || 0);
                return !listing.listingIsAvailable || quantity <= 0;
            });
            
            // Sort both by newest first
            available.sort((a, b) => {
                const dateA = a.listingCreatedAt?.toMillis() || 0;
                const dateB = b.listingCreatedAt?.toMillis() || 0;
                return dateB - dateA;
            });
            soldOut.sort((a, b) => {
                const dateA = a.listingCreatedAt?.toMillis() || 0;
                const dateB = b.listingCreatedAt?.toMillis() || 0;
                return dateB - dateA;
            });
            
            // Combine: available first, then sold out
            sortedListings = [...available, ...soldOut];
            break;
            
        case 1: // Available Only
            sortedListings = allListings.filter(listing => {
                const quantity = parseFloat(listing.listingQuantityLeftKG || 0);
                return listing.listingIsAvailable && quantity > 0;
            });
            // Sort by newest first
            sortedListings.sort((a, b) => {
                const dateA = a.listingCreatedAt?.toMillis() || 0;
                const dateB = b.listingCreatedAt?.toMillis() || 0;
                return dateB - dateA;
            });
            break;
            
        case 2: // Price: Low to High
            sortedListings.sort((a, b) => {
                const priceA = parseFloat(a.listingPricePerKG || 0);
                const priceB = parseFloat(b.listingPricePerKG || 0);
                return priceA - priceB;
            });
            break;
            
        case 3: // Price: High to Low
            sortedListings.sort((a, b) => {
                const priceA = parseFloat(a.listingPricePerKG || 0);
                const priceB = parseFloat(b.listingPricePerKG || 0);
                return priceB - priceA;
            });
            break;
            
        case 4: // Newest First (all items)
            sortedListings.sort((a, b) => {
                const dateA = a.listingCreatedAt?.toMillis() || 0;
                const dateB = b.listingCreatedAt?.toMillis() || 0;
                return dateB - dateA;
            });
            break;
    }
    
    filteredListings = sortedListings;
    displayListings(filteredListings);
    
    const filterNames = [
        'All listings (available first, newest)',
        'Available only (newest first)',
        'Price: Low to High',
        'Price: High to Low',
        'Newest first (all)'
    ];
    
    console.log(`✅ Filtered by: ${filterNames[filterType]} (${filteredListings.length} listings)`);
}

function performSearch(searchTerm) {
    if (!searchTerm.trim()) {
        applyFilter(0); // Reset to default filter
        return;
    }
    
    const term = searchTerm.toLowerCase();
    console.log('🔍 Searching for:', term);
    
    filteredListings = allListings.filter(listing => {
        return (
            (listing.listingProductName || '').toLowerCase().includes(term) ||
            (listing.listingDescription || '').toLowerCase().includes(term) ||
            (listing.addressInfo?.addressName || '').toLowerCase().includes(term) ||
            (listing.sellerInfo?.userName || '').toLowerCase().includes(term)
        );
    });
    
    displayListings(filteredListings);
    console.log(`✅ Search found ${filteredListings.length} results for "${term}"`);
}

// Global function for view button
window.viewListing = function(listingId) {
    console.log('👁️ Viewing listing:', listingId);
    window.location.href = `/listing-details.html?id=${listingId}`;
};

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (unsubscribeListings) {
        unsubscribeListings();
        console.log('🔄 Unsubscribed from real-time listener');
    }
});

// Add CSS animations and styles
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
    
    .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
    }
    
    /* Filter Dialog Styles */
    .filter-dialog-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        opacity: 0;
        transition: opacity 0.3s;
    }
    
    .filter-dialog-overlay.active {
        opacity: 1;
    }
    
    .filter-dialog {
        background: white;
        border-radius: 16px;
        width: 90%;
        max-width: 400px;
        max-height: 80vh;
        overflow: hidden;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
        transform: scale(0.9);
        transition: transform 0.3s;
    }
    
    .filter-dialog-overlay.active .filter-dialog {
        transform: scale(1);
    }
    
    .filter-dialog-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px 24px;
        border-bottom: 1px solid #e0e0e0;
    }
    
    .filter-dialog-header h3 {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
        color: #333;
    }
    
    .close-dialog {
        background: none;
        border: none;
        font-size: 24px;
        color: #666;
        cursor: pointer;
        padding: 4px 8px;
        line-height: 1;
        transition: color 0.2s;
    }
    
    .close-dialog:hover {
        color: #333;
    }
    
    .filter-dialog-body {
        padding: 8px 0;
        max-height: calc(80vh - 80px);
        overflow-y: auto;
    }
    
    .filter-option {
        padding: 16px 24px;
        cursor: pointer;
        transition: background 0.2s;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 15px;
        color: #333;
    }
    
    .filter-option:hover {
        background: #f5f5f5;
    }
    
    .filter-option .check-icon {
        color: #4CAF50;
        font-size: 18px;
        font-weight: bold;
        opacity: 0;
    }
    
    .filter-option:hover .check-icon {
        opacity: 1;
    }
    
    /* Sold Out Styles */
    .product-image.sold-out {
        position: relative;
    }
    
    .product-image.sold-out::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
    }
    
    .sold-out-badge {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(231, 76, 60, 0.95);
        color: white;
        padding: 8px 20px;
        border-radius: 8px;
        font-weight: 700;
        font-size: 14px;
        z-index: 10;
        letter-spacing: 1px;
    }
`;
document.head.appendChild(style);

console.log('🐷✅ PigSoil+ Buyer Marketplace with Filter Dialog loaded!');