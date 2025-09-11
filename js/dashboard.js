// PigSoil+ Dashboard JavaScript
// Author: Your Name
// Description: Interactive functionality for the PigSoil+ farming dashboard

document.addEventListener('DOMContentLoaded', function() {
    // Initialize all components
    initializeNavigation();
    initializeBotInteractions();
    initializeQuickActions();
    initializeBatchManagement();
    initializeNotifications();
    initializeUserProfile();
    startRealTimeUpdates();
});

// Navigation Management
function initializeNavigation() {
    const navLinks = document.querySelectorAll('.nav-menu a');

    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            const href = this.getAttribute('href');

            // Only handle internal section links (starting with #)
            if (href.startsWith('#')) {
                e.preventDefault();

                // Remove active class from all links
                navLinks.forEach(l => l.classList.remove('active'));

                // Add active class to clicked link
                this.classList.add('active');

                // Smooth scroll to section
                const targetSection = document.querySelector(href);
                if (targetSection) {
                    targetSection.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }

                showNotification(`Navigated to ${this.textContent}`, 'info');
            }
            // External links (like marketplace.html) will work normally
        });
    });
}

// Bot Interaction System
function initializeBotInteractions() {
    const botButtons = document.querySelectorAll('.bot-buttons button');
    const botMessage = document.querySelector('.bot-message');
    
    const botResponses = [
        "How can I help you optimize your composting process today?",
        "Ask me anything about pig manure composting, soil health, or fertilizer production!",
        "I'm here to guide you through any farming challenges. What's on your mind?",
        "Need tips on moisture levels, temperature control, or carbon ratios? Just ask!",
        "What would you like to know about turning waste into profit?"
    ];

    botButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Add press animation
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = 'scale(1)';
            }, 150);

            // Handle Ask Question button specifically
            if (this.classList.contains('secondary') || this.textContent.includes('Ask Question')) {
                // Show typing indicator
                botMessage.textContent = "Manong Bot is typing...";
                
                // After a short delay, show random response
                setTimeout(() => {
                    const randomResponse = botResponses[Math.floor(Math.random() * botResponses.length)];
                    botMessage.textContent = randomResponse;
                }, 1000);
            }
        });
    });
}

// Quick Actions System
function initializeQuickActions() {
    const actionCards = document.querySelectorAll('.action-card');
    
    // Action-specific responses and behaviors
    const actionResponses = {
        'Start a New Compost': {
            message: 'Great! Let me guide you through setting up a new compost batch...',
            followUp: 'What type of composting method would you like to use?',
            icon: '🌱'
        },
        'Learn Composting': {
            message: 'Opening composting guide... Perfect for beginners!',
            followUp: 'Would you like to start with basic or advanced techniques?',
            icon: '📚'
        },
        'Sell Fertilizer': {
            message: 'Taking you to the marketplace... Let\'s turn your compost into profit!',
            followUp: 'Your premium fertilizer is ready to list!',
            icon: '💰'
        }
    };

    actionCards.forEach((card, index) => {
        // Add loading state capability
        card.setAttribute('data-loading', 'false');
        
        card.addEventListener('click', function() {
            const action = this.querySelector('strong').textContent;
            const actionData = actionResponses[action];
            
            // Prevent double clicks during loading
            if (this.getAttribute('data-loading') === 'true') return;
            
            console.log(`${action} clicked`);
            
            // Set loading state
            this.setAttribute('data-loading', 'true');
            
            // Enhanced click animation with loading effect
            this.style.transform = 'translateY(-4px) scale(1.02)';
            this.style.filter = 'brightness(1.1)';
            
            // Add subtle pulse effect
            this.style.animation = 'pulse 0.6s ease-in-out';
            
            setTimeout(() => {
                this.style.transform = 'translateY(0) scale(1)';
                this.style.filter = 'brightness(1)';
                this.style.animation = 'none';
                this.setAttribute('data-loading', 'false');
            }, 600);

            // Show contextual notification
            if (actionData) {
                showNotification(`${actionData.icon} ${actionData.message}`, 'success');
                
                // Show follow-up message after a delay
                setTimeout(() => {
                    showFollowUpMessage(actionData.followUp, actionData.icon);
                }, 2000);
            } else {
                showNotification(`${action} clicked!`, 'success');
            }
            
            // Update Manong Bot with contextual advice
            updateBotWithActionAdvice(action);
        });

        // Enhanced hover effects with tooltips
        card.addEventListener('mouseenter', function() {
            const action = this.querySelector('strong').textContent;
            
            this.style.transform = 'translateY(-2px) scale(1.01)';
            this.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)';
            
            // Add subtle glow effect
            this.style.filter = 'brightness(1.05)';
            
            // Show preview tooltip
            showActionPreview(this, action);
        });

        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
            this.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.15)';
            this.style.filter = 'brightness(1)';
            
            // Hide preview tooltip
            hideActionPreview();
        });
        
        // Add keyboard accessibility
        card.setAttribute('tabindex', '0');
        card.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.click();
            }
        });
    });
    
    // Add CSS for pulse animation
    if (!document.querySelector('#pulse-animation-style')) {
        const style = document.createElement('style');
        style.id = 'pulse-animation-style';
        style.textContent = `
            @keyframes pulse {
                0% { box-shadow: 0 0 0 0 rgba(76, 175, 80, 0.4); }
                70% { box-shadow: 0 0 0 10px rgba(76, 175, 80, 0); }
                100% { box-shadow: 0 0 0 0 rgba(76, 175, 80, 0); }
            }
        `;
        document.head.appendChild(style);
    }
}

// Update bot with action-specific advice
function updateBotWithActionAdvice(action) {
    const botMessage = document.querySelector('.bot-message');
    const actionAdvice = {
        'Start a New Compost': 'Pro tip: Start with a 3:1 ratio of carbon to nitrogen materials for optimal composting!',
        'Learn Composting': 'Remember: Temperature, moisture, oxygen, and time are the four key factors for successful composting.',
        'Sell Fertilizer': 'Your compost is like liquid gold! Premium organic fertilizer sells for 3x more than regular compost.'
    };
    
    if (botMessage && actionAdvice[action]) {
        setTimeout(() => {
            botMessage.textContent = actionAdvice[action];
        }, 1500);
    }
}

// Show action preview tooltip
function showActionPreview(element, action) {
    const previews = {
        'Start a New Compost': 'Set up monitoring for temperature, moisture, and turning schedule',
        'Learn Composting': 'Access video tutorials, guides, and best practices',
        'Sell Fertilizer': 'List your products, set prices, and connect with buyers'
    };
    
    const preview = previews[action];
    if (!preview) return;
    
    const tooltip = document.createElement('div');
    tooltip.className = 'action-tooltip';
    tooltip.textContent = preview;
    tooltip.style.cssText = `
        position: absolute;
        background: rgba(0,0,0,0.9);
        color: white;
        padding: 8px 12px;
        border-radius: 8px;
        font-size: 12px;
        font-family: 'Poppins', sans-serif;
        z-index: 1000;
        pointer-events: none;
        white-space: nowrap;
        transform: translateX(-50%);
        opacity: 0;
        transition: opacity 0.3s ease;
    `;
    
    document.body.appendChild(tooltip);
    
    const rect = element.getBoundingClientRect();
    tooltip.style.left = rect.left + rect.width / 2 + 'px';
    tooltip.style.top = rect.top - 40 + 'px';
    
    setTimeout(() => {
        tooltip.style.opacity = '1';
    }, 100);
}

// Hide action preview tooltip
function hideActionPreview() {
    const tooltip = document.querySelector('.action-tooltip');
    if (tooltip) {
        tooltip.style.opacity = '0';
        setTimeout(() => {
            if (tooltip.parentNode) {
                tooltip.parentNode.removeChild(tooltip);
            }
        }, 300);
    }
}

// Show follow-up message
function showFollowUpMessage(message, icon) {
    const followUp = document.createElement('div');
    followUp.className = 'follow-up-message';
    followUp.innerHTML = `${icon} ${message}`;
    
    followUp.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: linear-gradient(135deg, #4CAF50, #45a049);
        color: white;
        padding: 16px 20px;
        border-radius: 12px;
        box-shadow: 0 6px 20px rgba(76, 175, 80, 0.3);
        z-index: 1000;
        font-family: 'Poppins', sans-serif;
        font-size: 14px;
        font-weight: 500;
        max-width: 300px;
        transform: translateY(100%);
        transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    `;
    
    document.body.appendChild(followUp);
    
    setTimeout(() => {
        followUp.style.transform = 'translateY(0)';
    }, 100);
    
    setTimeout(() => {
        followUp.style.transform = 'translateY(100%)';
        setTimeout(() => {
            if (followUp.parentNode) {
                followUp.parentNode.removeChild(followUp);
            }
        }, 400);
    }, 4000);
}

// Batch Management System
function initializeBatchManagement() {
    // This would handle batch operations
    console.log('Batch management initialized');
}

// Notification System
function initializeNotifications() {
    const notificationBtn = document.getElementById('notificationBtn');
    if (notificationBtn) {
        notificationBtn.addEventListener('click', function() {
            showNotification('No new notifications', 'info');
        });
    }
}

// User Profile Management
function initializeUserProfile() {
    const userProfile = document.querySelector('.user-profile');
    if (userProfile) {
        userProfile.addEventListener('click', function(e) {
            // This would handle profile menu
            console.log('User profile clicked');
        });
    }
}

// Real-time Updates
function startRealTimeUpdates() {
    // This would handle real-time data updates
    console.log('Real-time updates started');
}

// Utility function for notifications
function showNotification(message, type) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // Style the notification
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
    
    // Slide in
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}