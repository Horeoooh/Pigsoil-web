// script.js
document.addEventListener('DOMContentLoaded', function() {
    // Cart functionality
    const cartItems = document.querySelectorAll('.cart-item');
    const subtotalElement = document.querySelector('.subtotal-amount');
    
    // Initialize cart
    updateSubtotal();
    
    // Add event listeners to all cart items
    cartItems.forEach(item => {
        const minusBtn = item.querySelector('.minus');
        const plusBtn = item.querySelector('.plus');
        const qtyInput = item.querySelector('.qty-input');
        const removeBtn = item.querySelector('.remove-btn');
        const itemTotalElement = item.querySelector('.item-total');
        const basePrice = parseFloat(item.dataset.price);
        
        // Minus button
        minusBtn.addEventListener('click', function() {
            let currentQty = parseInt(qtyInput.value);
            if (currentQty > 1) {
                qtyInput.value = currentQty - 1;
                updateItemTotal(item, basePrice, qtyInput.value);
                updateSubtotal();
            }
        });
        
        // Plus button
        plusBtn.addEventListener('click', function() {
            let currentQty = parseInt(qtyInput.value);
            qtyInput.value = currentQty + 1;
            updateItemTotal(item, basePrice, qtyInput.value);
            updateSubtotal();
        });
        
        // Quantity input change
        qtyInput.addEventListener('change', function() {
            let qty = parseInt(this.value);
            if (qty < 1 || isNaN(qty)) {
                this.value = 1;
                qty = 1;
            }
            updateItemTotal(item, basePrice, qty);
            updateSubtotal();
        });
        
        // Remove button
        removeBtn.addEventListener('click', function() {
            if (confirm('Are you sure you want to remove this item from your cart?')) {
                item.remove();
                updateSubtotal();
                checkEmptyCart();
            }
        });
    });
    
    // Update individual item total
    function updateItemTotal(item, basePrice, quantity) {
        const itemTotalElement = item.querySelector('.item-total');
        const total = basePrice * quantity;
        itemTotalElement.textContent = `₱${total.toFixed(2)}`;
    }
    
    // Update subtotal
    function updateSubtotal() {
        const currentItems = document.querySelectorAll('.cart-item');
        let subtotal = 0;
        
        currentItems.forEach(item => {
            const basePrice = parseFloat(item.dataset.price);
            const quantity = parseInt(item.querySelector('.qty-input').value);
            subtotal += basePrice * quantity;
        });
        
        subtotalElement.textContent = `₱${subtotal.toFixed(2)}`;
    }
    
    // Check if cart is empty
    function checkEmptyCart() {
        const remainingItems = document.querySelectorAll('.cart-item');
        if (remainingItems.length === 0) {
            const cartContent = document.querySelector('.cart-content');
            cartContent.innerHTML = `
                <div style="text-align: center; padding: 3rem;">
                    <h3>Your cart is empty</h3>
                    <p style="color: #666; margin: 1rem 0;">Add some fertilizer products to get started!</p>
                    <a href="#" style="color: #007bff; text-decoration: none;">Continue shopping</a>
                </div>
            `;
        }
    }
    
    // Checkout button
    const checkoutBtn = document.querySelector('.checkout-btn');
    checkoutBtn.addEventListener('click', function() {
        const itemCount = document.querySelectorAll('.cart-item').length;
        const subtotal = subtotalElement.textContent;
        
        if (itemCount > 0) {
            alert(`Proceeding to checkout with ${itemCount} item(s)\nSubtotal: ${subtotal}`);
            // Here you would typically redirect to a checkout page
            // window.location.href = '/checkout';
        } else {
            alert('Your cart is empty!');
        }
    });
    
    // Navigation links (placeholder functionality)
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Remove active class from all links
            navLinks.forEach(l => l.classList.remove('active'));
            
            // Add active class to clicked link
            this.classList.add('active');
            
            // Placeholder navigation
            const linkText = this.textContent;
            console.log(`Navigating to: ${linkText}`);
        });
    });
    
    // Continue shopping link
    const continueShoppingLink = document.querySelector('.continue-shopping');
    if (continueShoppingLink) {
        continueShoppingLink.addEventListener('click', function(e) {
            e.preventDefault();
            alert('Redirecting to the market page...');
            // window.location.href = '/market';
        });
    }
    
    // User profile interactions (placeholder)
    const userAvatar = document.querySelector('.user-avatar');
    if (userAvatar) {
        userAvatar.addEventListener('click', function() {
            alert('User profile menu would open here');
        });
    }
    
    // Notification button
    const notificationBtn = document.querySelector('.notification-btn');
    if (notificationBtn) {
        notificationBtn.addEventListener('click', function() {
            alert('Notifications panel would open here');
        });
    }
    
    // Add smooth animations for quantity changes
    function animateChange(element) {
        element.style.transform = 'scale(1.1)';
        element.style.transition = 'transform 0.2s ease';
        
        setTimeout(() => {
            element.style.transform = 'scale(1)';
        }, 200);
    }
    
    // Apply animation to item totals when they change
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList' || mutation.type === 'characterData') {
                const target = mutation.target.closest('.item-total');
                if (target) {
                    animateChange(target);
                }
            }
        });
    });
    
    // Observe changes to item totals
    document.querySelectorAll('.item-total').forEach(total => {
        observer.observe(total, {
            childList: true,
            characterData: true,
            subtree: true
        });
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        // ESC key to clear cart (with confirmation)
        if (e.key === 'Escape') {
            if (confirm('Clear entire cart? This action cannot be undone.')) {
                document.querySelectorAll('.cart-item').forEach(item => item.remove());
                checkEmptyCart();
            }
        }
        
        // Enter key to checkout
        if (e.key === 'Enter' && e.ctrlKey) {
            checkoutBtn.click();
        }
    });
});

// Utility function to format currency
function formatCurrency(amount) {
    return `₱${parseFloat(amount).toFixed(2)}`;
}

// Export functions for potential use in other scripts
window.PigSoilCart = {
    formatCurrency: formatCurrency
};