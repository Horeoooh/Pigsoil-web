// Updated farmermarket.js - Firebase Integration for PigSoil+ 
// This replaces the existing JavaScript in farmermarket.html

// Import Firebase modules

import '../js/shared-user-manager.js';
import { auth, db, storage } from '../js/init.js';
import { 
    collection, 
    addDoc, 
    getDocs, 
    getDoc, 
    doc,
    query, 
    where, 
    orderBy, 
    limit,
    onSnapshot,
    serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js';

// Collection names matching your Firebase structure
const COLLECTIONS = {
    PRODUCT_LISTINGS: 'product_listings',
    USERS: 'users'
};

// Global variables
let currentUser = null;
let currentUserData = null;
let userListings = [];
let activeFilter = 'My Listings';

document.addEventListener('DOMContentLoaded', function() {
    console.log('🐷 PigSoil+ Farmer Market with Firebase integration loaded');
    
    // Initialize the application
    initializeApp();
});

function initializeApp() {
    // Check authentication first
    checkAuthState();
    
    // Set up event listeners
    setupNavigationHandlers();
    setupTabHandlers();
    setupSearchHandler();
    setupButtonHandlers();
    setupCardAnimations();
    
    console.log('✅ PigSoil+ Farmer Market initialized successfully!');
}

// Check authentication state
function checkAuthState() {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            showNotification('Please sign in to view your listings', 'error');
            setTimeout(() => {
                window.location.href = '../html/login.html';
            }, 2000);
            return;
        }
        
        currentUser = user;
        
        try {
            currentUserData = await getUserData(user.uid);
            
            // Update UI with user data
            updateUserProfile(currentUserData);
            
            // Load user's listings
            await loadUserListings();
            
            console.log('✅ User authenticated and listings loaded');
        } catch (error) {
            console.error('❌ Error loading user data:', error);
            showNotification('Error loading user data', 'error');
        }
    });
}

// Get user data from Firestore
async function getUserData(uid) {
    try {
        const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, uid));
        
        if (userDoc.exists()) {
            return userDoc.data();
        }
        
        // Return default data if user not found
        return {
            userName: currentUser.displayName || 'Swine Farmer',
            userEmail: currentUser.email,
            userType: 'swine_farmer'
        };
        
    } catch (error) {
        console.error('Error fetching user data:', error);
        throw error;
    }
}

// Update user profile in UI
function updateUserProfile(userData) {
    const userNameEl = document.querySelector('.user-name');
    const userRoleEl = document.querySelector('.user-role');
    const userAvatarEl = document.querySelector('.user-avatar');
    
    if (userNameEl) userNameEl.textContent = userData.userName || 'Swine Farmer';
    if (userRoleEl) userRoleEl.textContent = userData.userType === 'swine_farmer' ? 'Swine Farmer' : 'Active Farmer';
    
    if (userAvatarEl && userData.userName) {
        const initials = userData.userName.split(' ').map(name => name.charAt(0)).join('').substring(0, 2);
        userAvatarEl.textContent = initials.toUpperCase();
    }
}

// Load user's listings from Firestore
async function loadUserListings() {
    try {
        console.log('📦 Loading listings for user:', currentUser.uid);
        
        // Show loading state
        showLoadingState();
        
        // Query product_listings where listingSellerID matches current user
        const listingsRef = collection(db, COLLECTIONS.PRODUCT_LISTINGS);
        const q = query(
            listingsRef,
            where('listingSellerID', '==', currentUser.uid),
            orderBy('listingCreatedAt', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        userListings = [];
        
        querySnapshot.forEach((doc) => {
            const listingData = doc.data();
            userListings.push({
                id: doc.id,
                ...listingData
            });
        });
        
        console.log('✅ Found', userListings.length, 'listings for current user');
        
        // Display the listings
        displayListings(userListings);
        
        // Update hero section with stats
        updateHeroStats();
        
    } catch (error) {
        console.error('❌ Error loading listings:', error);
        showNotification('Error loading your listings: ' + error.message, 'error');
        hideLoadingState();
    }
}

// Display listings in the UI
function displayListings(listings) {
    const listingsGrid = document.querySelector('.listings-grid');
    const listingsSection = document.querySelector('.listings-section h2');
    
    if (!listingsGrid) {
        console.error('Listings grid not found');
        return;
    }
    
    // Hide loading state
    hideLoadingState();
    
    // Update section title based on active filter
    if (listingsSection) {
        listingsSection.textContent = getFilterTitle(activeFilter, listings.length);
    }
    
    if (listings.length === 0) {
        showEmptyState();
        return;
    }
    
    // Clear existing content
    listingsGrid.innerHTML = '';
    
    // Create listing cards
    listings.forEach((listing, index) => {
        const listingCard = createListingCard(listing, index);
        listingsGrid.appendChild(listingCard);
    });
    
    console.log('✅ Displayed', listings.length, 'listings');
}

// Create individual listing card
function createListingCard(listing, index) {
    const card = document.createElement('div');
    card.className = 'listing-card';
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    
    // Determine status
    const isAvailable = listing.listingIsAvailable;
    const statusClass = isAvailable ? 'active' : 'sold';
    const statusText = isAvailable ? 'Active' : 'Sold Out';
    
    // Format price
    const pricePerKg = parseFloat(listing.listingPricePerKG || 0);
    const quantity = parseFloat(listing.listingQuantityKG || 0);
    const totalPrice = parseFloat(listing.listingTotalPrice || 0);
    
    // Format dates
    const createdAt = listing.listingCreatedAt?.toDate ? 
        listing.listingCreatedAt.toDate() : 
        new Date(listing.listingCreatedAt || Date.now());
    
    const timeAgo = getTimeAgo(createdAt);
    
    // Get main image
    const mainImage = listing.listingProductImages && listing.listingProductImages.length > 0 
        ? listing.listingProductImages[0] 
        : null;
    
    card.innerHTML = `
        <div class="listing-image compost">
            <div class="status-badge ${statusClass}">${statusText}</div>
            ${mainImage ? 
                `<img src="${mainImage}" alt="${listing.listingProductName}" style="width: 100%; height: 100%; object-fit: cover;">` :
                '<div style="display: flex; align-items: center; justify-content: center; height: 100%; font-size: 48px;">🌱</div>'
            }
        </div>
        <div class="listing-details">
            <div class="listing-header">
                <h3 class="listing-title">${listing.listingProductName || 'Swine Compost'}</h3>
                <span class="listing-price">₱${pricePerKg.toFixed(2)}/kg</span>
            </div>
            <div class="listing-stats">
                <div class="stat-item">
                    <span class="stat-icon">📦</span>
                    <span>${quantity}kg ${isAvailable ? 'remaining' : 'total'}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-icon">${isAvailable ? '👁️' : '✅'}</span>
                    <span>${isAvailable ? 'Active listing' : 'Sold out'}</span>
                </div>
            </div>
            <div class="listing-meta">
                <div class="meta-item">
                    <span class="meta-icon">📅</span>
                    <span>Posted ${timeAgo}</span>
                </div>
                <div class="meta-item">
                    <span class="meta-icon">💰</span>
                    <span>₱${totalPrice.toFixed(2)} total</span>
                </div>
            </div>
            <button class="btn-view" onclick="viewListing('${listing.id}')">
                View Details
            </button>
        </div>
    `;
    
    // Animate in
    setTimeout(() => {
        card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
    }, index * 100);
    
    return card;
}

// Show empty state when no listings found
function showEmptyState() {
    const listingsGrid = document.querySelector('.listings-grid');
    
    let emptyMessage = '';
    let emptyIcon = '';
    let actionButton = '';
    
    switch(activeFilter) {
        case 'My Listings':
            emptyMessage = 'You haven\'t created any listings yet';
            emptyIcon = '📦';
            actionButton = '<a href="../html/CreateListing.html" class="btn-primary" style="margin-top: 16px; display: inline-block; text-decoration: none;">Create Your First Listing</a>';
            break;
        case 'Active':
            emptyMessage = 'No active listings found';
            emptyIcon = '🔍';
            actionButton = '<a href="../html/CreateListing.html" class="btn-primary" style="margin-top: 16px; display: inline-block; text-decoration: none;">Create New Listing</a>';
            break;
        case 'Sold':
            emptyMessage = 'No sold listings yet';
            emptyIcon = '💰';
            actionButton = '';
            break;
        case 'Nearby Buyers':
            emptyMessage = 'No nearby buyers found';
            emptyIcon = '🗺️';
            actionButton = '';
            break;
        default:
            emptyMessage = 'No listings found';
            emptyIcon = '📝';
    }
    
    listingsGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: #666;">
            <div style="font-size: 64px; margin-bottom: 16px; opacity: 0.5;">${emptyIcon}</div>
            <h3 style="margin-bottom: 8px; font-size: 18px;">${emptyMessage}</h3>
            <p style="color: #888; margin-bottom: 0;">Start selling your premium swine compost to the community</p>
            ${actionButton}
        </div>
    `;
}

// Show/hide loading state
function showLoadingState() {
    const listingsGrid = document.querySelector('.listings-grid');
    
    listingsGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px;">
            <div style="width: 50px; height: 50px; border: 4px solid #f3f3f3; border-top: 4px solid #4CAF50; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
            <p style="color: #666;">Loading your swine compost listings...</p>
        </div>
    `;
    
    // Add spin animation if not exists
    if (!document.querySelector('#loading-spin')) {
        const style = document.createElement('style');
        style.id = 'loading-spin';
        style.textContent = `
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }
}

function hideLoadingState() {
    // Loading state will be replaced by displayListings or showEmptyState
}

// Update hero section stats
function updateHeroStats() {
    const activeListings = userListings.filter(listing => listing.listingIsAvailable).length;
    const soldListings = userListings.filter(listing => !listing.listingIsAvailable).length;
    
    // You can add these stats to the hero section if needed
    console.log('📊 Stats - Active:', activeListings, 'Sold:', soldListings);
}

// Navigation Handlers
function setupNavigationHandlers() {
    const navLinks = document.querySelectorAll('.nav-menu a');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            // Let the browser handle navigation naturally
            console.log('Navigating to:', this.href);
        });
    });
}

// Tab Handlers with Firebase Integration
function setupTabHandlers() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Remove active class from all tabs
            tabButtons.forEach(btn => btn.classList.remove('active'));
            
            // Add active class to clicked tab
            this.classList.add('active');
            
            // Filter listings based on selected tab
            const tabName = this.textContent.trim();
            activeFilter = tabName;
            filterListings(tabName);
        });
    });
}

// Filter listings based on tab selection
function filterListings(filter) {
    let filteredListings = [];
    
    switch(filter) {
        case 'My Listings':
            filteredListings = userListings;
            break;
        case 'Active':
            filteredListings = userListings.filter(listing => listing.listingIsAvailable);
            break;
        case 'Sold':
            filteredListings = userListings.filter(listing => !listing.listingIsAvailable);
            break;
        case 'Nearby Buyers':
            // For now, show empty state - this would require buyer location data
            filteredListings = [];
            break;
        default:
            filteredListings = userListings;
    }
    
    displayListings(filteredListings);
    showNotification(`Showing ${getFilterTitle(filter, filteredListings.length)}`, 'info');
}

// Get filter title with count
function getFilterTitle(filter, count) {
    const titles = {
        'My Listings': `My Listings (${count})`,
        'Active': `Active Listings (${count})`,
        'Sold': `Sold Listings (${count})`,
        'Nearby Buyers': `Nearby Buyers (${count})`
    };
    
    return titles[filter] || `Listings (${count})`;
}

// Search Handler
function setupSearchHandler() {
    const searchInput = document.querySelector('.search-input');
    let searchTimeout;
    
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            
            searchTimeout = setTimeout(() => {
                const searchTerm = this.value.toLowerCase().trim();
                performSearch(searchTerm);
            }, 300);
        });
        
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                const searchTerm = this.value.toLowerCase().trim();
                performSearch(searchTerm);
            }
        });
    }
}

// Perform search on listings
function performSearch(searchTerm) {
    let baseListings = [];
    
    // Get base listings based on active filter
    switch(activeFilter) {
        case 'Active':
            baseListings = userListings.filter(listing => listing.listingIsAvailable);
            break;
        case 'Sold':
            baseListings = userListings.filter(listing => !listing.listingIsAvailable);
            break;
        case 'My Listings':
        default:
            baseListings = userListings;
            break;
    }
    
    if (searchTerm === '') {
        displayListings(baseListings);
        return;
    }
    
    // Filter listings based on search term
    const filteredListings = baseListings.filter(listing => {
        const title = (listing.listingProductName || '').toLowerCase();
        const description = (listing.listingDescription || '').toLowerCase();
        const price = listing.listingPricePerKG?.toString() || '';
        
        return title.includes(searchTerm) || 
               description.includes(searchTerm) || 
               price.includes(searchTerm);
    });
    
    displayListings(filteredListings);
    showNotification(`Found ${filteredListings.length} listing(s) matching "${searchTerm}"`, 'info');
}

// Button Handlers
function setupButtonHandlers() {
    // Add Listing Button
    const addListingBtn = document.querySelector('.btn-primary');
    if (addListingBtn) {
        addListingBtn.addEventListener('click', function() {
            showNotification('Opening Create Listing page...', 'info');
            // Let the browser handle the navigation
        });
    }
    
    // Messages Button
    const messagesBtn = document.querySelector('.messages-btn');
    if (messagesBtn) {
        messagesBtn.addEventListener('click', function() {
            handleMessages();
        });
    }
}

// Handle messages functionality
function handleMessages() {
    showNotification('Messages feature coming soon!', 'info');
    
    // Create messages modal placeholder
    const modal = createModal('Messages', `
        <div style="text-align: center; padding: 40px 20px; color: #666;">
            <div style="font-size: 48px; margin-bottom: 16px;">💬</div>
            <h3 style="margin-bottom: 8px;">Messages Coming Soon</h3>
            <p>Direct communication with organic fertilizer buyers will be available in the next update.</p>
            <div style="margin-top: 24px;">
                <button onclick="closeModal()" class="btn-primary">Got it</button>
            </div>
        </div>
    `);
}

// View listing details (global function)
window.viewListing = function(listingId) {
    const listing = userListings.find(l => l.id === listingId);
    
    if (!listing) {
        showNotification('Listing not found', 'error');
        return;
    }
    
    // Create detailed view modal
    const modal = createModal(listing.listingProductName || 'Swine Compost', `
        <div style="display: flex; flex-direction: column; gap: 20px;">
            ${listing.listingProductImages && listing.listingProductImages.length > 0 ? 
                `<div style="border-radius: 12px; overflow: hidden; max-height: 200px;">
                    <img src="${listing.listingProductImages[0]}" alt="${listing.listingProductName}" 
                         style="width: 100%; height: 200px; object-fit: cover;">
                </div>` : 
                `<div style="background: linear-gradient(45deg, #8B4513, #A0522D); border-radius: 12px; height: 200px; 
                           display: flex; align-items: center; justify-content: center; font-size: 64px;">🌱</div>`
            }
            
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin: 0; color: #333;">${listing.listingProductName || 'Swine Compost'}</h3>
                <span style="font-size: 24px; font-weight: 700; color: #4CAF50;">₱${parseFloat(listing.listingPricePerKG || 0).toFixed(2)}/kg</span>
            </div>
            
            <div style="padding: 10px 15px; background: ${listing.listingIsAvailable ? '#4CAF50' : '#e74c3c'}; 
                        color: white; border-radius: 20px; display: inline-block; width: fit-content; font-size: 12px; font-weight: 600;">
                ${listing.listingIsAvailable ? 'Available' : 'Sold Out'}
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px;">
                <div style="background: #f9f9f9; padding: 12px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 20px; font-weight: 600; color: #4CAF50;">${listing.listingQuantityKG || 0}kg</div>
                    <div style="font-size: 12px; color: #666;">Quantity</div>
                </div>
                <div style="background: #f9f9f9; padding: 12px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 20px; font-weight: 600; color: #4CAF50;">₱${parseFloat(listing.listingTotalPrice || 0).toFixed(2)}</div>
                    <div style="font-size: 12px; color: #666;">Total Value</div>
                </div>
            </div>
            
            ${listing.listingDescription ? 
                `<div>
                    <div style="font-weight: 600; color: #333; margin-bottom: 8px;">Description:</div>
                    <div style="color: #666; line-height: 1.5; background: #f9f9f9; padding: 12px; border-radius: 8px;">
                        ${listing.listingDescription}
                    </div>
                </div>` : ''
            }
            
            <div style="display: flex; gap: 12px; margin-top: 10px;">
                <button onclick="editListing('${listing.id}')" 
                        class="btn-primary" style="flex: 1; background: #4CAF50;">
                    Edit Listing
                </button>
                <button onclick="deleteListing('${listing.id}')" 
                        class="btn-primary" style="flex: 1; background: #e74c3c;">
                    Delete Listing
                </button>
            </div>
        </div>
    `);
};

// Card Animations
function setupCardAnimations() {
    // Intersection Observer for scroll animations
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });
    
    // Will observe cards as they're created
    window.cardObserver = observer;
}

// Utility Functions
function getTimeAgo(date) {
    const now = new Date();
    const diff = now - date;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
}

function createModal(title, content) {
    // Remove existing modal if any
    const existingModal = document.querySelector('.modal-overlay');
    if (existingModal) {
        existingModal.remove();
    }
    
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay';
    modalOverlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
        background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; 
        justify-content: center; z-index: 1000; backdrop-filter: blur(5px);
    `;
    
    const modal = document.createElement('div');
    modal.style.cssText = `
        background: white; border-radius: 20px; padding: 30px; 
        max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto; 
        position: relative; animation: modalSlideIn 0.3s ease;
    `;
    
    modal.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2 style="margin: 0; color: #333;">${title}</h2>
            <button onclick="closeModal()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666;">×</button>
        </div>
        ${content}
    `;
    
    modalOverlay.appendChild(modal);
    document.body.appendChild(modalOverlay);
    
    // Close modal when clicking overlay
    modalOverlay.addEventListener('click', function(e) {
        if (e.target === modalOverlay) {
            closeModal();
        }
    });
    
    // Add CSS animation
    if (!document.querySelector('#modal-animations')) {
        const style = document.createElement('style');
        style.id = 'modal-animations';
        style.textContent = `
            @keyframes modalSlideIn {
                from { opacity: 0; transform: translateY(-50px) scale(0.9); }
                to { opacity: 1; transform: translateY(0) scale(1); }
            }
        `;
        document.head.appendChild(style);
    }
    
    return modal;
}

function closeModal() {
    const modal = document.querySelector('.modal-overlay');
    if (modal) {
        modal.style.animation = 'modalSlideOut 0.3s ease';
        setTimeout(() => {
            modal.remove();
        }, 300);
    }
}

function showNotification(message, type = 'info') {
    // Remove existing notification
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = 'notification';
    
    const colors = {
        success: '#4CAF50',
        error: '#e74c3c',
        info: '#2196F3',
        warning: '#ff9800'
    };
    
    notification.style.cssText = `
        position: fixed; top: 20px; right: 20px; background: ${colors[type]}; 
        color: white; padding: 15px 25px; border-radius: 10px; 
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15); z-index: 1001; 
        font-weight: 600; max-width: 350px; transform: translateX(100%); 
        transition: transform 0.3s ease;
    `;
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Auto remove notification
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 300);
    }, 4000);
}

// Global functions for modal actions
window.closeModal = closeModal;

window.editListing = function(listingId) {
    closeModal();
    showNotification('Edit functionality coming soon!', 'info');
    // You can implement edit functionality here
};

window.deleteListing = function(listingId) {
    if (confirm('Are you sure you want to delete this listing?')) {
        // Implement delete functionality here
        showNotification('Delete functionality coming soon!', 'info');
        closeModal();
    }
};

console.log('🐷 PigSoil+ Farmer Market with Firebase integration fully loaded!');