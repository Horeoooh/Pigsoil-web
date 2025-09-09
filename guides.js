// DOM Content Loaded Event
document.addEventListener('DOMContentLoaded', function() {
    
    // Initialize all functionality
    initCollapseButtons();
    initViewGuideButtons();
    initNotificationButton();
    initNavigation();
    initScrollAnimations();
    
    console.log('PigSoil+ Guides loaded successfully!');
});

// Collapse/Expand Guide Cards
function initCollapseButtons() {
    const collapseButtons = document.querySelectorAll('.collapse-btn');
    
    collapseButtons.forEach(button => {
        button.addEventListener('click', function() {
            const guideCard = this.closest('.guide-card');
            const guideContent = guideCard.querySelector('.guide-content');
            const stepsPreview = guideContent.querySelector('.steps-preview');
            const tags = guideContent.querySelector('.tags');
            
            // Toggle collapsed state
            const isCollapsed = guideCard.classList.contains('collapsed');
            
            if (isCollapsed) {
                // Expand
                guideCard.classList.remove('collapsed');
                
                // Show elements immediately
                stepsPreview.style.display = 'block';
                tags.style.display = 'flex';
                
                // Use requestAnimationFrame for smooth animation
                requestAnimationFrame(() => {
                    stepsPreview.style.opacity = '1';
                    stepsPreview.style.transform = 'translateY(0)';
                    tags.style.opacity = '1';
                    tags.style.transform = 'translateY(0)';
                });
                
            } else {
                // Collapse
                guideCard.classList.add('collapsed');
                
                // Start collapse animation
                stepsPreview.style.opacity = '0';
                stepsPreview.style.transform = 'translateY(-10px)';
                tags.style.opacity = '0';
                tags.style.transform = 'translateY(-10px)';
                
                // Hide after transition completes
                setTimeout(() => {
                    if (guideCard.classList.contains('collapsed')) {
                        stepsPreview.style.display = 'none';
                        tags.style.display = 'none';
                    }
                }, 250);
            }
        });
        
        // Initialize transition styles
        const guideCard = button.closest('.guide-card');
        const guideContent = guideCard.querySelector('.guide-content');
        const stepsPreview = guideContent.querySelector('.steps-preview');
        const tags = guideContent.querySelector('.tags');
        
        // Add smooth transitions
        stepsPreview.style.transition = 'opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
        tags.style.transition = 'opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1), transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
        button.style.transition = 'background-image 0.25s cubic-bezier(0.4, 0, 0.2, 1)';
    });
}

// View Guide Button Functionality
function initViewGuideButtons() {
    const viewButtons = document.querySelectorAll('.view-guide-btn');
    
    viewButtons.forEach(button => {
        button.addEventListener('click', function() {
            const guideCard = this.closest('.guide-card');
            const guideTitle = guideCard.querySelector('.guide-title').textContent;
            
            // Add loading state
            const originalText = this.textContent;
            this.textContent = 'Loading...';
            this.disabled = true;
            
            // Simulate loading (replace with actual navigation)
            setTimeout(() => {
                // Reset button
                this.textContent = originalText;
                this.disabled = false;
                
                // Show success message or navigate
                showNotification(`Opening ${guideTitle}...`, 'success');
                
                // Here you would typically navigate to the full guide page
                // window.location.href = `guide-detail.html?guide=${encodeURIComponent(guideTitle)}`;
            }, 1500);
        });
    });
}

// Notification Button
function initNotificationButton() {
    const notificationBtn = document.querySelector('.notification');
    
    if (notificationBtn) {
        notificationBtn.addEventListener('click', function() {
            showNotification('No new notifications', 'info');
        });
    }
}

// Navigation Enhancement
function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-links a');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            // Remove active class from all links
            navLinks.forEach(l => l.classList.remove('active'));
            
            // Add active class to clicked link
            this.classList.add('active');
            
            // If it's not the guides page, show coming soon message
            if (!this.getAttribute('href').includes('guides')) {
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
    
    // Observe guide cards
    const guideCards = document.querySelectorAll('.guide-card');
    guideCards.forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(card);
    });
}

// Notification System
function showNotification(message, type = 'info') {
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
        top: 100px;
        right: 20px;
        background: ${getNotificationColor(type)};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 10px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 1000;
        transform: translateX(400px);
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        max-width: 300px;
    `;
    
    // Add notification to body
    document.body.appendChild(notification);
    
    // Animate in
    requestAnimationFrame(() => {
        notification.style.transform = 'translateX(0)';
    });
    
    // Close button functionality
    const closeBtn = notification.querySelector('.notification-close');
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
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 300);
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

// Smooth Scrolling for Internal Links
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

// Export functions for potential use in other files
window.PigSoilGuides = {
    showNotification,
    smoothScroll,
    debounce
};