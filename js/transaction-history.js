// transaction-history.js - Handles seller-specific transaction history
import { auth, db } from './init.js';
import { DEFAULT_PROFILE_PIC } from './shared-user-manager.js';
import { 
    collection, 
    query, 
    where, 
    getDocs, 
    orderBy, 
    doc, 
    getDoc
} from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js';

// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const sellerId = urlParams.get('seller');
const sellerName = urlParams.get('name') || 'Seller';

// State
let currentUserId = null;
let transactions = [];

// Initialize
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUserId = user.uid;
        
        if (!sellerId) {
            alert('Invalid seller information');
            window.history.back();
            return;
        }

        document.getElementById('sellerName').textContent = decodeURIComponent(sellerName);
        await loadTransactionHistory();
    } else {
        window.location.href = '/login.html';
    }
});

// Back button
document.getElementById('backBtn').addEventListener('click', () => {
    window.history.back();
});

// Message seller button
document.getElementById('messageSellerBtn').addEventListener('click', () => {
    // Find conversation with this seller
    window.location.href = `/messages.html?seller=${sellerId}`;
});

// Load transaction history with this specific seller
async function loadTransactionHistory() {
    showLoading(true);

    try {
        // Get all transactions where current user is buyer
        const transactionsRef = collection(db, 'transactions');
        const q = query(
            transactionsRef,
            where('transactionBuyerID', '==', currentUserId),
            orderBy('transactionOrderDate', 'desc')
        );

        const snapshot = await getDocs(q);
        
        // Filter transactions with this specific seller
        const allTransactions = [];
        
        for (const docSnap of snapshot.docs) {
            const transactionData = { id: docSnap.id, ...docSnap.data() };
            
            if (transactionData.transactionSellerID === sellerId) {
                // Load product name for this transaction
                const productName = await loadProductName(transactionData.transactionListingID);
                allTransactions.push({
                    ...transactionData,
                    productName
                });
            }
        }

        transactions = allTransactions;
        console.log(`Found ${transactions.length} transactions with seller ${sellerId}`);

        if (transactions.length === 0) {
            showEmptyState();
        } else {
            showTransactions();
        }

    } catch (error) {
        console.error('Error loading transaction history:', error);
        showLoading(false);
        alert('Failed to load transaction history. Please try again.');
    }
}

// Load product name from listing
async function loadProductName(listingId) {
    if (!listingId) return 'Organic Compost';

    try {
        const listingDoc = await getDoc(doc(db, 'product_listings', listingId));
        if (listingDoc.exists()) {
            const listingData = listingDoc.data();
            return listingData.listingProductName || 'Organic Compost';
        }
    } catch (error) {
        console.error('Error loading product name:', error);
    }
    
    return 'Organic Compost';
}

// Show transactions
function showTransactions() {
    showLoading(false);
    document.getElementById('historySection').style.display = 'block';
    document.getElementById('transactionCount').textContent = transactions.length;

    const container = document.getElementById('transactionList');
    container.innerHTML = '';

    transactions.forEach(transaction => {
        const card = createTransactionCard(transaction);
        container.appendChild(card);
    });
}

// Create transaction card
function createTransactionCard(transaction) {
    const card = document.createElement('div');
    card.className = 'transaction-card';

    // Header
    const header = document.createElement('div');
    header.className = 'transaction-header';

    const mainInfo = document.createElement('div');
    mainInfo.className = 'transaction-main-info';

    const productName = document.createElement('div');
    productName.className = 'product-name';
    productName.textContent = transaction.productName || 'Organic Compost';

    const date = document.createElement('div');
    date.className = 'transaction-date';
    date.textContent = formatTransactionDate(transaction.transactionOrderDate);

    mainInfo.appendChild(productName);
    mainInfo.appendChild(date);

    const statusBadge = document.createElement('span');
    statusBadge.className = `status-badge ${transaction.transactionStatus}`;
    statusBadge.textContent = formatTransactionStatus(transaction.transactionStatus);

    header.appendChild(mainInfo);
    header.appendChild(statusBadge);

    // Details
    const details = document.createElement('div');
    details.className = 'transaction-details';

    const quantityItem = document.createElement('div');
    quantityItem.className = 'detail-item';
    quantityItem.innerHTML = `
        <div class="detail-label">Quantity</div>
        <div class="detail-value">${transaction.transactionQuantityOrdered} kg</div>
    `;

    const unitPriceItem = document.createElement('div');
    unitPriceItem.className = 'detail-item';
    unitPriceItem.innerHTML = `
        <div class="detail-label">Unit Price</div>
        <div class="detail-value">₱${formatPrice(transaction.transactionUnitPrice)}/kg</div>
    `;

    const totalItem = document.createElement('div');
    totalItem.className = 'detail-item';
    totalItem.innerHTML = `
        <div class="detail-label">Total Amount</div>
        <div class="detail-value price">₱${formatPrice(transaction.transactionTotalAmount)}</div>
    `;

    details.appendChild(quantityItem);
    details.appendChild(unitPriceItem);
    details.appendChild(totalItem);

    // Assemble card
    card.appendChild(header);
    card.appendChild(details);

    return card;
}

// Format transaction date
function formatTransactionDate(timestamp) {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    
    // Format: "January 15, 2024 at 2:30 PM"
    const options = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    return date.toLocaleDateString('en-US', options);
}

// Format price
function formatPrice(amount) {
    return Number(amount).toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    });
}

// Format transaction status
function formatTransactionStatus(status) {
    const statusMap = {
        'contacted': 'Negotiating',
        'agreed': 'Agreed',
        'confirmed': 'Confirmed',
        'completed': '✓ Completed',
        'cancelled': '✗ Cancelled',
        'cancellation_requested': 'Cancellation Pending'
    };
    return statusMap[status] || status.charAt(0).toUpperCase() + status.slice(1);
}

// Show/hide loading
function showLoading(show) {
    const loadingContainer = document.getElementById('loadingContainer');
    
    if (show) {
        loadingContainer.style.display = 'flex';
    } else {
        loadingContainer.style.display = 'none';
    }
}

// Show empty state
function showEmptyState() {
    showLoading(false);
    document.getElementById('emptyState').classList.add('show');
}
