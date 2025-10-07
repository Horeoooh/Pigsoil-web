// messages.js
import { auth, db } from './init.js';
import { 
    collection, 
    addDoc, 
    query, 
    where, 
    orderBy, 
    onSnapshot,
    serverTimestamp,
    updateDoc,
    doc,
    getDocs,
    getDoc
} from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js';

let currentUser = null;
let currentConversationId = null;
let unsubscribeMessages = null;

// Initialize
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        loadUserInfo();
        loadConversations();
    } else {
        window.location.href = '../html/login.html';
    }
});

// Load user info
async function loadUserInfo() {
    try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('uid', '==', currentUser.uid));
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
            const userData = snapshot.docs[0].data();
            document.getElementById('currentUserName').textContent = userData.displayName || 'User';
            document.getElementById('currentUserRole').textContent = 
                userData.userType === 'swine_farmer' ? 'Swine Farmer' : 'Fertilizer Buyer';
            
            const initials = userData.displayName ? userData.displayName.split(' ').map(n => n[0]).join('') : 'U';
            document.getElementById('currentUserAvatar').textContent = initials;
        }
    } catch (error) {
        console.error('Error loading user info:', error);
    }
}

// Load conversations
function loadConversations() {
    const conversationsRef = collection(db, 'conversations');
    const q = query(
        conversationsRef,
        where('participantIds', 'array-contains', currentUser.uid),
        orderBy('lastMessageTime', 'desc')
    );
    
    onSnapshot(q, (snapshot) => {
        const conversationList = document.getElementById('conversationList');
        conversationList.innerHTML = '';
        
        if (snapshot.empty) {
            conversationList.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; color: #888;">
                    <p>No conversations yet</p>
                    <p style="font-size: 13px; margin-top: 8px;">Start a conversation from the marketplace</p>
                </div>
            `;
            return;
        }
        
        snapshot.forEach((doc) => {
            const conv = doc.data();
            const otherParticipant = conv.participants.find(p => p.userId !== currentUser.uid);
            
            const convItem = document.createElement('div');
            convItem.className = 'conversation-item';
            convItem.onclick = () => openConversation(doc.id, conv);
            
            const unreadCount = conv.unreadCount?.[currentUser.uid] || 0;
            
            convItem.innerHTML = `
                <div class="conversation-header">
                    <span class="conversation-name">${otherParticipant?.name || 'Unknown'}</span>
                    <span class="conversation-time">${formatTime(conv.lastMessageTime)}</span>
                </div>
                <div class="conversation-preview">
                    ${conv.lastMessage || 'No messages yet'}
                    ${unreadCount > 0 ? `<span class="unread-badge">${unreadCount}</span>` : ''}
                </div>
            `;
            
            conversationList.appendChild(convItem);
        });
    });
}

// Open conversation
function openConversation(conversationId, conversationData) {
    currentConversationId = conversationId;
    
    // Update UI
    document.querySelectorAll('.conversation-item').forEach(item => {
        item.classList.remove('active');
    });
    event.currentTarget.classList.add('active');
    
    // Get other participant
    const otherParticipant = conversationData.participants.find(p => p.userId !== currentUser.uid);
    
    // Build chat panel
    const chatPanel = document.getElementById('chatPanel');
    chatPanel.innerHTML = `
        <div class="chat-header">
            <div class="chat-user-info">
                <div class="chat-avatar">${getInitials(otherParticipant?.name)}</div>
                <div class="chat-user-details">
                    <h3>${otherParticipant?.name || 'Unknown'}</h3>
                    <p>${otherParticipant?.userType === 'swine_farmer' ? 'Swine Farmer' : 'Fertilizer Buyer'}</p>
                </div>
            </div>
            <div class="chat-actions">
                <button>ℹ️</button>
            </div>
        </div>
        <div class="messages-area" id="messagesArea"></div>
        <div class="message-input-container">
            <input type="text" class="message-input" id="messageInput" placeholder="Type a message..." />
            <button class="send-btn" id="sendBtn">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M2 21L23 12L2 3V10L17 12L2 14V21Z"/>
                </svg>
            </button>
        </div>
    `;
    
    // Load messages
    loadMessages(conversationId);
    
    // Mark messages as read
    markAsRead(conversationId);
    
    // Setup send button
    document.getElementById('sendBtn').onclick = sendMessage;
    document.getElementById('messageInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
}

// Load messages
function loadMessages(conversationId) {
    if (unsubscribeMessages) {
        unsubscribeMessages();
    }
    
    const messagesRef = collection(db, 'messages');
    const q = query(
        messagesRef,
        where('conversationId', '==', conversationId),
        orderBy('createdAt', 'asc')
    );
    
    unsubscribeMessages = onSnapshot(q, (snapshot) => {
        const messagesArea = document.getElementById('messagesArea');
        messagesArea.innerHTML = '';
        
        snapshot.forEach((doc) => {
            const msg = doc.data();
            const isSent = msg.senderId === currentUser.uid;
            
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;
            messageDiv.innerHTML = `
                <div class="message-avatar">${getInitials(msg.senderName)}</div>
                <div class="message-content">
                    <div class="message-text">${msg.content}</div>
                    <div class="message-time">${formatTime(msg.createdAt)}</div>
                </div>
            `;
            
            messagesArea.appendChild(messageDiv);
        });
        
        // Scroll to bottom
        messagesArea.scrollTop = messagesArea.scrollHeight;
    });
}

// Send message
async function sendMessage() {
    const input = document.getElementById('messageInput');
    const content = input.value.trim();
    
    if (!content || !currentConversationId) return;
    
    try {
        // Get conversation data
        const convRef = doc(db, 'conversations', currentConversationId);
        const convSnap = await getDoc(convRef);
        
        if (!convSnap.exists()) {
            throw new Error('Conversation not found');
        }
        
        const convData = convSnap.data();
        const otherParticipant = convData.participants.find(p => p.userId !== currentUser.uid);
        
        // Add message
        await addDoc(collection(db, 'messages'), {
            conversationId: currentConversationId,
            senderId: currentUser.uid,
            senderName: currentUser.displayName || 'User',
            receiverId: otherParticipant.userId,
            receiverName: otherParticipant.name,
            content: content,
            isRead: false,
            createdAt: serverTimestamp()
        });
        
        // Update conversation
        await updateDoc(convRef, {
            lastMessage: content,
            lastMessageTime: serverTimestamp(),
            [`unreadCount.${otherParticipant.userId}`]: (convData.unreadCount?.[otherParticipant.userId] || 0) + 1
        });
        
        input.value = '';
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message: ' + error.message);
    }
}

// Mark as read
async function markAsRead(conversationId) {
    try {
        const convRef = doc(db, 'conversations', conversationId);
        await updateDoc(convRef, {
            [`unreadCount.${currentUser.uid}`]: 0
        });
    } catch (error) {
        console.error('Error marking as read:', error);
    }
}

// Utility functions
function getInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).toUpperCase().join('');
}

function formatTime(timestamp) {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
}

// Search conversations
document.getElementById('searchConversations')?.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const conversations = document.querySelectorAll('.conversation-item');
    
    conversations.forEach(conv => {
        const name = conv.querySelector('.conversation-name').textContent.toLowerCase();
        const preview = conv.querySelector('.conversation-preview').textContent.toLowerCase();
        
        if (name.includes(searchTerm) || preview.includes(searchTerm)) {
            conv.style.display = 'block';
        } else {
            conv.style.display = 'none';
        }
    });
});