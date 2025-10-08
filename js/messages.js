// messages.js - Integrated with shared user manager
import { auth, db } from './init.js';
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
    serverTimestamp,
    getDocs 
} from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js';

const COLLECTIONS = {
    CONVERSATIONS: 'conversations',
    MESSAGES: 'messages',
    USERS: 'users'
};

let currentConversationId = null;
let conversationsListener = null;
let messagesListener = null;

// Initialize messages functionality
document.addEventListener('DOMContentLoaded', function() {
    console.log('💬 Messages page initializing...');
    
    // Wait for user data to load
    onUserDataChange(({ user, userData }) => {
        console.log('✅ User data loaded in messages page:', userData);
        initializeMessaging(user, userData);
    });
    
    // Check if user is already loaded
    const user = getCurrentUser();
    const userData = getCurrentUserData();
    
    if (user && userData) {
        console.log('✅ User already loaded, initializing messaging');
        initializeMessaging(user, userData);
    }
});

function initializeMessaging(user, userData) {
    console.log('💬 Initializing messaging for:', userData.userName);
    
    loadConversations(user.uid);
    setupSearchFunctionality();
    setupMessageInput();
}

// Load conversations for current user
function loadConversations(userId) {
    const conversationList = document.getElementById('conversationList');
    
    if (!conversationList) {
        console.error('Conversation list element not found');
        return;
    }
    
    conversationList.innerHTML = '<div style="text-align: center; padding: 20px; color: #888;">Loading conversations...</div>';
    
    // Query conversations where user is a participant
    const conversationsRef = collection(db, COLLECTIONS.CONVERSATIONS);
    const q = query(
        conversationsRef,
        where('participants', 'array-contains', userId),
        orderBy('lastMessageAt', 'desc')
    );
    
    if (conversationsListener) {
        conversationsListener();
    }
    
    conversationsListener = onSnapshot(q, 
        (snapshot) => {
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
            
            snapshot.forEach((doc) => {
                const conversation = doc.data();
                renderConversationItem(doc.id, conversation, userId);
            });
        },
        (error) => {
            console.error('Error loading conversations:', error);
            conversationList.innerHTML = `
                <div style="text-align: center; padding: 20px; color: #e74c3c;">
                    <p>Error loading conversations</p>
                    <p style="font-size: 12px;">${error.message}</p>
                </div>
            `;
        }
    );
}

function renderConversationItem(conversationId, conversation, currentUserId) {
    const conversationList = document.getElementById('conversationList');
    
    // Determine the other participant
    const otherParticipantId = conversation.participants.find(id => id !== currentUserId);
    
    // Get other participant's name (you might want to fetch this from users collection)
    const otherParticipantName = conversation.participantNames?.[otherParticipantId] || 'User';
    
    const conversationItem = document.createElement('div');
    conversationItem.className = 'conversation-item';
    if (conversationId === currentConversationId) {
        conversationItem.classList.add('active');
    }
    
    const lastMessageTime = conversation.lastMessageAt ? 
        formatTimestamp(conversation.lastMessageAt.toDate()) : 
        'No messages';
    
    conversationItem.innerHTML = `
        <div class="conversation-header">
            <span class="conversation-name">${otherParticipantName}</span>
            <span class="conversation-time">${lastMessageTime}</span>
        </div>
        <div class="conversation-preview">${conversation.lastMessage || 'Start a conversation'}</div>
    `;
    
    conversationItem.addEventListener('click', () => {
        openConversation(conversationId, otherParticipantName);
    });
    
    conversationList.appendChild(conversationItem);
}

function openConversation(conversationId, participantName) {
    console.log('💬 Opening conversation:', conversationId);
    
    currentConversationId = conversationId;
    
    // Update active state
    document.querySelectorAll('.conversation-item').forEach(item => {
        item.classList.remove('active');
    });
    event.currentTarget?.classList.add('active');
    
    // Render chat UI
    const chatPanel = document.getElementById('chatPanel');
    chatPanel.innerHTML = `
        <div class="chat-header">
            <div class="chat-user-info">
                <div class="chat-avatar">${participantName.charAt(0).toUpperCase()}</div>
                <div class="chat-user-details">
                    <h3>${participantName}</h3>
                    <p>Active now</p>
                </div>
            </div>
        </div>
        <div class="messages-area" id="messagesArea"></div>
        <div class="message-input-container">
            <input type="text" 
                   class="message-input" 
                   id="messageInput" 
                   placeholder="Type your message..." 
                   autocomplete="off">
            <button class="send-btn" id="sendBtn">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
            </button>
        </div>
    `;
    
    // Load messages
    loadMessages(conversationId);
    
    // Setup message input handlers
    setupMessageInputForConversation();
}

function loadMessages(conversationId) {
    const messagesArea = document.getElementById('messagesArea');
    
    if (!messagesArea) return;
    
    messagesArea.innerHTML = '<div style="text-align: center; color: #888;">Loading messages...</div>';
    
    const messagesRef = collection(db, COLLECTIONS.MESSAGES);
    const q = query(
        messagesRef,
        where('conversationId', '==', conversationId),
        orderBy('sentAt', 'asc')
    );
    
    if (messagesListener) {
        messagesListener();
    }
    
    messagesListener = onSnapshot(q,
        (snapshot) => {
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
            
            snapshot.forEach((doc) => {
                const message = doc.data();
                renderMessage(message, currentUser.uid);
            });
            
            // Scroll to bottom
            messagesArea.scrollTop = messagesArea.scrollHeight;
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
    const isSent = message.senderId === currentUserId;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isSent ? 'sent' : ''}`;
    
    const senderInitial = message.senderName ? 
        message.senderName.charAt(0).toUpperCase() : 
        'U';
    
    const messageTime = message.sentAt ? 
        formatMessageTime(message.sentAt.toDate()) : 
        'Sending...';
    
    messageDiv.innerHTML = `
        <div class="message-avatar">${senderInitial}</div>
        <div class="message-content">
            <div class="message-text">${escapeHtml(message.text)}</div>
            <div class="message-time">${messageTime}</div>
        </div>
    `;
    
    messagesArea.appendChild(messageDiv);
}

function setupMessageInputForConversation() {
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    
    if (!messageInput || !sendBtn) return;
    
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    
    sendBtn.addEventListener('click', sendMessage);
}

async function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    
    if (!messageInput || !currentConversationId) return;
    
    const messageText = messageInput.value.trim();
    
    if (!messageText) return;
    
    const currentUser = getCurrentUser();
    const currentUserData = getCurrentUserData();
    
    if (!currentUser || !currentUserData) {
        console.error('No user data available');
        return;
    }
    
    // Disable input while sending
    messageInput.disabled = true;
    sendBtn.disabled = true;
    
    try {
        const messageData = {
            conversationId: currentConversationId,
            senderId: currentUser.uid,
            senderName: currentUserData.userName,
            text: messageText,
            sentAt: serverTimestamp(),
            isRead: false
        };
        
        await addDoc(collection(db, COLLECTIONS.MESSAGES), messageData);
        
        // Clear input
        messageInput.value = '';
        
        console.log('✅ Message sent successfully');
        
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message. Please try again.');
    } finally {
        messageInput.disabled = false;
        sendBtn.disabled = false;
        messageInput.focus();
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

function setupMessageInput() {
    // This is handled per conversation in setupMessageInputForConversation
}

// Utility functions
function formatTimestamp(date) {
    const now = new Date();
    const diff = now - date;
    
    // Less than 1 minute
    if (diff < 60000) return 'Just now';
    
    // Less than 1 hour
    if (diff < 3600000) {
        const minutes = Math.floor(diff / 60000);
        return `${minutes}m ago`;
    }
    
    // Less than 24 hours
    if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000);
        return `${hours}h ago`;
    }
    
    // Less than 7 days
    if (diff < 604800000) {
        const days = Math.floor(diff / 86400000);
        return `${days}d ago`;
    }
    
    // Show date
    return date.toLocaleDateString();
}

function formatMessageTime(date) {
    return date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

console.log('💬 Messages.js loaded with user manager integration');