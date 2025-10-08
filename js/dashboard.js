// Updated PigSoil+ Dashboard JavaScript - Simplified Version
import { auth, db } from './init.js';
import '../js/shared-user-manager.js';
import { 
    initializeSharedUserManager, 
    getCurrentUser, 
    getCurrentUserData,
    onUserDataChange,
    isSwineFarmer 
} from '../js/shared-user-manager.js';

let currentUserData = null;

document.addEventListener('DOMContentLoaded', function() {
    console.log('Dashboard initialized');
    
    initializeNavigation();
    initializeBotInteractions();
    initializeQuickActions();
    initializeNotifications();
    
    setupUserDataListener();
});

function setupUserDataListener() {
    onUserDataChange(async (userInfo) => {
        const { user, userData } = userInfo;
        
        if (user && userData) {
            console.log('Dashboard: User data updated', userData);
            currentUserData = userData;
            
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
    
    if (userNameEl) userNameEl.textContent = userData.userName || 'Swine Farmer';
    if (userRoleEl) userRoleEl.textContent = 'Active Farmer';
    
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