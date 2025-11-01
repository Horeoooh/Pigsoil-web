// Updated PigSoil+ Dashboard JavaScript - Simplified Version
import { auth, db } from './init.js';
import { 
    initializeSharedUserManager, 
    getCurrentUser, 
    getCurrentUserData,
    getCachedUserData,
    getCachedProfilePic,
    DEFAULT_PROFILE_PIC,
    onUserDataChange,
    isSwineFarmer 
} from './shared-user-manager.js';
import notificationManager from './notification-manager.js';

// ===== USER TYPE CHECK - REDIRECT FERTILIZER BUYERS =====
function checkUserTypeAndRedirect() {
    try {
        const cachedUserData = localStorage.getItem('pigsoil_user_data');
        if (cachedUserData) {
            const userData = JSON.parse(cachedUserData);
            const userType = userData.userType;
            
            // Redirect fertilizer buyers to buyer dashboard
            if (userType === 'fertilizer_buyer' || userType === 'Organic Fertilizer Buyer') {
                console.log('🚫 Fertilizer buyer detected on farmer page, redirecting to buyer dashboard...');
                window.location.href = '/buyer-dashboard.html';
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

let currentUserData = null;

document.addEventListener('DOMContentLoaded', function() {
    console.log('Dashboard initialized');
    
    // Initialize i18n
    if (window.i18nManager) {
        window.i18nManager.initialize();
    }
    
    // Load user profile immediately
    loadUserProfile();
    
    initializeNavigation();
    initializeBotInteractions();
    initializeQuickActions();
    initializeNotifications();
    
    setupUserDataListener();
    
    // Initialize FCM and notification manager
    initializeFCM();
});

// Initialize Firebase Cloud Messaging and Notification Manager
async function initializeFCM() {
    try {
        console.log('🔔 Initializing FCM for dashboard...');
        
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

// Load user profile from cache or current data
function loadUserProfile() {
    const userData = getCurrentUserData() || getCachedUserData();
    const user = getCurrentUser();
    
    if (!userData && !user) {
        console.log('⏳ No user data available yet');
        return;
    }
    
    const userName = userData?.userName || user?.displayName || 'User';
    const userType = userData?.userType || 'swine_farmer';
    
    // Get profile picture with proper fallback chain
    let profilePicUrl = userData?.userProfilePictureUrl || user?.photoURL || getCachedProfilePic();
    
    // If still no profile pic or it's the default, use the DEFAULT_PROFILE_PIC
    if (!profilePicUrl || profilePicUrl === DEFAULT_PROFILE_PIC) {
        profilePicUrl = DEFAULT_PROFILE_PIC;
    }
    
    // Use getUserRoleDisplay from shared-user-manager.js logic
    let roleDisplay = 'Swine Farmer'; // Default
    if (userType === 'swine_farmer' || userType === 'Swine Farmer') {
        roleDisplay = 'Swine Farmer';
    } else if (userType === 'fertilizer_buyer' || userType === 'Organic Fertilizer Buyer') {
        roleDisplay = 'Organic Fertilizer Buyer';
    }
    
    // Generate initials
    const initials = userName.split(' ')
        .map(word => word.charAt(0))
        .join('')
        .substring(0, 2)
        .toUpperCase();
    
    // Update header elements
    const userNameElement = document.getElementById('headerUserName');
    const userRoleElement = document.getElementById('headerUserRole');
    const userAvatarElement = document.getElementById('headerUserAvatar');
    
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
    
    console.log('👤 User profile loaded:', { 
        userName, 
        roleDisplay, 
        profilePicUrl, 
        usingDefault: profilePicUrl === DEFAULT_PROFILE_PIC 
    });
}

function setupUserDataListener() {
    onUserDataChange(async (userInfo) => {
        const { user, userData } = userInfo;
        
        if (user && userData) {
            console.log('Dashboard: User data updated', userData);
            currentUserData = userData;
            
            // Update profile when data changes
            loadUserProfile();
            updateDashboardUserInfo(userData);
            
            if (!isSwineFarmer()) {
                console.log('Redirecting non-farmer to buyer marketplace');
                setTimeout(() => {
                    window.location.href = '/buyer-marketplace.html';
                }, 1000);
            }
        }
    });
}

function updateDashboardUserInfo(userData) {
    const userNameEl = document.querySelector('.user-name');
    const userRoleEl = document.querySelector('.user-role');
    const userAvatarEl = document.querySelector('.user-avatar');
    
    if (userNameEl) userNameEl.textContent = userData.userName || 'User';
    
    // Use proper role display based on userType
    if (userRoleEl) {
        const userType = userData.userType;
        let roleDisplay = 'Swine Farmer'; // Default
        if (userType === 'swine_farmer' || userType === 'Swine Farmer') {
            roleDisplay = 'Swine Farmer';
        } else if (userType === 'fertilizer_buyer' || userType === 'Organic Fertilizer Buyer') {
            roleDisplay = 'Organic Fertilizer Buyer';
        }
        userRoleEl.textContent = roleDisplay;
    }
    
    if (userAvatarEl && userData.userName) {
        const initials = userData.userName.split(' ').map(name => name.charAt(0)).join('').substring(0, 2);
        userAvatarEl.textContent = initials.toUpperCase();
    }
}

function initializeNavigation() {
    const navLinks = document.querySelectorAll('.nav-menu a');

    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            const href = this.getAttribute('href');

            if (href && href.startsWith('#')) {
                e.preventDefault();
                navLinks.forEach(l => l.classList.remove('active'));
                this.classList.add('active');

                const targetSection = document.querySelector(href);
                if (targetSection) {
                    targetSection.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            }
        });
    });
}

function initializeBotInteractions() {
    const botButtons = document.querySelectorAll('.bot-buttons button');
    
    botButtons.forEach(button => {
        button.addEventListener('click', function() {
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = 'scale(1)';
            }, 150);
        });
    });
}

function initializeQuickActions() {
    const actionCards = document.querySelectorAll('.action-card');
    
    actionCards.forEach((card) => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-2px) scale(1.01)';
            this.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)';
        });

        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
            this.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.15)';
        });
    });
}

function initializeNotifications() {
    const notificationBtn = document.getElementById('notificationBtn');
    if (notificationBtn) {
        notificationBtn.addEventListener('click', function() {
            showNotification('No new notifications', 'info');
        });
    }
}

function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? '#4CAF50' : type === 'info' ? '#2196F3' : '#FF5722'};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 1000;
        font-family: 'Poppins', sans-serif;
        font-size: 14px;
        transform: translateX(100%);
        transition: transform 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

console.log('PigSoil+ Dashboard loaded!');