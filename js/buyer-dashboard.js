// Buyer Dashboard functionality for PigSoil+ - Firebase Version with Loading States
import { auth, db } from './init.js';   
import { 
    getCurrentUser, 
    getCurrentUserData, 
    getCachedProfilePic,
    onUserDataChange,
    DEFAULT_PROFILE_PIC 
} from './shared-user-manager.js';
import notificationManager from './notification-manager.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js';
import { 
    collection, 
    query, 
    where, 
    getDocs, 
    orderBy,
    limit,
    doc,
    getDoc
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
    USERS: 'users',
    TRANSACTIONS: 'transactions',
    LISTINGS: 'product_listings'
};

let currentUser = null;
let isLoading = false;

// Load cached user data for instant UI display
function loadCachedUserDataToUI() {
    try {
        const userData = getCurrentUserData();
        
        if (userData) {
            const userName = userData.userName || 'Buyer';
            const firstName = userName.split(' ')[0];
            const profilePicUrl = userData.userProfilePictureUrl || DEFAULT_PROFILE_PIC;
            
            // Update name elements
            const buyerNameElement = document.getElementById('buyerName');
            if (buyerNameElement) {
                buyerNameElement.textContent = userName;
            }
            
            const welcomeNameElement = document.getElementById('welcomeName');
            if (welcomeNameElement) {
                welcomeNameElement.textContent = firstName;
            }
            
            // Set avatar using background image (no initials fallback)
            const avatarElement = document.getElementById('buyerAvatar');
            if (avatarElement) {
                avatarElement.style.backgroundImage = `url(${profilePicUrl})`;
                avatarElement.style.backgroundSize = 'cover';
                avatarElement.style.backgroundPosition = 'center';
                avatarElement.style.backgroundRepeat = 'no-repeat';
                avatarElement.textContent = ''; // Clear any text content
            }
            
            console.log('✅ Loaded cached user data to UI:', userName);
        }
    } catch (error) {
        console.error('❌ Error loading cached user data:', error);
    }
}

// Show loading spinner
function showLoading(elementId) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    element.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px;">
            <div style="width: 50px; height: 50px; border: 4px solid #f3f3f3; border-top: 4px solid #4CAF50; border-radius: 50%; animation: spin 1s linear infinite;"></div>
            <p style="margin-top: 20px; color: #666; font-size: 14px;">Loading...</p>
        </div>
    `;
}

// Hide loading and show content
function hideLoading(elementId) {
    const element = document.getElementById(elementId);
    if (element && element.querySelector('[style*="animation: spin"]')) {
        element.innerHTML = '';
    }
}

document.addEventListener('DOMContentLoaded', async function() {
    console.log('Buyer Dashboard initialized');
    
    // Load cached data immediately for instant UI
    loadCachedUserDataToUI();
    
    // Show loading states immediately
    showLoading('transactionsList');
    
    // Initialize FCM and notification manager
    initializeFCM();
    
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log('User authenticated:', user.uid);
            isLoading = true;
            
            try {
                // Load all data
                await Promise.all([
                    loadUserData(user),
                    loadRecentTransactions()
                ]);
            } catch (error) {
                console.error('Error loading dashboard data:', error);
            } finally {
                isLoading = false;
            }
        } else {
            console.log('No user authenticated, redirecting to login');
            window.location.href = '/login.html';
        }
    });
});

// Listen for user data changes from shared manager
onUserDataChange(({ user, userData }) => {
    if (userData) {
        updateHeaderProfile(userData, user);
    }
});

// Initialize Firebase Cloud Messaging and Notification Manager
async function initializeFCM() {
    try {
        console.log('🔔 Initializing FCM for buyer dashboard...');
        
        // Wait for user to be authenticated
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                console.log('✅ User authenticated, initializing notification manager...');
                
                // Initialize notification manager (will check/update FCM token)
                const initialized = await notificationManager.initialize();
                
                if (initialized) {
                    console.log('✅ Notification manager initialized successfully');
                    
                    // Update notification badge if needed
                    updateNotificationBadge();
                    
                    // Listen for notification changes
                    notificationManager.addListener(() => {
                        updateNotificationBadge();
                    });
                } else {
                    console.warn('⚠️ Notification manager initialized with limited functionality');
                }
            } else {
                console.log('⚠️ No user authenticated, skipping FCM initialization');
            }
        });
    } catch (error) {
        console.error('❌ Error initializing FCM:', error);
    }
}

// Update notification badge with unread count
function updateNotificationBadge() {
    try {
        const notificationBtn = document.getElementById('notificationBtn');
        if (!notificationBtn) return;
        
        const unreadCount = notificationManager.getUnreadCount();
        
        // Remove existing badge if any
        const existingBadge = notificationBtn.querySelector('.notification-badge');
        if (existingBadge) {
            existingBadge.remove();
        }
        
        // Add badge if there are unread notifications
        if (unreadCount > 0) {
            const badge = document.createElement('span');
            badge.className = 'notification-badge';
            badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
            badge.style.cssText = `
                position: absolute;
                top: -4px;
                right: -4px;
                background: #ff4444;
                color: white;
                border-radius: 10px;
                padding: 2px 6px;
                font-size: 11px;
                font-weight: 600;
                min-width: 18px;
                text-align: center;
            `;
            
            // Make the button position relative if not already
            notificationBtn.style.position = 'relative';
            notificationBtn.appendChild(badge);
            
            console.log(`🔔 Updated notification badge: ${unreadCount} unread`);
        }
    } catch (error) {
        console.error('❌ Error updating notification badge:', error);
    }
}

// Load user profile using shared-user-manager
async function loadUserData(user) {
    const userData = getCurrentUserData();
    
    if (userData) {
        currentUser = userData;
        updateHeaderProfile(userData, user);
    } else {
        // Fallback if shared manager hasn't loaded yet
        try {
            const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, user.uid));
            if (userDoc.exists()) {
                currentUser = userDoc.data();
                updateHeaderProfile(currentUser, user);
            }
        } catch (error) {
            console.error('Error loading user profile:', error);
        }
    }
}

// Update header profile with data
function updateHeaderProfile(userData, user) {
    const userName = userData.userName || user?.displayName || 'Buyer';
    const firstName = userName.split(' ')[0];
    const profilePicUrl = userData.userProfilePictureUrl || user?.photoURL || DEFAULT_PROFILE_PIC;
    
    // Update name elements
    const buyerNameElement = document.getElementById('buyerName');
    if (buyerNameElement) {
        buyerNameElement.textContent = userName;
    }
    
    const welcomeNameElement = document.getElementById('welcomeName');
    if (welcomeNameElement) {
        welcomeNameElement.textContent = firstName;
    }
    
    // Set avatar using background image (no initials fallback)
    const avatarElement = document.getElementById('buyerAvatar');
    if (avatarElement) {
        avatarElement.style.backgroundImage = `url(${profilePicUrl})`;
        avatarElement.style.backgroundSize = 'cover';
        avatarElement.style.backgroundPosition = 'center';
        avatarElement.style.backgroundRepeat = 'no-repeat';
        avatarElement.textContent = ''; // Clear any text content
    }
    
    console.log('User data loaded:', userName);
}

async function loadRecentTransactions() {
    const transactionsList = document.getElementById('transactionsList');
    if (!transactionsList) return;
    
    try {
        if (!auth.currentUser) {
            displayEmptyTransactions();
            return;
        }
        
        showLoading('transactionsList');
        
        const transactionsRef = collection(db, COLLECTIONS.TRANSACTIONS);
        const q = query(
            transactionsRef,
            where('transactionBuyerID', '==', auth.currentUser.uid),
            orderBy('transactionOrderDate', 'desc'),
            limit(3)
        );
        
        const querySnapshot = await getDocs(q);
        
        hideLoading('transactionsList');
        
        if (querySnapshot.empty) {
            displayEmptyTransactions();
            return;
        }
        
        // Load enriched transaction data (with product and seller info)
        const transactions = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        loadTransactionDetails(transactions, transactionsList);
        
        console.log('Loaded', querySnapshot.size, 'recent transactions');
    } catch (error) {
        console.error('Error loading transactions:', error);
        hideLoading('transactionsList');
        displayErrorState('transactionsList', 'Failed to load transactions');
    }
}

// Load product and seller info for transactions (like Android version)
async function loadTransactionDetails(transactions, transactionsList) {
    transactionsList.innerHTML = '';
    
    const enrichedTransactions = [];
    
    for (const transaction of transactions) {
        try {
            const displayData = await loadProductAndSellerInfo(transaction);
            enrichedTransactions.push(displayData);
        } catch (error) {
            console.error('Error loading transaction details:', error);
            // Add with default values if loading fails
            enrichedTransactions.push({
                transaction: transaction,
                productName: 'Organic Fertilizer',
                sellerName: 'Unknown Seller',
                productImage: '/images/compost-basic.jpg'
            });
        }
    }
    
    // Display all enriched transactions
    enrichedTransactions.forEach(displayData => {
        const transactionCard = createTransactionCard(displayData);
        transactionsList.appendChild(transactionCard);
    });
}

// Load product and seller information
async function loadProductAndSellerInfo(transaction) {
    let productName = 'Organic Fertilizer';
    let sellerName = 'Unknown Seller';
    let productImage = '/images/compost-basic.jpg'; // Default image
    
    try {
        // Load product listing
        const listingRef = doc(db, COLLECTIONS.LISTINGS, transaction.transactionListingID);
        const listingDoc = await getDoc(listingRef);
        
        if (listingDoc.exists()) {
            const listingData = listingDoc.data();
            productName = listingData.listingProductName || productName;
            
            // Get first image from listingProductImages array
            if (listingData.listingProductImages && Array.isArray(listingData.listingProductImages) && listingData.listingProductImages.length > 0) {
                productImage = listingData.listingProductImages[0];
            }
        }
    } catch (error) {
        console.error('Error loading product:', error);
    }
    
    try {
        // Load seller info
        const sellerRef = doc(db, COLLECTIONS.USERS, transaction.transactionSellerID);
        const sellerDoc = await getDoc(sellerRef);
        
        if (sellerDoc.exists()) {
            sellerName = sellerDoc.data().userName || sellerName;
        }
    } catch (error) {
        console.error('Error loading seller:', error);
    }
    
    return {
        transaction: transaction,
        productName: productName,
        sellerName: sellerName,
        productImage: productImage
    };
}

function createTransactionCard(displayData) {
    const transaction = displayData.transaction;
    const card = document.createElement('div');
    card.className = 'transaction-card';
    
    const statusClass = getStatusClass(transaction.transactionStatus);
    const statusIcon = getStatusIcon(transaction.transactionStatus);
    const statusText = getStatusDisplayText(transaction.transactionStatus);
    
    // Format date
    const transactionDate = transaction.transactionOrderDate?.toDate ? 
        transaction.transactionOrderDate.toDate() : 
        new Date(transaction.transactionOrderDate);
    const dateFormatter = new Intl.DateTimeFormat('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
    });
    const formattedDate = dateFormatter.format(transactionDate);
    
    // Format amount
    const amount = transaction.transactionTotalAmount || 0;
    const formattedAmount = new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
    
    card.innerHTML = `
        <div class="transaction-image">
            <img src="${displayData.productImage}" 
                 alt="${displayData.productName}"
                 onerror="this.src='/images/compost-basic.jpg'">
        </div>
        <div class="transaction-details">
            <h4>${displayData.productName}</h4>
            <span class="seller-name">Swine Farmer: ${displayData.sellerName}</span>
            <div class="transaction-meta">
                <span class="price">${formattedAmount}</span>
                <span class="quantity">${formattedDate}</span>
            </div>
            <span class="status-badge ${statusClass}">${statusIcon} ${statusText}</span>
        </div>
    `;
    
    card.style.cursor = 'pointer';
    card.onclick = () => {
        // Navigate to transaction details (when implemented)
        console.log('View transaction:', transaction.id || transaction.transactionId);
        // window.location.href = `/transaction-details.html?id=${transaction.id}`;
    };
    
    return card;
}

function getStatusDisplayText(status) {
    const statusMap = {
        'contacted': 'Negotiating',
        'agreed': 'Agreed',
        'confirmed': 'Confirmed',
        'completed': 'Completed',
        'cancelled': 'Cancelled',
        'cancellation_requested': 'Cancelling'
    };
    
    return statusMap[status] || status.charAt(0).toUpperCase() + status.slice(1);
}

function getStatusClass(status) {
    const statusMap = {
        'completed': 'completed',
        'agreed': 'in-progress',
        'confirmed': 'in-progress',
        'contacted': 'pending',
        'cancelled': 'cancelled',
        'cancellation_requested': 'pending'
    };
    return statusMap[status] || 'pending';
}

function getStatusIcon(status) {
    const iconMap = {
        'completed': '✓',
        'agreed': '✓',
        'confirmed': '✓',
        'contacted': '�',
        'cancelled': '❌',
        'cancellation_requested': '⏳'
    };
    return iconMap[status] || '⏳';
}

function displayEmptyTransactions() {
    const transactionsList = document.getElementById('transactionsList');
    if (!transactionsList) return;
    
    transactionsList.innerHTML = `
        <div style="text-align: center; padding: 60px 20px; color: #666;">
            <div style="font-size: 60px; margin-bottom: 15px;">📦</div>
            <h3 style="margin-bottom: 10px; font-size: 18px; color: #333; font-weight: 600;">No transactions yet</h3>
            <p style="margin-bottom: 20px; font-size: 14px; line-height: 1.5;">Start browsing the marketplace to find quality organic fertilizer from swine farmers</p>
            <a href="/buyer-marketplace.html" style="display: inline-block; background: #4CAF50; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; transition: all 0.3s ease; box-shadow: 0 2px 8px rgba(76, 175, 80, 0.3);">
                Browse Marketplace
            </a>
        </div>
    `;
}

function displayErrorState(elementId, message) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    element.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: #666;">
            <div style="font-size: 60px; margin-bottom: 15px;">⚠️</div>
            <h3 style="margin-bottom: 10px; font-size: 18px; color: #333;">${message}</h3>
            <p style="margin-bottom: 20px; font-size: 14px;">Please refresh the page to try again</p>
            <button onclick="location.reload()" style="background: #4CAF50; color: white; padding: 12px 24px; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
                Refresh Page
            </button>
        </div>
    `;
}

// Add CSS for loading animation
const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);



console.log('PigSoil+ Buyer Dashboard loaded!');