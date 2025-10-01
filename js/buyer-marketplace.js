// Buyer Marketplace functionality for PigSoil+ - Firebase Version with Loading States
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
    getDoc
} from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js';

const COLLECTIONS = {
    LISTINGS: 'listings',
    USERS: 'users'
};

let allListings = [];
let filteredListings = [];
let currentFilter = 'all';
let isLoading = false;

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
                <h3 style="font-size: 20px; margin-bottom: 8px; color: #333;">Loading listings...</h3>
                <p style="color: #666; font-size: 14px;">Please wait while we fetch available products</p>
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
    console.log('Buyer Marketplace initialized');
    
    // Show loading immediately
    showLoadingState();
    
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log('User authenticated:', user.uid);
            
            try {
                await loadListings();
                setupEventListeners();
            } catch (error) {
                console.error('Error initializing marketplace:', error);
                displayErrorState('Failed to load marketplace');
            }
        } else {
            console.log('No user authenticated, redirecting to login');
            window.location.href = '../html/login.html';
        }
    });
});

async function loadListings() {
    try {
        isLoading = true;
        showLoadingState();
        
        const listingsRef = collection(db, COLLECTIONS.LISTINGS);
        const q = query(
            listingsRef,
            where('listingIsActive', '==', true),
            orderBy('listingCreatedAt', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        
        allListings = [];
        
        // Fetch seller info for each listing
        const listingPromises = querySnapshot.docs.map(async (docSnap) => {
            const listing = { id: docSnap.id, ...docSnap.data() };
            
            try {
                const sellerDocRef = doc(db, COLLECTIONS.USERS, listing.farmerID);
                const sellerDoc = await getDoc(sellerDocRef);
                
                if (sellerDoc.exists()) {
                    listing.sellerInfo = sellerDoc.data();
                }
            } catch (error) {
                console.error('Error loading seller info:', error);
                listing.sellerInfo = null;
            }
            
            return listing;
        });
        
        allListings = await Promise.all(listingPromises);
        filteredListings = [...allListings];
        
        hideLoadingState();
        displayListings(filteredListings);
        
        console.log('Loaded', allListings.length, 'listings');
    } catch (error) {
        console.error('Error loading listings:', error);
        displayErrorState('Failed to load listings');
    } finally {
        isLoading = false;
    }
}

function displayListings(listings) {
    const productsGrid = document.getElementById('productsGrid');
    const emptyState = document.getElementById('emptyState');
    
    if (!productsGrid) return;
    
    if (listings.length === 0) {
        productsGrid.style.display = 'none';
        if (emptyState) {
            emptyState.style.display = 'flex';
            emptyState.innerHTML = `
                <div class="empty-icon">🔍</div>
                <h3>No products found</h3>
                <p>Try adjusting your filters or search terms</p>
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
}

function createProductCard(listing) {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.dataset.listingId = listing.id;
    card.style.opacity = '0';
    card.style.animation = 'fadeIn 0.3s forwards';
    
    const compostType = listing.compostType || 'Basic Swine Manure';
    const badgeClass = compostType.toLowerCase().includes('hot') ? 'hot' : '';
    const sellerName = listing.sellerInfo?.userName || 'Swine Farmer';
    const sellerRating = listing.sellerInfo?.sellerRating || 4.5;
    const location = listing.listingLocation || 'Cebu';
    const price = listing.listingPrice || 0;
    const quantity = listing.listingQuantity || '25kg';
    
    card.innerHTML = `
        <div class="product-image">
            <img src="${listing.listingImage || '../images/compost-basic.jpg'}" 
                 alt="${listing.listingTitle}"
                 onerror="this.style.display='none'; this.parentElement.style.background='linear-gradient(45deg, ${badgeClass ? '#C44536, #e74c3c' : '#4A6741, #6B8E5F'})'; this.parentElement.innerHTML+='<div style=\\'font-size:48px;opacity:0.8\\'>🌱</div>'">
            <span class="product-badge ${badgeClass}">${compostType}</span>
        </div>
        <div class="product-info">
            <h3>${listing.listingTitle || 'Organic Compost'}</h3>
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
                    <span>${quantity}</span>
                </div>
            </div>
            <div class="product-footer">
                <span class="price">₱${price.toFixed(2)}</span>
                <button class="btn-view" onclick="viewListing('${listing.id}')">View Details</button>
            </div>
        </div>
    `;
    
    return card;
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
    
    if (filterText === 'All') {
        filteredListings = [...allListings];
    } else if (filterText === 'Basic Swine Manure') {
        filteredListings = allListings.filter(listing => 
            (listing.compostType || '').toLowerCase().includes('basic')
        );
    } else if (filterText === 'Hot Composting') {
        filteredListings = allListings.filter(listing => 
            (listing.compostType || '').toLowerCase().includes('hot')
        );
    } else if (filterText === 'Nearby') {
        // For now, show all. Can implement location-based filtering later
        filteredListings = [...allListings];
    }
    
    displayListings(filteredListings);
}

function performSearch(searchTerm) {
    if (!searchTerm.trim()) {
        filteredListings = [...allListings];
        displayListings(filteredListings);
        return;
    }
    
    const term = searchTerm.toLowerCase();
    
    filteredListings = allListings.filter(listing => {
        return (
            (listing.listingTitle || '').toLowerCase().includes(term) ||
            (listing.listingDescription || '').toLowerCase().includes(term) ||
            (listing.compostType || '').toLowerCase().includes(term) ||
            (listing.listingLocation || '').toLowerCase().includes(term) ||
            (listing.sellerInfo?.userName || '').toLowerCase().includes(term)
        );
    });
    
    displayListings(filteredListings);
}

// Global function for view button
window.viewListing = function(listingId) {
    window.location.href = `listing-details.html?id=${listingId}`;
};

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
    
    .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
    }
`;
document.head.appendChild(style);

console.log('PigSoil+ Buyer Marketplace loaded!');