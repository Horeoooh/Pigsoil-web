// PigSoil+ Batches Page JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // Initialize the page
    initializePage();
});

function initializePage() {
    // Add event listeners
    addEventListeners();
    
    // Initialize any dynamic content
    updateProgressBars();
    
    console.log('PigSoil+ Batches page initialized');
}

function addEventListeners() {
    // Update Progress buttons
    const updateButtons = document.querySelectorAll('.update-btn');
    updateButtons.forEach(button => {
        button.addEventListener('click', handleUpdateProgress);
    });

    // New Batch button
    const newBatchBtn = document.querySelector('.new-batch-btn');
    if (newBatchBtn) {
        newBatchBtn.addEventListener('click', handleNewBatch);
    }

    // Edit buttons
    const editButtons = document.querySelectorAll('.edit-btn');
    editButtons.forEach(button => {
        button.addEventListener('click', handleEditBatch);
    });

    // Delete buttons
    const deleteButtons = document.querySelectorAll('.delete-btn');
    deleteButtons.forEach(button => {
        button.addEventListener('click', handleDeleteBatch);
    });

    // Navigation items
    const navItems = document.querySelectorAll('.nav-menu a');
    navItems.forEach(item => {
        item.addEventListener('click', handleNavigation);
    });

    // Icon buttons
    const cartBtn = document.getElementById('cartBtn');
    const notificationBtn = document.getElementById('notificationBtn');
    
    if (cartBtn) {
        cartBtn.addEventListener('click', handleCartClick);
    }
    
    if (notificationBtn) {
        notificationBtn.addEventListener('click', handleNotificationClick);
    }
}

function handleUpdateProgress(event) {
    const button = event.currentTarget;
    const batchCard = button.closest('.batch-card');
    const batchTitle = batchCard.querySelector('.batch-title').textContent;
    
    // Show loading state
    button.style.opacity = '0.7';
    button.style.pointerEvents = 'none';
    
    // Simulate API call
    setTimeout(() => {
        alert(`Progress updated for ${batchTitle}!\n\nIn a real application, this would:\n- Send data to the server\n- Update the progress bar\n- Refresh batch information\n- Show success notification`);
        
        // Reset button state
        button.style.opacity = '1';
        button.style.pointerEvents = 'auto';
    }, 1000);
}

function handleNewBatch() {
    alert('Start New Compost Batch\n\nThis would open a form to:\n- Select composting method\n- Set batch parameters\n- Choose materials\n- Set timeline\n- Create batch tracking');
}

function handleEditBatch(event) {
    const batchCard = event.currentTarget.closest('.batch-card');
    const batchTitle = batchCard.querySelector('.batch-title').textContent;
    
    alert(`Edit ${batchTitle}\n\nThis would open an edit form to modify:\n- Batch parameters\n- Timeline\n- Materials\n- Notes`);
}

function handleDeleteBatch(event) {
    const batchCard = event.currentTarget.closest('.batch-card');
    const batchTitle = batchCard.querySelector('.batch-title').textContent;
    
    if (confirm(`Are you sure you want to delete "${batchTitle}"?\n\nThis action cannot be undone.`)) {
        // Animate removal
        batchCard.style.transform = 'scale(0.9)';
        batchCard.style.opacity = '0.5';
        
        setTimeout(() => {
            alert(`${batchTitle} has been deleted.\n\nIn a real application, this would:\n- Remove from database\n- Update statistics\n- Show confirmation`);
            // batchCard.remove(); // Uncomment to actually remove
            
            // Reset for demo
            batchCard.style.transform = '';
            batchCard.style.opacity = '';
        }, 500);
    }
}

function handleNavigation(event) {
    event.preventDefault();
    const target = event.currentTarget.getAttribute('href');
    
    // Remove active class from all nav items
    document.querySelectorAll('.nav-menu a').forEach(link => {
        link.classList.remove('active');
    });
    
    // Add active class to clicked item
    event.currentTarget.classList.add('active');
    
    // Navigate based on target
    switch(target) {
        case '#dashboard':
            alert('Navigating to Dashboard...');
            break;
        case '#batches':
            alert('You are already on the Batches page');
            break;
        case '#market':
            alert('Navigating to Market...');
            break;
        case '#guides':
            alert('Navigating to Guides...');
            break;
        case '#manongbot':
            alert('Navigating to ManongBot...');
            break;
        default:
            console.log('Unknown navigation target:', target);
    }
}

function handleCartClick() {
    alert('Shopping Cart\n\nThis would show:\n- Current cart items\n- Quantities\n- Total price\n- Checkout options');
}

function handleNotificationClick() {
    alert('Notifications\n\nThis would display:\n- Batch updates\n- Due actions\n- System alerts\n- Messages');
}

function updateProgressBars() {
    // Animate progress bars on page load
    const progressBars = document.querySelectorAll('.progress-fill');
    
    progressBars.forEach((bar, index) => {
        const targetWidth = bar.style.width;
        bar.style.width = '0%';
        
        setTimeout(() => {
            bar.style.transition = 'width 1s ease-in-out';
            bar.style.width = targetWidth;
        }, 300 + (index * 100)); // Stagger the animations
    });
}

// Utility functions
function formatDate(date) {
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }).format(date);
}

function calculateDaysRemaining(startDate, totalDays, currentDay) {
    return totalDays - currentDay;
}

function updateBatchStatistics() {
    // This would typically fetch data from an API
    const activeBatches = document.querySelectorAll('.batch-card').length;
    const readyBatches = 1; // This would be calculated based on completion
    const totalBatches = activeBatches + readyBatches;
    
    // Update the statistics cards
    document.querySelector('.active-stat .stat-number').textContent = activeBatches;
    document.querySelector('.ready-stat .stat-number').textContent = readyBatches;
    document.querySelector('.stat-card:not(.active-stat):not(.ready-stat) .stat-number').textContent = totalBatches;
}

// Simulated data updates (in a real app, this would come from an API)
function simulateDataUpdate() {
    // This function would periodically update batch data
    console.log('Checking for batch updates...');
    
    // Example: Update next actions based on current time
    updateNextActions();
}

function updateNextActions() {
    const batchCards = document.querySelectorAll('.batch-card');
    
    batchCards.forEach(card => {
        const dueLabel = card.querySelector('.due-label');
        if (dueLabel && dueLabel.textContent.includes('Today')) {
            // Highlight overdue or due today items
            dueLabel.style.fontWeight = 'bold';
            dueLabel.style.animation = 'pulse 2s infinite';
        }
    });
}

// Add pulse animation for urgent items
const style = document.createElement('style');
style.textContent = `
    @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: 0.7; }
        100% { opacity: 1; }
    }
`;
document.head.appendChild(style);

// Initialize periodic updates (in a real app)
setInterval(simulateDataUpdate, 30000); // Check every 30 seconds

// Export functions for potential use in other modules
window.PigSoilBatches = {
    updateProgressBars,
    updateBatchStatistics,
    formatDate,
    calculateDaysRemaining
};