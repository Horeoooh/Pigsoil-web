// Buyer Transactions functionality for PigSoil+ - Firebase Version
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
    updateDoc,
    serverTimestamp,
    getDoc
} from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js';

const COLLECTIONS = {
    TRANSACTIONS: 'transactions',
    USERS: 'users'
};

let allTransactions = [];
let filteredTransactions = [];
let currentFilter = 'all';

document.addEventListener('DOMContentLoaded', async function() {
    console.log('💰 Buyer Transactions initialized');
    
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log('✅ User authenticated:', user.uid);
            await loadTransactions();
            setupEventListeners();
        } else {
            console.log('❌ No user authenticated, redirecting to login');
            window.location.href = '../html/login.html';
        }
    });
});

async function loadTransactions() {
    try {
        if (!auth.currentUser) return;
        
        const transactionsRef = collection(db, COLLECTIONS.TRANSACTIONS);
        const q = query(
            transactionsRef,
            where('buyerID', '==', auth.currentUser.uid),
            orderBy('transactionCreatedAt', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        
        allTransactions = [];
        
        for (const docSnap of querySnapshot.docs) {
            const transaction = { id: docSnap.id, ...docSnap.data() };
            
            try {
                const sellerDocRef = doc(db, COLLECTIONS.USERS, transaction.sellerID);
                const sellerDoc = await getDoc(sellerDocRef);
                
                if (sellerDoc.exists()) {
                    transaction.sellerInfo = sellerDoc.data();
                }
            } catch (error) {
                console.error('Error loading seller info:', error);
            }
            
            allTransactions.push(transaction);
        }
        
        filteredTransactions = [...allTransactions];
        displayTransactions(filteredTransactions);
        
        console.log('📦 Loaded', allTransactions.length, 'transactions');
    } catch (error) {
        console.error('❌ Error loading transactions:', error);
        displayEmptyState();
    }
}

function displayTransactions(transactions) {
    const container = document.getElementById('transactionsContainer');
    const emptyState = document.getElementById('emptyState');
    
    if (!container) return;
    
    if (transactions.length === 0) {
        container.style.display = 'none';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }
    
    container.style.display = 'block';
    if (emptyState) emptyState.style.display = 'none';
    
    container.innerHTML = '';
    
    transactions.forEach(transaction => {
        const card = createTransactionCard(transaction);
        container.appendChild(card);
    });
}

function createTransactionCard(transaction) {
    const card = document.createElement('div');
    card.className = 'transaction-card';
    card.dataset.status = getStatusValue(transaction.transactionStatus);
    card.dataset.id = transaction.transactionID || transaction.id;
    
    const statusClass = getStatusClass(transaction.transactionStatus);
    const statusIcon = getStatusIcon(transaction.transactionStatus);
    const date = formatDate(transaction.transactionCreatedAt);
    const sellerName = transaction.sellerInfo?.userName || 'Swine Farmer';
    const sellerRating = transaction.sellerInfo?.sellerRating || 4.5;
    
    card.innerHTML = `
        <div class="transaction-header">
            <div class="transaction-id">
                <span class="id-label">#${transaction.transactionID || transaction.id}</span>
                <span class="status-badge ${statusClass}">${statusIcon} ${transaction.transactionStatus || 'Pending'}</span>
            </div>
            <span class="transaction-date">${date}</span>
        </div>

        <div class="transaction-body">
            <div class="product-image">
                <img src="${transaction.productImage || '../images/compost-basic.jpg'}" 
                     alt="${transaction.productName}"
                     onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22%3E%3Crect fill=%22%234A6741%22 width=%22100%22 height=%22100%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22white%22 font-size=%2214%22%3ECompost%3C/text%3E%3C/svg%3E'">
            </div>
            <div class="transaction-details">
                <h3>${transaction.productName || 'Organic Compost'}</h3>
                <p class="seller-info">
                    <span class="seller-icon">👨‍🌾</span>
                    From: <strong>${sellerName}</strong>
                    <span class="seller-rating">⭐ ${sellerRating.toFixed(1)}</span>
                </p>
                <div class="transaction-meta">
                    <span class="location">📍 ${transaction.meetupLocation || 'Cebu'}</span>
                    <span class="quantity">${transaction.productQuantity || '25kg'}</span>
                </div>
                <div class="price-info">
                    <span class="price-label">Total Payment:</span>
                    <span class="price">₱${transaction.transactionAmount?.toFixed(2) || '0.00'}</span>
                </div>
                ${transaction.transactionStatus === 'In Progress' && transaction.meetupSchedule ? `
                <div class="progress-info">
                    <p><strong>Scheduled Meet-up:</strong> ${formatDateTime(transaction.meetupSchedule)}</p>
                </div>
                ` : ''}
            </div>
        </div>

        <div class="transaction-actions">
            <button class="btn-secondary" onclick="messageSellerBuyer('${transaction.id}')">
                <span>💬</span> Message Seller
            </button>
            ${getActionButton(transaction)}
        </div>
    `;
    
    return card;
}

function getActionButton(transaction) {
    const status = transaction.transactionStatus;
    const transactionId = transaction.transactionID || transaction.id;
    
    if (status === 'Pending') {
        return `<button class="btn-danger" onclick="cancelOrder('${transactionId}')">
                    <span>❌</span> Cancel Order
                </button>`;
    } else if (status === 'Completed') {
        return `<button class="btn-primary" onclick="viewTransactionDetails('${transactionId}')">
                    View Details
                </button>`;
    } else {
        return `<button class="btn-primary" onclick="viewTransactionDetails('${transactionId}')">
                    View Details
                </button>`;
    }
}

function getStatusValue(status) {
    const statusMap = {
        'Completed': 'completed',
        'Pending': 'pending',
        'In Progress': 'in-progress',
        'Cancelled': 'cancelled'
    };
    return statusMap[status] || 'pending';
}

function getStatusClass(status) {
    return getStatusValue(status);
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

function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

function formatDateTime(timestamp) {
    if (!timestamp) return 'N/A';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const options = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
    return date.toLocaleDateString('en-US', options);
}

function displayEmptyState() {
    const container = document.getElementById('transactionsContainer');
    const emptyState = document.getElementById('emptyState');
    
    if (container) container.style.display = 'none';
    if (emptyState) emptyState.style.display = 'block';
}

function setupEventListeners() {
    const filterTabs = document.querySelectorAll('.filter-tab');
    filterTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            filterTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            const filter = this.dataset.filter;
            applyFilter(filter);
        });
    });
}

function applyFilter(filter) {
    currentFilter = filter;
    
    if (filter === 'all') {
        filteredTransactions = [...allTransactions];
    } else {
        filteredTransactions = allTransactions.filter(transaction => {
            const status = getStatusValue(transaction.transactionStatus);
            return status === filter;
        });
    }
    
    displayTransactions(filteredTransactions);
}

window.messageSellerBuyer = function(transactionId) {
    alert('Messaging feature coming soon!');
};

window.viewTransactionDetails = function(transactionId) {
    window.location.href = `transaction-details.html?id=${transactionId}`;
};

window.cancelOrder = async function(transactionId) {
    const confirmed = confirm('Are you sure you want to cancel this order?');
    
    if (!confirmed) return;
    
    try {
        const transactionRef = doc(db, COLLECTIONS.TRANSACTIONS, transactionId);
        await updateDoc(transactionRef, {
            transactionStatus: 'Cancelled',
            transactionUpdatedAt: serverTimestamp()
        });
        
        alert('Order cancelled successfully!');
        await loadTransactions();
    } catch (error) {
        console.error('❌ Error cancelling order:', error);
        alert('Failed to cancel order. Please try again.');
    }
};

console.log('🐷 PigSoil+ Buyer Transactions loaded!');