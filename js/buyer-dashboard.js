// Buyer Dashboard functionality for PigSoil+ - Firebase Version
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

document.addEventListener('DOMContentLoaded', async function() {
    console.log('🏠 Buyer Dashboard initialized');
    
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log('✅ User authenticated:', user.uid);
            await loadUserData(user.uid);
            await loadRecentTransactions();
            await loadStats();
        } else {
            console.log('❌ No user authenticated, redirecting to login');
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
            
            console.log('👤 User data loaded:', currentUser);
        }
    } catch (error) {
        console.error('❌ Error loading user data:', error);
    }
}

async function loadRecentTransactions() {
    try {
        if (!auth.currentUser) return;
        
        const transactionsRef = collection(db, COLLECTIONS.TRANSACTIONS);
        const q = query(
            transactionsRef,
            where('buyerID', '==', auth.currentUser.uid),
            orderBy('transactionCreatedAt', 'desc'),
            limit(3)
        );
        
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            displayEmptyTransactions();
            return;
        }
        
        const transactionsList = document.getElementById('transactionsList');
        if (!transactionsList) return;
        
        transactionsList.innerHTML = '';
        
        querySnapshot.forEach((doc) => {
            const transaction = doc.data();
            const transactionCard = createTransactionCard(transaction);
            transactionsList.appendChild(transactionCard);
        });
        
        console.log('📊 Loaded', querySnapshot.size, 'recent transactions');
    } catch (error) {
        console.error('❌ Error loading transactions:', error);
        displayEmptyTransactions();
    }
}

function createTransactionCard(transaction) {
    const card = document.createElement('div');
    card.className = 'transaction-card';
    
    const statusClass = getStatusClass(transaction.transactionStatus);
    const statusIcon = getStatusIcon(transaction.transactionStatus);
    
    card.innerHTML = `
        <div class="transaction-image">
            <img src="${transaction.productImage || '../images/compost-placeholder.jpg'}" 
                 alt="${transaction.productName}"
                 onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22%3E%3Crect fill=%22%234A6741%22 width=%22100%22 height=%22100%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22white%22 font-size=%2214%22%3ECompost%3C/text%3E%3C/svg%3E'">
        </div>
        <div class="transaction-details">
            <h4>${transaction.productName || 'Compost Product'}</h4>
            <p class="seller-name">From: ${transaction.sellerName || 'Swine Farmer'}</p>
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
            <h3 style="margin-bottom: 10px;">No transactions yet</h3>
            <p style="margin-bottom: 20px;">Start browsing the marketplace to find quality organic fertilizer</p>
            <a href="buyer-marketplace.html" style="display: inline-block; background: #4A6741; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600;">
                Browse Marketplace
            </a>
        </div>
    `;
}

async function loadStats() {
    try {
        if (!auth.currentUser) return;
        
        const transactionsRef = collection(db, COLLECTIONS.TRANSACTIONS);
        const q = query(
            transactionsRef,
            where('buyerID', '==', auth.currentUser.uid)
        );
        
        const querySnapshot = await getDocs(q);
        
        let totalPurchases = 0;
        let completedPurchases = 0;
        let pendingPurchases = 0;
        
        querySnapshot.forEach((doc) => {
            const transaction = doc.data();
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
        
        console.log('📈 Stats loaded:', { totalPurchases, completedPurchases, pendingPurchases });
    } catch (error) {
        console.error('❌ Error loading stats:', error);
        updateStatElement('totalPurchases', 0);
        updateStatElement('completedPurchases', 0);
        updateStatElement('pendingPurchases', 0);
    }
}

function updateStatElement(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = value;
    }
}

const notificationBtn = document.getElementById('notificationBtn');
if (notificationBtn) {
    notificationBtn.addEventListener('click', function() {
        alert('Notifications feature coming soon!');
    });
}

console.log('🐷 PigSoil+ Buyer Dashboard loaded!');