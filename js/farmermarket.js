// Updated farmermarket.js - Firebase Integration with Loading States
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

const COLLECTIONS = {
    PRODUCT_LISTINGS: 'product_listings',
    USERS: 'users'
};

let currentUser = null;
let currentUserData = null;
let userListings = [];
let activeFilter = 'My Listings';
let isLoading = false;

document.addEventListener('DOMContentLoaded', function() {
    console.log('PigSoil+ Farmer Market initialized');
    
    // Show loading immediately
    showLoadingState();
    
    initializeApp();
});

function initializeApp() {
    checkAuthState();
    setupNavigationHandlers();
    setupTabHandlers();
    setupSearchHandler();
    setupButtonHandlers();
    setupCardAnimations();
    
    console.log('Farmer Market initialized successfully');
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
        isLoading = true;
        
        try {
            currentUserData = await getUserData(user.uid);
            updateUserProfile(currentUserData);
            await loadUserListings();
            
            console.log('User authenticated and listings loaded');
        } catch (error) {
            console.error('Error loading user data:', error);
            showNotification('Error loading user data', 'error');
            hideLoadingState();
        } finally {
            isLoading = false;
        }
    });
}

async function getUserData(uid) {
    try {
        const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, uid));
        
        if (userDoc.exists()) {
            return userDoc.data();
        }
        
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

function updateUserProfile(userData) {
    const userNameEl = document.querySelector('.user-name');
    const userRoleEl = document.querySelector('.user-role');
    const userAvatarEl = document.querySelector('.user-avatar');
    
    if (userNameEl) userNameEl.textContent = userData.userName || 'Swine Farmer';
    if (userRoleEl) userRoleEl.textContent = userData.userType === 'swine_farmer' ? 'Active Farmer' : 'Active Farmer';
    
    if (userAvatarEl && userData.userName) {
        const initials = userData.userName.split(' ').map(name => name.charAt(0)).join('').substring(0, 2);
        userAvatarEl.textContent = initials.toUpperCase();
    }
}

async function loadUserListings() {
    try {
        console.log('Loading listings for user:', currentUser.uid);
        
        showLoadingState();
        
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
        
        console.log('Found', userListings.length, 'listings');
        
        hideLoadingState();
        displayListings(userListings);
        updateHeroStats();
        
    } catch (error) {
        console.error('Error loading listings:', error);
        showNotification('Error loading your listings: ' + error.message, 'error');
        hideLoadingState();
        showEmptyState();
    }
}

function displayListings(listings) {
    const listingsGrid = document.querySelector('.listings-grid');
    const listingsSection = document.querySelector('.listings-section h2');
    
    if (!listingsGrid) {
        console.error('Listings grid not found');
        return;
    }
    
    hideLoadingState();
    
    if (listingsSection) {
        listingsSection.textContent = getFilterTitle(activeFilter, listings.length);
    }
    
    if (listings.length === 0) {
        showEmptyState();
        return;
    }
    
    // Smooth transition
    listingsGrid.style.opacity = '0';
    listingsGrid.innerHTML = '';
    
    listings.forEach((listing, index) => {
        const listingCard = createListingCard(listing, index);
        setTimeout(() => {
            listingsGrid.appendChild(listingCard);
        }, index * 50);
    });
    
    setTimeout(() => {
        listingsGrid.style.transition = 'opacity 0.3s';
        listingsGrid.style.opacity = '1';
    }, 100);
    
    console.log('Displayed', listings.length, 'listings');
}

function createListingCard(listing, index) {
    const card = document.createElement('div');
    card.className = 'listing-card';
    card.style.opacity = '0';
    card.style.animation = 'fadeIn 0.5s forwards';
    card.style.animationDelay = `${index * 0.05}s`;
    
    const isAvailable = listing.listingIsAvailable;
    const statusClass = isAvailable ? 'active' : 'sold';
    const statusText = isAvailable ? 'Active' : 'Sold Out';
    
    const pricePerKg = parseFloat(listing.listingPricePerKG || 0);
    const quantity = parseFloat(listing.listingQuantityKG || 0);
    const totalPrice = parseFloat(listing.listingTotalPrice || 0);
    
    const createdAt = listing.listingCreatedAt?.toDate ? 
        listing.listingCreatedAt.toDate() : 
        new Date(listing.listingCreatedAt || Date.now());
    
    const timeAgo = getTimeAgo(createdAt);
    
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
            <a href="../html/View.html?id=${listing.id}" class="btn-view">View Details</a>
        </div>
    `;
    
    return card;
}

function showEmptyState() {
    const listingsGrid = document.querySelector('.listings-grid');
    
    let emptyMessage = '';
    let emptyIcon = '';
    let actionButton = '';
    
    switch(activeFilter) {
        case 'My Listings':
            emptyMessage = 'You haven\'t created any listings yet';
            emptyIcon = '📦';
            actionButton = '<a href="../html/CreateListing.html" class="btn-primary" style="margin-top: 16px; display: inline-block; text-decoration: none; padding: 12px 24px; background: #4CAF50; color: white; border-radius: 8px; font-weight: 600;">Create Your First Listing</a>';
            break;
        case 'Active':
            emptyMessage = 'No active listings found';
            emptyIcon = '🔍';
            actionButton = '<a href="../html/CreateListing.html" class="btn-primary" style="margin-top: 16px; display: inline-block; text-decoration: none; padding: 12px 24px; background: #4CAF50; color: white; border-radius: 8px; font-weight: 600;">Create New Listing</a>';
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

function showLoadingState() {
    const listingsGrid = document.querySelector('.listings-grid');
    
    if (listingsGrid) {
        listingsGrid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px;">
                <div style="width: 50px; height: 50px; border: 4px solid #f3f3f3; border-top: 4px solid #4CAF50; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
                <p style="color: #666;">Loading your swine compost listings...</p>
            </div>
        `;
    }
}

function hideLoadingState() {
    // Will be replaced by displayListings or showEmptyState
}

function updateHeroStats() {
    const activeListings = userListings.filter(listing => listing.listingIsAvailable).length;
    const soldListings = userListings.filter(listing => !listing.listingIsAvailable).length;
    
    console.log('Stats - Active:', activeListings, 'Sold:', soldListings);
}

function setupNavigationHandlers() {
    const navLinks = document.querySelectorAll('.nav-menu a');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            console.log('Navigating to:', this.href);
        });
    });
}

function setupTabHandlers() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            if (isLoading) return;
            
            tabButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            const tabName = this.textContent.trim();
            activeFilter = tabName;
            filterListings(tabName);
        });
    });
}

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
            filteredListings = [];
            break;
        default:
            filteredListings = userListings;
    }
    
    displayListings(filteredListings);
    showNotification(`Showing ${getFilterTitle(filter, filteredListings.length)}`, 'info');
}

function getFilterTitle(filter, count) {
    const titles = {
        'My Listings': `My Listings (${count})`,
        'Active': `Active Listings (${count})`,
        'Sold': `Sold Listings (${count})`,
        'Nearby Buyers': `Nearby Buyers (${count})`
    };
    
    return titles[filter] || `Listings (${count})`;
}

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

function performSearch(searchTerm) {
    let baseListings = [];
    
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

function setupButtonHandlers() {
    const messagesBtn = document.querySelector('.messages-btn');
    if (messagesBtn) {
        messagesBtn.addEventListener('click', function() {
            showNotification('Messages feature coming soon!', 'info');
        });
    }
}

function setupCardAnimations() {
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
    
    window.cardObserver = observer;
}

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

function showNotification(message, type = 'info') {
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
    
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 300);
    }, 4000);
}

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

console.log('PigSoil+ Farmer Market fully loaded!');