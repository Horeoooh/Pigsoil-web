// PigSoil+ Farmer Market JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // Initialize the application
    initializeApp();
});

function initializeApp() {
    // Set up event listeners
    setupNavigationHandlers();
    setupTabHandlers();
    setupSearchHandler();
    setupButtonHandlers();
    setupCardAnimations();
    
    // Initialize data
    loadListingsData();
    
    console.log('PigSoil+ Farmer Market initialized successfully!');
}

// Navigation Handlers
function setupNavigationHandlers() {
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Remove active class from all links
            navLinks.forEach(l => l.classList.remove('active'));
            
            // Add active class to clicked link
            this.classList.add('active');
            
            // Handle navigation based on link text
            const linkText = this.textContent.trim();
            handleNavigation(linkText);
        });
    });
}

function handleNavigation(page) {
    switch(page) {
        case 'Dashboard':
            showNotification('Navigating to Dashboard...', 'info');
            break;
        case 'Batches':
            showNotification('Navigating to Batches...', 'info');
            break;
        case 'Market':
            showNotification('You are already on the Market page', 'info');
            break;
        case 'Guides':
            showNotification('Navigating to Guides...', 'info');
            break;
        case 'Manong Bot':
            showNotification('Navigating to Manong Bot...', 'info');
            break;
        default:
            console.log('Unknown navigation:', page);
    }
}

// Tab Handlers
function setupTabHandlers() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Remove active class from all tabs
            tabButtons.forEach(btn => btn.classList.remove('active'));
            
            // Add active class to clicked tab
            this.classList.add('active');
            
            // Filter listings based on selected tab
            const tabName = this.textContent.trim();
            filterListings(tabName);
        });
    });
}

function filterListings(filter) {
    const listingsGrid = document.querySelector('.listings-grid');
    const allCards = document.querySelectorAll('.listing-card');
    
    // Show loading state
    listingsGrid.style.opacity = '0.5';
    
    setTimeout(() => {
        switch(filter) {
            case 'My Listings':
                showAllListings();
                break;
            case 'Active':
                showActiveListings();
                break;
            case 'Sold':
                showSoldListings();
                break;
            case 'Nearby Buyers':
                showNearbyBuyers();
                break;
        }
        
        // Restore opacity
        listingsGrid.style.opacity = '1';
        
        showNotification(`Showing ${filter}`, 'success');
    }, 300);
}

function showAllListings() {
    const allCards = document.querySelectorAll('.listing-card');
    allCards.forEach(card => {
        card.style.display = 'block';
    });
}

function showActiveListings() {
    const allCards = document.querySelectorAll('.listing-card');
    allCards.forEach(card => {
        const statusBadge = card.querySelector('.status-badge');
        if (statusBadge && statusBadge.classList.contains('active')) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}

function showSoldListings() {
    const allCards = document.querySelectorAll('.listing-card');
    allCards.forEach(card => {
        const statusBadge = card.querySelector('.status-badge');
        if (statusBadge && statusBadge.classList.contains('sold')) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}

function showNearbyBuyers() {
    // Hide all current listings and show a message
    const listingsGrid = document.querySelector('.listings-grid');
    listingsGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px;">
            <h3 style="color: #666; margin-bottom: 15px;">No nearby buyers found</h3>
            <p style="color: #888;">Check back later or expand your search radius in settings.</p>
        </div>
    `;
}

// Search Handler
function setupSearchHandler() {
    const searchInput = document.querySelector('.search-input');
    let searchTimeout;
    
    searchInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        
        searchTimeout = setTimeout(() => {
            const searchTerm = this.value.toLowerCase().trim();
            performSearch(searchTerm);
        }, 300);
    });
    
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const searchTerm = this.value.toLowerCase().trim();
            performSearch(searchTerm);
        }
    });
}

function performSearch(searchTerm) {
    const allCards = document.querySelectorAll('.listing-card');
    let visibleCount = 0;
    
    if (searchTerm === '') {
        // Show all listings if search is empty
        allCards.forEach(card => {
            card.style.display = 'block';
            visibleCount++;
        });
    } else {
        allCards.forEach(card => {
            const title = card.querySelector('.listing-title').textContent.toLowerCase();
            const price = card.querySelector('.listing-price').textContent.toLowerCase();
            
            if (title.includes(searchTerm) || price.includes(searchTerm)) {
                card.style.display = 'block';
                visibleCount++;
            } else {
                card.style.display = 'none';
            }
        });
    }
    
    if (visibleCount === 0 && searchTerm !== '') {
        showNoResults();
    }
    
    showNotification(`Found ${visibleCount} listing(s)`, 'info');
}

function showNoResults() {
    const listingsGrid = document.querySelector('.listings-grid');
    const existingNoResults = listingsGrid.querySelector('.no-results');
    
    if (!existingNoResults) {
        const noResultsDiv = document.createElement('div');
        noResultsDiv.className = 'no-results';
        noResultsDiv.style.cssText = 'grid-column: 1 / -1; text-align: center; padding: 60px 20px;';
        noResultsDiv.innerHTML = `
            <h3 style="color: #666; margin-bottom: 15px;">No listings found</h3>
            <p style="color: #888;">Try adjusting your search terms or browse all listings.</p>
        `;
        listingsGrid.appendChild(noResultsDiv);
        
        setTimeout(() => {
            if (noResultsDiv.parentNode) {
                noResultsDiv.remove();
            }
        }, 3000);
    }
}

// Button Handlers
function setupButtonHandlers() {
    // Add Listing Button
    const addListingBtn = document.querySelector('.btn-primary');
    addListingBtn.addEventListener('click', function() {
        handleAddListing();
    });
    
    // Messages Button
    const messagesBtn = document.querySelector('.messages-btn');
    messagesBtn.addEventListener('click', function() {
        handleMessages();
    });
    
    // View Buttons
    const viewButtons = document.querySelectorAll('.btn-view');
    viewButtons.forEach(button => {
        button.addEventListener('click', function() {
            const listingCard = this.closest('.listing-card');
            const listingTitle = listingCard.querySelector('.listing-title').textContent;
            handleViewListing(listingTitle);
        });
    });
}

function handleAddListing() {
    showNotification('Opening Add Listing form...', 'info');
    
    // Create a modal for adding listing
    const modal = createModal('Add New Listing', `
        <form id="addListingForm" style="display: flex; flex-direction: column; gap: 20px;">
            <div>
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Product Name</label>
                <input type="text" id="productName" style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px;" placeholder="e.g., Premium Pig Compost" required>
            </div>
            <div>
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Price per kg (PHP)</label>
                <input type="number" id="productPrice" style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px;" placeholder="75" required>
            </div>
            <div>
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Quantity (kg)</label>
                <input type="number" id="productQuantity" style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px;" placeholder="50" required>
            </div>
            <div>
                <label style="display: block; margin-bottom: 5px; font-weight: 600;">Description</label>
                <textarea id="productDescription" style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; min-height: 100px;" placeholder="Describe your product..."></textarea>
            </div>
            <button type="submit" style="background: #68B984; color: white; border: none; padding: 15px; border-radius: 8px; font-weight: 600; cursor: pointer;">Create Listing</button>
        </form>
    `);
    
    document.getElementById('addListingForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const productName = document.getElementById('productName').value;
        const productPrice = document.getElementById('productPrice').value;
        const productQuantity = document.getElementById('productQuantity').value;
        const productDescription = document.getElementById('productDescription').value;
        
        if (productName && productPrice && productQuantity) {
            addNewListing({
                name: productName,
                price: productPrice,
                quantity: productQuantity,
                description: productDescription
            });
            
            closeModal();
            showNotification('Listing created successfully!', 'success');
        }
    });
}

function handleMessages() {
    showNotification('Opening Messages...', 'info');
    
    // Create messages modal
    const modal = createModal('Messages', `
        <div style="display: flex; flex-direction: column; gap: 15px; max-height: 400px; overflow-y: auto;">
            <div style="display: flex; align-items: center; gap: 10px; padding: 15px; background: #f9f9f9; border-radius: 8px;">
                <div style="width: 40px; height: 40px; background: #68B984; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600;">MR</div>
                <div style="flex: 1;">
                    <div style="font-weight: 600;">Maria Rodriguez</div>
                    <div style="color: #666; font-size: 14px;">Interested in your pig compost. Is it still available?</div>
                    <div style="color: #888; font-size: 12px;">2 hours ago</div>
                </div>
                <div style="width: 8px; height: 8px; background: #ff4757; border-radius: 50%;"></div>
            </div>
            <div style="display: flex; align-items: center; gap: 10px; padding: 15px; background: #f9f9f9; border-radius: 8px;">
                <div style="width: 40px; height: 40px; background: #5DA974; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600;">JS</div>
                <div style="flex: 1;">
                    <div style="font-weight: 600;">Juan Santos</div>
                    <div style="color: #666; font-size: 14px;">Can you deliver to Cebu City? I need 10kg of organic fertilizer.</div>
                    <div style="color: #888; font-size: 12px;">5 hours ago</div>
                </div>
                <div style="width: 8px; height: 8px; background: #ff4757; border-radius: 50%;"></div>
            </div>
            <div style="display: flex; align-items: center; gap: 10px; padding: 15px; background: #f9f9f9; border-radius: 8px;">
                <div style="width: 40px; height: 40px; background: #888; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600;">AT</div>
                <div style="flex: 1;">
                    <div style="font-weight: 600;">Ana Torres</div>
                    <div style="color: #666; font-size: 14px;">Thank you for the quick delivery! The compost quality is excellent.</div>
                    <div style="color: #888; font-size: 12px;">1 day ago</div>
                </div>
            </div>
        </div>
    `);
}

function handleViewListing(listingTitle) {
    showNotification(`Opening ${listingTitle}...`, 'info');
    
    // Find the listing data
    const listingCard = Array.from(document.querySelectorAll('.listing-card')).find(card => 
        card.querySelector('.listing-title').textContent === listingTitle
    );
    
    if (listingCard) {
        const price = listingCard.querySelector('.listing-price').textContent;
        const statusBadge = listingCard.querySelector('.status-badge');
        const status = statusBadge.textContent;
        const stats = Array.from(listingCard.querySelectorAll('.stat-item')).map(item => item.textContent);
        
        const modal = createModal(listingTitle, `
            <div style="display: flex; flex-direction: column; gap: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="color: #333; margin: 0;">${listingTitle}</h3>
                    <span style="font-size: 24px; font-weight: 700; color: #68B984;">${price}</span>
                </div>
                <div style="padding: 10px 15px; background: ${status === 'Active' ? '#68B984' : '#8B4513'}; color: white; border-radius: 20px; display: inline-block; width: fit-content; font-size: 12px; font-weight: 600;">${status}</div>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                    ${stats.map(stat => `<div style="padding: 10px; background: #f9f9f9; border-radius: 8px; font-size: 14px;">${stat}</div>`).join('')}
                </div>
                <div style="display: flex; gap: 10px;">
                    <button onclick="editListing('${listingTitle}')" style="flex: 1; background: #68B984; color: white; border: none; padding: 12px; border-radius: 8px; font-weight: 600; cursor: pointer;">Edit Listing</button>
                    <button onclick="deleteListing('${listingTitle}')" style="flex: 1; background: #ff4757; color: white; border: none; padding: 12px; border-radius: 8px; font-weight: 600; cursor: pointer;">Delete Listing</button>
                </div>
            </div>
        `);
    }
}

// Card Animations
function setupCardAnimations() {
    const cards = document.querySelectorAll('.listing-card');
    
    // Intersection Observer for scroll animations
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });
    
    cards.forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(card);
    });
}

// Utility Functions
function createModal(title, content) {
    // Remove existing modal if any
    const existingModal = document.querySelector('.modal-overlay');
    if (existingModal) {
        existingModal.remove();
    }
    
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay';
    modalOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        backdrop-filter: blur(5px);
    `;
    
    const modal = document.createElement('div');
    modal.style.cssText = `
        background: white;
        border-radius: 20px;
        padding: 30px;
        max-width: 500px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
        position: relative;
        animation: modalSlideIn 0.3s ease;
    `;
    
    modal.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
            <h2 style="margin: 0; color: #333;">${title}</h2>
            <button onclick="closeModal()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666;">×</button>
        </div>
        ${content}
    `;
    
    modalOverlay.appendChild(modal);
    document.body.appendChild(modalOverlay);
    
    // Close modal when clicking overlay
    modalOverlay.addEventListener('click', function(e) {
        if (e.target === modalOverlay) {
            closeModal();
        }
    });
    
    // Add CSS animation
    if (!document.querySelector('#modal-animations')) {
        const style = document.createElement('style');
        style.id = 'modal-animations';
        style.textContent = `
            @keyframes modalSlideIn {
                from {
                    opacity: 0;
                    transform: translateY(-50px) scale(0.9);
                }
                to {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    return modal;
}

function closeModal() {
    const modal = document.querySelector('.modal-overlay');
    if (modal) {
        modal.style.animation = 'modalSlideOut 0.3s ease';
        setTimeout(() => {
            modal.remove();
        }, 300);
    }
}

function showNotification(message, type = 'info') {
    // Remove existing notification
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    const notification = document.createElement('div');
    notification.className = 'notification';
    
    const colors = {
        success: '#68B984',
        error: '#ff4757',
        info: '#3742fa',
        warning: '#ffa502'
    };
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${colors[type]};
        color: white;
        padding: 15px 25px;
        border-radius: 10px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        z-index: 1001;
        font-weight: 600;
        animation: notificationSlideIn 0.3s ease;
    `;
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Add CSS animation for notifications
    if (!document.querySelector('#notification-animations')) {
        const style = document.createElement('style');
        style.id = 'notification-animations';
        style.textContent = `
            @keyframes notificationSlideIn {
                from {
                    opacity: 0;
                    transform: translateX(100%);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }
            @keyframes notificationSlideOut {
                from {
                    opacity: 1;
                    transform: translateX(0);
                }
                to {
                    opacity: 0;
                    transform: translateX(100%);
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Auto remove notification
    setTimeout(() => {
        notification.style.animation = 'notificationSlideOut 0.3s ease';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

function addNewListing(listingData) {
    const listingsGrid = document.querySelector('.listings-grid');
    
    const newCard = document.createElement('div');
    newCard.className = 'listing-card';
    newCard.style.opacity = '0';
    newCard.style.transform = 'translateY(20px)';
    
    newCard.innerHTML = `
        <div class="listing-image">
            <div class="status-badge active">Active</div>
            <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 200'%3E%3Crect width='300' height='200' fill='%2368B984'/%3E%3Ctext x='150' y='105' text-anchor='middle' fill='white' font-size='14'%3E${listingData.name}%3C/text%3E%3C/svg%3E" alt="${listingData.name}">
        </div>
        <div class="listing-details">
            <div class="listing-header">
                <h3 class="listing-title">${listingData.name}</h3>
                <span class="listing-price">P${listingData.price}/kg</span>
            </div>
            <div class="listing-stats">
                <div class="stat-item">
                    <span class="stat-icon">📦</span>
                    <span>${listingData.quantity}kg remaining</span>
                </div>
                <div class="stat-item">
                    <span class="stat-icon">👁️</span>
                    <span>0 views today</span>
                </div>
            </div>
            <div class="listing-meta">
                <div class="meta-item">
                    <span class="meta-icon">📅</span>
                    <span>Posted just now</span>
                </div>
                <div class="meta-item">
                    <span class="meta-icon">💬</span>
                    <span>0 inquiries</span>
                </div>
            </div>
            <button class="btn-view">View</button>
        </div>
    `;
    
    listingsGrid.insertBefore(newCard, listingsGrid.firstChild);
    
    // Animate in the new card
    setTimeout(() => {
        newCard.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        newCard.style.opacity = '1';
        newCard.style.transform = 'translateY(0)';
    }, 100);
    
    // Add event listener to new view button
    const viewButton = newCard.querySelector('.btn-view');
    viewButton.addEventListener('click', function() {
        handleViewListing(listingData.name);
    });
}

function loadListingsData() {
    // This function would typically load data from an API
    // For now, we'll just add some interactive behavior to existing listings
    
    const listings = [
        {
            title: "My Premium Pig Compost",
            price: "P75/kg",
            status: "active",
            views: 12,
            inquiries: 2
        },
        {
            title: "Pig Compost Hot Method",
            price: "P90/kg", 
            status: "sold",
            views: 5,
            inquiries: 0
        }
    ];
    
    // Add some random view updates
    setInterval(() => {
        updateListingViews();
    }, 30000); // Update every 30 seconds
}

function updateListingViews() {
    const activeListings = document.querySelectorAll('.listing-card .status-badge.active');
    
    activeListings.forEach(badge => {
        const card = badge.closest('.listing-card');
        const viewsElement = card.querySelector('.stat-item:nth-child(2) span:last-child');
        
        if (viewsElement && viewsElement.textContent.includes('views today')) {
            const currentViews = parseInt(viewsElement.textContent.match(/\d+/)[0]);
            const newViews = currentViews + Math.floor(Math.random() * 3);
            viewsElement.textContent = `${newViews} views today`;
        }
    });
}

// Global functions for modal actions
window.closeModal = closeModal;

window.editListing = function(listingTitle) {
    closeModal();
    showNotification(`Opening editor for ${listingTitle}...`, 'info');
};

window.deleteListing = function(listingTitle) {
    if (confirm(`Are you sure you want to delete "${listingTitle}"?`)) {
        const cards = document.querySelectorAll('.listing-card');
        cards.forEach(card => {
            const title = card.querySelector('.listing-title').textContent;
            if (title === listingTitle) {
                card.style.animation = 'fadeOut 0.3s ease';
                setTimeout(() => {
                    card.remove();
                    showNotification(`${listingTitle} deleted successfully`, 'success');
                }, 300);
            }
        });
        closeModal();
    }
};

// Add fadeOut animation
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeOut {
        from {
            opacity: 1;
            transform: scale(1);
        }
        to {
            opacity: 0;
            transform: scale(0.8);
        }
    }
`;
document.head.appendChild(style);