// Product Data
const products = [
    {
        id: 1,
        title: 'Poo Small',
        price: 119.00,
        image: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&h=300&fit=crop',
        description: 'High-quality small-sized organic fertilizer perfect for small gardens and potted plants. Rich in nutrients and eco-friendly.'
    },
    {
        id: 2,
        title: 'Bo Soft',
        price: 365.00,
        image: 'https://images.unsplash.com/photo-1592419044706-39796d40f98c?w=400&h=300&fit=crop',
        description: 'Premium soft-textured soil amendment that improves soil structure and water retention. Ideal for vegetables and flowers.'
    },
    {
        id: 3,
        title: 'Hobo Large',
        price: 615.00,
        image: 'https://images.unsplash.com/photo-1619784299133-f691ffaea42f?w=400&h=300&fit=crop',
        description: 'Large volume organic compost suitable for commercial farming and large-scale gardening projects.'
    },
    {
        id: 4,
        title: 'Stormi',
        price: 195.00,
        image: 'https://images.unsplash.com/photo-1560493676-04071c5f467b?w=400&h=300&fit=crop',
        description: 'Special blend fertilizer with enhanced moisture retention properties. Perfect for drought-prone areas.',
        sale: true
    },
    {
        id: 5,
        title: 'Premium Garden Mix',
        price: 450.00,
        image: 'https://images.unsplash.com/photo-1619784299133-f691ffaea42f?w=400&h=300&fit=crop',
        description: 'Professional-grade garden mix combining multiple organic components for optimal plant growth.'
    },
    {
        id: 6,
        title: 'Organic Compost',
        price: 280.00,
        image: 'https://images.unsplash.com/photo-1560493676-04071c5f467b?w=400&h=300&fit=crop',
        description: '100% organic compost made from natural materials. Chemical-free and safe for all plants.'
    },
    {
        id: 7,
        title: 'Rich Soil Blend',
        price: 320.00,
        image: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&h=300&fit=crop',
        description: 'Nutrient-rich soil blend perfect for establishing new gardens or rejuvenating existing soil.'
    },
    {
        id: 8,
        title: 'Planting Mix Special',
        price: 185.00,
        image: 'https://images.unsplash.com/photo-1592419044706-39796d40f98c?w=400&h=300&fit=crop',
        description: 'Specially formulated planting mix for seedlings and young plants. Promotes healthy root development.'
    }
];

// Shopping Cart
let cart = [];

// DOM Elements
const productsGrid = document.getElementById('productsGrid');
const productModal = document.getElementById('productModal');
const cartSidebar = document.getElementById('cartSidebar');
const cartBtn = document.getElementById('cartBtn');
const cartItems = document.getElementById('cartItems');
const cartTotal = document.getElementById('cartTotal');

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    updateCartUI();
});

// Setup Event Listeners
function setupEventListeners() {
    // Product cards click
    document.querySelectorAll('.product-card').forEach(card => {
        card.addEventListener('click', () => {
            const productId = parseInt(card.dataset.productId);
            openProductModal(productId);
        });
    });

    // Modal close button
    document.querySelector('.close-btn').addEventListener('click', closeModal);

    // Add to cart button in modal
    document.getElementById('addToCartBtn').addEventListener('click', () => {
        const productId = parseInt(productModal.dataset.currentProduct);
        addToCart(productId);
        closeModal();
        showNotification('Product added to cart!');
    });

    // Contact seller button
    document.getElementById('contactSellerBtn').addEventListener('click', () => {
        showNotification('Seller contact information will be available soon!');
    });

    // Cart button
    cartBtn.addEventListener('click', toggleCart);

    // Close cart button
    document.querySelector('.close-cart').addEventListener('click', toggleCart);

    // Checkout button
    document.querySelector('.checkout-btn').addEventListener('click', () => {
        if (cart.length > 0) {
            showNotification('Proceeding to checkout...');
            setTimeout(() => {
                cart = [];
                updateCartUI();
                toggleCart();
                showNotification('Order placed successfully!');
            }, 2000);
        } else {
            showNotification('Your cart is empty!');
        }
    });

    // Click outside modal to close
    productModal.addEventListener('click', (e) => {
        if (e.target === productModal) {
            closeModal();
        }
    });

    // Click outside cart to close
    document.addEventListener('click', (e) => {
        if (cartSidebar.classList.contains('active') && 
            !cartSidebar.contains(e.target) && 
            !cartBtn.contains(e.target)) {
            toggleCart();
        }
    });
}

// Open Product Modal
function openProductModal(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    document.getElementById('modalImage').src = product.image;
    document.getElementById('modalImage').alt = product.title;
    document.getElementById('modalTitle').textContent = product.title;
    document.getElementById('modalPrice').textContent = `₱${product.price.toFixed(2)}`;
    document.getElementById('modalDescription').textContent = product.description;

    productModal.dataset.currentProduct = productId;
    productModal.classList.add('active');
}

// Close Modal
function closeModal() {
    productModal.classList.remove('active');
}

// Toggle Cart Sidebar
function toggleCart() {
    cartSidebar.classList.toggle('active');
}

// Add to Cart
function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const existingItem = cart.find(item => item.id === productId);
    
    if (existingItem) {
        existingItem.quantity++;
    } else {
        cart.push({
            ...product,
            quantity: 1
        });
    }

    updateCartUI();
    updateCartBadge();
}

// Remove from Cart
function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    updateCartUI();
    updateCartBadge();
}

// Update Item Quantity
function updateQuantity(productId, change) {
    const item = cart.find(item => item.id === productId);
    if (!item) return;

    item.quantity += change;
    
    if (item.quantity <= 0) {
        removeFromCart(productId);
    } else {
        updateCartUI();
    }
}

// Update Cart UI
function updateCartUI() {
    if (cart.length === 0) {
        cartItems.innerHTML = '<p class="empty-cart">Your cart is empty</p>';
        cartTotal.textContent = '₱0.00';
        return;
    }

    let total = 0;
    let html = '';

    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;

        html += `
            <div class="cart-item">
                <img src="${item.image}" alt="${item.title}">
                <div class="cart-item-info">
                    <div class="cart-item-title">${item.title}</div>
                    <div class="cart-item-price">₱${item.price.toFixed(2)}</div>
                    <div class="cart-item-quantity">
                        <button class="quantity-btn" onclick="updateQuantity(${item.id}, -1)">-</button>
                        <span>${item.quantity}</span>
                        <button class="quantity-btn" onclick="updateQuantity(${item.id}, 1)">+</button>
                    </div>
                </div>
                <button class="remove-item" onclick="removeFromCart(${item.id})">×</button>
            </div>
        `;
    });

    cartItems.innerHTML = html;
    cartTotal.textContent = `₱${total.toFixed(2)}`;
}

// Update Cart Badge
function updateCartBadge() {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    
    // Remove existing badge
    const existingBadge = cartBtn.querySelector('.cart-badge');
    if (existingBadge) {
        existingBadge.remove();
    }
    
    // Add new badge if there are items
    if (totalItems > 0) {
        const badge = document.createElement('span');
        badge.className = 'cart-badge';
        badge.textContent = totalItems;
        badge.style.cssText = `
            position: absolute;
            top: -8px;
            right: -8px;
            background: #e74c3c;
            color: white;
            border-radius: 50%;
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 0.75rem;
            font-weight: 600;
        `;
        cartBtn.style.position = 'relative';
        cartBtn.appendChild(badge);
    }
}

// Show Notification
function showNotification(message) {
    // Remove existing notification
    const existingNotif = document.querySelector('.notification');
    if (existingNotif) {
        existingNotif.remove();
    }

    // Create new notification
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: #27ae60;
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        z-index: 2000;
        animation: slideIn 0.3s ease-out;
    `;

    // Add animation keyframes if not already added
    if (!document.querySelector('#notificationStyles')) {
        const style = document.createElement('style');
        style.id = 'notificationStyles';
        style.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            @keyframes slideOut {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(notification);

    // Remove notification after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// Search/Filter Products (bonus feature)
function filterProducts(searchTerm) {
    const cards = document.querySelectorAll('.product-card');
    
    cards.forEach(card => {
        const title = card.querySelector('.product-title').textContent.toLowerCase();
        const match = title.includes(searchTerm.toLowerCase());
        
        card.style.display = match ? 'block' : 'none';
    });
}

// Sort Products (bonus feature)
function sortProducts(sortBy) {
    const productsArray = Array.from(document.querySelectorAll('.product-card'));
    
    productsArray.sort((a, b) => {
        const aPrice = parseFloat(a.querySelector('.product-price').textContent.replace(/[^\d.]/g, ''));
        const bPrice = parseFloat(b.querySelector('.product-price').textContent.replace(/[^\d.]/g, ''));
        
        if (sortBy === 'price-low') {
            return aPrice - bPrice;
        } else if (sortBy === 'price-high') {
            return bPrice - aPrice;
        } else if (sortBy === 'name') {
            const aTitle = a.querySelector('.product-title').textContent;
            const bTitle = b.querySelector('.product-title').textContent;
            return aTitle.localeCompare(bTitle);
        }
        
        return 0;
    });
    
    const grid = document.getElementById('productsGrid');
    productsArray.forEach(card => {
        grid.appendChild(card);
    });
}

// Load More Products (for pagination - bonus feature)
function loadMoreProducts() {
    // This would typically fetch more products from a server
    showNotification('Loading more products...');
    
    // Simulate loading delay
    setTimeout(() => {
        showNotification('All products loaded!');
    }, 1000);
}

// Initialize tooltips for better UX
function initTooltips() {
    const elements = document.querySelectorAll('[data-tooltip]');
    
    elements.forEach(element => {
        element.addEventListener('mouseenter', (e) => {
            const tooltip = document.createElement('div');
            tooltip.className = 'tooltip';
            tooltip.textContent = e.target.dataset.tooltip;
            tooltip.style.cssText = `
                position: absolute;
                background: #333;
                color: white;
                padding: 0.5rem;
                border-radius: 4px;
                font-size: 0.875rem;
                z-index: 1000;
                pointer-events: none;
            `;
            
            document.body.appendChild(tooltip);
            
            const rect = e.target.getBoundingClientRect();
            tooltip.style.top = `${rect.bottom + 5}px`;
            tooltip.style.left = `${rect.left + (rect.width - tooltip.offsetWidth) / 2}px`;
        });
        
        element.addEventListener('mouseleave', () => {
            const tooltips = document.querySelectorAll('.tooltip');
            tooltips.forEach(tooltip => tooltip.remove());
        });
    });
}

// Mobile Menu Toggle (for responsive design)
function toggleMobileMenu() {
    const navMenu = document.querySelector('.nav-menu');
    navMenu.classList.toggle('mobile-active');
}

// Add keyboard navigation support
document.addEventListener('keydown', (e) => {
    // Close modal with Escape key
    if (e.key === 'Escape') {
        if (productModal.classList.contains('active')) {
            closeModal();
        }
        if (cartSidebar.classList.contains('active')) {
            toggleCart();
        }
    }
});

// Lazy loading for images (performance optimization)
function lazyLoadImages() {
    const images = document.querySelectorAll('img[data-src]');
    
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
                observer.unobserve(img);
            }
        });
    });
    
    images.forEach(img => imageObserver.observe(img));
}

// Export functions for testing or external use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        addToCart,
        removeFromCart,
        updateQuantity,
        filterProducts,
        sortProducts
    };
}