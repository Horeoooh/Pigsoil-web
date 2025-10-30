// Composting Guides JavaScript for PigSoil+
import { 
    getCurrentUser, 
    getCurrentUserData, 
    getCachedUserData,
    getCachedProfilePic,
    DEFAULT_PROFILE_PIC,
    onUserDataChange
} from './shared-user-manager.js';

document.addEventListener('DOMContentLoaded', function() {
    console.log('PigSoil+ Composting Guides loaded successfully!');
    
    // Load user profile immediately
    loadUserProfile();
    
    // Listen for user data changes
    onUserDataChange(() => {
        loadUserProfile();
    });
    
    // Initialize all functionality
    initMethodSelector();
    initNotificationButton();
    initNavigation();
    initScrollAnimations();
    initProgressIndicator();
});

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
    
    // Determine user role display
    let roleDisplay = 'Active Farmer';
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

// Method Selector Functionality
function initMethodSelector() {
    const methodButtons = document.querySelectorAll('.method-btn');
    const guideMethods = document.querySelectorAll('.guide-method');
    const progressIndicator = document.getElementById('progressIndicator');
    
    methodButtons.forEach(button => {
        button.addEventListener('click', function() {
            const method = this.getAttribute('data-method');
            
            // Remove active class from all buttons and methods
            methodButtons.forEach(btn => btn.classList.remove('active'));
            guideMethods.forEach(guide => guide.classList.remove('active'));
            
            // Add active class to clicked button and corresponding method
            this.classList.add('active');
            document.getElementById(method + '-method').classList.add('active');
            
            // Update progress indicator
            updateProgressIndicator(method);
            
            // Add click animation
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = '';
            }, 150);
            
            // Smooth scroll to top of guide
            document.querySelector('.container').scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        });
    });
}

// Update Progress Indicator
function updateProgressIndicator(method) {
    const progressIndicator = document.getElementById('progressIndicator');
    
    if (method === 'basic') {
        progressIndicator.textContent = 'Day 1-21 Guide';
        progressIndicator.classList.remove('hot');
    } else {
        progressIndicator.innerHTML = 'Hot Method<br>Day 1-18 Guide';
        progressIndicator.classList.add('hot');
    }
}

// Notification Button
function initNotificationButton() {
    const notificationBtn = document.getElementById('notificationBtn');
    
    if (notificationBtn) {
        notificationBtn.addEventListener('click', function() {
            showNotification('No new notifications', 'info');
        });
    }
}

// Navigation Enhancement
function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-menu a');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            // If it's not an actual page link, show coming soon
            const href = this.getAttribute('href');
            if (href && href.includes('#')) {
                e.preventDefault();
                showNotification('Coming Soon!', 'info');
            }
        });
    });
}

// Scroll Animations
function initScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);
    
    // Observe day containers
    const dayContainers = document.querySelectorAll('.day-container');
    dayContainers.forEach(container => {
        container.style.opacity = '0';
        container.style.transform = 'translateY(20px)';
        container.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(container);
    });
    
    // Observe material items
    const materialItems = document.querySelectorAll('.material-item');
    materialItems.forEach((item, index) => {
        item.style.opacity = '0';
        item.style.transform = 'translateY(10px)';
        item.style.transition = `opacity 0.4s ease ${index * 0.1}s, transform 0.4s ease ${index * 0.1}s`;
        observer.observe(item);
    });
}

// Progress Indicator Auto-Update on Scroll
function initProgressIndicator() {
    const progressIndicator = document.getElementById('progressIndicator');
    let currentDayVisible = '';
    
    const dayContainers = document.querySelectorAll('.day-container');
    
    const updateProgress = debounce(() => {
        const activeMethod = document.querySelector('.guide-method.active');
        if (!activeMethod) return;
        
        const methodType = activeMethod.id === 'basic-method' ? 'basic' : 'hot';
        const activeDayContainers = activeMethod.querySelectorAll('.day-container');
        
        let nearestDay = '';
        let minDistance = Infinity;
        
        activeDayContainers.forEach(container => {
            const rect = container.getBoundingClientRect();
            const distance = Math.abs(rect.top - window.innerHeight / 2);
            
            if (distance < minDistance && rect.bottom > 0 && rect.top < window.innerHeight) {
                minDistance = distance;
                const dayNumber = container.querySelector('.day-number').textContent;
                nearestDay = `Day ${dayNumber}`;
            }
        });
        
        if (nearestDay && nearestDay !== currentDayVisible) {
            currentDayVisible = nearestDay;
            
            if (methodType === 'basic') {
                progressIndicator.innerHTML = `${nearestDay}<br>Basic Method`;
            } else {
                progressIndicator.innerHTML = `${nearestDay}<br>Hot Method`;
            }
            
            // Add pulse animation
            progressIndicator.style.transform = 'scale(1.05)';
            setTimeout(() => {
                progressIndicator.style.transform = '';
            }, 200);
        }
    }, 100);
    
    window.addEventListener('scroll', updateProgress);
    
    // Add smooth transition
    progressIndicator.style.transition = 'all 0.3s ease';
}

// Enhanced Material Item Interactions
function initMaterialInteractions() {
    const materialItems = document.querySelectorAll('.material-item');
    
    materialItems.forEach(item => {
        item.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-3px) scale(1.02)';
        });
        
        item.addEventListener('mouseleave', function() {
            this.style.transform = '';
        });
        
        item.addEventListener('click', function() {
            // Add ripple effect
            const ripple = document.createElement('div');
            ripple.style.cssText = `
                position: absolute;
                background: rgba(76, 175, 80, 0.3);
                border-radius: 50%;
                transform: scale(0);
                animation: ripple 0.6s linear;
                pointer-events: none;
            `;
            
            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = (rect.width - size) / 2 + 'px';
            ripple.style.top = (rect.height - size) / 2 + 'px';
            
            this.style.position = 'relative';
            this.style.overflow = 'hidden';
            this.appendChild(ripple);
            
            setTimeout(() => {
                if (ripple.parentNode) {
                    ripple.parentNode.removeChild(ripple);
                }
            }, 600);
        });
    });
    
    // Add ripple keyframes
    if (!document.querySelector('#ripple-styles')) {
        const style = document.createElement('style');
        style.id = 'ripple-styles';
        style.textContent = `
            @keyframes ripple {
                to {
                    transform: scale(4);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
}

// Day Container Click Interactions
function initDayContainerInteractions() {
    const dayContainers = document.querySelectorAll('.day-container');
    
    dayContainers.forEach(container => {
        container.addEventListener('click', function(e) {
            // Don't trigger if clicking on tip/warning boxes
            if (e.target.closest('.tip-box, .warning-box, .temperature-box')) {
                return;
            }
            
            // Add subtle click feedback
            this.style.transform = 'scale(0.98)';
            setTimeout(() => {
                this.style.transform = '';
            }, 150);
            
            // Get day info
            const dayNumber = this.querySelector('.day-number').textContent;
            const dayTitle = this.querySelector('.day-title').textContent;
            const methodType = this.classList.contains('basic') ? 'Basic' : 'Hot';
            
            showNotification(`Day ${dayNumber}: ${dayTitle}`, 'info');
        });
    });
}

// Notification System (Enhanced)
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification-toast');
    existingNotifications.forEach(n => n.remove());
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification-toast ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">${getNotificationIcon(type)}</span>
            <span class="notification-message">${message}</span>
            <button class="notification-close">×</button>
        </div>
    `;
    
    // Add styles for notification
    notification.style.cssText = `
        position: fixed;
        top: 120px;
        right: 20px;
        background: ${getNotificationColor(type)};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 12px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.15);
        z-index: 1001;
        transform: translateX(400px);
        transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        max-width: 320px;
        font-family: 'Poppins', sans-serif;
        font-size: 14px;
        border-left: 4px solid rgba(255,255,255,0.3);
    `;
    
    const content = notification.querySelector('.notification-content');
    content.style.cssText = `
        display: flex;
        align-items: center;
        gap: 10px;
    `;
    
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.style.cssText = `
        background: none;
        border: none;
        color: white;
        font-size: 18px;
        cursor: pointer;
        padding: 0;
        margin-left: auto;
        opacity: 0.8;
        transition: opacity 0.2s;
    `;
    
    // Add notification to body
    document.body.appendChild(notification);
    
    // Animate in
    requestAnimationFrame(() => {
        notification.style.transform = 'translateX(0)';
    });
    
    // Close button functionality
    closeBtn.addEventListener('click', () => {
        removeNotification(notification);
    });
    
    // Auto remove after 4 seconds
    setTimeout(() => {
        removeNotification(notification);
    }, 4000);
}

function removeNotification(notification) {
    notification.style.transform = 'translateX(400px)';
    notification.style.opacity = '0';
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 400);
}

function getNotificationIcon(type) {
    const icons = {
        success: '✓',
        error: '✗',
        warning: '⚠',
        info: 'ℹ'
    };
    return icons[type] || icons.info;
}

function getNotificationColor(type) {
    const colors = {
        success: '#4CAF50',
        error: '#f44336',
        warning: '#ff9800',
        info: '#2196F3'
    };
    return colors[type] || colors.info;
}

// Utility Functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Smooth Scrolling Enhancement
function smoothScroll(target, duration = 800) {
    const targetElement = document.querySelector(target);
    if (!targetElement) return;
    
    const startPosition = window.pageYOffset;
    const targetPosition = targetElement.offsetTop - 100;
    const distance = targetPosition - startPosition;
    let startTime = null;
    
    function animation(currentTime) {
        if (startTime === null) startTime = currentTime;
        const timeElapsed = currentTime - startTime;
        const run = ease(timeElapsed, startPosition, distance, duration);
        window.scrollTo(0, run);
        if (timeElapsed < duration) requestAnimationFrame(animation);
    }
    
    function ease(t, b, c, d) {
        t /= d / 2;
        if (t < 1) return c / 2 * t * t + b;
        t--;
        return -c / 2 * (t * (t - 2) - 1) + b;
    }
    
    requestAnimationFrame(animation);
}

// Keyboard Navigation Support
function initKeyboardNavigation() {
    document.addEventListener('keydown', function(e) {
        // Tab between methods with 1 and 2 keys
        if (e.key === '1') {
            document.querySelector('[data-method="basic"]').click();
        } else if (e.key === '2') {
            document.querySelector('[data-method="hot"]').click();
        }
        
        // Scroll to top with Home key
        if (e.key === 'Home') {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        
        // Scroll to bottom with End key
        if (e.key === 'End') {
            e.preventDefault();
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
        }
    });
}

// Initialize all enhanced interactions
setTimeout(() => {
    initMaterialInteractions();
    initDayContainerInteractions();
    initKeyboardNavigation();
}, 1000);

// Export functions for potential use in other files
window.PigSoilCompostGuides = {
    showNotification,
    smoothScroll,
    debounce
};