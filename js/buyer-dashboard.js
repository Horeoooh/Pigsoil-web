// Buyer Dashboard functionality for PigSoil+ - Firebase Version with Loading States
import { auth, db } from './init.js';   
import '../js/shared-user-manager.js';
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

const COLLECTIONS = {
    USERS: 'users',
    TRANSACTIONS: 'transactions',
    LISTINGS: 'listings'
};

let currentUser = null;
let isLoading = false;

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
    
    // Show loading states immediately
    showLoading('transactionsList');
    
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log('User authenticated:', user.uid);
            isLoading = true;
            
            try {
                // Load all data
                await Promise.all([
                    loadUserData(user.uid),
                    loadRecentTransactions(),
                    loadStats()
                ]);
            } catch (error) {
                console.error('Error loading dashboard data:', error);
            } finally {
                isLoading = false;
            }
        } else {
            console.log('No user authenticated, redirecting to login');
            window.location.href = '../html/login.html';
        }
    });
});

async function loadUserData(userId) {
    try {
        const userDocRef = doc(db, COLLECTIONS.USERS, userId);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
            currentUser = userDoc.data();
            
            const buyerNameElement = document.getElementById('buyerName');
            if (buyerNameElement) {
                buyerNameElement.textContent = currentUser.userName || 'Buyer';
            }
            
            console.log('User data loaded:', currentUser);
        }
    } catch (error) {
        console.error('Error loading user data:', error);
    }
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
            where('buyerID', '==', auth.currentUser.uid),
            orderBy('transactionCreatedAt', 'desc'),
            limit(3)
        );
        
        const querySnapshot = await getDocs(q);
        
        hideLoading('transactionsList');
        
        if (querySnapshot.empty) {
            displayEmptyTransactions();
            return;
        }
        
        transactionsList.innerHTML = '';
        
        for (const docSnap of querySnapshot.docs) {
            const transaction = docSnap.data();
            const transactionCard = createTransactionCard(transaction);
            transactionsList.appendChild(transactionCard);
        }
        
        console.log('Loaded', querySnapshot.size, 'recent transactions');
    } catch (error) {
        console.error('Error loading transactions:', error);
        hideLoading('transactionsList');
        displayErrorState('transactionsList', 'Failed to load transactions');
    }
}

function createTransactionCard(transaction) {
    const card = document.createElement('div');
    card.className = 'transaction-card';
    
    const statusClass = getStatusClass(transaction.transactionStatus);
    const statusIcon = getStatusIcon(transaction.transactionStatus);
    
    card.innerHTML = `
        <div class="transaction-image">
            <img src="${transaction.productImage || '../images/compost-basic.jpg'}" 
                 alt="${transaction.productName}"
                 onerror="this.parentElement.innerHTML='🌱'">
        </div>
        <div class="transaction-details">
            <h4>${transaction.productName || 'Compost Product'}</h4>
            <span class="seller-name">From: ${transaction.sellerName || 'Swine Farmer'}</span>
            <div class="transaction-meta">
                <span class="price">₱${transaction.transactionAmount?.toFixed(2) || '0.00'}</span>
                <span class="quantity">${transaction.productQuantity || '25kg'}</span>
            </div>
            <span class="status-badge ${statusClass}">${statusIcon} ${transaction.transactionStatus || 'Pending'}</span>
        </div>
    `;
    
    card.onclick = () => {
        window.location.href = `transaction-details.html?id=${transaction.transactionID}`;
    };
    
    return card;
}

function getStatusClass(status) {
    const statusMap = {
        'Completed': 'completed',
        'Pending': 'pending',
        'In Progress': 'in-progress',
        'Cancelled': 'cancelled'
    };
    return statusMap[status] || 'pending';
}

function getStatusIcon(status) {
    const iconMap = {
        'Completed': '✓',
        'Pending': '⏳',
        'In Progress': '🚚',
        'Cancelled': '❌'
    };
    return iconMap[status] || '⏳';
}

function displayEmptyTransactions() {
    const transactionsList = document.getElementById('transactionsList');
    if (!transactionsList) return;
    
    transactionsList.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: #666;">
            <div style="font-size: 60px; margin-bottom: 15px;">📦</div>
            <h3 style="margin-bottom: 10px; font-size: 18px; color: #333;">No transactions yet</h3>
            <p style="margin-bottom: 20px; font-size: 14px;">Start browsing the marketplace to find quality organic fertilizer</p>
            <a href="buyer-marketplace.html" style="display: inline-block; background: #4CAF50; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; transition: background 0.3s;">
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

async function loadStats() {
    try {
        if (!auth.currentUser) {
            updateStatElement('totalPurchases', 0);
            updateStatElement('completedPurchases', 0);
            updateStatElement('pendingPurchases', 0);
            return;
        }
        
        const transactionsRef = collection(db, COLLECTIONS.TRANSACTIONS);
        const q = query(
            transactionsRef,
            where('buyerID', '==', auth.currentUser.uid)
        );
        
        const querySnapshot = await getDocs(q);
        
        let totalPurchases = 0;
        let completedPurchases = 0;
        let pendingPurchases = 0;
        
        querySnapshot.forEach((docSnap) => {
            const transaction = docSnap.data();
            totalPurchases++;
            
            if (transaction.transactionStatus === 'Completed') {
                completedPurchases++;
            } else if (transaction.transactionStatus === 'Pending' || transaction.transactionStatus === 'In Progress') {
                pendingPurchases++;
            }
        });
        
        updateStatElement('totalPurchases', totalPurchases);
        updateStatElement('completedPurchases', completedPurchases);
        updateStatElement('pendingPurchases', pendingPurchases);
        
        console.log('Stats loaded:', { totalPurchases, completedPurchases, pendingPurchases });
    } catch (error) {
        console.error('Error loading stats:', error);
        updateStatElement('totalPurchases', 0);
        updateStatElement('completedPurchases', 0);
        updateStatElement('pendingPurchases', 0);
    }
}

function updateStatElement(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        // Add animation
        element.style.opacity = '0';
        setTimeout(() => {
            element.textContent = value;
            element.style.transition = 'opacity 0.3s';
            element.style.opacity = '1';
        }, 100);
    }
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

const notificationBtn = document.getElementById('notificationBtn');
if (notificationBtn) {
    notificationBtn.addEventListener('click', function() {
        alert('Notifications feature coming soon!');
    });
}

console.log('PigSoil+ Buyer Dashboard loaded!');