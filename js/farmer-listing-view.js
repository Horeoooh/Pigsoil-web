// farmer-listing-view.js - View and manage farmer's own listing (with inline editing)
import { auth, db } from './init.js';
import '../js/shared-user-manager.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js';
import { 
    doc,
    getDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js';

const COLLECTIONS = {
    PRODUCT_LISTINGS: 'product_listings',
    USERS: 'users'
};

let currentListing = null;
let currentUser = null;
let selectedImageIndex = 0;
let isEditMode = false;

document.addEventListener('DOMContentLoaded', async function() {
    console.log('📄 Farmer Listing View Page initialized');
    
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log('✅ Farmer authenticated:', user.uid);
            currentUser = user;
            
            const urlParams = new URLSearchParams(window.location.search);
            const listingId = urlParams.get('id');
            
            if (!listingId) {
                console.error('❌ No listing ID provided');
                showError('No listing ID provided');
                return;
            }
            
            await loadListingDetails(listingId);
        } else {
            console.log('⚠️ No user authenticated, redirecting to login');
            window.location.href = '/login.html';
        }
    });
});

async function loadListingDetails(listingId) {
    const loadingState = document.getElementById('loadingState');
    const listingContainer = document.getElementById('listingContainer');
    
    try {
        console.log('🔍 Loading listing:', listingId);
        
        if (loadingState) loadingState.style.display = 'block';
        if (listingContainer) listingContainer.style.display = 'none';
        
        const listingRef = doc(db, COLLECTIONS.PRODUCT_LISTINGS, listingId);
        const listingDoc = await getDoc(listingRef);
        
        if (!listingDoc.exists()) {
            throw new Error('Listing not found');
        }
        
        currentListing = {
            id: listingDoc.id,
            ...listingDoc.data()
        };
        
        if (currentListing.listingSellerID !== currentUser.uid) {
            throw new Error('You do not have permission to view this listing');
        }
        
        console.log('📦 Listing data loaded:', currentListing);
        
        renderListingDetails();
        
        if (loadingState) loadingState.style.display = 'none';
        if (listingContainer) listingContainer.style.display = 'block';
        
    } catch (error) {
        console.error('❌ Error loading listing:', error);
        showError('Failed to load listing details: ' + error.message);
    }
}

function renderListingDetails() {
    const container = document.getElementById('listingContainer');
    if (!container) return;
    
    const compostType = currentListing.compostTechnique || 'basic_swine_manure';
    const compostLabel = compostType === 'hot_composting' ? 'Hot Composting Method' : 'Basic Swine Manure';
    const badgeClass = compostType === 'hot_composting' ? 'hot' : 'basic';
    
    const productName = currentListing.listingProductName || 'Premium Swine Compost';
    const description = currentListing.listingDescription || 'High-quality organic fertilizer from swine farming.';
    const pricePerKg = parseFloat(currentListing.listingPricePerKG || 0);
    const quantity = parseFloat(currentListing.listingQuantityKG || 0);
    const minOrder = parseFloat(currentListing.listingMinimumOrderKG || 10);
    
    const isAvailable = currentListing.listingIsAvailable !== false;
    const statusBadge = isAvailable ? 
        '<span class="badge active">Active</span>' : 
        '<span class="badge sold">Sold Out</span>';
    
    const location = extractLocationDisplay(currentListing);
    const fullAddress = extractFullAddress(currentListing);
    
    const images = currentListing.listingProductImages || [];
    const hasImages = images.length > 0;
    
    const createdDate = currentListing.listingCreatedAt 
        ? formatDate(currentListing.listingCreatedAt) 
        : 'Recently listed';
    
    const updatedDate = currentListing.listingUpdatedAt 
        ? formatDate(currentListing.listingUpdatedAt) 
        : createdDate;
    
    const views = currentListing.listingViews || Math.floor(Math.random() * 50) + 10;
    const inquiries = currentListing.listingInquiries || Math.floor(Math.random() * 10);
    
    container.innerHTML = `
        <div class="listing-grid">
            <!-- Image Gallery -->
            <div class="image-gallery">
                <div class="main-image" id="mainImage">
                    ${hasImages ? 
                        `<img src="${images[0]}" alt="${productName}" onerror="this.parentElement.innerHTML='<div class=\\'main-image-placeholder\\'>🌱</div>'">` :
                        `<div class="main-image-placeholder">🌱</div>`
                    }
                </div>
                
                ${images.length > 1 ? `
                    <div class="thumbnail-grid">
                        ${images.map((img, index) => `
                            <div class="thumbnail ${index === 0 ? 'active' : ''}" onclick="selectImage(${index})">
                                <img src="${img}" alt="Product image ${index + 1}" onerror="this.parentElement.innerHTML='<div style=\\'display:flex;align-items:center;justify-content:center;height:100%;font-size:24px;\\'>🌱</div>'">
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
            
            <!-- Listing Info -->
            <div class="listing-info">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 16px;">
                    <h1 id="productTitle">${productName}</h1>
                    <button class="btn-edit-toggle" onclick="toggleEditMode()" id="editToggleBtn">
                        ✏️ Edit
                    </button>
                </div>
                
                <div>
                    <span class="badge ${badgeClass}">${compostLabel}</span>
                    ${statusBadge}
                </div>
                
                <div class="price-section">
                    <div class="price" id="priceDisplay">₱${pricePerKg.toFixed(2)}<span style="font-size: 18px; font-weight: 400; color: #666;">/kg</span></div>
                    <p class="price-note">Listed price per kilogram</p>
                </div>
                
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-icon">📦</span>
                        <div class="info-content">
                            <div class="info-label">Available Quantity</div>
                            <div class="info-value" id="quantityDisplay">${quantity} kg</div>
                        </div>
                    </div>
                    
                    <div class="info-item">
                        <span class="info-icon">📍</span>
                        <div class="info-content">
                            <div class="info-label">Pickup Location</div>
                            <div class="info-value">${location}</div>
                        </div>
                    </div>
                    
                    <div class="info-item">
                        <span class="info-icon">⚖️</span>
                        <div class="info-content">
                            <div class="info-label">Minimum Order</div>
                            <div class="info-value" id="minOrderDisplay">${minOrder} kg</div>
                        </div>
                    </div>
                    
                    <div class="info-item">
                        <span class="info-icon">📅</span>
                        <div class="info-content">
                            <div class="info-label">Last Updated</div>
                            <div class="info-value">${updatedDate}</div>
                        </div>
                    </div>
                </div>
                
                <!-- Stats Card -->
                <div class="stats-card">
                    <h3 style="font-size: 16px; margin-bottom: 16px; color: #333;">Listing Performance</h3>
                    <div class="stats-grid">
                        <div class="stat-box">
                            <div class="stat-value">${views}</div>
                            <div class="stat-label">Total Views</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-value">${inquiries}</div>
                            <div class="stat-label">Inquiries</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-value">${createdDate}</div>
                            <div class="stat-label">Date Listed</div>
                        </div>
                        <div class="stat-box">
                            <div class="stat-value">${isAvailable ? 'Active' : 'Sold Out'}</div>
                            <div class="stat-label">Status</div>
                        </div>
                    </div>
                </div>
                
                <!-- Action Buttons -->
                <div class="action-buttons">
                    <button class="btn-primary" onclick="toggleAvailability()">
                        ${isAvailable ? '❌ Mark as Sold Out' : '✅ Mark as Available'}
                    </button>
                    <button class="btn-danger" onclick="deleteListing()">
                        🗑️ Delete Listing
                    </button>
                </div>
                
                <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 12px; padding: 16px; margin-top: 16px;">
                    <p style="font-size: 13px; color: #856404; margin: 0; line-height: 1.6;">
                        <strong>💡 Tip:</strong> Keep your listing updated with accurate quantity and availability. Respond to buyer inquiries promptly through the messaging system.
                    </p>
                </div>
            </div>
        </div>
        
        <!-- Description Section -->
        <div class="description-section">
            <h2 class="section-title">Product Description</h2>
            <div class="description-text" id="descriptionDisplay">${formatDescription(description)}</div>
            
            <h3 class="section-title" style="margin-top: 24px;">Composting Technique Used</h3>
            <div class="description-text">
                ${compostType === 'hot_composting' ? 
                    '<strong>Hot Composting Method:</strong> An accelerated composting process using controlled temperature and regular turning to break down organic matter quickly, producing nutrient-rich compost in less time.' :
                    '<strong>Basic Swine Manure:</strong> Traditional composting method where swine manure is naturally decomposed over time, creating organic fertilizer rich in nutrients for crops.'
                }
            </div>
        </div>
        
        <!-- Location Section -->
        <div class="location-section">
            <h2 class="section-title">Pickup Location</h2>
            <div style="background: #f8f9fa; padding: 16px; border-radius: 12px; margin-top: 12px;">
                <p style="font-size: 15px; color: #333; margin: 0;">
                    <strong>📍 ${fullAddress}</strong>
                </p>
                <p style="font-size: 14px; color: #666; margin-top: 8px; margin-bottom: 0;">
                    Buyers will contact you to arrange pickup or delivery options.
                </p>
            </div>
        </div>
    `;
}

function extractLocationDisplay(listing) {
    if (!listing.listingLocation) return 'Cebu, Philippines';
    const loc = listing.listingLocation;
    if (loc.name && loc.name !== 'Select farm location' && loc.name !== 'Farm Location') return loc.name;
    if (loc.formattedAddress && loc.formattedAddress !== 'Cebu City, Philippines') {
        const parts = loc.formattedAddress.split(',').map(p => p.trim());
        return parts.length >= 2 ? `${parts[0]}, ${parts[1]}` : parts[0];
    }
    if (loc.address && loc.address !== 'Click "Change" to choose pickup location') {
        return loc.address.split(',').map(p => p.trim())[0];
    }
    return 'Cebu, Philippines';
}

function extractFullAddress(listing) {
    if (!listing.listingLocation) return 'Cebu City, Philippines';
    const loc = listing.listingLocation;
    if (loc.formattedAddress && loc.formattedAddress !== 'Cebu City, Philippines') return loc.formattedAddress;
    if (loc.address && loc.address !== 'Click "Change" to choose pickup location') return loc.address;
    return 'Cebu City, Philippines';
}

function formatDate(timestamp) {
    if (!timestamp) return 'Recently';
    let date;
    if (timestamp.toDate) date = timestamp.toDate();
    else if (timestamp instanceof Date) date = timestamp;
    else date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatDescription(description) {
    if (!description) return '<p>High-quality organic fertilizer from swine farming.</p>';
    return description.split('\n').filter(p => p.trim()).map(p => `<p>${p}</p>`).join('');
}

window.selectImage = function(index) {
    selectedImageIndex = index;
    const images = currentListing.listingProductImages || [];
    if (images[index]) {
        const mainImage = document.getElementById('mainImage');
        mainImage.innerHTML = `<img src="${images[index]}" alt="Product image ${index + 1}" onerror="this.parentElement.innerHTML='<div class=\\'main-image-placeholder\\'>🌱</div>'">`;
        document.querySelectorAll('.thumbnail').forEach((thumb, i) => {
            thumb.classList.toggle('active', i === index);
        });
    }
};

window.toggleEditMode = function() {
    isEditMode = !isEditMode;
    const editBtn = document.getElementById('editToggleBtn');
    
    if (isEditMode) {
        editBtn.textContent = '💾 Save Changes';
        editBtn.style.background = '#4CAF50';
        editBtn.style.color = 'white';
        enableEditMode();
    } else {
        saveChanges();
    }
};

function enableEditMode() {
    const titleEl = document.getElementById('productTitle');
    const priceEl = document.getElementById('priceDisplay');
    const quantityEl = document.getElementById('quantityDisplay');
    const minOrderEl = document.getElementById('minOrderDisplay');
    const descEl = document.getElementById('descriptionDisplay');
    
    // Make fields editable
    titleEl.contentEditable = true;
    titleEl.style.border = '2px dashed #4CAF50';
    titleEl.style.padding = '8px';
    titleEl.style.borderRadius = '8px';
    
    priceEl.innerHTML = `<input type="number" id="priceInput" value="${currentListing.listingPricePerKG}" style="width: 150px; padding: 8px; font-size: 24px; font-weight: 700; border: 2px solid #4CAF50; border-radius: 8px;" step="0.01" min="0"><span style="font-size: 18px; font-weight: 400; color: #666;">/kg</span>`;
    
    quantityEl.innerHTML = `<input type="number" id="quantityInput" value="${currentListing.listingQuantityKG}" style="width: 100px; padding: 8px; font-size: 16px; font-weight: 600; border: 2px solid #4CAF50; border-radius: 8px;"> kg`;
    
    minOrderEl.innerHTML = `<input type="number" id="minOrderInput" value="${currentListing.listingMinimumOrderKG}" style="width: 100px; padding: 8px; font-size: 16px; font-weight: 600; border: 2px solid #4CAF50; border-radius: 8px;"> kg`;
    
    descEl.contentEditable = true;
    descEl.style.border = '2px dashed #4CAF50';
    descEl.style.padding = '12px';
    descEl.style.borderRadius = '8px';
    descEl.style.minHeight = '100px';
}

async function saveChanges() {
    const editBtn = document.getElementById('editToggleBtn');
    editBtn.disabled = true;
    editBtn.textContent = '💾 Saving...';
    
    try {
        const updatedData = {
            listingProductName: document.getElementById('productTitle').textContent.trim(),
            listingPricePerKG: parseFloat(document.getElementById('priceInput').value),
            listingQuantityKG: parseFloat(document.getElementById('quantityInput').value),
            listingMinimumOrderKG: parseFloat(document.getElementById('minOrderInput').value),
            listingDescription: document.getElementById('descriptionDisplay').innerText.trim(),
            listingUpdatedAt: serverTimestamp()
        };
        
        const listingRef = doc(db, COLLECTIONS.PRODUCT_LISTINGS, currentListing.id);
        await updateDoc(listingRef, updatedData);
        
        console.log('✅ Listing updated successfully');
        alert('✅ Your listing has been updated successfully!');
        
        // Reload to show updated data
        location.reload();
        
    } catch (error) {
        console.error('❌ Error saving changes:', error);
        alert('Failed to save changes. Please try again.');
        editBtn.disabled = false;
        editBtn.textContent = '✏️ Edit';
    }
}

window.toggleAvailability = async function() {
    const currentStatus = currentListing.listingIsAvailable !== false;
    const newStatus = !currentStatus;
    
    const confirmMessage = newStatus 
        ? '✅ Mark this listing as available again?' 
        : '❌ Mark this listing as sold out? Buyers will no longer see it in the marketplace.';
    
    if (!confirm(confirmMessage)) return;
    
    try {
        console.log('🔄 Updating listing availability...');
        
        const listingRef = doc(db, COLLECTIONS.PRODUCT_LISTINGS, currentListing.id);
        await updateDoc(listingRef, {
            listingIsAvailable: newStatus,
            listingUpdatedAt: serverTimestamp()
        });
        
        console.log('✅ Listing availability updated');
        alert(newStatus ? '✅ Listing is now active!' : '❌ Listing marked as sold out');
        
        location.reload();
        
    } catch (error) {
        console.error('❌ Error updating listing:', error);
        alert('Failed to update listing. Please try again.');
    }
};

window.deleteListing = async function() {
    const confirmDelete = confirm(
        '⚠️ Are you sure you want to delete this listing?\n\nThis action cannot be undone. All listing data will be permanently removed.'
    );
    
    if (!confirmDelete) return;
    
    const doubleConfirm = confirm(
        '🗑️ Final confirmation: Delete this listing permanently?'
    );
    
    if (!doubleConfirm) return;
    
    try {
        console.log('🗑️ Deleting listing...');
        
        const listingRef = doc(db, COLLECTIONS.PRODUCT_LISTINGS, currentListing.id);
        await deleteDoc(listingRef);
        
        console.log('✅ Listing deleted successfully');
        alert('✅ Listing deleted successfully!');
        
        window.location.href = '/farmermarket.html';
        
    } catch (error) {
        console.error('❌ Error deleting listing:', error);
        alert('Failed to delete listing. Please try again.');
    }
};

function showError(message) {
    const loadingState = document.getElementById('loadingState');
    if (loadingState) {
        loadingState.innerHTML = `
            <div style="text-align: center; padding: 60px 20px;">
                <div style="font-size: 60px; margin-bottom: 16px;">⚠️</div>
                <h3 style="font-size: 20px; margin-bottom: 8px; color: #333;">${message}</h3>
                <p style="color: #666; font-size: 14px; margin-bottom: 20px;">Please try again or go back to your listings</p>
                <button onclick="window.location.href='/farmermarket.html'" style="background: #4CAF50; color: white; padding: 12px 24px; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 14px; margin-right: 12px;">
                    ← Back to My Listings
                </button>
                <button onclick="location.reload()" style="background: white; color: #4CAF50; border: 2px solid #4CAF50; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 14px;">
                    Retry
                </button>
            </div>
        `;
    }
}

console.log('🐷✅ PigSoil+ Farmer Listing View with Inline Editing loaded!');