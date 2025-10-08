// script.js

// Global variables
let selectedLocation = { x: 50, y: 50 }; // Default center position (percentage)

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeMap();
    setupEventListeners();
});

// Initialize map functionality
function initializeMap() {
    const map = document.getElementById('map');
    const marker = document.getElementById('marker');
    
    // Set initial marker position
    updateMarkerPosition(selectedLocation.x, selectedLocation.y);
    
    // Add click event to map for selecting location
    map.addEventListener('click', function(e) {
        const rect = map.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        
        selectedLocation = { x: x, y: y };
        updateMarkerPosition(x, y);
        
        // Add a little bounce animation
        marker.style.animation = 'none';
        setTimeout(() => {
            marker.style.animation = 'bounce 2s ease-in-out infinite';
        }, 100);
    });
}

// Update marker position on the map
function updateMarkerPosition(x, y) {
    const marker = document.getElementById('marker');
    marker.style.left = x + '%';
    marker.style.top = y + '%';
}

// Setup event listeners for interactive elements
function setupEventListeners() {
    // Navigation links
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Remove active class from all nav links
            navLinks.forEach(l => l.classList.remove('active'));
            
            // Add active class to clicked link
            this.classList.add('active');
            
            // Show notification (simulate navigation)
            showNotification(`Navigated to ${this.textContent}`);
        });
    });
    
    // Sidebar links
    const sidebarLinks = document.querySelectorAll('.sidebar-link');
    sidebarLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Remove active class from all sidebar links
            sidebarLinks.forEach(l => l.classList.remove('active'));
            
            // Add active class to clicked link
            this.classList.add('active');
            
            // Show notification
            showNotification(`Switched to ${this.textContent} settings`);
        });
    });
    
    // Logout button
    const logoutBtn = document.querySelector('.logout-btn');
    logoutBtn.addEventListener('click', function() {
        if (confirm('Are you sure you want to log out?')) {
            showNotification('Logging out...', 'warning');
            setTimeout(() => {
                alert('You have been logged out successfully!');
            }, 1000);
        }
    });
    
    // Notification button
    const notificationBtn = document.querySelector('.notification-btn');
    notificationBtn.addEventListener('click', function() {
        showNotificationPanel();
    });
}

// Save location function
function saveLocation() {
    const saveBtn = document.querySelector('.save-btn');
    
    // Disable button and show loading state
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    
    // Simulate API call
    setTimeout(() => {
        // Re-enable button
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Location';
        
        // Show success message
        showNotification('Location saved successfully!', 'success');
        
        // Log the saved location (in real app, this would be sent to server)
        console.log('Location saved:', selectedLocation);
        
        // Store in localStorage for demo purposes
        localStorage.setItem('userLocation', JSON.stringify(selectedLocation));
        
    }, 2000);
}

// Show notification function
function showNotification(message, type = 'info') {
    // Remove existing notification
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Style the notification
    Object.assign(notification.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        padding: '1rem 1.5rem',
        borderRadius: '8px',
        color: 'white',
        fontWeight: '600',
        zIndex: '1000',
        opacity: '0',
        transform: 'translateX(100%)',
        transition: 'all 0.3s ease'
    });
    
    // Set background color based on type
    switch (type) {
        case 'success':
            notification.style.background = '#28a745';
            break;
        case 'warning':
            notification.style.background = '#ffc107';
            notification.style.color = '#333';
            break;
        case 'error':
            notification.style.background = '#dc3545';
            break;
        default:
            notification.style.background = '#4a7c59';
    }
    
    // Add to document
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 300);
    }, 3000);
}

// Show notification panel
function showNotificationPanel() {
    const notifications = [
        { message: 'Your pig batch #234 is ready for market!', time: '2 hours ago', type: 'success' },
        { message: 'Weather alert: Heavy rain expected tomorrow', time: '4 hours ago', type: 'warning' },
        { message: 'New guide available: Pig nutrition basics', time: '1 day ago', type: 'info' }
    ];
    
    // Create notification panel
    const panel = document.createElement('div');
    panel.className = 'notification-panel';
    
    let panelHTML = `
        <div class="notification-panel-header">
            <h3>Notifications</h3>
            <button class="close-panel">&times;</button>
        </div>
        <div class="notification-panel-content">
    `;
    
    notifications.forEach(notif => {
        panelHTML += `
            <div class="notification-item notification-item-${notif.type}">
                <div class="notification-message">${notif.message}</div>
                <div class="notification-time">${notif.time}</div>
            </div>
        `;
    });
    
    panelHTML += '</div>';
    panel.innerHTML = panelHTML;
    
    // Style the panel
    Object.assign(panel.style, {
        position: 'fixed',
        top: '80px',
        right: '20px',
        width: '350px',
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
        zIndex: '1000',
        opacity: '0',
        transform: 'translateY(-20px)',
        transition: 'all 0.3s ease'
    });
    
    document.body.appendChild(panel);
    
    // Animate in
    setTimeout(() => {
        panel.style.opacity = '1';
        panel.style.transform = 'translateY(0)';
    }, 100);
    
    // Add close functionality
    panel.querySelector('.close-panel').addEventListener('click', () => {
        panel.style.opacity = '0';
        panel.style.transform = 'translateY(-20px)';
        setTimeout(() => panel.remove(), 300);
    });
    
    // Auto close after 5 seconds
    setTimeout(() => {
        if (panel.parentNode) {
            panel.style.opacity = '0';
            panel.style.transform = 'translateY(-20px)';
            setTimeout(() => panel.remove(), 300);
        }
    }, 5000);
}

// Add CSS for notification panel dynamically
const notificationPanelCSS = `
    .notification-panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem;
        border-bottom: 1px solid #eee;
    }
    
    .notification-panel-header h3 {
        margin: 0;
        color: #333;
        font-size: 1.1rem;
    }
    
    .close-panel {
        background: none;
        border: none;
        font-size: 1.5rem;
        cursor: pointer;
        color: #666;
        padding: 0;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    .close-panel:hover {
        background: #f0f0f0;
    }
    
    .notification-panel-content {
        max-height: 300px;
        overflow-y: auto;
    }
    
    .notification-item {
        padding: 1rem;
        border-bottom: 1px solid #f0f0f0;
        cursor: pointer;
    }
    
    .notification-item:hover {
        background: #f8f8f8;
    }
    
    .notification-item:last-child {
        border-bottom: none;
    }
    
    .notification-message {
        font-weight: 500;
        color: #333;
        margin-bottom: 0.25rem;
    }
    
    .notification-time {
        font-size: 0.8rem;
        color: #666;
    }
    
    .notification-item-success .notification-message {
        color: #28a745;
    }
    
    .notification-item-warning .notification-message {
        color: #ffc107;
    }
    
    .notification-item-info .notification-message {
        color: #4a7c59;
    }
`;

// Add the CSS to the document
const style = document.createElement('style');
style.textContent = notificationPanelCSS;
document.head.appendChild(style);

// Load saved location on page load
document.addEventListener('DOMContentLoaded', function() {
    const savedLocation = localStorage.getItem('userLocation');
    if (savedLocation) {
        selectedLocation = JSON.parse(savedLocation);
        setTimeout(() => {
            updateMarkerPosition(selectedLocation.x, selectedLocation.y);
        }, 100);
    }
});