// messages.js - Complete messaging with real-time updates
import { auth, db, storage } from './init.js';
import { 
    getCurrentUser, 
    getCurrentUserData,
    onUserDataChange 
} from './shared-user-manager.js';
import { 
    collection, 
    query, 
    where, 
    orderBy, 
    onSnapshot,
    addDoc,
    updateDoc,
    doc,
    serverTimestamp,
    getDocs,
    getDoc,
    Timestamp,
    runTransaction
} from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js';
import {
    ref,
    uploadBytesResumable,
    getDownloadURL
} from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-storage.js';

// Helper function to get translated text
function t(key, options = {}) {
    if (window.i18nManager && window.i18nManager.t) {
        return window.i18nManager.t(key, options);
    }
    return key;
}

const COLLECTIONS = {
    CONVERSATIONS: 'conversations',
    MESSAGES: 'messages',
    USERS: 'users',
    LISTINGS: 'product_listings',
    TRANSACTIONS: 'transactions',
    ADDRESSES: 'addresses'
};

let currentConversationId = null;
let currentConversation = null;
let currentReceiverId = null;
let currentListing = null;
let conversationsListener = null;
let messagesListener = null;
let conversationDetailsListener = null;
let uploadInProgress = false;

// Block status tracking
let isBlockedByOther = false;
let hasBlockedOther = false;

// Default profile picture
const DEFAULT_PROFILE_PICTURE = 'https://i.pinimg.com/736x/d7/95/c3/d795c373a0539e64c7ee69bb0af3c5c3.jpg';

// Toast notification system
function showToast(message, type = 'info') {
    const existingToast = document.querySelector('.toast-notification');
    if (existingToast) {
        existingToast.remove();
    }
    
    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.innerHTML = `
        <div class="toast-content">
            <span class="toast-icon">${type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ'}</span>
            <span class="toast-message">${message}</span>
        </div>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 10);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Confirmation dialog system
function showConfirmDialog(message, onConfirm, onCancel = null) {
    const existingDialog = document.getElementById('confirmDialog');
    if (existingDialog) {
        existingDialog.remove();
    }
    
    const dialog = document.createElement('div');
    dialog.className = 'modal';
    dialog.id = 'confirmDialog';
    dialog.innerHTML = `
        <div class="modal-content confirm-dialog">
            <div class="confirm-icon">⚠️</div>
            <p class="confirm-message">${message}</p>
            <div class="confirm-actions">
                <button class="btn-secondary" id="confirmCancel">Cancel</button>
                <button class="btn-primary" id="confirmOk">Confirm</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(dialog);
    dialog.style.display = 'block';
    
    document.getElementById('confirmOk').onclick = () => {
        dialog.remove();
        if (onConfirm) onConfirm();
    };
    
    document.getElementById('confirmCancel').onclick = () => {
        dialog.remove();
        if (onCancel) onCancel();
    };
}

// Prompt dialog system
function showPromptDialog(message, placeholder, onSubmit, onCancel = null) {
    const existingDialog = document.getElementById('promptDialog');
    if (existingDialog) {
        existingDialog.remove();
    }
    
    const dialog = document.createElement('div');
    dialog.className = 'modal';
    dialog.id = 'promptDialog';
    dialog.innerHTML = `
        <div class="modal-content prompt-dialog">
            <h3>${message}</h3>
            <textarea class="prompt-input" id="promptInput" placeholder="${placeholder}" rows="4"></textarea>
            <div class="prompt-actions">
                <button class="btn-secondary" id="promptCancel">Cancel</button>
                <button class="btn-primary" id="promptSubmit">Submit</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(dialog);
    dialog.style.display = 'block';
    
    const input = document.getElementById('promptInput');
    input.focus();
    
    document.getElementById('promptSubmit').onclick = () => {
        const value = input.value.trim();
        if (!value) {
            showToast('Please provide input', 'error');
            return;
        }
        dialog.remove();
        if (onSubmit) onSubmit(value);
    };
    
    document.getElementById('promptCancel').onclick = () => {
        dialog.remove();
        if (onCancel) onCancel();
    };
}

// Load user profile from cache or current data
function loadUserProfile() {
    const userData = getCurrentUserData();
    const user = getCurrentUser();
    
    if (!userData && !user) {
        console.log('⏳ No user data available yet');
        return;
    }
    
    const userName = userData?.userName || user?.displayName || 'User';
    const userType = userData?.userType || 'swine_farmer';
    
    // Get profile picture with proper fallback chain
    let profilePicUrl = userData?.userProfilePictureUrl || user?.photoURL || DEFAULT_PROFILE_PICTURE;
    
    // Determine user role display
    let roleDisplay = t('messages.userRole.activeUser');
    if (userType === 'swine_farmer' || userType === 'Swine Farmer') {
        roleDisplay = t('messages.userRole.swineFarmer');
    } else if (userType === 'fertilizer_buyer' || userType === 'Organic Fertilizer Buyer') {
        roleDisplay = t('messages.userRole.fertilizerBuyer');
    }
    
    // Generate initials
    const initials = userName.split(' ')
        .map(word => word.charAt(0))
        .join('')
        .substring(0, 2)
        .toUpperCase();
    
    // Update header elements
    const userNameElement = document.getElementById('currentUserName');
    const userRoleElement = document.getElementById('currentUserRole');
    const userAvatarElement = document.getElementById('currentUserAvatar');
    
    if (userNameElement) userNameElement.textContent = userName;
    if (userRoleElement) userRoleElement.textContent = roleDisplay;
    
    if (userAvatarElement) {
        // Always use background image with either user's pic or default pic
        userAvatarElement.style.backgroundImage = `url(${profilePicUrl})`;
        userAvatarElement.style.backgroundSize = 'cover';
        userAvatarElement.style.backgroundPosition = 'center';
        userAvatarElement.style.backgroundRepeat = 'no-repeat';
        userAvatarElement.textContent = '';
        
        // Fallback to initials if image fails to load
        const img = new Image();
        img.onerror = () => {
            userAvatarElement.style.backgroundImage = 'none';
            userAvatarElement.textContent = initials;
        };
        img.src = profilePicUrl;
    }
    
    console.log('👤 User profile loaded:', { userName, roleDisplay });
}

// Initialize messages functionality
document.addEventListener('DOMContentLoaded', function() {
    console.log('💬 Messages page initializing...');
    
    // Load user profile immediately
    loadUserProfile();
    
    onUserDataChange(({ user, userData }) => {
        console.log('✅ User data loaded:', userData.userName);
        loadUserProfile(); // Update profile when data changes
        initializeMessaging(user, userData);
    });
    
    const user = getCurrentUser();
    const userData = getCurrentUserData();
    
    if (user && userData) {
        console.log('✅ User already loaded');
        initializeMessaging(user, userData);
    }
    
    // Listen for language changes and refresh content
    document.addEventListener('languageChanged', () => {
        console.log('🌐 Language changed, refreshing messages...');
        // Re-render the current conversation if one is open
        if (currentConversationId && currentConversation && currentReceiverId) {
            const participantDetails = currentConversation.participantDetails?.[currentReceiverId];
            const participantName = participantDetails?.participantName || 'User';
            renderChatUI(participantName, participantDetails, currentConversation);
            setupMessageInputForConversation();
        }
    });
});

function initializeMessaging(user, userData) {
    console.log('💬 Initializing messaging for:', userData.userName);
    
    loadConversations(user.uid);
    setupSearchFunctionality();
    // REMOVE this line: setupMediaInput();  <-- DELETE THIS
    setupModals();
    handleUrlParameters();
}

// Setup modal functionality
function setupModals() {
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });
}

// Load conversations for current user
function loadConversations(userId) {
    const conversationList = document.getElementById('conversationList');
    
    if (!conversationList) {
        console.error('Conversation list element not found');
        return;
    }
    
    conversationList.innerHTML = `<div style="text-align: center; padding: 20px; color: #888;">${t('messages.loading')}</div>`;
    
    const conversationsRef = collection(db, COLLECTIONS.CONVERSATIONS);
    const q = query(
        conversationsRef,
        where('participants', 'array-contains', userId),
        where('conversationIsActive', '==', true),
        orderBy('conversationUpdatedAt', 'desc')
    );
    
    if (conversationsListener) {
        conversationsListener();
    }
    
    conversationsListener = onSnapshot(q, 
        async (snapshot) => {
            if (snapshot.empty) {
                conversationList.innerHTML = `
                    <div style="text-align: center; padding: 20px; color: #888;">
                        <p style="margin-bottom: 8px;">No conversations yet</p>
                        <p style="font-size: 12px;">Start a conversation from the marketplace</p>
                    </div>
                `;
                return;
            }
            
            conversationList.innerHTML = '';
            
            for (const docSnap of snapshot.docs) {
                const conversation = docSnap.data();
                await renderConversationItem(docSnap.id, conversation, userId);
            }
        },
        (error) => {
            console.error('Error loading conversations:', error);
            conversationList.innerHTML = `
                <div style="text-align: center; padding: 20px; color: #e74c3c;">
                    <p>Error loading conversations</p>
                </div>
            `;
        }
    );
}

function renderConversationItem(conversationId, conversation, currentUserId) {
    const conversationList = document.getElementById('conversationList');
    
    const otherParticipantId = conversation.participants.find(id => id !== currentUserId);
    const currentUserDetails = conversation.participantDetails?.[currentUserId];
    const otherParticipantDetails = conversation.participantDetails?.[otherParticipantId];
    
    const otherParticipantName = otherParticipantDetails?.participantName || 'User';
    const otherParticipantType = otherParticipantDetails?.participantUserType || '';
    
    // Start with default profile picture
    let otherParticipantImage = DEFAULT_PROFILE_PICTURE;
    
    const conversationItem = document.createElement('div');
    conversationItem.className = 'conversation-item';
    if (conversationId === currentConversationId) {
        conversationItem.classList.add('active');
    }
    
    // Check for unread messages
    const currentUserLastRead = currentUserDetails?.participantLastReadAt;
    const lastMessageTime = conversation.lastMessage?.lastMessageTimestamp;
    const lastMessageSenderId = conversation.lastMessage?.lastMessageSenderId;
    const hasUnread = lastMessageTime && currentUserLastRead && 
                      lastMessageTime.toMillis() > currentUserLastRead.toMillis() &&
                      lastMessageSenderId !== currentUserId;
    
    const lastMessageTimeFormatted = conversation.lastMessage?.lastMessageTimestamp ? 
        formatTimestamp(conversation.lastMessage.lastMessageTimestamp.toDate()) : 
        t('messages.conversationPreview.startConversation');
    
    let lastMessageText = conversation.lastMessage?.lastMessageText || t('messages.conversationPreview.startConversation');
    
    // Format media messages
    if (lastMessageText === '📸 Photo') {
        lastMessageText = t('messages.conversationPreview.photo');
    } else if (lastMessageText === '🎥 Video') {
        lastMessageText = t('messages.conversationPreview.video');
    }
    
    const userTypeBadge = otherParticipantType === 'swine_farmer' ? 
        `<span class="user-badge farmer">${t('messages.userBadge.farmer')}</span>` : 
        `<span class="user-badge buyer">${t('messages.userBadge.buyer')}</span>`;
    
    conversationItem.innerHTML = `
        <div class="conversation-avatar">
            <img src="${DEFAULT_PROFILE_PICTURE}" alt="${otherParticipantName}" onerror="this.src='${DEFAULT_PROFILE_PICTURE}'">
        </div>
        <div class="conversation-content">
            <div class="conversation-header">
                <div class="conversation-name-wrapper">
                    <span class="conversation-name">${otherParticipantName}</span>
                    ${userTypeBadge}
                </div>
                <span class="conversation-time">${lastMessageTimeFormatted}</span>
            </div>
            <div class="conversation-preview ${hasUnread ? 'unread' : ''}">
                ${lastMessageText}
                ${hasUnread ? '<span class="unread-indicator">•</span>' : ''}
            </div>
        </div>
    `;
    
    conversationItem.addEventListener('click', (event) => {
        openConversation(conversationId, otherParticipantId, otherParticipantName, otherParticipantDetails, conversation, event);
    });
    
    conversationList.appendChild(conversationItem);
    
    // NEW: Load profile picture asynchronously AFTER rendering
    getDoc(doc(db, COLLECTIONS.USERS, otherParticipantId)).then(userDoc => {
        if (userDoc.exists()) {
            const userData = userDoc.data();
            const profileUrl = userData.userProfilePictureUrl || DEFAULT_PROFILE_PICTURE;
            const avatarImg = conversationItem.querySelector('.conversation-avatar img');
            if (avatarImg) {
                avatarImg.src = profileUrl;
            }
        }
    }).catch(error => {
        console.error('Error fetching profile picture:', error);
    });
}

async function openConversation(conversationId, receiverId, participantName, participantDetails, conversationData, event) {
    console.log('💬 Opening conversation:', conversationId);
    
    currentConversationId = conversationId;
    currentConversation = conversationData;
    currentReceiverId = receiverId;
    
    // Load listing if available
    if (conversationData.listingId) {
        await loadListingForConversation(conversationData.listingId);
    }
    
    // Update active state
    document.querySelectorAll('.conversation-item').forEach(item => {
        item.classList.remove('active');
    });
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }
    
    // Mark messages as read
    const currentUser = getCurrentUser();
    await updateDoc(doc(db, COLLECTIONS.CONVERSATIONS, conversationId), {
        [`participantDetails.${currentUser.uid}.participantLastReadAt`]: serverTimestamp()
    });
    
    // IMPORTANT: Render the chat UI first (initial render)
    renderChatUI(participantName, participantDetails, conversationData);
    
    // Check block status
    checkBlockStatus();
    
    // Update menu items based on block status
    updateMenuItems();
    
    // Setup message input handlers
    setupMessageInputForConversation();
    
    // Load messages
    loadMessages(conversationId);
    
    // THEN setup real-time listener for conversation changes (only updates header)
    setupConversationListener(conversationId, participantName, participantDetails);
}

// NEW: Real-time conversation listener
function setupConversationListener(conversationId, participantName, participantDetails) {
    // Clean up existing listener
    if (conversationDetailsListener) {
        conversationDetailsListener();
    }
    
    const conversationRef = doc(db, COLLECTIONS.CONVERSATIONS, conversationId);
    
    // Track previous state to avoid unnecessary re-renders
    let previousCanProposeDeal = currentConversation?.canProposeDeal;
    let previousBuyerStatus = currentConversation?.buyerTransactionStatus;
    let previousSellerStatus = currentConversation?.sellerTransactionStatus;
    let previousBlockedByOther = isBlockedByOther;
    let previousBlockedByMe = hasBlockedOther;
    
    conversationDetailsListener = onSnapshot(conversationRef, (docSnap) => {
        if (docSnap.exists()) {
            const updatedConversation = docSnap.data();
            const newCanProposeDeal = updatedConversation.canProposeDeal;
            const newBuyerStatus = updatedConversation.buyerTransactionStatus;
            const newSellerStatus = updatedConversation.sellerTransactionStatus;
            
            // Check block status from updated conversation
            const currentUser = getCurrentUser();
            const currentUserId = currentUser?.uid;
            const currentUserDetails = updatedConversation.participantDetails?.[currentUserId];
            const otherUserDetails = updatedConversation.participantDetails?.[currentReceiverId];
            const newBlockedByOther = currentUserDetails?.participantIsBlocked ?? false;
            const newBlockedByMe = otherUserDetails?.participantIsBlocked ?? false;
            
            // Check if any relevant field changed
            const hasChanges = previousCanProposeDeal !== newCanProposeDeal ||
                              previousBuyerStatus !== newBuyerStatus ||
                              previousSellerStatus !== newSellerStatus ||
                              previousBlockedByOther !== newBlockedByOther ||
                              previousBlockedByMe !== newBlockedByMe;
            
            if (hasChanges) {
                console.log('🔄 Conversation status changed');
                console.log('  canProposeDeal:', previousCanProposeDeal, '->', newCanProposeDeal);
                console.log('  buyerStatus:', previousBuyerStatus, '->', newBuyerStatus);
                console.log('  sellerStatus:', previousSellerStatus, '->', newSellerStatus);
                console.log('  blockedByOther:', previousBlockedByOther, '->', newBlockedByOther);
                console.log('  blockedByMe:', previousBlockedByMe, '->', newBlockedByMe);
                
                currentConversation = updatedConversation;
                previousCanProposeDeal = newCanProposeDeal;
                previousBuyerStatus = newBuyerStatus;
                previousSellerStatus = newSellerStatus;
                previousBlockedByOther = newBlockedByOther;
                previousBlockedByMe = newBlockedByMe;
                
                // Update block status variables
                isBlockedByOther = newBlockedByOther;
                hasBlockedOther = newBlockedByMe;
                
                // Update only the header section, not the entire chat
                updateChatHeader(participantName, participantDetails, updatedConversation);
                
                // Update UI based on block status
                updateUIBasedOnBlockStatus();
                updateMenuItems();
            } else {
                // Just update the conversation object without re-rendering
                currentConversation = updatedConversation;
            }
        }
    }, (error) => {
        console.error('Error listening to conversation updates:', error);
    });
}

function updateConversationTransactionStatus(status) {
    const updates = {
        buyerTransactionStatus: status,
        sellerTransactionStatus: status,
        conversationUpdatedAt: serverTimestamp()
    };
    
    updateDoc(doc(db, COLLECTIONS.CONVERSATIONS, currentConversationId), updates)
        .then(() => {
            console.log('✅ Conversation transaction status updated:', status);
        })
        .catch(error => {
            console.error('Error updating transaction status:', error);
        });
}

function updateChatHeader(participantName, participantDetails, conversationData) {
    const chatHeader = document.querySelector('.chat-header');
    const transactionBanner = document.querySelector('.transaction-status-banner');
    
    if (!chatHeader) return;
    
    // Remove existing banner if it exists
    if (transactionBanner) {
        transactionBanner.remove();
    }
    
    // CRITICAL: Check current user's participant type from conversation
    const currentUser = getCurrentUser();
    const currentUserId = currentUser?.uid;
    const currentUserParticipantDetail = conversationData.participantDetails?.[currentUserId];
    const userType = currentUserParticipantDetail?.participantUserType || 'swine_farmer';
    
    // Check if propose deal button exists
    const existingProposeBtn = document.getElementById('proposeDealBtn');
    const chatHeaderActions = document.querySelector('.chat-header-actions');
    
    // CRITICAL: Only show deal proposal button for buyers (fertilizer_buyer)
    if (userType !== 'fertilizer_buyer') {
        // Hide button permanently for sellers
        if (existingProposeBtn) {
            existingProposeBtn.remove();
        }
        return; // Early exit for non-buyers
    }
    
    // Existing buyer logic below
    if (conversationData.canProposeDeal === true && currentListing) {
        // Show propose deal button if it doesn't exist
        if (!existingProposeBtn && chatHeaderActions) {
            chatHeaderActions.innerHTML = `
                <button class="btn-propose-deal" id="proposeDealBtn">
                    <img src="/images/deal-proposal.png" alt="Deal" style="width: 16px; height: 16px;">
                    ${t('messages.dealProposal.buttonText')}
                </button>
            `;
            
            // Re-attach event listener
            const proposeDealBtn = document.getElementById('proposeDealBtn');
            if (proposeDealBtn) {
                proposeDealBtn.addEventListener('click', openDealProposalModal);
            }
        }
    } else if (conversationData.canProposeDeal === false) {
        // Remove button if it exists
        if (existingProposeBtn) {
            existingProposeBtn.remove();
        }
        
        // Determine the appropriate status message based on transaction status
        const currentUser = getCurrentUser();
        const userData = getCurrentUserData();
        const userType = userData?.userType || 'fertilizer_buyer';
        const isBuyer = userType === 'fertilizer_buyer';
        
        const buyerStatus = conversationData.buyerTransactionStatus || 'none';
        const sellerStatus = conversationData.sellerTransactionStatus || 'none';
        
        let statusMessage = t('messages.dealProposalMessage.messages.dealProposalProgress');
        let statusIcon = '⏳';
        
        // Determine status message based on user role and transaction status
        if (isBuyer) {
            if (buyerStatus === 'confirmation_pending' && sellerStatus === 'ongoing') {
                statusMessage = 'You confirmed. Waiting for seller to confirm';
                statusIcon = '✓';
            } else if (buyerStatus === 'ongoing' && sellerStatus === 'confirmation_pending') {
                statusMessage = 'Seller confirmed. Please confirm transaction';
                statusIcon = '⚠️';
            } else if (buyerStatus === 'confirmation_pending' && sellerStatus === 'confirmation_pending') {
                statusMessage = 'Both parties confirmed. Processing completion';
                statusIcon = '✓✓';
            } else if (buyerStatus === 'completed' && sellerStatus === 'completed') {
                statusMessage = 'Transaction completed successfully';
                statusIcon = '✅';
            } else if (buyerStatus === 'ongoing' && sellerStatus === 'ongoing') {
                statusMessage = 'Transaction in progress';
                statusIcon = '⏳';
            }
        } else {
            // Seller view
            if (sellerStatus === 'confirmation_pending' && buyerStatus === 'ongoing') {
                statusMessage = 'You confirmed. Waiting for buyer to confirm';
                statusIcon = '✓';
            } else if (sellerStatus === 'ongoing' && buyerStatus === 'confirmation_pending') {
                statusMessage = 'Buyer confirmed. Please confirm transaction';
                statusIcon = '⚠️';
            } else if (sellerStatus === 'confirmation_pending' && buyerStatus === 'confirmation_pending') {
                statusMessage = 'Both parties confirmed. Processing completion';
                statusIcon = '✓✓';
            } else if (sellerStatus === 'completed' && buyerStatus === 'completed') {
                statusMessage = 'Transaction completed successfully';
                statusIcon = '✅';
            } else if (sellerStatus === 'ongoing' && buyerStatus === 'ongoing') {
                statusMessage = 'Transaction in progress';
                statusIcon = '⏳';
            }
        }
        
        // Add transaction status banner after chat header
        const bannerHTML = `
            <div class="transaction-status-banner">
                <span class="status-icon">${statusIcon}</span>
                <span>${statusMessage}</span>
            </div>
        `;
        chatHeader.insertAdjacentHTML('afterend', bannerHTML);
    } else {
        // Remove button if canProposeDeal is neither true nor false
        if (existingProposeBtn) {
            existingProposeBtn.remove();
        }
    }
}

async function loadListingForConversation(listingId) {
    try {
        const listingDoc = await getDoc(doc(db, COLLECTIONS.LISTINGS, listingId));
        if (listingDoc.exists()) {
            currentListing = { id: listingDoc.id, ...listingDoc.data() };
            console.log('✅ Listing loaded:', currentListing);
        } else {
            currentListing = null;
            console.log('⚠️ Listing not found');
        }
    } catch (error) {
        console.error('Error loading listing:', error);
        currentListing = null;
    }
}

function renderChatUI(participantName, participantDetails, conversationData) {
    const chatPanel = document.getElementById('chatPanel');
    
    if (!chatPanel) return;
    
    const currentUser = getCurrentUser();
    const userData = getCurrentUserData();
    const currentUserId = currentUser?.uid;
    
    // CRITICAL: Get current user's participant type from conversation
    const currentUserParticipantDetail = conversationData.participantDetails?.[currentUserId];
    const userType = currentUserParticipantDetail?.participantUserType || 'swine_farmer';
    
    let transactionStatusHTML = '';
    let dealProposalButtonHTML = '';
    
    // CRITICAL: Only show deal proposal button for buyers (fertilizer_buyer)
    if (userType === 'fertilizer_buyer') {
        if (conversationData.canProposeDeal === true && currentListing) {
            dealProposalButtonHTML = `
                <button class="btn-propose-deal" id="proposeDealBtn">
                    <img src="/images/deal-proposal.png" alt="Deal" style="width: 16px; height: 16px;">
                    ${t('messages.dealProposal.buttonText')}
                </button>
            `;
        } else if (conversationData.canProposeDeal === false) {
            transactionStatusHTML = `
                <div class="transaction-status-banner">
                    <span class="status-icon">⏳</span>
                    <span>${t('messages.dealProposalMessage.messages.waitingResponse')}</span>
                </div>
            `;
        }
    }
    // For sellers (swine_farmer), dealProposalButtonHTML remains empty (button hidden)
    
    chatPanel.innerHTML = `
        <div class="chat-header">
            <div class="chat-user-info">
                <div class="chat-avatar">
                    <img src="${DEFAULT_PROFILE_PICTURE}" alt="${participantName}" onerror="this.src='${DEFAULT_PROFILE_PICTURE}'">
                </div>
                <div class="chat-user-details">
                    <h3>${participantName}</h3>
                    <p class="user-type-label">${participantDetails?.participantUserType === 'swine_farmer' ? t('messages.userBadge.farmer') : t('messages.userBadge.buyer')}</p>
                </div>
            </div>
            <div class="chat-header-actions">
                ${dealProposalButtonHTML}
                <button class="icon-btn" id="chatMenuBtn" onclick="toggleChatMenu()" title="${t('messages.menu.title') || 'Menu'}">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="1"></circle>
                        <circle cx="12" cy="5" r="1"></circle>
                        <circle cx="12" cy="19" r="1"></circle>
                    </svg>
                </button>
                <div class="chat-menu" id="chatMenu" style="display: none;">
                    <div class="menu-item" id="blockMenuItem" onclick="showBlockConfirmation()">${t('messages.menu.blockUser') || 'Block User'}</div>
                    <div class="menu-item" id="unblockMenuItem" onclick="showUnblockConfirmation()" style="display: none;">${t('messages.menu.unblockUser') || 'Unblock User'}</div>
                </div>
            </div>
        </div>
        ${transactionStatusHTML}
        <div class="blocking-status-banner" id="blockingBanner"></div>
        <div class="messages-area" id="messagesArea"></div>
        <div class="message-input-container">
            <input type="file" id="mediaInput" accept="image/*,video/*" style="display: none;">
            <button class="attachment-btn" id="attachmentBtn" title="${t('messages.chatInput.attachTooltip')}">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                </svg>
            </button>
            <input type="text" 
                   class="message-input" 
                   id="messageInput" 
                   placeholder="${t('messages.chatInput.placeholder')}" 
                   autocomplete="off">
            <button class="send-btn" id="sendBtn">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
            </button>
        </div>
        <div class="upload-progress" id="uploadProgress" style="display: none;">
            <div class="progress-bar">
                <div class="progress-fill" id="progressFill"></div>
            </div>
            <span class="progress-text" id="progressText">${t('messages.upload.progress')} 0%</span>
        </div>
    `;
    
    const proposeDealBtn = document.getElementById('proposeDealBtn');
    if (proposeDealBtn) {
        proposeDealBtn.addEventListener('click', openDealProposalModal);
    }
    
    // NEW: Load profile picture asynchronously AFTER rendering
    getDoc(doc(db, COLLECTIONS.USERS, currentReceiverId)).then(userDoc => {
        if (userDoc.exists()) {
            const userData = userDoc.data();
            const profileUrl = userData.userProfilePictureUrl || DEFAULT_PROFILE_PICTURE;
            const avatarImg = chatPanel.querySelector('.chat-avatar img');
            if (avatarImg) {
                avatarImg.src = profileUrl;
            }
        }
    }).catch(error => {
        console.error('Error fetching profile picture:', error);
    });
}

function loadMessages(conversationId) {
    const messagesArea = document.getElementById('messagesArea');
    
    if (!messagesArea) return;
    
    // Only show loading on initial load
    if (!messagesListener) {
        messagesArea.innerHTML = '<div style="text-align: center; color: #888;">Loading messages...</div>';
    }
    
    const messagesRef = collection(db, COLLECTIONS.CONVERSATIONS);
    const conversationMessagesRef = collection(doc(messagesRef, conversationId), COLLECTIONS.MESSAGES);
    const q = query(
        conversationMessagesRef,
        orderBy('messageCreatedAt', 'asc')
    );
    
    if (messagesListener) {
        messagesListener();
    }
    
    let isInitialLoad = true;
    
    messagesListener = onSnapshot(q,
        (snapshot) => {
            // Store scroll state before update
            const wasAtBottom = messagesArea.scrollHeight - messagesArea.scrollTop - messagesArea.clientHeight < 50;
            
            messagesArea.innerHTML = '';
            
            if (snapshot.empty) {
                messagesArea.innerHTML = `
                    <div style="text-align: center; color: #888; margin: auto;">
                        <p>No messages yet. Start the conversation!</p>
                    </div>
                `;
                return;
            }
            
            const currentUser = getCurrentUser();
            
            snapshot.forEach((docSnap) => {
                const message = { id: docSnap.id, ...docSnap.data() };
                renderMessage(message, currentUser.uid);
            });
            
            // Scroll to bottom only if was at bottom or initial load
            if (wasAtBottom || isInitialLoad) {
                messagesArea.scrollTop = messagesArea.scrollHeight;
            }
            
            isInitialLoad = false;
        },
        (error) => {
            console.error('Error loading messages:', error);
            messagesArea.innerHTML = `
                <div style="text-align: center; color: #e74c3c;">
                    Error loading messages
                </div>
            `;
        }
    );
}

function renderMessage(message, currentUserId) {
    const messagesArea = document.getElementById('messagesArea');
    const isSent = message.messageSenderId === currentUserId;
    
    // Handle different message types
    if (message.messageType === 'deal_proposal') {
        renderDealProposalMessage(message, currentUserId);
        return;
    }
    
    if (message.messageType === 'cancellation_request') {
        renderCancellationRequestMessage(message, currentUserId);
        return;
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;
    
    const messageTime = message.messageCreatedAt ? 
        formatMessageTime(message.messageCreatedAt.toDate()) : 
        'Sending...';
    
    // Status indicator for sent messages
    let statusIndicator = '';
    if (isSent && message.messageStatus) {
        const statusIcons = {
            'sent': '✓',
            'delivered': '✓✓',
            'read': '✓✓'
        };
        const statusColors = {
            'sent': '#95a5a6',
            'delivered': '#95a5a6',
            'read': '#27ae60'
        };
        statusIndicator = `<span class="message-status" style="color: ${statusColors[message.messageStatus]}">${statusIcons[message.messageStatus] || ''}</span>`;
    }
    
    // Handle different message types
    if (message.messageType === 'image' && message.messageMediaUrl) {
        messageDiv.innerHTML = `
            <div class="message-content media-message">
                <img src="${message.messageMediaUrl}" alt="Image" class="message-media" onclick="window.open('${message.messageMediaUrl}', '_blank')">
                <div class="message-footer">
                    <span class="message-time">${messageTime}</span>
                    ${statusIndicator}
                </div>
            </div>
        `;
    } else if (message.messageType === 'video' && message.messageMediaUrl) {
        messageDiv.innerHTML = `
            <div class="message-content media-message">
                <video src="${message.messageMediaUrl}" controls class="message-media"></video>
                <div class="message-footer">
                    <span class="message-time">${messageTime}</span>
                    ${statusIndicator}
                </div>
            </div>
        `;
    } else {
        messageDiv.innerHTML = `
            <div class="message-content">
                <div class="message-text">${escapeHtml(message.messageText)}</div>
                <div class="message-footer">
                    <span class="message-time">${messageTime}</span>
                    ${statusIndicator}
                </div>
            </div>
        `;
    }
    
    messagesArea.appendChild(messageDiv);
}

function renderDealProposalMessage(message, currentUserId) {
    const messagesArea = document.getElementById('messagesArea');
    const metadata = message.messageMetadata || {};
    const isSender = message.messageSenderId === currentUserId;
    const status = metadata.proposalStatus || 'pending';
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message deal-proposal-message';
    
    const messageTime = message.messageCreatedAt ? 
        formatMessageTime(message.messageCreatedAt.toDate()) : 
        'Sending...';
    
    // Status badge configuration
    const statusConfig = {
        'pending': { text: 'Pending', color: '#f39c12', bg: '#fef5e7' },
        'accepted': { text: 'Accepted', color: '#27ae60', bg: '#e8f8f5' },
        'declined': { text: 'Declined', color: '#e74c3c', bg: '#fadbd8' },
        'cancelled': { text: 'Cancelled', color: '#95a5a6', bg: '#ecf0f1' },
        'completed': { text: 'Completed', color: '#3498db', bg: '#ebf5fb' }
    };
    
    const statusInfo = statusConfig[status] || statusConfig['pending'];
    
    // Price comparison
    const originalPrice = metadata.originalListingPrice || 0;
    const offeredPrice = metadata.unitPrice || 0;
    const isNegotiation = metadata.isNegotiation || false;
    
    let priceComparisonHTML = '';
    if (isNegotiation && originalPrice > 0 && offeredPrice !== originalPrice) {
        const difference = originalPrice - offeredPrice;
        if (difference > 0) {
            priceComparisonHTML = `
                <div class="price-comparison savings">
                    💰 ₱${formatNumber(difference)} less than listing
                </div>
            `;
        } else if (difference < 0) {
            priceComparisonHTML = `
                <div class="price-comparison premium">
                    ⬆️ ₱${formatNumber(Math.abs(difference))} above listing
                </div>
            `;
        }
    }
    
    // Meetup location
    let meetupHTML = '';
    if (metadata.meetupLocation) {
        meetupHTML = `
            <div class="proposal-meetup">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                </svg>
                <span class="proposal-meetup-text">${metadata.meetupLocation}</span>
            </div>
        `;
    }
    
    // Action buttons
    let actionButtonsHTML = '';
    if (status === 'pending') {
        if (!isSender) {
            // Receiver can accept/decline
            actionButtonsHTML = `
                <div class="proposal-actions-row">
                    <button class="btn-decline" onclick="declineDealProposal('${message.id}')">
                        Decline
                    </button>
                    <button class="btn-accept" onclick="acceptDealProposal('${message.id}')">
                        Accept Deal
                    </button>
                </div>
            `;
        } else {
            // Sender can cancel
            actionButtonsHTML = `
                <button class="btn-cancel" onclick="cancelDealProposal('${message.id}')">
                    Cancel Proposal
                </button>
            `;
        }
    } else if (status === 'accepted') {
        const transactionId = metadata.transactionId;
        if (transactionId) {
            actionButtonsHTML = `
                <button class="btn-complete" onclick="openTransactionConfirmation('${transactionId}')">
                    Mark as Complete
                </button>
                <button class="btn-cancel-transaction" onclick="requestCancellation('${transactionId}')">
                    Request Cancellation
                </button>
            `;
        }
    }
    
    // Status message
    let statusMessageHTML = '';
    if (status === 'accepted') {
        statusMessageHTML = `<div class="proposal-status-message accepted">Deal accepted! Complete transaction when ready.</div>`;
    } else if (status === 'declined') {
        statusMessageHTML = `<div class="proposal-status-message declined">${t('messages.dealProposalMessage.messages.dealProposalDeclined')}</div>`;
    } else if (status === 'cancelled') {
        statusMessageHTML = `<div class="proposal-status-message cancelled">Proposal cancelled</div>`;
    } else if (status === 'completed') {
        statusMessageHTML = `<div class="proposal-status-message accepted">${t('messages.dealProposalMessage.messages.transactionCompleted')}</div>`;
    }
    
    messageDiv.innerHTML = `
        <div class="deal-proposal-card">
            <div class="proposal-header">
                <div class="proposal-title">
                    <img src="/images/deal-proposal.png" alt="Deal">
                    <span>${t('messages.dealProposalMessage.title')}</span>
                </div>
                <div class="proposal-status" style="color: ${statusInfo.color}; background: ${statusInfo.bg};">
                    ${statusInfo.text}
                </div>
            </div>
            
            <div class="proposal-product-info">
                <div class="proposal-product-name">${metadata.productName || 'N/A'}</div>
                <div class="proposal-product-details">
                    ${metadata.quantity || 0}kg • ₱${formatNumber(metadata.unitPrice || 0)}/kg • ₱${formatNumber(metadata.totalAmount || 0)}
                </div>
                ${priceComparisonHTML}
            </div>
            
            ${meetupHTML}
            
            <div class="proposal-actions">
                ${actionButtonsHTML}
            </div>
            
            ${statusMessageHTML}
            
            <!-- TIME AND STATUS MOVED INSIDE HERE -->
            <div class="proposal-time">${messageTime}</div>
            <div class="proposal-message-status">
                <span class="proposal-message-status-text">${isSender ? t('messages.dealProposalMessage.messages.sentReceived.sent') : t('messages.dealProposalMessage.messages.sentReceived.received')}</span>
                <svg class="proposal-message-status-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            </div>
        </div>
    `;
    
    messagesArea.appendChild(messageDiv);
}

function renderCancellationRequestMessage(message, currentUserId) {
    const messagesArea = document.getElementById('messagesArea');
    const metadata = message.messageMetadata || {};
    const isSender = message.messageSenderId === currentUserId;
    const status = metadata.requestStatus || 'pending';
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message cancellation-request-message';
    
    const messageTime = message.messageCreatedAt ? 
        formatMessageTime(message.messageCreatedAt.toDate()) : 
        t('messages.dealProposalMessage.messages.sending');
    
    let actionButtonsHTML = '';
    if (status === 'pending' && !isSender) {
        actionButtonsHTML = `
            <div class="cancellation-actions">
                <button class="btn-approve" onclick="approveCancellation('${message.id}', '${metadata.transactionId}')">
                    ${t('messages.cancellation.actions.approveAction')}
                </button>
                <button class="btn-reject" onclick="rejectCancellation('${message.id}', '${metadata.transactionId}')">
                    ${t('messages.cancellation.actions.reject')}
                </button>
            </div>
        `;
    }
    
    const statusText = status === 'approved' ? t('messages.cancellation.status.approved') : 
                       status === 'rejected' ? t('messages.cancellation.status.rejected') : 
                       isSender ? t('messages.cancellation.messages.waitingApprovalShort') : t('messages.cancellation.messages.pendingResponse');
    
    messageDiv.innerHTML = `
        <div class="cancellation-card">
            <div class="cancellation-header">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="15" y1="9" x2="9" y2="15"></line>
                    <line x1="9" y1="9" x2="15" y2="15"></line>
                </svg>
                <span>${t('messages.cancellation.requestTitle')}</span>
            </div>
            <div class="cancellation-status">${statusText}</div>
            ${metadata.reason ? `
                <div class="cancellation-reason">
                    <strong>${t('messages.cancellation.reason')}:</strong> ${escapeHtml(metadata.reason)}
                </div>
            ` : ''}
            ${actionButtonsHTML}
            <div class="cancellation-time">${messageTime}</div>
        </div>
    `;
    
    messagesArea.appendChild(messageDiv);
}

function openDealProposalModal() {
    if (!currentListing) {
        showToast(t('messages.dealProposal.errors.sendFailed'), 'error');
        return;
    }
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'dealProposalModal';
    
    const availableQuantity = parseFloat(currentListing.listingQuantityLeftKG || currentListing.listingQuantityKG || 0);
    const listingPrice = parseFloat(currentListing.listingPricePerKG || 0);
    
    modal.innerHTML = `
        <div class="modal-content deal-proposal-modal">
            <div class="modal-header">
                <h2>${t('messages.dealProposal.modalTitle')}</h2>
                <button class="close-btn" onclick="closeDealProposalModal()">&times;</button>
            </div>
            
            <div class="modal-body">
                <div class="listing-info">
                    <div class="listing-image">
                        ${currentListing.listingProductImages && currentListing.listingProductImages.length > 0 ? 
                            `<img src="${currentListing.listingProductImages[0]}" alt="Product">` :
                            '<div class="placeholder-image">📦</div>'
                        }
                    </div>
                    <div class="listing-details">
                        <h3>${currentListing.listingProductName || 'Product'}</h3>
                        <p class="available-stock">Available: ${availableQuantity} kg</p>
                        <p class="listing-price">Listing Price: ₱${formatNumber(listingPrice)}/kg</p>
                    </div>
                </div>
                
                <div class="proposal-form">
                    <div class="form-group">
                        <label>${t('messages.dealProposal.quantityLabel')} *</label>
                        <input type="number" 
                               id="proposalQuantity" 
                               placeholder="${t('messages.dealProposal.quantityPlaceholder')}" 
                               min="1" 
                               max="${availableQuantity}"
                               oninput="updateProposalCalculation()">
                        <span class="error-text" id="quantityError"></span>
                    </div>
                    
                    <div class="form-group">
                        <label>${t('messages.dealProposal.priceLabel')}</label>
                        <input type="number" 
                               id="proposalPrice" 
                               placeholder="${t('messages.dealProposal.pricePlaceholder')}" 
                               min="0"
                               oninput="updateProposalCalculation()">
                        <span class="hint-text">If left empty, listing price will be used</span>
                    </div>
                    
                    <!-- NEW: Location Picker Section -->
                    <div class="location-picker-section">
                        <div class="location-picker-header">
                            <h4>${t('messages.dealProposal.deliveryLabel')}</h4>
                            <span class="optional-badge">Optional</span>
                        </div>
                        
                        <input type="text" 
                               id="locationSearchBox" 
                               class="location-search-box"
                               placeholder="${t('messages.dealProposal.deliveryPlaceholder')}">
                        
                        <div id="mapContainer" class="map-container"></div>
                        
                        <div id="selectedLocationDisplay" class="selected-location-display">
                            <span class="location-icon">📍</span>
                            <div class="location-details">
                                <div class="location-name" id="selectedLocationName">${t('messages.dealProposal.selectLocation')}</div>
                                <div class="location-subtext">Tap to change or clear</div>
                            </div>
                            <button class="btn-clear-location" onclick="clearSelectedLocation()">${t('messages.dealProposal.clearLocation')}</button>
                        </div>
                        
                        <p class="location-hint">You can search for a place or click on the map to select a meetup location</p>
                    </div>
                    
                    <div class="calculation-summary">
                        <div class="calc-row">
                            <span>${t('messages.dealProposalMessage.quantity')}:</span>
                            <strong id="calcQuantity">-- kg</strong>
                        </div>
                        <div class="calc-row">
                            <span>${t('messages.dealProposalMessage.pricePerKg')}:</span>
                            <strong id="calcPrice">₱--</strong>
                        </div>
                        <div class="calc-row total">
                            <span>${t('messages.dealProposal.totalLabel')}:</span>
                            <strong id="calcTotal">₱--</strong>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="modal-footer">
                <button class="btn-secondary" onclick="closeDealProposalModal()">${t('messages.dealProposal.cancelButton')}</button>
                <button class="btn-primary" id="sendProposalBtn" onclick="sendDealProposal()" disabled>
                    ${t('messages.dealProposal.sendButton')}
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.style.display = 'block';
    
    // Store listing price for calculation
    window.proposalListingPrice = listingPrice;
    window.proposalAvailableQuantity = availableQuantity;
    
    // Initialize map after modal is visible
    setTimeout(() => {
        initializeLocationPicker();
    }, 100);
}

// Location picker variables
let proposalMap = null;
let proposalMarker = null;
let proposalSelectedLocation = null;
let proposalAutocomplete = null;

function initializeLocationPicker() {
    // Default location (Cebu City, Philippines)
    const defaultLocation = { lat: 10.3157, lng: 123.8854 };
    
    // Initialize map
    proposalMap = new google.maps.Map(document.getElementById('mapContainer'), {
        center: defaultLocation,
        zoom: 13,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false
    });
    
    // Initialize marker
    proposalMarker = new google.maps.Marker({
        map: proposalMap,
        position: defaultLocation,
        draggable: true,
        animation: google.maps.Animation.DROP
    });
    
    // Handle marker drag
    proposalMarker.addListener('dragend', () => {
        const position = proposalMarker.getPosition();
        reverseGeocode(position.lat(), position.lng());
    });
    
    // Handle map click
    proposalMap.addListener('click', (event) => {
        const position = event.latLng;
        proposalMarker.setPosition(position);
        proposalMap.panTo(position);
        reverseGeocode(position.lat(), position.lng());
    });
    
    // Initialize autocomplete
    const searchBox = document.getElementById('locationSearchBox');
    proposalAutocomplete = new google.maps.places.Autocomplete(searchBox, {
        componentRestrictions: { country: 'ph' },
        fields: ['place_id', 'geometry', 'name', 'formatted_address'],
        types: ['establishment', 'geocode']
    });
    
    // Bias autocomplete results to Central Visayas
    const centralVisayasBounds = new google.maps.LatLngBounds(
        new google.maps.LatLng(9.0, 123.0),  // Southwest
        new google.maps.LatLng(11.5, 125.0)   // Northeast
    );
    proposalAutocomplete.setBounds(centralVisayasBounds);
    
    // Handle place selection
    proposalAutocomplete.addListener('place_changed', () => {
        const place = proposalAutocomplete.getPlace();
        
        if (!place.geometry || !place.geometry.location) {
            showToast('Place details not found', 'error');
            return;
        }
        
        const location = place.geometry.location;
        proposalMarker.setPosition(location);
        proposalMap.panTo(location);
        proposalMap.setZoom(16);
        
        // Store selected location
        proposalSelectedLocation = {
            name: place.name || place.formatted_address || t('messages.location.selectedLocation'),
            latitude: location.lat(),
            longitude: location.lng(),
            placeId: place.place_id || ''
        };
        
        updateLocationDisplay();
    });
    
    // Try to get user's current location
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                proposalMap.setCenter(userLocation);
                proposalMarker.setPosition(userLocation);
            },
            () => {
                // Silently fail - default location already set
                console.log('Geolocation not available, using default location');
            }
        );
    }
}

function reverseGeocode(lat, lng) {
    const geocoder = new google.maps.Geocoder();
    const latlng = { lat: lat, lng: lng };
    
    geocoder.geocode({ location: latlng }, (results, status) => {
        if (status === 'OK' && results[0]) {
            const locationName = findBestLocationName(results);
            
            proposalSelectedLocation = {
                name: locationName,
                latitude: lat,
                longitude: lng,
                placeId: results[0].place_id || ''
            };
            
            updateLocationDisplay();
        } else {
            proposalSelectedLocation = {
                name: `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
                latitude: lat,
                longitude: lng,
                placeId: ''
            };
            
            updateLocationDisplay();
        }
    });
}

function findBestLocationName(results) {
    // Try to find the most meaningful location name
    for (const result of results) {
        const addressComponents = result.address_components;
        
        // Priority 1: Establishment name
        const establishment = addressComponents.find(c => c.types.includes('establishment'));
        if (establishment && establishment.long_name.length > 3) {
            return establishment.long_name;
        }
        
        // Priority 2: Point of interest
        const poi = addressComponents.find(c => c.types.includes('point_of_interest'));
        if (poi && poi.long_name.length > 3) {
            return poi.long_name;
        }
        
        // Priority 3: Premise (building)
        const premise = addressComponents.find(c => c.types.includes('premise'));
        if (premise && premise.long_name.length > 3) {
            return premise.long_name;
        }
    }
    
    // Fallback to first result's formatted address
    const firstResult = results[0];
    const route = firstResult.address_components.find(c => c.types.includes('route'));
    const sublocality = firstResult.address_components.find(c => c.types.includes('sublocality') || c.types.includes('sublocality_level_1'));
    
    if (route && sublocality) {
        return `${route.long_name}, ${sublocality.long_name}`;
    }
    
    if (route) {
        return route.long_name;
    }
    
    const locality = firstResult.address_components.find(c => c.types.includes('locality'));
    if (locality) {
        return locality.long_name;
    }
    
    return t('messages.location.selectedLocation');
}

function updateLocationDisplay() {
    const display = document.getElementById('selectedLocationDisplay');
    const locationName = document.getElementById('selectedLocationName');
    
    if (proposalSelectedLocation) {
        display.classList.add('active');
        locationName.textContent = proposalSelectedLocation.name;
    }
}

window.clearSelectedLocation = function() {
    proposalSelectedLocation = null;
    const display = document.getElementById('selectedLocationDisplay');
    display.classList.remove('active');
    
    // Clear search box
    const searchBox = document.getElementById('locationSearchBox');
    if (searchBox) {
        searchBox.value = '';
    }
    
    showToast(t('messages.toast.locationCleared'), 'info');
};

window.closeDealProposalModal = function() {
    const modal = document.getElementById('dealProposalModal');
    if (modal) {
        modal.remove();
    }
};

window.updateProposalCalculation = function() {
    const quantityInput = document.getElementById('proposalQuantity');
    const priceInput = document.getElementById('proposalPrice');
    const quantityError = document.getElementById('quantityError');
    const sendBtn = document.getElementById('sendProposalBtn');
    
    const quantity = parseFloat(quantityInput.value) || 0;
    const customPrice = parseFloat(priceInput.value) || 0;
    const price = customPrice > 0 ? customPrice : window.proposalListingPrice;
    
    // Validate quantity
    if (quantity > window.proposalAvailableQuantity) {
        quantityError.textContent = `Cannot exceed available stock (${window.proposalAvailableQuantity} kg)`;
        sendBtn.disabled = true;
    } else if (quantity <= 0) {
        quantityError.textContent = '';
        sendBtn.disabled = true;
    } else {
        quantityError.textContent = '';
        sendBtn.disabled = false;
    }
    
    // Update calculation
    document.getElementById('calcQuantity').textContent = quantity > 0 ? `${quantity} kg` : '-- kg';
    document.getElementById('calcPrice').textContent = price > 0 ? `₱${formatNumber(price)}` : '₱--';
    
    const total = quantity * price;
    document.getElementById('calcTotal').textContent = total > 0 ? `₱${formatNumber(total)}` : '₱--';
};

window.sendDealProposal = async function() {
    const quantityInput = document.getElementById('proposalQuantity');
    const priceInput = document.getElementById('proposalPrice');
    const sendBtn = document.getElementById('sendProposalBtn');
    
    const quantity = parseInt(quantityInput.value);
    const customPrice = parseFloat(priceInput.value) || 0;
    const unitPrice = customPrice > 0 ? customPrice : window.proposalListingPrice;
    const totalAmount = quantity * unitPrice;
    
    if (quantity <= 0 || quantity > window.proposalAvailableQuantity) {
        showToast(t('messages.dealProposal.errors.invalidQuantity'), 'error');
        return;
    }
    
    sendBtn.disabled = true;
    sendBtn.textContent = t('messages.upload.progress');
    
    try {
        const currentUser = getCurrentUser();
        const proposalData = {
            listingId: currentListing.listingId || currentListing.id,
            productName: currentListing.listingProductName,
            quantity: quantity,
            unitPrice: unitPrice,
            originalListingPrice: window.proposalListingPrice,
            totalAmount: totalAmount,
            meetupLocation: proposalSelectedLocation?.name || '',
            meetupLocationId: proposalSelectedLocation?.placeId || '',
            meetupLatitude: proposalSelectedLocation?.latitude || null,
            meetupLongitude: proposalSelectedLocation?.longitude || null,
            proposalStatus: 'pending',
            isNegotiation: customPrice > 0 && customPrice !== window.proposalListingPrice
        };
        
        const messageData = {
            messageSenderId: currentUser.uid,
            messageReceiverId: currentReceiverId,
            messageText: customPrice > 0 && customPrice !== window.proposalListingPrice ? 
                t('messages.dealProposal.priceOffer') : t('messages.dealProposal.proposalSent'),
            messageType: 'deal_proposal',
            messageStatus: 'sent',
            messageCreatedAt: serverTimestamp(),
            messageDeliveredAt: null,
            messageReadAt: null,
            messageMediaUrl: null,
            messageMetadata: proposalData
        };
        
        const messagesRef = collection(db, COLLECTIONS.CONVERSATIONS);
        const conversationMessagesRef = collection(doc(messagesRef, currentConversationId), COLLECTIONS.MESSAGES);
        
        await addDoc(conversationMessagesRef, messageData);
        
        await updateDoc(doc(db, COLLECTIONS.CONVERSATIONS, currentConversationId), {
            'lastMessage': {
                lastMessageText: messageData.messageText,
                lastMessageTimestamp: serverTimestamp(),
                lastMessageSenderId: currentUser.uid
            },
            conversationUpdatedAt: serverTimestamp(),
            canProposeDeal: false
        });
        
        closeDealProposalModal();
        showToast(t('messages.dealProposal.success.sent'), 'success');
        
    } catch (error) {
        console.error('Error sending proposal:', error);
        showToast(t('messages.dealProposal.errors.sendFailed'), 'error');
        sendBtn.disabled = false;
        sendBtn.textContent = t('messages.dealProposal.sendButton');
    }
};

// Deal Proposal Actions
window.acceptDealProposal = async function(messageId) {
    showConfirmDialog(t('messages.confirmDialog.acceptProposal'), async () => {
        try {
            const messageRef = doc(db, COLLECTIONS.CONVERSATIONS, currentConversationId, COLLECTIONS.MESSAGES, messageId);
            const messageDoc = await getDoc(messageRef);
            
            if (!messageDoc.exists()) {
                showToast(t('messages.toast.proposalNotFound'), 'error');
                return;
            }
            
            const message = messageDoc.data();
            const metadata = message.messageMetadata;
            
            // Get listing to determine roles
            const listingDoc = await getDoc(doc(db, COLLECTIONS.LISTINGS, metadata.listingId));
            if (!listingDoc.exists()) {
                showToast(t('messages.toast.listingNotFound'), 'error');
                return;
            }
            
            const listing = listingDoc.data();
            const currentUser = getCurrentUser();
            
            // Determine buyer and seller
            const sellerId = listing.listingSellerID;
            const buyerId = sellerId === currentUser.uid ? message.messageSenderId : currentUser.uid;
            
            // Create transaction
            const transactionData = {
                transactionBuyerID: buyerId,
                transactionSellerID: sellerId,
                transactionListingID: metadata.listingId,
                transactionQuantityOrdered: metadata.quantity,
                transactionUnitPrice: metadata.unitPrice,
                transactionTotalAmount: metadata.totalAmount,
                transactionOrderDate: serverTimestamp(),
                transactionStatus: 'agreed',
                sellerConfirmed: false,
                buyerConfirmed: false,
                buyerRequestedCancellation: false,
                sellerRequestedCancellation: false,
                agreedQuantity: metadata.quantity,
                agreedUnitPrice: metadata.unitPrice,
                agreedTotalAmount: metadata.totalAmount,
                agreedMeetupLocation: metadata.meetupLocation || null,
                agreedMeetupLocationId: metadata.meetupLocationId || null
            };
            
            const transactionRef = await addDoc(collection(db, COLLECTIONS.TRANSACTIONS), transactionData);
            
            // Update proposal message
            await updateDoc(messageRef, {
                'messageMetadata.proposalStatus': 'accepted',
                'messageMetadata.transactionId': transactionRef.id,
                'messageMetadata.finalNegotiatedPrice': metadata.unitPrice,
                messageUpdatedAt: serverTimestamp()
            });
            
            // Update conversation - set transaction status to ongoing
            await updateDoc(doc(db, COLLECTIONS.CONVERSATIONS, currentConversationId), {
                conversationUpdatedAt: serverTimestamp(),
                buyerTransactionStatus: 'ongoing',
                sellerTransactionStatus: 'ongoing'
            });
            
            showToast('Deal accepted! Transaction created.', 'success');
            
            showToast(t('messages.toast.proposalAccepted'), 'success');
            
        } catch (error) {
            console.error('Error accepting proposal:', error);
            showToast(t('messages.transaction.errors.confirmFailed'), 'error');
        }
    });
};

window.declineDealProposal = async function(messageId) {
    showConfirmDialog(t('messages.confirmDialog.declineProposal'), async () => {
        try {
            const messageRef = doc(db, COLLECTIONS.CONVERSATIONS, currentConversationId, COLLECTIONS.MESSAGES, messageId);
            
            await updateDoc(messageRef, {
                'messageMetadata.proposalStatus': 'declined',
                messageUpdatedAt: serverTimestamp()
            });
            
            // Re-enable proposals - SET canProposeDeal to TRUE
            await updateDoc(doc(db, COLLECTIONS.CONVERSATIONS, currentConversationId), {
                canProposeDeal: true,
                conversationUpdatedAt: serverTimestamp()
            });
            
            showToast(t('messages.toast.proposalDeclined'), 'info');
            
        } catch (error) {
            console.error('Error declining proposal:', error);
            showToast(t('messages.toast.proposalDeclineFailed'), 'error');
        }
    });
};

window.cancelDealProposal = async function(messageId) {
    showConfirmDialog(t('messages.confirmDialog.cancelProposal'), async () => {
        try {
            const messageRef = doc(db, COLLECTIONS.CONVERSATIONS, currentConversationId, COLLECTIONS.MESSAGES, messageId);
            
            await updateDoc(messageRef, {
                'messageMetadata.proposalStatus': 'cancelled',
                messageUpdatedAt: serverTimestamp()
            });
            
            // Re-enable proposals - SET canProposeDeal to TRUE
            await updateDoc(doc(db, COLLECTIONS.CONVERSATIONS, currentConversationId), {
                canProposeDeal: true,
                conversationUpdatedAt: serverTimestamp()
            });
            
            showToast(t('messages.toast.proposalCancelled'), 'info');
            
        } catch (error) {
            console.error('Error cancelling proposal:', error);
            showToast(t('messages.toast.proposalCancelFailed'), 'error');
        }
    });
};

// Transaction Confirmation with real-time updates
window.openTransactionConfirmation = async function(transactionId) {
    try {
        const transactionDoc = await getDoc(doc(db, COLLECTIONS.TRANSACTIONS, transactionId));
        
        if (!transactionDoc.exists()) {
            showToast(t('messages.transaction.errors.notFound'), 'error');
            return;
        }
        
        const transaction = { id: transactionDoc.id, ...transactionDoc.data() };
        
        // Create modal
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'transactionModal';
        modal.setAttribute('data-transaction-id', transactionId);
        
        document.body.appendChild(modal);
        modal.style.display = 'block';
        
        // Set up real-time listener
        const transactionRef = doc(db, COLLECTIONS.TRANSACTIONS, transactionId);
        const unsubscribe = onSnapshot(transactionRef, (docSnap) => {
            if (docSnap.exists()) {
                const updatedTransaction = { id: docSnap.id, ...docSnap.data() };
                renderTransactionModal(updatedTransaction);
            }
        });
        
        // Store unsubscribe function for cleanup
        modal.unsubscribeTransaction = unsubscribe;
        
    } catch (error) {
        console.error('Error opening transaction:', error);
        showToast(t('messages.transaction.errors.loadFailed'), 'error');
    }
};

function renderTransactionModal(transaction) {
    const modal = document.getElementById('transactionModal');
    if (!modal) return;
    
    const currentUser = getCurrentUser();
    const isBuyer = transaction.transactionBuyerID === currentUser.uid;
    
    const buyerConfirmed = transaction.buyerConfirmed || false;
    const sellerConfirmed = transaction.sellerConfirmed || false;
    const userConfirmed = isBuyer ? buyerConfirmed : sellerConfirmed;
    const otherConfirmed = isBuyer ? sellerConfirmed : buyerConfirmed;
    const isCompleted = transaction.transactionStatus === 'completed';
    
    let statusMessage = '';
    let actionButton = '';
    
    if (isCompleted) {
        statusMessage = `<div class="status-completed">${t('messages.transaction.statusMessages.completed')}</div>`;
    } else if (userConfirmed && otherConfirmed) {
        statusMessage = `<div class="status-completed">${t('messages.transaction.statusMessages.bothConfirmed')}</div>`;
    } else if (userConfirmed) {
        const party = isBuyer ? t('messages.transaction.parties.seller') : t('messages.transaction.parties.buyer');
        statusMessage = `<div class="status-waiting">${t('messages.transaction.statusMessages.waitingForOther', { party })}</div>`;
    } else if (otherConfirmed) {
        const party = isBuyer ? t('messages.transaction.parties.seller') : t('messages.transaction.parties.buyer');
        statusMessage = `<div class="status-action">${t('messages.transaction.statusMessages.otherConfirmed', { party })}</div>`;
        actionButton = `
            <button class="btn-primary btn-confirm" onclick="confirmTransaction('${transaction.id}', ${isBuyer})">
                ${isBuyer ? t('messages.transaction.confirmReceipt') : t('messages.transaction.confirmDelivery')}
            </button>
        `;
    } else {
        statusMessage = `<div class="status-pending">${t('messages.transaction.statusMessages.waitingBoth')}</div>`;
        actionButton = `
            <button class="btn-primary btn-confirm" onclick="confirmTransaction('${transaction.id}', ${isBuyer})">
                ${isBuyer ? t('messages.transaction.confirmReceipt') : t('messages.transaction.confirmDelivery')}
            </button>
        `;
    }
    
    modal.innerHTML = `
        <div class="modal-content transaction-modal">
            <div class="modal-header">
                <h2>${t('messages.transaction.modalTitle')}</h2>
                <button class="close-btn" onclick="closeTransactionModal()">&times;</button>
            </div>
            
            <div class="modal-body">
                ${statusMessage}
                
                <div class="transaction-details">
                    <div class="detail-row">
                        <span>${t('messages.transaction.transactionId')}:</span>
                        <strong>#${transaction.id.slice(-8)}</strong>
                    </div>
                    <div class="detail-row">
                        <span>${t('messages.transaction.quantity')}:</span>
                        <strong>${transaction.transactionQuantityOrdered} kg</strong>
                    </div>
                    <div class="detail-row">
                        <span>${t('messages.transaction.pricePerKg')}:</span>
                        <strong>₱${formatNumber(transaction.transactionUnitPrice)}/kg</strong>
                    </div>
                    <div class="detail-row total">
                        <span>Total Amount:</span>
                        <strong>₱${formatNumber(transaction.transactionTotalAmount)}</strong>
                    </div>
                    ${transaction.agreedMeetupLocation ? `
                        <div class="detail-row">
                            <span>📍 Meetup Location:</span>
                            <strong>${transaction.agreedMeetupLocation}</strong>
                        </div>
                    ` : ''}
                </div>
                
                <div class="confirmation-status">
                    <div class="confirmation-item ${buyerConfirmed ? 'confirmed' : ''}">
                        <span class="confirmation-icon">${buyerConfirmed ? '✓' : '○'}</span>
                        <span>Buyer Confirmation</span>
                    </div>
                    <div class="confirmation-item ${sellerConfirmed ? 'confirmed' : ''}">
                        <span class="confirmation-icon">${sellerConfirmed ? '✓' : '○'}</span>
                        <span>Seller Confirmation</span>
                    </div>
                </div>
            </div>
            
            <div class="modal-footer">
                ${!isCompleted && !userConfirmed ? actionButton : ''}
                <button class="btn-secondary" onclick="closeTransactionModal()">Close</button>
            </div>
        </div>
    `;
}

window.closeTransactionModal = function() {
    const modal = document.getElementById('transactionModal');
    if (modal) {
        // Clean up listener
        if (modal.unsubscribeTransaction) {
            modal.unsubscribeTransaction();
        }
        modal.remove();
    }
};

window.confirmTransaction = async function(transactionId, isBuyer) {
    showConfirmDialog(
        `Confirm that you have ${isBuyer ? 'received the items' : 'delivered the items'}?`,
        async () => {
            try {
                const transactionRef = doc(db, COLLECTIONS.TRANSACTIONS, transactionId);
                const transactionDoc = await getDoc(transactionRef);
                
                if (!transactionDoc.exists()) {
                    showToast('Transaction not found', 'error');
                    return;
                }
                
                const transaction = transactionDoc.data();
                const updates = {};
                const now = Timestamp.now();
                
                if (isBuyer) {
                    updates.buyerConfirmed = true;
                    updates.buyerConfirmedAt = now;
                } else {
                    updates.sellerConfirmed = true;
                    updates.sellerConfirmedAt = now;
                }
                
                // Check if both will be confirmed after this update
                const bothConfirmed = (transaction.buyerConfirmed || isBuyer) && 
                                     (transaction.sellerConfirmed || !isBuyer);
                
                if (bothConfirmed) {
                    updates.transactionStatus = 'completed';
                    updates.completedTransactionAt = now;
                    
                    console.log('✅ Both parties confirmed - marking as completed');
                    
                    // Use Firestore transaction to update everything atomically
                    await runTransaction(db, async (firestoreTransaction) => {
                        // Read listing first
                        const listingRef = doc(db, COLLECTIONS.LISTINGS, transaction.transactionListingID);
                        const listingDoc = await firestoreTransaction.get(listingRef);
                        
                        // Update transaction
                        firestoreTransaction.update(transactionRef, updates);
                        
                        // Update listing inventory
                        if (listingDoc.exists()) {
                            const listing = listingDoc.data();
                            const currentQuantity = parseFloat(listing.listingQuantityLeftKG || listing.listingQuantityKG || 0);
                            const soldQuantity = transaction.transactionQuantityOrdered;
                            const newQuantity = Math.max(0, currentQuantity - soldQuantity);
                            
                            firestoreTransaction.update(listingRef, {
                                listingQuantityLeftKG: newQuantity.toString(),
                                listingUpdatedAt: serverTimestamp()
                            });
                            
                            console.log(`📦 Updated listing inventory: ${currentQuantity} -> ${newQuantity} kg`);
                        }
                    });
                    
                    // Update conversation to completed status
                    await updateDoc(doc(db, COLLECTIONS.CONVERSATIONS, currentConversationId), {
                        buyerTransactionStatus: 'completed',
                        sellerTransactionStatus: 'completed',
                        conversationUpdatedAt: serverTimestamp()
                    });
                    
                    // After 3 seconds, clear status and re-enable proposals
                    setTimeout(async () => {
                        await updateDoc(doc(db, COLLECTIONS.CONVERSATIONS, currentConversationId), {
                            canProposeDeal: true,
                            buyerTransactionStatus: 'none',
                            sellerTransactionStatus: 'none',
                            conversationUpdatedAt: serverTimestamp()
                        });
                        console.log('✅ Transaction status cleared - ready for new proposals');
                    }, 3000);
                    
                    // Update all related deal proposal messages to completed
                    await updateRelatedProposalsToCompleted(transactionId);
                    
                    showToast(t('messages.transaction.success.completed'), 'success');
                    
                } else {
                    // Only one party confirmed - update conversation status
                    await updateDoc(transactionRef, updates);
                    
                    const conversationUpdates = {};
                    if (isBuyer) {
                        conversationUpdates.buyerTransactionStatus = 'confirmation_pending';
                    } else {
                        conversationUpdates.sellerTransactionStatus = 'confirmation_pending';
                    }
                    conversationUpdates.conversationUpdatedAt = serverTimestamp();
                    
                    await updateDoc(doc(db, COLLECTIONS.CONVERSATIONS, currentConversationId), conversationUpdates);
                    
                    showToast(t('messages.transaction.success.confirmed'), 'info');
                }
                
            } catch (error) {
                console.error('Error confirming transaction:', error);
                showToast(t('messages.transaction.errors.confirmFailed'), 'error');
            }
        }
    );
};

// Add this new helper function
async function updateRelatedProposalsToCompleted(transactionId) {
    try {
        console.log('📝 Updating related proposals to completed...');
        
        const messagesRef = collection(db, COLLECTIONS.CONVERSATIONS, currentConversationId, COLLECTIONS.MESSAGES);
        const q = query(
            messagesRef,
            where('messageType', '==', 'deal_proposal'),
            where('messageMetadata.transactionId', '==', transactionId)
        );
        
        const querySnapshot = await getDocs(q);
        
        console.log(`Found ${querySnapshot.size} proposals to update`);
        
        const updatePromises = [];
        querySnapshot.forEach((docSnap) => {
            const messageRef = doc(db, COLLECTIONS.CONVERSATIONS, currentConversationId, COLLECTIONS.MESSAGES, docSnap.id);
            updatePromises.push(
                updateDoc(messageRef, {
                    'messageMetadata.proposalStatus': 'completed',
                    messageUpdatedAt: serverTimestamp()
                })
            );
        });
        
        await Promise.all(updatePromises);
        console.log('✅ All proposals updated to completed');
        
    } catch (error) {
        console.error('Error updating proposals:', error);
    }
}
// Cancellation Request
window.requestCancellation = async function(transactionId) {
    showPromptDialog(
        t('messages.cancellation.modalTitle'),
        t('messages.cancellation.reasonPlaceholder'),
        async (reason) => {
            try {
                const currentUser = getCurrentUser();
                const userData = getCurrentUserData();
                
                const requestData = {
                    transactionId: transactionId,
                    reason: reason,
                    requestStatus: 'pending',
                    requesterName: userData.userName,
                    requestedAt: serverTimestamp()
                };
                
                const messageData = {
                    messageSenderId: currentUser.uid,
                    messageReceiverId: currentReceiverId,
                    messageText: t('messages.cancellation.requestedMessage'),
                    messageType: 'cancellation_request',
                    messageStatus: 'sent',
                    messageCreatedAt: serverTimestamp(),
                    messageMetadata: requestData
                };
                
                const messagesRef = collection(db, COLLECTIONS.CONVERSATIONS);
                const conversationMessagesRef = collection(doc(messagesRef, currentConversationId), COLLECTIONS.MESSAGES);
                
                await addDoc(conversationMessagesRef, messageData);
                
                // Update transaction status
                await updateDoc(doc(db, COLLECTIONS.TRANSACTIONS, transactionId), {
                    transactionStatus: 'cancellation_requested'
                });
                
                // Update conversation
                await updateDoc(doc(db, COLLECTIONS.CONVERSATIONS, currentConversationId), {
                    'lastMessage': {
                        lastMessageText: messageData.messageText,
                        lastMessageTimestamp: serverTimestamp(),
                        lastMessageSenderId: currentUser.uid
                    },
                    conversationUpdatedAt: serverTimestamp()
                });
                
                showToast(t('messages.cancellation.success.requested'), 'info');
                
            } catch (error) {
                console.error('Error requesting cancellation:', error);
                showToast(t('messages.cancellation.errors.requestFailed'), 'error');
            }
        }
    );
};

window.approveCancellation = async function(messageId, transactionId) {
    showConfirmDialog(t('messages.cancellation.actions.approve'), async () => {
        try {
            const messageRef = doc(db, COLLECTIONS.CONVERSATIONS, currentConversationId, COLLECTIONS.MESSAGES, messageId);
            
            await updateDoc(messageRef, {
                'messageMetadata.requestStatus': 'approved',
                messageUpdatedAt: serverTimestamp()
            });
            
            // Update transaction
            await updateDoc(doc(db, COLLECTIONS.TRANSACTIONS, transactionId), {
                transactionStatus: 'cancelled',
                completedTransactionAt: serverTimestamp()
            });
            
            // RE-ENABLE proposals after cancellation - SET canProposeDeal to TRUE
            setTimeout(async () => {
                await updateDoc(doc(db, COLLECTIONS.CONVERSATIONS, currentConversationId), {
                    canProposeDeal: true,
                    conversationUpdatedAt: serverTimestamp()
                });
            }, 1000);
            
            showToast(t('messages.cancellation.success.approved'), 'success');
            
        } catch (error) {
            console.error('Error approving cancellation:', error);
            showToast(t('messages.cancellation.errors.approveFailed'), 'error');
        }
    });
};

function handleUrlParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const conversationId = urlParams.get('conversation');
    
    if (conversationId) {
        console.log('📌 Opening conversation from URL:', conversationId);
        
        // Wait for conversations to load, then open the specified one
        setTimeout(async () => {
            try {
                const conversationDoc = await getDoc(doc(db, COLLECTIONS.CONVERSATIONS, conversationId));
                
                if (!conversationDoc.exists()) {
                    console.error('❌ Conversation not found:', conversationId);
                    showToast(t('messages.toast.conversationNotFound'), 'error');
                    return;
                }
                
                const conversation = conversationDoc.data();
                const currentUser = getCurrentUser();
                const otherParticipantId = conversation.participants.find(id => id !== currentUser.uid);
                const otherParticipantDetails = conversation.participantDetails?.[otherParticipantId];
                const otherParticipantName = otherParticipantDetails?.participantName || 'User';
                
                // Open the conversation
                await openConversation(
                    conversationId, 
                    otherParticipantId, 
                    otherParticipantName, 
                    otherParticipantDetails, 
                    conversation,
                    null
                );
                
                // Clear URL parameter
                window.history.replaceState({}, '', '/messages.html');
                
            } catch (error) {
                console.error('❌ Error opening conversation from URL:', error);
                showToast('Failed to open conversation', 'error');
            }
        }, 1000);
    }
}


window.rejectCancellation = async function(messageId, transactionId) {
    showConfirmDialog('Reject this cancellation request?', async () => {
        try {
            const messageRef = doc(db, COLLECTIONS.CONVERSATIONS, currentConversationId, COLLECTIONS.MESSAGES, messageId);
            
            await updateDoc(messageRef, {
                'messageMetadata.requestStatus': 'rejected',
                messageUpdatedAt: serverTimestamp()
            });
            
            // Restore transaction to agreed status
            await updateDoc(doc(db, COLLECTIONS.TRANSACTIONS, transactionId), {
                transactionStatus: 'agreed'
            });
            
            showToast('Cancellation request rejected', 'info');
            
        } catch (error) {
            console.error('Error rejecting cancellation:', error);
            showToast('Failed to reject cancellation', 'error');
        }
    });
};


function setupMessageInputForConversation() {
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const attachmentBtn = document.getElementById('attachmentBtn');
    const mediaInput = document.getElementById('mediaInput');
    
    if (!messageInput || !sendBtn) return;
    
    // Setup message input enter key
    if (!messageInput.hasAttribute('data-listener-bound')) {
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        messageInput.setAttribute('data-listener-bound', 'true');
    }
    
    // Setup send button
    if (!sendBtn.hasAttribute('data-listener-bound')) {
        sendBtn.addEventListener('click', sendMessage);
        sendBtn.setAttribute('data-listener-bound', 'true');
    }
    
    // Setup attachment button - FIXED
    if (attachmentBtn && mediaInput && !attachmentBtn.hasAttribute('data-listener-bound')) {
        attachmentBtn.addEventListener('click', () => {
            console.log('📎 Attachment button clicked');
            mediaInput.click();
        });
        attachmentBtn.setAttribute('data-listener-bound', 'true');
    }
    
    // Setup media input change listener - FIXED
    if (mediaInput && !mediaInput.hasAttribute('data-listener-bound')) {
        mediaInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            
            if (!file) return;
            
            const validImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            const validVideoTypes = ['video/mp4', 'video/webm', 'video/ogg'];
            
            const isImage = validImageTypes.includes(file.type);
            const isVideo = validVideoTypes.includes(file.type);
            
            if (!isImage && !isVideo) {
                showToast('Please select a valid image or video file', 'error');
                mediaInput.value = '';
                return;
            }
            
            const maxSize = 10 * 1024 * 1024;
            if (file.size > maxSize) {
                showToast('File size must be less than 10MB', 'error');
                mediaInput.value = '';
                return;
            }
            
            await uploadMedia(file, isImage ? 'image' : 'video');
            mediaInput.value = '';
        });
        mediaInput.setAttribute('data-listener-bound', 'true');
    }
    
    messageInput.focus();
}


async function uploadMedia(file, mediaType) {
    if (uploadInProgress) {
        showToast('Please wait for the current upload to complete', 'info');
        return;
    }
    
    if (!currentConversationId || !currentReceiverId) {
        showToast('Please select a conversation first', 'error');
        return;
    }
    
    uploadInProgress = true;
    
    const uploadProgress = document.getElementById('uploadProgress');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const attachmentBtn = document.getElementById('attachmentBtn');
    
    if (messageInput) messageInput.disabled = true;
    if (sendBtn) sendBtn.disabled = true;
    if (attachmentBtn) attachmentBtn.disabled = true;
    
    if (uploadProgress) uploadProgress.style.display = 'block';
    
    try {
        const currentUser = getCurrentUser();
        const timestamp = Date.now();
        const fileName = `${mediaType}_${timestamp}_${currentUser.uid}`;
        const storageReference = ref(storage, `chat_media/${currentConversationId}/${fileName}`);
        
        const uploadTask = uploadBytesResumable(storageReference, file);
        
        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                if (progressFill) progressFill.style.width = `${progress}%`;
                if (progressText) progressText.textContent = t('messages.upload.progressPercent', { percent: Math.round(progress) });
            },
            (error) => {
                console.error('Upload error:', error);
                showToast('Failed to upload media. Please try again.', 'error');
                uploadInProgress = false;
                if (uploadProgress) uploadProgress.style.display = 'none';
                if (messageInput) messageInput.disabled = false;
                if (sendBtn) sendBtn.disabled = false;
                if (attachmentBtn) attachmentBtn.disabled = false;
            },
            async () => {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                await sendMediaMessage(downloadURL, mediaType);
                
                uploadInProgress = false;
                if (uploadProgress) uploadProgress.style.display = 'none';
                if (messageInput) messageInput.disabled = false;
                if (sendBtn) sendBtn.disabled = false;
                if (attachmentBtn) attachmentBtn.disabled = false;
            }
        );
        
    } catch (error) {
        console.error('Error uploading media:', error);
        showToast('Failed to upload media. Please try again.', 'error');
        uploadInProgress = false;
        if (uploadProgress) uploadProgress.style.display = 'none';
        if (messageInput) messageInput.disabled = false;
        if (sendBtn) sendBtn.disabled = false;
        if (attachmentBtn) attachmentBtn.disabled = false;
    }
}

async function sendMediaMessage(mediaUrl, mediaType) {
    // Check if blocked
    if (isBlockedByOther || hasBlockedOther) {
        if (isBlockedByOther) {
            showToast(t('messages.block.cannotSendBlockedByOther') || 'You cannot send messages. This user has blocked you.', 'error');
        } else if (hasBlockedOther) {
            showToast(t('messages.block.cannotSendBlockedByMe') || 'You cannot send messages. You have blocked this user.', 'error');
        }
        return;
    }
    
    const messageText = mediaType === 'image' ? '📸 Photo' : '🎥 Video';
    await sendMessageToFirestore(messageText, mediaType, mediaUrl);
}

async function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    
    if (!messageInput || !currentConversationId || !currentReceiverId) return;
    
    // Check if blocked
    if (isBlockedByOther || hasBlockedOther) {
        if (isBlockedByOther) {
            showToast(t('messages.block.cannotSendBlockedByOther') || 'You cannot send messages. This user has blocked you.', 'error');
        } else if (hasBlockedOther) {
            showToast(t('messages.block.cannotSendBlockedByMe') || 'You cannot send messages. You have blocked this user.', 'error');
        }
        return;
    }
    
    const messageText = messageInput.value.trim();
    
    if (!messageText) return;
    
    messageInput.value = '';
    
    await sendMessageToFirestore(messageText, 'text', null);
}

async function sendMessageToFirestore(messageText, messageType, mediaUrl) {
    const currentUser = getCurrentUser();
    
    if (!currentUser) {
        console.error('No user logged in');
        return;
    }
    
    try {
        const now = serverTimestamp();
        
        const messageData = {
            messageSenderId: currentUser.uid,
            messageReceiverId: currentReceiverId,
            messageText: messageText,
            messageType: messageType,
            messageStatus: 'sent',
            messageCreatedAt: now,
            messageDeliveredAt: null,
            messageReadAt: null,
            messageMediaUrl: mediaUrl,
            messageMetadata: null
        };
        
        const messagesRef = collection(db, COLLECTIONS.CONVERSATIONS);
        const conversationMessagesRef = collection(doc(messagesRef, currentConversationId), COLLECTIONS.MESSAGES);
        
        await addDoc(conversationMessagesRef, messageData);
        
        await updateDoc(doc(db, COLLECTIONS.CONVERSATIONS, currentConversationId), {
            'lastMessage': {
                lastMessageText: messageText,
                lastMessageTimestamp: now,
                lastMessageSenderId: currentUser.uid
            },
            conversationUpdatedAt: now
        });
        
        console.log('✅ Message sent successfully');
        
    } catch (error) {
        console.error('Error sending message:', error);
        showToast(t('messages.toast.messageSendFailed'), 'error');
    }
}

function setupSearchFunctionality() {
    const searchInput = document.getElementById('searchConversations');
    
    if (!searchInput) return;
    
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const conversations = document.querySelectorAll('.conversation-item');
        
        conversations.forEach(conv => {
            const name = conv.querySelector('.conversation-name')?.textContent.toLowerCase() || '';
            const preview = conv.querySelector('.conversation-preview')?.textContent.toLowerCase() || '';
            
            if (name.includes(searchTerm) || preview.includes(searchTerm)) {
                conv.style.display = '';
            } else {
                conv.style.display = 'none';
            }
        });
    });
}

// Utility functions
function formatTimestamp(date) {
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return t('messages.time.justNow');
    if (diff < 3600000) return t('messages.time.minutesAgo', { minutes: Math.floor(diff / 60000) });
    if (diff < 86400000) return t('messages.time.hoursAgo', { hours: Math.floor(diff / 3600000) });
    if (diff < 604800000) return t('messages.time.daysAgo', { days: Math.floor(diff / 86400000) });
    
    return date.toLocaleDateString();
}

function formatMessageTime(date) {
    return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
    });
}

function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (conversationsListener) conversationsListener();
    if (messagesListener) messagesListener();
    if (conversationDetailsListener) conversationDetailsListener();
});

// Block/Unblock User Functions
function checkBlockStatus() {
    const currentUser = getCurrentUser();
    if (!currentUser || !currentConversation) {
        isBlockedByOther = false;
        hasBlockedOther = false;
        return;
    }
    
    const currentUserId = currentUser.uid;
    const currentUserDetails = currentConversation.participantDetails?.[currentUserId];
    const otherUserDetails = currentConversation.participantDetails?.[currentReceiverId];
    
    // Use ?? false for null handling
    isBlockedByOther = currentUserDetails?.participantIsBlocked ?? false;
    hasBlockedOther = otherUserDetails?.participantIsBlocked ?? false;
    
    console.log('🚫 Block status checked:', { isBlockedByOther, hasBlockedOther });
    
    updateUIBasedOnBlockStatus();
}

function updateMenuItems() {
    const blockMenuItem = document.getElementById('blockMenuItem');
    const unblockMenuItem = document.getElementById('unblockMenuItem');
    
    if (blockMenuItem && unblockMenuItem) {
        if (hasBlockedOther) {
            blockMenuItem.style.display = 'none';
            unblockMenuItem.style.display = 'block';
        } else {
            blockMenuItem.style.display = 'block';
            unblockMenuItem.style.display = 'none';
        }
    }
}

async function blockUser() {
    if (!currentConversationId || !currentReceiverId) {
        showToast(t('messages.block.error') || 'Cannot block user', 'error');
        return;
    }
    
    try {
        const updates = {
            [`participantDetails.${currentReceiverId}.participantIsBlocked`]: true,
            [`participantDetails.${currentReceiverId}.participantBlockedAt`]: serverTimestamp(),
            conversationUpdatedAt: serverTimestamp()
        };
        
        await updateDoc(doc(db, COLLECTIONS.CONVERSATIONS, currentConversationId), updates);
        
        hasBlockedOther = true;
        showToast(t('messages.block.success') || 'User blocked successfully', 'success');
        updateUIBasedOnBlockStatus();
        
        console.log('🚫 User blocked successfully');
    } catch (error) {
        console.error('❌ Error blocking user:', error);
        showToast(t('messages.block.error') || 'Failed to block user', 'error');
    }
}

async function unblockUser() {
    if (!currentConversationId || !currentReceiverId) {
        showToast(t('messages.unblock.error') || 'Cannot unblock user', 'error');
        return;
    }
    
    try {
        const updates = {
            [`participantDetails.${currentReceiverId}.participantIsBlocked`]: false,
            [`participantDetails.${currentReceiverId}.participantBlockedAt`]: null,
            conversationUpdatedAt: serverTimestamp()
        };
        
        await updateDoc(doc(db, COLLECTIONS.CONVERSATIONS, currentConversationId), updates);
        
        hasBlockedOther = false;
        showToast(t('messages.unblock.success') || 'User unblocked successfully', 'success');
        updateUIBasedOnBlockStatus();
        
        console.log('✅ User unblocked successfully');
    } catch (error) {
        console.error('❌ Error unblocking user:', error);
        showToast(t('messages.unblock.error') || 'Failed to unblock user', 'error');
    }
}

function updateUIBasedOnBlockStatus() {
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const attachmentBtn = document.getElementById('attachmentBtn');
    const mediaInput = document.getElementById('mediaInput');
    const proposeDealBtn = document.getElementById('proposeDealBtn');
    const blockingBanner = document.getElementById('blockingBanner');
    const menuBtn = document.getElementById('chatMenuBtn');
    const transactionBanner = document.querySelector('.transaction-status-banner');
    
    // Reset states
    if (blockingBanner) {
        blockingBanner.className = 'blocking-status-banner';
        blockingBanner.style.display = 'none';
    }
    
    if (isBlockedByOther) {
        // Current user is blocked by other user
        if (messageInput) messageInput.disabled = true;
        if (sendBtn) sendBtn.disabled = true;
        if (attachmentBtn) attachmentBtn.disabled = true;
        if (mediaInput) mediaInput.disabled = true;
        if (proposeDealBtn) proposeDealBtn.style.display = 'none';
        if (menuBtn) {
            menuBtn.disabled = true;
            menuBtn.style.opacity = '0.5';
        }
        
        if (blockingBanner) {
            blockingBanner.textContent = `🚫 ${t('messages.block.blockedByOther') || 'This user has blocked you'}`;
            blockingBanner.classList.add('blocked-by-other', 'active');
            blockingBanner.style.display = 'block';
        }
        
        // Hide transaction banner
        if (transactionBanner) transactionBanner.style.display = 'none';
        
    } else if (hasBlockedOther) {
        // Current user has blocked other user
        if (messageInput) messageInput.disabled = true;
        if (sendBtn) sendBtn.disabled = true;
        if (attachmentBtn) attachmentBtn.disabled = true;
        if (mediaInput) mediaInput.disabled = true;
        if (proposeDealBtn) proposeDealBtn.style.display = 'none';
        if (menuBtn) {
            menuBtn.disabled = false;
            menuBtn.style.opacity = '1';
        }
        
        if (blockingBanner) {
            blockingBanner.textContent = `🚫 ${t('messages.block.blockedByMe') || 'You have blocked this user'}`;
            blockingBanner.classList.add('blocked-by-me', 'active');
            blockingBanner.style.display = 'block';
        }
        
        // Hide transaction banner
        if (transactionBanner) transactionBanner.style.display = 'none';
        
    } else {
        // No blocking - enable everything
        if (messageInput) messageInput.disabled = false;
        if (sendBtn) sendBtn.disabled = false;
        if (attachmentBtn) attachmentBtn.disabled = false;
        if (mediaInput) mediaInput.disabled = false;
        if (menuBtn) {
            menuBtn.disabled = false;
            menuBtn.style.opacity = '1';
        }
        
        // Show deal proposal button if conditions are met
        if (proposeDealBtn && currentConversation?.canProposeDeal === true && currentListing) {
            proposeDealBtn.style.display = 'block';
        }
        
        if (blockingBanner) {
            blockingBanner.style.display = 'none';
        }
    }
}

window.showBlockConfirmation = function() {
    showConfirmDialog(
        t('messages.block.confirmMessage') || 'Are you sure you want to block this user? You will not be able to send or receive messages.',
        () => blockUser(),
        null
    );
};

window.showUnblockConfirmation = function() {
    showConfirmDialog(
        t('messages.unblock.confirmMessage') || 'Are you sure you want to unblock this user?',
        () => unblockUser(),
        null
    );
};

window.toggleChatMenu = function() {
    const menu = document.getElementById('chatMenu');
    if (menu) {
        menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
    }
};

// Close menu when clicking outside
document.addEventListener('click', function(event) {
    const menu = document.getElementById('chatMenu');
    const menuBtn = document.getElementById('chatMenuBtn');
    
    if (menu && menuBtn && !menu.contains(event.target) && !menuBtn.contains(event.target)) {
        menu.style.display = 'none';
    }
});

console.log('💬 Messages.js loaded with real-time updates and proper canProposeDeal logic');