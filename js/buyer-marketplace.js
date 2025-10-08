// buyer-marketplace.js - COMPLETE Firebase Version
// Displays ALL listings from farmers (product_listings collection)
import { auth, db } from './init.js';
import '../js/shared-user-manager.js';
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

const COLLECTIONS = {
    PRODUCT_LISTINGS: 'product_listings',
    USERS: 'users'
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

// Set up REAL-TIME listener for product listings
function setupRealtimeListingsListener() {
    console.log('🔄 Setting up real-time listings listener...');
    
    const listingsRef = collection(db, COLLECTIONS.PRODUCT_LISTINGS);
    const q = query(
        listingsRef,
        where('listingIsAvailable', '==', true),
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
                        userPhone: sellerData.userPhone || '',
                        sellerRating: calculateSellerRating(sellerData)
                    };
                } else {
                    listing.sellerInfo = {
                        userName: 'Swine Farmer',
                        userEmail: '',
                        userPhone: '',
                        sellerRating: 4.5
                    };
                }
            } catch (error) {
                console.error('Error loading seller info:', error);
                listing.sellerInfo = {
                    userName: 'Swine Farmer',
                    sellerRating: 4.5
                };
            }
            
            return listing;
        });
        
        allListings = await Promise.all(listingPromises);
        filteredListings = [...allListings];
        
        hideLoadingState();
        displayListings(filteredListings);
        
        // Debug: Log location data for verification
        console.log(`✅ Loaded and displayed ${allListings.length} listings`);
        if (allListings.length > 0) {
            console.log('📍 Sample listing location data:', {
                listingId: allListings[0].id,
                locationObject: allListings[0].listingLocation,
                extractedLocation: extractLocationDisplay(allListings[0])
            });
        }
    }, (error) => {
        console.error('❌ Error in real-time listener:', error);
        displayErrorState('Failed to load listings: ' + error.message);
    });
}

// Helper function to extract location for display
function extractLocationDisplay(listing) {
    if (!listing.listingLocation) {
        return 'Cebu, Philippines';
    }
    
    const loc = listing.listingLocation;
    
    // Priority 1: Use name if it's not the default
    if (loc.name && loc.name !== 'Select farm location' && loc.name !== 'Farm Location') {
        return loc.name;
    }
    
    // Priority 2: Use formatted address, extract city/province
    if (loc.formattedAddress && loc.formattedAddress !== 'Cebu City, Philippines') {
        const parts = loc.formattedAddress.split(',').map(p => p.trim());
        if (parts.length >= 2) {
            return `${parts[0]}, ${parts[1]}`; // City, Province
        }
        return parts[0]; // Just city
    }
    
    // Priority 3: Use address field
    if (loc.address && loc.address !== 'Click "Change" to choose pickup location') {
        const parts = loc.address.split(',').map(p => p.trim());
        return parts[0]; // First part usually most relevant
    }
    
    // Fallback
    return 'Cebu, Philippines';
}

function calculateSellerRating(sellerData) {
    // Calculate rating based on seller's stats
    if (sellerData.sellerRating) {
        return sellerData.sellerRating;
    }
    
    // Default to 4.5 if no rating
    return 4.5;
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
    const compostType = listing.compostTechnique || 'basic_swine_manure';
    const compostLabel = compostType === 'hot_composting' ? 'Hot Composting Method' : 'Basic Swine Manure';
    const badgeClass = compostType === 'hot_composting' ? 'hot' : 'basic';
    
    const sellerName = listing.sellerInfo?.userName || 'Swine Farmer';
    const sellerRating = listing.sellerInfo?.sellerRating || 4.5;
    
    // UPDATED: Use helper function for better location extraction
    const location = extractLocationDisplay(listing);
    
    const pricePerKg = parseFloat(listing.listingPricePerKG || 0);
    const quantity = parseFloat(listing.listingQuantityKG || 0);
    const productName = listing.listingProductName || 'Premium Swine Compost';
    
    // Get main image
    const mainImage = listing.listingProductImages && listing.listingProductImages.length > 0 
        ? listing.listingProductImages[0] 
        : null;
    
    card.innerHTML = `
        <div class="product-image">
            ${mainImage ? 
                `<img src="${mainImage}" 
                     alt="${productName}"
                     onerror="this.style.display='none'; this.parentElement.style.background='linear-gradient(45deg, ${badgeClass === 'hot' ? '#C44536, #e74c3c' : '#4A6741, #6B8E5F'})'; this.parentElement.innerHTML+='<div style=\\'display: flex; align-items: center; justify-content: center; height: 100%; font-size:48px;opacity:0.8\\'>🌱</div><span class=\\'product-badge ${badgeClass}\\'>${compostLabel}</span>'">` :
                `<div style="display: flex; align-items: center; justify-content: center; height: 100%; background: linear-gradient(45deg, ${badgeClass === 'hot' ? '#C44536, #e74c3c' : '#4A6741, #6B8E5F'}); font-size: 48px; opacity: 0.8;">🌱</div>`
            }
            <span class="product-badge ${badgeClass}">${compostLabel}</span>
        </div>
        <div class="product-info">
            <h3>${productName}</h3>
            <div class="seller-info">
                <span>👨‍🌾</span>
                <span class="seller-name">${sellerName}</span>
                <span class="seller-rating">⭐ ${sellerRating.toFixed(1)}</span>
            </div>
            <div class="product-details">
                <div class="detail-item">
                    <span>📍</span>
                    <span>${location}</span>
                </div>
                <div class="detail-item">
                    <span>📦</span>
                    <span>${quantity}kg available</span>
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
    // Quick filter tabs
    const filterTags = document.querySelectorAll('.tab-btn');
    filterTags.forEach(tag => {
        tag.addEventListener('click', function() {
            if (isLoading) return;
            
            filterTags.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            const filterText = this.textContent.trim();
            applyQuickFilter(filterText);
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
            }, 300); // Debounce search
        });
        
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                clearTimeout(searchTimeout);
                performSearch(e.target.value);
            }
        });
    }
}

function applyQuickFilter(filterText) {
    currentFilter = filterText;
    
    console.log('🔍 Applying filter:', filterText);
    
    if (filterText === 'All') {
        filteredListings = [...allListings];
    } else if (filterText === 'Basic Swine Manure') {
        filteredListings = allListings.filter(listing => {
            const technique = listing.compostTechnique || 'basic_swine_manure';
            return technique.toLowerCase().includes('basic') || 
                   technique.toLowerCase().includes('swine') ||
                   technique === 'basic_swine_manure';
        });
    } else if (filterText === 'Hot Composting') {
        filteredListings = allListings.filter(listing => {
            const technique = listing.compostTechnique || '';
            return technique.toLowerCase().includes('hot') ||
                   technique === 'hot_composting';
        });
    } else if (filterText === 'Nearby') {
        // For now, show all. Can implement location-based filtering later
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
            (listing.compostTechnique || '').toLowerCase().includes(term) ||
            (listing.listingLocation?.formattedAddress || '').toLowerCase().includes(term) ||
            (listing.listingLocation?.address || '').toLowerCase().includes(term) ||
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
    
    .product-badge {
        padding: 6px 12px;
        border-radius: 6px;
        font-weight: 600;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    
    .product-badge.basic {
        background: rgba(74, 103, 65, 0.9);
        color: white;
    }
    
    .product-badge.hot {
        background: rgba(196, 69, 54, 0.9);
        color: white;
    }
    
    .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
    }
`;
document.head.appendChild(style);

console.log('🐷✅ PigSoil+ Buyer Marketplace with REAL-TIME updates loaded!');