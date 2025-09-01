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
            e.preventDefault();
            
            // Remove active class from all links
            navLinks.forEach(l => l.classList.remove('active'));
            
            // Add active class to clicked link
            this.classList.add('active');
            
            // Smooth scroll to section
            const targetId = this.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            
            if (targetSection) {
                targetSection.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
            
            // Add navigation feedback
            showNotification(`Navigated to ${this.textContent}`, 'info');
        });
    });
}

// Bot Interaction System
function initializeBotInteractions() {
    const botButtons = document.querySelectorAll('.bot-buttons button');
    const botMessage = document.querySelector('.bot-message p');
    
    // Bot responses database
    const botResponses = {
        gotIt: [
            "Great! I'll remind you about the next steps for your compost.",
            "Perfect! Your compost management is on track.",
            "Excellent! Keep up the good composting work!",
            "Wonderful! Your farm efficiency is improving."
        ],
        askQuestion: [
            "What would you like to know about composting?",
            "I'm here to help! What's your farming question?",
            "How can I assist you with your composting today?",
            "What composting challenge can I help you solve?"
        ]
    };
    
    botButtons.forEach(button => {
        button.addEventListener('click', function() {
            const isGotIt = this.classList.contains('primary');
            const responses = isGotIt ? botResponses.gotIt : botResponses.askQuestion;
            const randomResponse = responses[Math.floor(Math.random() * responses.length)];
            
            // Animate button press
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = 'scale(1)';
            }, 150);
            
            // Update bot message with typing effect
            if (isGotIt) {
                typeMessage(botMessage, randomResponse);
                markTaskAsComplete();
            } else {
                typeMessage(botMessage, randomResponse);
                setTimeout(() => {
                    openChatModal();
                }, 1500);
            }
        });
    });
}

// Typing animation effect
function typeMessage(element, message) {
    element.textContent = '';
    let index = 0;
    
    const typeInterval = setInterval(() => {
        element.textContent += message[index];
        index++;
        
        if (index >= message.length) {
            clearInterval(typeInterval);
        }
    }, 50);
}

// Quick Actions System
function initializeQuickActions() {
    const actionCards = document.querySelectorAll('.action-card');
    
    const actionHandlers = {
        'Start a New Compost': handleNewCompost,
        'Learn Composting': handleLearnComposting,
        'Sell Fertilizer': handleSellFertilizer
    };
    
    actionCards.forEach(card => {
        card.addEventListener('click', function() {
            const actionText = this.querySelector('strong').textContent;
            const handler = actionHandlers[actionText];
            
            // Add click animation
            this.style.transform = 'translateY(-4px) scale(1.02)';
            setTimeout(() => {
                this.style.transform = 'translateY(-2px)';
            }, 200);
            
            if (handler) {
                handler();
            }
            
            showNotification(`${actionText} clicked!`, 'success');
        });
        
        // Enhanced hover effects
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-2px) scale(1.01)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0) scale(1)';
        });
    });
}

// Action Handlers
function handleNewCompost() {
    const modal = createCompostModal();
    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('show'), 10);
}

function handleLearnComposting() {
    const tips = [
        "🌡️ Maintain temperature between 140-160°F for optimal decomposition",
        "💧 Keep moisture at 50-60% - it should feel like a wrung-out sponge",
        "🔄 Turn your compost every 2-3 days for proper aeration",
        "⚖️ Maintain a 3:1 ratio of brown (carbon) to green (nitrogen) materials"
    ];
    
    showLearningTips(tips);
}

function handleSellFertilizer() {
    const marketData = {
        readyBatches: 3,
        estimatedValue: "₱15,750",
        bestPrice: "₱5,250/batch"
    };
    
    showMarketModal(marketData);
}

// Batch Management System
function initializeBatchManagement() {
    const batchCards = document.querySelectorAll('.batch-card');
    const seeAllBtn = document.querySelector('.see-all');
    
    batchCards.forEach(card => {
        card.addEventListener('click', function() {
            const batchName = this.querySelector('strong').textContent;
            showBatchDetails(batchName, this);
        });
        
        // Add batch status monitoring
        const progress = card.querySelector('.progress div');
        const progressWidth = parseInt(progress.style.width);
        
        if (progressWidth >= 90) {
            card.classList.add('ready-soon');
            card.style.borderLeft = '4px solid #FF9800';
        }
    });
    
    if (seeAllBtn) {
        seeAllBtn.addEventListener('click', function() {
            showAllBatches();
        });
    }
}

// Notification System
function initializeNotifications() {
    const notificationBtn = document.querySelector('#notificationBtn');
    const cartBtn = document.querySelector('#cartBtn');
    
    // Add notification counter
    addNotificationBadge(notificationBtn, 3);
    addNotificationBadge(cartBtn, 2);
    
    notificationBtn.addEventListener('click', function() {
        showNotificationPanel();
    });
    
    cartBtn.addEventListener('click', function() {
        showCartPanel();
    });
}

// User Profile Management
function initializeUserProfile() {
    const userProfile = document.querySelector('.user-profile');
    
    userProfile.addEventListener('click', function() {
        showUserMenu();
    });
}

// Real-time Updates
function startRealTimeUpdates() {
    // Update batch progress every 30 seconds (simulated)
    setInterval(updateBatchProgress, 30000);
    
    // Check for new notifications every minute
    setInterval(checkNotifications, 60000);
    
    // Update weather and farming conditions
    setInterval(updateFarmingConditions, 300000); // 5 minutes
}

// Utility Functions

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">${getNotificationIcon(type)}</span>
            <span class="notification-message">${message}</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => notification.classList.add('show'), 10);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => document.body.removeChild(notification), 300);
    }, 3000);
}

function getNotificationIcon(type) {
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    return icons[type] || icons.info;
}

function createCompostModal() {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>🌱 Start New Compost Batch</h3>
                <button class="close-btn">&times;</button>
            </div>
            <div class="modal-body">
                <form id="compostForm">
                    <div class="form-group">
                        <label for="batchName">Batch Name:</label>
                        <input type="text" id="batchName" placeholder="e.g., Basic Compost C">
                    </div>
                    <div class="form-group">
                        <label for="compostType">Compost Type:</label>
                        <select id="compostType">
                            <option value="basic">Basic Compost (21 days)</option>
                            <option value="hot">Hot Compost (18 days)</option>
                            <option value="quick">Quick Compost (14 days)</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="materialAmount">Pig Waste Amount (kg):</label>
                        <input type="number" id="materialAmount" placeholder="100" min="1">
                    </div>
                    <button type="submit" class="submit-btn">Start Composting</button>
                </form>
            </div>
        </div>
    `;
    
    // Add event listeners
    modal.querySelector('.close-btn').addEventListener('click', () => {
        modal.classList.remove('show');
        setTimeout(() => document.body.removeChild(modal), 300);
    });
    
    modal.querySelector('#compostForm').addEventListener('submit', function(e) {
        e.preventDefault();
        const batchName = document.getElementById('batchName').value;
        const compostType = document.getElementById('compostType').value;
        const amount = document.getElementById('materialAmount').value;
        
        if (batchName && amount) {
            addNewBatch(batchName, compostType, amount);
            modal.classList.remove('show');
            setTimeout(() => document.body.removeChild(modal), 300);
            showNotification(`New batch "${batchName}" started successfully!`, 'success');
        } else {
            showNotification('Please fill in all required fields', 'warning');
        }
    });
    
    return modal;
}

function showLearningTips(tips) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>📚 Composting Tips</h3>
                <button class="close-btn">&times;</button>
            </div>
            <div class="modal-body">
                <div class="tips-container">
                    ${tips.map(tip => `<div class="tip-item">${tip}</div>`).join('')}
                </div>
                <div class="tip-actions">
                    <button class="btn-secondary" onclick="showRandomTip()">Random Tip</button>
                    <button class="btn-primary" onclick="openFullGuide()">Full Guide</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('show'), 10);
    
    modal.querySelector('.close-btn').addEventListener('click', () => {
        modal.classList.remove('show');
        setTimeout(() => document.body.removeChild(modal), 300);
    });
}

function showMarketModal(data) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>💰 Fertilizer Market</h3>
                <button class="close-btn">&times;</button>
            </div>
            <div class="modal-body">
                <div class="market-stats">
                    <div class="stat-item">
                        <span class="stat-label">Ready Batches:</span>
                        <span class="stat-value">${data.readyBatches}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Estimated Value:</span>
                        <span class="stat-value">${data.estimatedValue}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Best Price:</span>
                        <span class="stat-value">${data.bestPrice}</span>
                    </div>
                </div>
                <div class="market-actions">
                    <button class="btn-primary" onclick="listForSale()">List for Sale</button>
                    <button class="btn-secondary" onclick="viewBuyers()">View Buyers</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('show'), 10);
    
    modal.querySelector('.close-btn').addEventListener('click', () => {
        modal.classList.remove('show');
        setTimeout(() => document.body.removeChild(modal), 300);
    });
}

function addNotificationBadge(element, count) {
    const badge = document.createElement('span');
    badge.className = 'notification-badge';
    badge.textContent = count;
    element.appendChild(badge);
}

function updateBatchProgress() {
    const progressBars = document.querySelectorAll('.progress div');
    progressBars.forEach(bar => {
        const currentWidth = parseInt(bar.style.width);
        if (currentWidth < 100) {
            // Simulate progress increase
            const newWidth = Math.min(currentWidth + Math.random() * 2, 100);
            bar.style.width = newWidth + '%';
            
            if (newWidth >= 100) {
                showNotification('🎉 A compost batch is ready for harvest!', 'success');
            }
        }
    });
}

function checkNotifications() {
    // Simulate checking for new notifications
    const notifications = [
        'Your Basic Compost A needs turning',
        'Weather alert: Rain expected tomorrow',
        'New buyer interested in your fertilizer',
        'Temperature check required for Hot Compost B'
    ];
    
    if (Math.random() > 0.7) { // 30% chance of new notification
        const randomNotification = notifications[Math.floor(Math.random() * notifications.length)];
        showNotification(randomNotification, 'info');
        
        // Update notification badge
        const badge = document.querySelector('#notificationBtn .notification-badge');
        if (badge) {
            badge.textContent = parseInt(badge.textContent) + 1;
        }
    }
}

function updateFarmingConditions() {
    // Simulate updating farming conditions
    const conditions = ['Optimal', 'Good', 'Fair', 'Needs Attention'];
    const randomCondition = conditions[Math.floor(Math.random() * conditions.length)];
    
    console.log(`Farm conditions updated: ${randomCondition}`);
    
    if (randomCondition === 'Needs Attention') {
        showNotification('⚠️ Farm conditions need attention - check ManongBot for details', 'warning');
    }
}

// Add CSS for modals and notifications
const modalStyles = `
<style>
.notification {
    position: fixed;
    top: 100px;
    right: 20px;
    background: white;
    padding: 15px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    transform: translateX(400px);
    transition: transform 0.3s ease;
    z-index: 10000;
    min-width: 300px;
}

.notification.show {
    transform: translateX(0);
}

.notification.success {
    border-left: 4px solid #4CAF50;
}

.notification.error {
    border-left: 4px solid #f44336;
}

.notification.warning {
    border-left: 4px solid #FF9800;
}

.notification.info {
    border-left: 4px solid #2196F3;
}

.notification-content {
    display: flex;
    align-items: center;
    gap: 10px;
}

.notification-badge {
    position: absolute;
    top: -5px;
    right: -5px;
    background: #f44336;
    color: white;
    border-radius: 50%;
    width: 20px;
    height: 20px;
    font-size: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
}

.modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    opacity: 0;
    transition: opacity 0.3s ease;
}

.modal.show {
    opacity: 1;
}

.modal-content {
    background: white;
    border-radius: 16px;
    max-width: 500px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
    transform: scale(0.9);
    transition: transform 0.3s ease;
}

.modal.show .modal-content {
    transform: scale(1);
}

.modal-header {
    padding: 20px;
    border-bottom: 1px solid #eee;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.modal-body {
    padding: 20px;
}

.close-btn {
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: #666;
}

.form-group {
    margin-bottom: 15px;
}

.form-group label {
    display: block;
    margin-bottom: 5px;
    font-weight: 600;
}

.form-group input,
.form-group select {
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 14px;
}

.submit-btn,
.btn-primary,
.btn-secondary {
    padding: 10px 20px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-weight: 600;
    margin: 5px;
}

.submit-btn,
.btn-primary {
    background: #4CAF50;
    color: white;
}

.btn-secondary {
    background: #f5f5f5;
    color: #333;
}

.tips-container {
    margin-bottom: 20px;
}

.tip-item {
    background: #f8f9fa;
    padding: 15px;
    margin-bottom: 10px;
    border-radius: 8px;
    border-left: 4px solid #4CAF50;
}

.market-stats {
    margin-bottom: 20px;
}

.stat-item {
    display: flex;
    justify-content: space-between;
    padding: 10px 0;
    border-bottom: 1px solid #eee;
}

.stat-value {
    font-weight: 600;
    color: #4CAF50;
}
</style>
`;

// Inject modal styles
document.head.insertAdjacentHTML('beforeend', modalStyles);