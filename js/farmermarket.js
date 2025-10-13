// farmermarket.js - Farmer's marketplace for managing their own listings
import { auth, db } from './init.js';
import '../js/shared-user-manager.js';
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
    USERS: 'users'
};

let allListings = [];
let filteredListings = [];
let currentFilter = 'My Listings';
let currentUser = null;
let unsubscribeListings = null;

document.addEventListener('DOMContentLoaded', async function() {
    console.log('🛒 Farmer Market initialized');
    
    // Show loading immediately
    showLoadingState();
    
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log('✅ Farmer authenticated:', user.uid);
            currentUser = user;
            
            try {
                setupRealtimeListingsListener();
                setupEventListeners();
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
        <div class="listing-image ${isAvailable ? 'compost' : 'sold-out-bg'}">
            ${mainImage ? 
                `<img src="${mainImage}" alt="${productName}" style="width: 100%; height: 100%; object-fit: cover; position: absolute; top: 0; left: 0;">` :
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

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (unsubscribeListings) {
        unsubscribeListings();
        console.log('🔄 Unsubscribed from real-time listener');
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