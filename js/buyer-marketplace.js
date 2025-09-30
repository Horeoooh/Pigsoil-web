// Buyer Marketplace functionality for PigSoil+ - Firebase Version
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

document.addEventListener('DOMContentLoaded', async function() {
    console.log('🏪 Buyer Marketplace initialized');
    
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log('✅ User authenticated:', user.uid);
            await loadListings();
            setupEventListeners();
        } else {
            console.log('❌ No user authenticated, redirecting to login');
            window.location.href = '../html/login.html';
        }
    });
});

async function loadListings() {
    try {
        const listingsRef = collection(db, COLLECTIONS.LISTINGS);
        const q = query(
            listingsRef,
            where('listingIsActive', '==', true),
            orderBy('listingCreatedAt', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        
        allListings = [];
        
        for (const docSnap of querySnapshot.docs) {
            const listing = { id: docSnap.id, ...docSnap.data() };
            
            try {
                const sellerDocRef = doc(db, COLLECTIONS.USERS, listing.farmerID);
                const sellerDoc = await getDoc(sellerDocRef);
                
                if (sellerDoc.exists()) {
                    listing.sellerInfo = sellerDoc.data();
                }
            } catch (error) {
                console.error('Error loading seller info:', error);
            }
            
            allListings.push(listing);
        }
        
        filteredListings = [...allListings];
        displayListings(filteredListings);
        
        console.log('📦 Loaded', allListings.length, 'listings');
    } catch (error) {
        console.error('❌ Error loading listings:', error);
        displayEmptyState();
    }
}

function displayListings(listings) {
    const productsGrid = document.getElementById('productsGrid');
    const emptyState = document.getElementById('emptyState');
    
    if (!productsGrid) return;
    
    if (listings.length === 0) {
        productsGrid.style.display = 'none';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }
    
    productsGrid.style.display = 'grid';
    if (emptyState) emptyState.style.display = 'none';
    
    productsGrid.innerHTML = '';
    
    listings.forEach(listing => {
        const card = createProductCard(listing);
        productsGrid.appendChild(card);
    });
}

function createProductCard(listing) {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.dataset.listingId = listing.id;
    
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
                 onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22%3E%3Crect fill=%22%23${badgeClass ? 'C44536' : '4A6741'}%22 width=%22200%22 height=%22200%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22white%22 font-size=%2220%22%3ECompost%3C/text%3E%3C/svg%3E'">
            <span class="product-badge ${badgeClass}">${compostType}</span>
        </div>
        <div class="product-info">
            <h3>${listing.listingTitle || 'Organic Compost'}</h3>
            <div class="seller-info">
                <span class="seller-icon">👨‍🌾</span>
                <span class="seller-name">${sellerName}</span>
                <span class="seller-rating">⭐ ${sellerRating.toFixed(1)}</span>
            </div>
            <div class="product-details">
                <span class="location">📍 ${location}</span>
                <span class="quantity">${quantity}</span>
            </div>
            <div class="product-footer">
                <span class="price">₱${price.toFixed(2)}</span>
                <button class="btn-view" onclick="viewListing('${listing.id}')">View Details</button>
            </div>
        </div>
    `;
    
    return card;
}

function displayEmptyState() {
    const productsGrid = document.getElementById('productsGrid');
    const emptyState = document.getElementById('emptyState');
    
    if (productsGrid) productsGrid.style.display = 'none';
    if (emptyState) emptyState.style.display = 'block';
}

function setupEventListeners() {
    const filterBtn = document.getElementById('filterBtn');
    const filterModal = document.getElementById('filterModal');
    const closeFilter = document.getElementById('closeFilter');
    const applyFilters = document.getElementById('applyFilters');
    const clearFilters = document.getElementById('clearFilters');
    
    if (filterBtn) {
        filterBtn.addEventListener('click', () => {
            if (filterModal) filterModal.classList.add('active');
        });
    }
    
    if (closeFilter) {
        closeFilter.addEventListener('click', () => {
            if (filterModal) filterModal.classList.remove('active');
        });
    }
    
    if (filterModal) {
        filterModal.addEventListener('click', (e) => {
            if (e.target === filterModal) {
                filterModal.classList.remove('active');
            }
        });
    }
    
    if (applyFilters) {
        applyFilters.addEventListener('click', applyAdvancedFilters);
    }
    
    if (clearFilters) {
        clearFilters.addEventListener('click', () => {
            document.getElementById('compostTypeFilter').value = 'all';
            document.getElementById('minPrice').value = '';
            document.getElementById('maxPrice').value = '';
            document.getElementById('locationFilter').value = '';
            document.getElementById('sortBy').value = 'recent';
            
            filteredListings = [...allListings];
            displayListings(filteredListings);
            
            if (filterModal) filterModal.classList.remove('active');
        });
    }
    
    const filterTags = document.querySelectorAll('.filter-tag');
    filterTags.forEach(tag => {
        tag.addEventListener('click', function() {
            filterTags.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            const filter = this.dataset.filter;
            applyQuickFilter(filter);
        });
    });
    
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.querySelector('.search-btn');
    
    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            if (searchInput) performSearch(searchInput.value);
        });
    }
    
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                performSearch(searchInput.value);
            }
        });
    }
}

function applyQuickFilter(filter) {
    currentFilter = filter;
    
    if (filter === 'all') {
        filteredListings = [...allListings];
    } else if (filter === 'basic') {
        filteredListings = allListings.filter(listing => 
            (listing.compostType || '').toLowerCase().includes('basic')
        );
    } else if (filter === 'hot') {
        filteredListings = allListings.filter(listing => 
            (listing.compostType || '').toLowerCase().includes('hot')
        );
    } else if (filter === 'nearby') {
        filteredListings = [...allListings];
    }
    
    displayListings(filteredListings);
}

function applyAdvancedFilters() {
    const compostType = document.getElementById('compostTypeFilter').value;
    const minPrice = parseFloat(document.getElementById('minPrice').value) || 0;
    const maxPrice = parseFloat(document.getElementById('maxPrice').value) || Infinity;
    const location = document.getElementById('locationFilter').value.toLowerCase();
    const sortBy = document.getElementById('sortBy').value;
    
    filteredListings = allListings.filter(listing => {
        let matches = true;
        
        if (compostType !== 'all') {
            matches = matches && (listing.compostType || '').toLowerCase().includes(compostType);
        }
        
        const price = listing.listingPrice || 0;
        matches = matches && price >= minPrice && price <= maxPrice;
        
        if (location) {
            matches = matches && (listing.listingLocation || '').toLowerCase().includes(location);
        }
        
        return matches;
    });
    
    if (sortBy === 'price-low') {
        filteredListings.sort((a, b) => (a.listingPrice || 0) - (b.listingPrice || 0));
    } else if (sortBy === 'price-high') {
        filteredListings.sort((a, b) => (b.listingPrice || 0) - (a.listingPrice || 0));
    } else if (sortBy === 'rating') {
        filteredListings.sort((a, b) => {
            const ratingA = a.sellerInfo?.sellerRating || 0;
            const ratingB = b.sellerInfo?.sellerRating || 0;
            return ratingB - ratingA;
        });
    }
    
    displayListings(filteredListings);
    
    const filterModal = document.getElementById('filterModal');
    if (filterModal) filterModal.classList.remove('active');
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

window.viewListing = function(listingId) {
    window.location.href = `listing-details.html?id=${listingId}`;
};

console.log('🐷 PigSoil+ Buyer Marketplace loaded!');