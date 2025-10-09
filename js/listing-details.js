// listing-details.js - COMPLETE Firebase Version
// Displays detailed view of a single listing from product_listings collection
import { auth, db } from './init.js';
import './shared-user-manager.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js';
import { 
    doc,
    getDoc,
    collection,
    query,
    where,
    getDocs,
    addDoc,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js';

const COLLECTIONS = {
    PRODUCT_LISTINGS: 'product_listings',
    USERS: 'users',
    CONVERSATIONS: 'conversations',
    MESSAGES: 'messages'
};

let currentListing = null;
let currentUser = null;
let sellerData = null;
let selectedImageIndex = 0;

document.addEventListener('DOMContentLoaded', async function() {
    console.log('📄 Listing Details Page initialized');
    
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log('✅ Buyer authenticated:', user.uid);
            currentUser = user;
            
            // Get listing ID from URL
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
        
        // Show loading
        if (loadingState) loadingState.style.display = 'block';
        if (listingContainer) listingContainer.style.display = 'none';
        
        // Fetch listing document
        const listingRef = doc(db, COLLECTIONS.PRODUCT_LISTINGS, listingId);
        const listingDoc = await getDoc(listingRef);
        
        if (!listingDoc.exists()) {
            throw new Error('Listing not found');
        }
        
        currentListing = {
            id: listingDoc.id,
            ...listingDoc.data()
        };
        
        console.log('📦 Listing data loaded:', currentListing);
        
        // Fetch seller information
        const sellerRef = doc(db, COLLECTIONS.USERS, currentListing.listingSellerID);
        const sellerDoc = await getDoc(sellerRef);
        
        if (sellerDoc.exists()) {
            sellerData = sellerDoc.data();
            console.log('👨‍🌾 Seller data loaded:', sellerData.userName);
        } else {
            sellerData = {
                userName: 'Swine Farmer',
                userEmail: '',
                userPhone: ''
            };
        }
        
        // Render the listing
        renderListingDetails();
        
        // Hide loading, show content
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
    
    // Extract data with fallbacks
    const compostType = currentListing.compostTechnique || 'basic_swine_manure';
    const compostLabel = compostType === 'hot_composting' ? 'Hot Composting Method' : 'Basic Swine Manure';
    const badgeClass = compostType === 'hot_composting' ? 'hot' : 'basic';
    
    const productName = currentListing.listingProductName || 'Premium Swine Compost';
    const description = currentListing.listingDescription || 'High-quality organic fertilizer from swine farming.';
    const pricePerKg = parseFloat(currentListing.listingPricePerKG || 0);
    const quantity = parseFloat(currentListing.listingQuantityKG || 0);
    const minOrder = parseFloat(currentListing.listingMinimumOrderKG || 10);
    
    const sellerName = sellerData?.userName || 'Swine Farmer';
    const sellerRating = calculateSellerRating(sellerData);
    
    // Location extraction
    const location = extractLocationDisplay(currentListing);
    const fullAddress = extractFullAddress(currentListing);
    
    // Images
    const images = currentListing.listingProductImages || [];
    const hasImages = images.length > 0;
    
    // Created date
    const createdDate = currentListing.listingCreatedAt 
        ? formatDate(currentListing.listingCreatedAt) 
        : 'Recently listed';
    
    container.innerHTML = `
        <div class="listing-grid">
            <!-- Image Gallery -->
            <div class="image-gallery">
                <div class="main-image" id="mainImage">
                    ${hasImages ? 
                        `<img src="${images[0]}" alt="${productName}" onerror="this.parentElement.innerHTML='<div class=\"main-image-placeholder\">🌱</div>'">` :
                        `<div class="main-image-placeholder">🌱</div>`
                    }
                </div>
                
                ${images.length > 1 ? `
                    <div class="thumbnail-grid">
                        ${images.map((img, index) => `
                            <div class="thumbnail ${index === 0 ? 'active' : ''}" onclick="selectImage(${index})">
                                <img src="${img}" alt="Product image ${index + 1}" onerror="this.parentElement.innerHTML='<div style=\"display:flex;align-items:center;justify-content:center;height:100%;font-size:24px;\">🌱</div>'">
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
            
            <!-- Listing Info -->
            <div class="listing-info">
                <h1>${productName}</h1>
                <span class="badge ${badgeClass}">${compostLabel}</span>
                
                <div class="price-section">
                    <div class="price">₱${pricePerKg.toFixed(2)}<span style="font-size: 18px; font-weight: 400; color: #666;">/kg</span></div>
                    <p class="price-note">Payment terms arranged directly with farmer through messaging</p>
                </div>
                
                <div class="info-grid">
                    <div class="info-item">
                        <span class="info-icon">📦</span>
                        <div class="info-content">
                            <div class="info-label">Available Quantity</div>
                            <div class="info-value">${quantity} kg</div>
                        </div>
                    </div>
                    
                    <div class="info-item">
                        <span class="info-icon">📍</span>
                        <div class="info-content">
                            <div class="info-label">Location</div>
                            <div class="info-value">${location}</div>
                        </div>
                    </div>
                    
                    <div class="info-item">
                        <span class="info-icon">⚖️</span>
                        <div class="info-content">
                            <div class="info-label">Minimum Order</div>
                            <div class="info-value">${minOrder} kg</div>
                        </div>
                    </div>
                    
                    <div class="info-item">
                        <span class="info-icon">📅</span>
                        <div class="info-content">
                            <div class="info-label">Listed On</div>
                            <div class="info-value">${createdDate}</div>
                        </div>
                    </div>
                </div>
                
                <!-- Action Buttons -->
                <div class="action-buttons">
                    <button class="btn-primary" onclick="contactSeller()">
                        💬 Contact Swine Farmer
                    </button>
                </div>
                
                <!-- Seller Info Card -->
                <div class="seller-card">
                    <div class="seller-header">
                        <div class="seller-avatar">${getInitials(sellerName)}</div>
                        <div style="flex: 1;">
                            <div class="seller-name">${sellerName}</div>
                            <div class="seller-rating">⭐ ${sellerRating.toFixed(1)} Rating</div>
                        </div>
                    </div>
                    <p style="font-size: 14px; color: #666; margin-top: 12px;">
                        Verified swine farmer offering quality compost
                    </p>
                </div>
                
                <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 12px; padding: 16px; margin-top: 16px;">
                    <p style="font-size: 13px; color: #856404; margin: 0; line-height: 1.6;">
                        <strong>💡 Note:</strong> PigSoil+ connects buyers and swine farmers. Payment and delivery terms are arranged directly between you and the farmer through our messaging system.
                    </p>
                </div>
            </div>
        </div>
        
        <!-- Description Section -->
        <div class="description-section">
            <h2 class="section-title">About This Swine Compost</h2>
            <div class="description-text">${formatDescription(description)}</div>
            
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
                    Contact the farmer to arrange pickup or delivery options.
                </p>
            </div>
        </div>
    `;
}

function extractLocationDisplay(listing) {
    if (!listing.listingLocation) {
        return 'Cebu, Philippines';
    }
    
    const loc = listing.listingLocation;
    
    if (loc.name && loc.name !== 'Select farm location' && loc.name !== 'Farm Location') {
        return loc.name;
    }
    
    if (loc.formattedAddress && loc.formattedAddress !== 'Cebu City, Philippines') {
        const parts = loc.formattedAddress.split(',').map(p => p.trim());
        if (parts.length >= 2) {
            return `${parts[0]}, ${parts[1]}`;
        }
        return parts[0];
    }
    
    if (loc.address && loc.address !== 'Click "Change" to choose pickup location') {
        const parts = loc.address.split(',').map(p => p.trim());
        return parts[0];
    }
    
    return 'Cebu, Philippines';
}

function extractFullAddress(listing) {
    if (!listing.listingLocation) {
        return 'Cebu City, Philippines';
    }
    
    const loc = listing.listingLocation;
    
    if (loc.formattedAddress && loc.formattedAddress !== 'Cebu City, Philippines') {
        return loc.formattedAddress;
    }
    
    if (loc.address && loc.address !== 'Click "Change" to choose pickup location') {
        return loc.address;
    }
    
    return 'Cebu City, Philippines';
}

function calculateSellerRating(sellerData) {
    if (sellerData?.sellerRating) {
        return sellerData.sellerRating;
    }
    return 4.5;
}

function getInitials(name) {
    if (!name) return 'SF';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
}

function formatDate(timestamp) {
    if (!timestamp) return 'Recently';
    
    let date;
    if (timestamp.toDate) {
        date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
        date = timestamp;
    } else {
        date = new Date(timestamp);
    }
    
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

function formatDescription(description) {
    if (!description) {
        return '<p>High-quality organic fertilizer from swine farming. Contact the farmer for more details.</p>';
    }
    
    // Convert newlines to paragraphs
    return description.split('\n').filter(p => p.trim()).map(p => `<p>${p}</p>`).join('');
}

// Global function to select image
window.selectImage = function(index) {
    selectedImageIndex = index;
    const images = currentListing.listingProductImages || [];
    
    if (images[index]) {
        const mainImage = document.getElementById('mainImage');
        mainImage.innerHTML = `<img src="${images[index]}" alt="Product image ${index + 1}" onerror="this.parentElement.innerHTML='<div class=\"main-image-placeholder\">🌱</div>'">`;
        
        // Update active thumbnail
        document.querySelectorAll('.thumbnail').forEach((thumb, i) => {
            if (i === index) {
                thumb.classList.add('active');
            } else {
                thumb.classList.remove('active');
            }
        });
    }
};

// Global function to contact seller
window.contactSeller = async function() {
    if (!currentUser || !currentListing || !sellerData) {
        console.error('❌ Missing required data for messaging');
        alert('Unable to contact seller. Please try again.');
        return;
    }
    
    try {
        console.log('💬 Initiating conversation with seller...');
        
        // Check if conversation already exists
        const conversationsRef = collection(db, COLLECTIONS.CONVERSATIONS);
        const q = query(
            conversationsRef,
            where('participants', 'array-contains', currentUser.uid)
        );
        
        const querySnapshot = await getDocs(q);
        let existingConversation = null;
        
        // Check if there's an existing conversation with this seller
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.participants.includes(currentListing.listingSellerID)) {
                existingConversation = { id: doc.id, ...data };
            }
        });
        
        if (existingConversation) {
            console.log('✅ Found existing conversation:', existingConversation.id);
            // Redirect to messages with conversation ID
            window.location.href = `/messages.html?conversationId=${existingConversation.id}`;
            return;
        }
        
        // Create new conversation
        const newConversation = {
            participants: [currentUser.uid, currentListing.listingSellerID],
            participantNames: {
                [currentUser.uid]: 'Buyer',
                [currentListing.listingSellerID]: sellerData.userName
            },
            lastMessage: '',
            lastMessageAt: serverTimestamp(),
            createdAt: serverTimestamp(),
            listingId: currentListing.id,
            listingTitle: currentListing.listingProductName
        };
        
        const conversationRef = await addDoc(collection(db, COLLECTIONS.CONVERSATIONS), newConversation);
        console.log('✅ Created new conversation:', conversationRef.id);
        
        // Send initial message
        const initialMessage = {
            conversationId: conversationRef.id,
            senderId: currentUser.uid,
            senderName: 'Buyer',
            message: `Hi! I'm interested in your swine compost listing: ${currentListing.listingProductName}`,
            messageType: 'text',
            sentAt: serverTimestamp(),
            isRead: false
        };
        
        await addDoc(collection(db, COLLECTIONS.MESSAGES), initialMessage);
        console.log('✅ Sent initial message');
        
        // Redirect to messages
        window.location.href = `/messages.html?conversationId=${conversationRef.id}`;
        
    } catch (error) {
        console.error('❌ Error contacting seller:', error);
        alert('Failed to contact seller. Please try again.');
    }
};

function showError(message) {
    const loadingState = document.getElementById('loadingState');
    
    if (loadingState) {
        loadingState.innerHTML = `
            <div style="text-align: center; padding: 60px 20px;">
                <div style="font-size: 60px; margin-bottom: 16px;">⚠️</div>
                <h3 style="font-size: 20px; margin-bottom: 8px; color: #333;">${message}</h3>
                <p style="color: #666; font-size: 14px; margin-bottom: 20px;">Please try again or go back to the marketplace</p>
                <button onclick="window.location.href='/buyer-marketplace.html'" style="background: #4CAF50; color: white; padding: 12px 24px; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 14px; margin-right: 12px;">
                    ← Back to Marketplace
                </button>
                <button onclick="location.reload()" style="background: white; color: #4CAF50; border: 2px solid #4CAF50; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 14px;">
                    Retry
                </button>
            </div>
        `;
    }
}

console.log('🐷✅ PigSoil+ Listing Details loaded!');