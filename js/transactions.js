// transactions.js - Handles buyer transactions page
import { auth, db } from './init.js';
import { 
    getCurrentUser, 
    getCurrentUserData, 
    onUserDataChange,
    DEFAULT_PROFILE_PIC 
} from './shared-user-manager.js';
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
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js';

// State management
let currentUserId = null;
let conversationsListener = null;
let sellerConversations = [];

// Initialize on auth state change
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUserId = user.uid;
        await loadUserProfile(user);
        await loadSellerConversations();
    } else {
        window.location.href = '/login.html';
    }
});

// Also listen for user data changes from shared manager
onUserDataChange(({ user, userData }) => {
    if (userData) {
        updateHeaderProfile(userData, user);
    }
});

// Load user profile using shared-user-manager
async function loadUserProfile(user) {
    const userData = getCurrentUserData();
    
    if (userData) {
        updateHeaderProfile(userData, user);
    } else {
        // Fallback if shared manager hasn't loaded yet
        try {
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists()) {
                const data = userDoc.data();
                updateHeaderProfile(data, user);
            }
        } catch (error) {
            console.error('Error loading user profile:', error);
        }
    }
}

// Update header profile with data
function updateHeaderProfile(userData, user) {
    const userName = userData.userName || user?.displayName || 'User';
    const profilePicUrl = userData.userProfilePictureUrl || user?.photoURL || DEFAULT_PROFILE_PIC;
    
    const userNameEl = document.getElementById('headerUserName');
    if (userNameEl) {
        userNameEl.textContent = userName;
    }
    
    // Set avatar using background image (no initials fallback)
    const userAvatarElement = document.getElementById('headerUserAvatar');
    if (userAvatarElement) {
        userAvatarElement.style.backgroundImage = `url(${profilePicUrl})`;
        userAvatarElement.style.backgroundSize = 'cover';
        userAvatarElement.style.backgroundPosition = 'center';
        userAvatarElement.style.backgroundRepeat = 'no-repeat';
        userAvatarElement.textContent = ''; // Clear any text content
    }
}

// Load seller conversations with real-time updates
async function loadSellerConversations() {
    showLoading(true);
    
    try {
        // Get all conversations for current user
        const conversationsQuery = query(
            collection(db, 'conversations'),
            where('participants', 'array-contains', currentUserId),
            where('conversationIsActive', '==', true),
            orderBy('conversationUpdatedAt', 'desc')
        );

        // Set up real-time listener
        conversationsListener = onSnapshot(conversationsQuery, async (snapshot) => {
            console.log('Conversations updated:', snapshot.size);
            
            if (snapshot.empty) {
                showEmptyState();
                return;
            }

            const conversations = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Get all transactions for current user
            const transactions = await getUserTransactions();
            
            // Process conversations with transaction data
            await processConversations(conversations, transactions);
        });

    } catch (error) {
        console.error('Error loading conversations:', error);
        showLoading(false);
        showError('Failed to load transactions. Please try again.');
    }
}

// Get all transactions for current user
async function getUserTransactions() {
    try {
        const transactionsRef = collection(db, 'transactions');
        const buyerQuery = query(
            transactionsRef,
            where('transactionBuyerID', '==', currentUserId),
            orderBy('transactionOrderDate', 'desc')
        );
        
        const buyerSnapshot = await getDocs(buyerQuery);
        const transactions = buyerSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        console.log('Loaded transactions:', transactions.length);
        return transactions;
    } catch (error) {
        console.error('Error getting transactions:', error);
        return [];
    }
}

// Process conversations with transaction data
async function processConversations(conversations, transactions) {
    sellerConversations = [];
    
    for (const conversation of conversations) {
        // Get the other participant (seller)
        const sellerId = conversation.participants.find(id => id !== currentUserId);
        if (!sellerId) continue;

        const sellerDetail = conversation.participantDetails?.[sellerId];
        const sellerName = sellerDetail?.participantName || 'Unknown Seller';

        // Find latest transaction with this seller
        const sellerTransactions = transactions.filter(
            t => t.transactionSellerID === sellerId || t.transactionBuyerID === sellerId
        );
        
        const latestTransaction = sellerTransactions.length > 0 ? sellerTransactions[0] : null;
        
        // Get listing ID from conversation or transaction
        const listingId = conversation.listingId || latestTransaction?.transactionListingID;
        
        // Load seller profile and product info
        const sellerData = await loadSellerProfile(sellerId);
        const productData = listingId ? await loadProductInfo(listingId) : null;

        sellerConversations.push({
            conversation,
            sellerId,
            sellerName: sellerData.userName || sellerName,
            sellerProfileUrl: sellerData.profilePictureUrl,
            latestTransaction,
            productName: productData?.productName,
            listingId: productData?.listingId,
            unreadCount: getUnreadCount(conversation)
        });
    }

    // Render the conversations
    renderConversations();
}

// Load seller profile
async function loadSellerProfile(sellerId) {
    try {
        const userDoc = await getDoc(doc(db, 'users', sellerId));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            return {
                userName: userData.userName,
                profilePictureUrl: userData.userProfilePictureUrl || DEFAULT_PROFILE_PIC,
                userType: userData.userType
            };
        }
    } catch (error) {
        console.error('Error loading seller profile:', error);
    }
    return {
        userName: 'Unknown Seller',
        profilePictureUrl: DEFAULT_PROFILE_PIC,
        userType: 'swine_farmer'
    };
}

// Load product info from listing
async function loadProductInfo(listingId) {
    try {
        const listingDoc = await getDoc(doc(db, 'product_listings', listingId));
        if (listingDoc.exists()) {
            const listingData = listingDoc.data();
            return {
                productName: listingData.listingProductName || 'Organic Compost',
                listingId: listingDoc.id
            };
        }
    } catch (error) {
        console.error('Error loading product info:', error);
    }
    return null;
}

// Get unread message count for conversation
function getUnreadCount(conversation) {
    const lastMessage = conversation.lastMessage;
    if (!lastMessage || lastMessage.lastMessageSenderId === currentUserId) {
        return 0;
    }

    const participantDetail = conversation.participantDetails?.[currentUserId];
    const lastReadAt = participantDetail?.participantLastReadAt;

    if (!lastReadAt) {
        return 1;
    }

    return lastMessage.lastMessageTimestamp?.toMillis() > lastReadAt?.toMillis() ? 1 : 0;
}

// Render conversations
function renderConversations() {
    showLoading(false);
    
    const container = document.getElementById('conversationsContainer');
    container.innerHTML = '';

    if (sellerConversations.length === 0) {
        showEmptyState();
        return;
    }

    hideEmptyState();

    sellerConversations.forEach(item => {
        const card = createSellerCard(item);
        container.appendChild(card);
    });
}

// Create seller card element
function createSellerCard(item) {
    const card = document.createElement('div');
    card.className = 'seller-card';

    // Seller Header
    const header = document.createElement('div');
    header.className = 'seller-header';

    const avatar = document.createElement('div');
    avatar.className = 'seller-avatar';
    
    const img = document.createElement('img');
    img.src = item.sellerProfileUrl || DEFAULT_PROFILE_PIC;
    img.alt = item.sellerName;
    img.onerror = () => {
        // Fallback to default on error
        img.src = DEFAULT_PROFILE_PIC;
    };
    avatar.appendChild(img);

    const sellerInfo = document.createElement('div');
    sellerInfo.className = 'seller-info';

    const sellerName = document.createElement('div');
    sellerName.className = 'seller-name';
    sellerName.textContent = item.sellerName;

    const sellerType = document.createElement('div');
    sellerType.className = 'seller-type';
    sellerType.textContent = 'Swine Farmer';

    sellerInfo.appendChild(sellerName);
    sellerInfo.appendChild(sellerType);

    const unreadBadge = document.createElement('div');
    unreadBadge.className = 'unread-badge';
    if (item.unreadCount > 0) {
        unreadBadge.classList.add('show');
    }

    header.appendChild(avatar);
    header.appendChild(sellerInfo);
    header.appendChild(unreadBadge);

    // Transaction Info Section
    const transactionInfo = document.createElement('div');
    transactionInfo.className = 'transaction-info';

    if (item.productName || item.latestTransaction) {
        // Product name
        if (item.productName) {
            const productName = document.createElement('div');
            productName.className = 'product-name';
            productName.textContent = item.productName;
            
            if (item.listingId) {
                productName.style.cursor = 'pointer';
                productName.addEventListener('click', () => {
                    window.location.href = `/listing-details.html?id=${item.listingId}`;
                });
            } else {
                productName.classList.add('disabled');
            }
            
            transactionInfo.appendChild(productName);
        }

        if (item.latestTransaction) {
            const transaction = item.latestTransaction;

            // Transaction date
            const date = document.createElement('div');
            date.className = 'transaction-date';
            date.textContent = formatTransactionDate(transaction.transactionOrderDate);
            transactionInfo.appendChild(date);

            // Transaction meta (price, quantity)
            const meta = document.createElement('div');
            meta.className = 'transaction-meta';

            const priceItem = document.createElement('div');
            priceItem.className = 'meta-item';
            priceItem.innerHTML = `
                <div class="meta-label">Total Amount</div>
                <div class="meta-value price">₱${formatPrice(transaction.transactionTotalAmount)}</div>
            `;

            const quantityItem = document.createElement('div');
            quantityItem.className = 'meta-item';
            quantityItem.innerHTML = `
                <div class="meta-label">Quantity</div>
                <div class="meta-value">${transaction.transactionQuantityOrdered} kg</div>
            `;

            meta.appendChild(priceItem);
            meta.appendChild(quantityItem);
            transactionInfo.appendChild(meta);

            // Status badge
            const statusBadge = document.createElement('span');
            statusBadge.className = `status-badge ${transaction.transactionStatus}`;
            statusBadge.textContent = formatTransactionStatus(transaction.transactionStatus);
            transactionInfo.appendChild(statusBadge);
        } else {
            // No transaction yet
            const noTransaction = document.createElement('div');
            noTransaction.className = 'no-transactions';
            noTransaction.textContent = 'Product listed - No transactions yet';
            transactionInfo.appendChild(noTransaction);
        }
    } else {
        // No product or transactions
        const noTransaction = document.createElement('div');
        noTransaction.className = 'no-transactions';
        noTransaction.textContent = 'No transactions with this seller yet';
        transactionInfo.appendChild(noTransaction);
    }

    // Action Buttons
    const actions = document.createElement('div');
    actions.className = 'card-actions';

    const messageBtn = document.createElement('button');
    messageBtn.className = 'btn btn-primary';
    messageBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
        Message Seller
    `;
    messageBtn.addEventListener('click', () => {
        window.location.href = `/messages.html?conversation=${item.conversation.id}&seller=${item.sellerId}`;
    });

    const historyBtn = document.createElement('button');
    historyBtn.className = 'btn btn-secondary';
    historyBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
        View History
    `;
    
    if (item.latestTransaction) {
        historyBtn.addEventListener('click', () => {
            window.location.href = `/transaction-history.html?seller=${item.sellerId}&name=${encodeURIComponent(item.sellerName)}`;
        });
    } else {
        historyBtn.disabled = true;
    }

    actions.appendChild(messageBtn);
    actions.appendChild(historyBtn);

    // Assemble card
    card.appendChild(header);
    card.appendChild(transactionInfo);
    card.appendChild(actions);

    return card;
}

// Format transaction date
function formatTransactionDate(timestamp) {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

// Format price
function formatPrice(amount) {
    return Number(amount).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// Format transaction status
function formatTransactionStatus(status) {
    const statusMap = {
        'agreed': '✓ Agreed',
        'confirmed': '✓ Confirmed',
        'completed': '✓ Completed',
        'cancelled': '✗ Cancelled',
        'cancellation_requested': '⏳ Cancellation Pending',
        'contacted': '💬 Negotiating'
    };
    return statusMap[status] || status.charAt(0).toUpperCase() + status.slice(1);
}

// Show/hide loading state
function showLoading(show) {
    const loadingContainer = document.getElementById('loadingContainer');
    const conversationsContainer = document.getElementById('conversationsContainer');
    
    if (show) {
        loadingContainer.style.display = 'flex';
        conversationsContainer.style.display = 'none';
    } else {
        loadingContainer.style.display = 'none';
        conversationsContainer.style.display = 'grid';
    }
}

// Show empty state
function showEmptyState() {
    showLoading(false);
    document.getElementById('emptyState').classList.add('show');
    document.getElementById('conversationsContainer').style.display = 'none';
}

// Hide empty state
function hideEmptyState() {
    document.getElementById('emptyState').classList.remove('show');
    document.getElementById('conversationsContainer').style.display = 'grid';
}

// Show error message
function showError(message) {
    alert(message); // TODO: Replace with better error UI
}

// Cleanup listeners on page unload
window.addEventListener('beforeunload', () => {
    if (conversationsListener) {
        conversationsListener();
    }
});
