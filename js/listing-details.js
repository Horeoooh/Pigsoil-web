// listing-details.js - COMPLETE Implementation
// Features: Image Carousel, Reviews Modal, Google Maps Static & Interactive
import { auth, db } from './init.js';
import { 
    getCurrentUser, 
    getCurrentUserData, 
    getCachedUserData,
    getCachedProfilePic,
    DEFAULT_PROFILE_PIC,
    onUserDataChange
} from './shared-user-manager.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js';
import { 
    doc,
    getDoc,
    collection,
    query,
    where,
    getDocs,
    addDoc,
    updateDoc,
    serverTimestamp,
    orderBy
} from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js';

// Get i18next instance for translations
const t = (key, options = {}) => {
    if (window.i18next && window.i18next.t) {
        return window.i18next.t(key, options);
    }
    return key; // Fallback to key if i18next not loaded
};

// ===== USER TYPE CHECK - REDIRECT SWINE FARMERS =====
function checkUserTypeAndRedirect() {
    try {
        const cachedUserData = localStorage.getItem('pigsoil_user_data');
        if (cachedUserData) {
            const userData = JSON.parse(cachedUserData);
            const userType = userData.userType;
            
            // Redirect swine farmers to farmer dashboard
            if (userType === 'swine_farmer' || userType === 'Swine Farmer') {
                console.log('🚫 Swine farmer detected on buyer page, redirecting to dashboard...');
                window.location.href = '/dashboard.html';
                return true; // Redirecting
            }
        }
        return false; // Not redirecting
    } catch (error) {
        console.error('❌ Error checking user type:', error);
        return false;
    }
}

// Check immediately on page load
if (checkUserTypeAndRedirect()) {
    // Stop execution if redirecting
    throw new Error('Redirecting...');
}

const COLLECTIONS = {
    PRODUCT_LISTINGS: 'product_listings',
    USERS: 'users',
    CONVERSATIONS: 'conversations',
    MESSAGES: 'messages',
    REVIEWS: 'reviews',
    ADDRESSES: 'addresses'
};

const GOOGLE_MAPS_API_KEY = 'AIzaSyDxldiepJaqTaCW9kxCr-3cYgSlVD0fQYg';

let currentListing = null;
let currentUser = null;
let sellerData = null;
let sellerReviews = [];
let addressData = null;
let currentImageIndex = 0;
let productImages = [];
let map = null;
let marker = null;

document.addEventListener('DOMContentLoaded', async function() {
    console.log('📄 Listing Details Page initialized');
    
    // Load user profile immediately
    loadUserProfile();
    
    // Listen for user data changes
    onUserDataChange(() => {
        loadUserProfile();
    });
    
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log('✅ Buyer authenticated:', user.uid);
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

// Load user profile from cache or current data
function loadUserProfile() {
    const userData = getCurrentUserData() || getCachedUserData();
    const user = getCurrentUser();
    
    if (!userData && !user) {
        console.log('⏳ No user data available yet');
        return;
    }
    
    const userName = userData?.userName || user?.displayName || 'User';
    const userType = userData?.userType || 'fertilizer_buyer';
    
    // Get profile picture with proper fallback chain
    let profilePicUrl = userData?.userProfilePictureUrl || user?.photoURL || getCachedProfilePic();
    
    // If still no profile pic or it's the default, use the DEFAULT_PROFILE_PIC
    if (!profilePicUrl || profilePicUrl === DEFAULT_PROFILE_PIC) {
        profilePicUrl = DEFAULT_PROFILE_PIC;
    }
    
    // Determine user role display
    let roleDisplay = t('listingDetails.userRole.activeUser');
    if (userType === 'swine_farmer' || userType === 'Swine Farmer') {
        roleDisplay = t('listingDetails.userRole.swineFarmer');
    } else if (userType === 'fertilizer_buyer' || userType === 'Organic Fertilizer Buyer') {
        roleDisplay = t('listingDetails.userRole.fertilizerBuyer');
    }
    
    // Generate initials
    const initials = userName.split(' ')
        .map(word => word.charAt(0))
        .join('')
        .substring(0, 2)
        .toUpperCase();
    
    // Update header elements
    const userNameElement = document.getElementById('headerUserName');
    const userRoleElement = document.getElementById('headerUserRole');
    const userAvatarElement = document.getElementById('headerUserAvatar');
    
    if (userNameElement) userNameElement.textContent = userName;
    if (userRoleElement) userRoleElement.textContent = roleDisplay;
    
    if (userAvatarElement) {
        // Always use background image with either user's pic or default pic
        userAvatarElement.style.backgroundImage = `url(${profilePicUrl})`;
        userAvatarElement.style.backgroundSize = 'cover';
        userAvatarElement.style.backgroundPosition = 'center';
        userAvatarElement.style.backgroundRepeat = 'no-repeat';
        userAvatarElement.textContent = '';
        
        // Fallback to initials if image fails to load
        const img = new Image();
        img.onerror = () => {
            userAvatarElement.style.backgroundImage = 'none';
            userAvatarElement.textContent = initials;
        };
        img.src = profilePicUrl;
    }
    
    console.log('👤 User profile loaded:', { 
        userName, 
        roleDisplay, 
        profilePicUrl, 
        usingDefault: profilePicUrl === DEFAULT_PROFILE_PIC 
    });
}

async function loadListingDetails(listingId) {
    const loadingState = document.getElementById('loadingState');
    const listingContainer = document.getElementById('listingContainer');
    
    try {
        console.log('🔍 Loading listing:', listingId);
        
        if (loadingState) loadingState.style.display = 'block';
        if (listingContainer) listingContainer.style.display = 'none';
        
        // Fetch listing document
        const listingRef = doc(db, COLLECTIONS.PRODUCT_LISTINGS, listingId);
        const listingDoc = await getDoc(listingRef);
        
        if (!listingDoc.exists()) {
            throw new Error(t('listingDetails.error.listingNotFound'));
        }
        
        currentListing = {
            id: listingDoc.id,
            ...listingDoc.data()
        };
        
        console.log('📦 Listing data loaded:', currentListing);
        
        // Store product images for carousel
        productImages = currentListing.listingProductImages || [];
        
        // Fetch address data if available
        if (currentListing.listingAddressId) {
            await loadAddressData(currentListing.listingAddressId);
        }
        
        // Fetch seller information
        const sellerRef = doc(db, COLLECTIONS.USERS, currentListing.listingSellerID);
        const sellerDoc = await getDoc(sellerRef);
        
        if (sellerDoc.exists()) {
            sellerData = {
                id: sellerDoc.id,
                ...sellerDoc.data()
            };
            console.log('👨‍🌾 Seller data loaded:', sellerData.userName);
            
            // Fetch seller reviews
            await loadSellerReviews(currentListing.listingSellerID);
        } else {
            sellerData = {
                userName: t('listingDetails.productDefaults.seller'),
                userEmail: '',
                userPhone: ''
            };
        }
        
        // Render the listing
        renderListingDetails();
        
        // Load seller profile picture asynchronously
        loadSellerProfilePicture();
        
        // Initialize carousel if images exist
        if (productImages.length > 1) {
            initializeCarousel();
        }
        
        if (loadingState) loadingState.style.display = 'none';
        if (listingContainer) listingContainer.style.display = 'block';
        
    } catch (error) {
        console.error('❌ Error loading listing:', error);
        showError(t('listingDetails.error.title') + ': ' + error.message);
    }
}

async function loadAddressData(addressId) {
    try {
        console.log('📍 Loading address data:', addressId);
        
        const addressRef = doc(db, COLLECTIONS.ADDRESSES, addressId);
        const addressDoc = await getDoc(addressRef);
        
        if (addressDoc.exists()) {
            addressData = {
                id: addressDoc.id,
                ...addressDoc.data()
            };
            console.log('✅ Address data loaded:', addressData.addressName);
        } else {
            console.log('⚠️ Address document not found');
            addressData = null;
        }
    } catch (error) {
        console.error('❌ Error loading address:', error);
        addressData = null;
    }
}

async function loadSellerReviews(sellerId) {
    try {
        console.log('⭐ Loading reviews for seller:', sellerId);
        
        const reviewsRef = collection(db, COLLECTIONS.REVIEWS);
        const q = query(
            reviewsRef,
            where('reviewedUserID', '==', sellerId),
            orderBy('reviewCreatedAt', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        
        // Get only the latest review from each reviewer (like Android version)
        const latestReviewsMap = new Map();
        
        querySnapshot.forEach((doc) => {
            const reviewData = doc.data();
            const review = {
                id: doc.id,
                reviewerID: reviewData.reviewerID,
                reviewedUserID: reviewData.reviewedUserID,
                reviewRating: reviewData.reviewRating || 0,
                reviewText: reviewData.reviewText || '',
                reviewType: reviewData.reviewType || 'buyer_review',
                reviewTransactionID: reviewData.reviewTransactionID || '',
                reviewCreatedAt: reviewData.reviewCreatedAt
            };
            
            const existingReview = latestReviewsMap.get(review.reviewerID);
            if (!existingReview || 
                review.reviewCreatedAt.toDate() > existingReview.reviewCreatedAt.toDate()) {
                latestReviewsMap.set(review.reviewerID, review);
            }
        });
        
        sellerReviews = Array.from(latestReviewsMap.values());
        console.log(`✅ Loaded ${sellerReviews.length} unique reviews`);
        
    } catch (error) {
        console.error('❌ Error loading reviews:', error);
        sellerReviews = [];
    }
}

function calculateSellerRating() {
    if (sellerReviews.length === 0) {
        return { average: 0, count: 0 };
    }
    
    const totalRating = sellerReviews.reduce((sum, review) => sum + review.reviewRating, 0);
    const average = totalRating / sellerReviews.length;
    
    return {
        average: average,
        count: sellerReviews.length
    };
}

function getRatingBreakdown() {
    const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    
    sellerReviews.forEach(review => {
        if (review.reviewRating >= 1 && review.reviewRating <= 5) {
            breakdown[review.reviewRating]++;
        }
    });
    
    return breakdown;
}

function getStaticMapUrl(lat, lng, locationName) {
    const center = `${lat},${lng}`;
    const marker = `color:red|label:P|${lat},${lng}`;
    const size = '400x250';  // Changed from 600x300 to reduce height
    const zoom = '15';
    const scale = '2';  // ADD THIS - Makes map high resolution (retina)
    
    return `https://maps.googleapis.com/maps/api/staticmap?center=${center}&zoom=${zoom}&size=${size}&scale=${scale}&markers=${marker}&key=${GOOGLE_MAPS_API_KEY}`;
}

// ========== SELLER PROFILE PICTURE LOADER ==========
function loadSellerProfilePicture() {
    if (!sellerData || !sellerData.id) {
        console.log('⚠️ No seller data available for profile picture');
        return;
    }
    
    const sellerAvatarContainer = document.getElementById('sellerAvatarContainer');
    if (!sellerAvatarContainer) {
        console.log('⚠️ Seller avatar container not found');
        return;
    }
    
    // Get seller profile picture URL
    const sellerProfilePic = sellerData.userProfilePictureUrl || DEFAULT_PROFILE_PIC;
    const sellerName = sellerData.userName || 'Swine Farmer';
    
    console.log('🖼️ Loading seller profile picture:', sellerProfilePic);
    
    // Use background image approach like the header
    sellerAvatarContainer.style.backgroundImage = `url(${sellerProfilePic})`;
    sellerAvatarContainer.style.backgroundSize = 'cover';
    sellerAvatarContainer.style.backgroundPosition = 'center';
    sellerAvatarContainer.style.backgroundRepeat = 'no-repeat';
    sellerAvatarContainer.textContent = '';
    
    // Fallback to initials if image fails to load
    const img = new Image();
    img.onerror = () => {
        console.log('⚠️ Seller profile picture failed to load, using initials');
        sellerAvatarContainer.style.backgroundImage = '';
        sellerAvatarContainer.textContent = getInitials(sellerName);
    };
    img.src = sellerProfilePic;
    
    console.log('✅ Seller profile picture loaded successfully');
}

function renderListingDetails() {
    const container = document.getElementById('listingContainer');
    if (!container) return;
    
    const productName = currentListing.listingProductName || t('listingDetails.productDefaults.name');
    const description = currentListing.listingDescription || t('listingDetails.productDefaults.description');
    const pricePerKg = parseFloat(currentListing.listingPricePerKG || 0);
    const quantity = parseFloat(currentListing.listingQuantityLeftKG || currentListing.listingQuantityKG || 0);
    
    const sellerName = sellerData?.userName || t('listingDetails.productDefaults.seller');
    const ratingInfo = calculateSellerRating();
    
    // Location extraction - use addressData if available
    const location = getLocationDisplay();
    const fullAddress = getFullAddress();
    
    // Images
    const hasImages = productImages.length > 0;
    
    // Created date
    const createdDate = currentListing.listingCreatedAt 
        ? formatDate(currentListing.listingCreatedAt) 
        : t('listingDetails.productDefaults.recentlyListed');
    
    // Static map URL
    let staticMapUrl = '';
    if (addressData && addressData.addressLatitude && addressData.addressLongitude) {
        staticMapUrl = getStaticMapUrl(
            addressData.addressLatitude, 
            addressData.addressLongitude,
            addressData.addressName
        );
    }
    
    container.innerHTML = `
        <div class="listing-grid">
            <!-- Image Carousel -->
            <div class="image-carousel">
                <div class="carousel-container">
                    ${hasImages ? 
                        productImages.map((img, index) => `
                            <img src="${img}" 
                                 alt="${productName} - Image ${index + 1}" 
                                 class="${index === 0 ? 'active' : ''}"
                                 onerror="this.style.display='none'">
                        `).join('') :
                        `<div class="carousel-placeholder">🌱</div>`
                    }
                    ${productImages.length > 1 ? `
                        <button class="carousel-btn prev" onclick="changeImage(-1)">‹</button>
                        <button class="carousel-btn next" onclick="changeImage(1)">›</button>
                    ` : ''}
                </div>
                ${productImages.length > 1 ? `
                    <div class="carousel-indicators">
                        ${productImages.map((_, index) => `
                            <div class="indicator ${index === 0 ? 'active' : ''}" 
                                 onclick="goToImage(${index})"></div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
            
            <!-- Listing Info -->
            <div class="listing-info">
                <h1>${productName}</h1>
                
                <div class="price-section">
                    <div class="price">₱${pricePerKg.toFixed(2)}<span style="font-size: 18px; font-weight: 400; color: #666;">${t('listingDetails.price.perKg')}</span></div>
                    <p class="price-note">${t('listingDetails.price.note')}</p>
                </div>
                
               <div class="info-grid">
                    <div class="info-item">
                        <span class="info-icon">🏭</span>
                        <div class="info-content">
                            <div class="info-label">${t('listingDetails.info.totalProduced')}</div>
                            <div class="info-value">${parseFloat(currentListing.listingQuantityKG || 0)} kg</div>
                        </div>
                    </div>
                    
                    <div class="info-item">
                        <span class="info-icon">📦</span>
                        <div class="info-content">
                            <div class="info-label">${t('listingDetails.info.availableQuantity')}</div>
                            <div class="info-value">${quantity} kg</div>
                        </div>
                    </div>
                    <div class="info-item">
                        <span class="info-icon">📍</span>
                        <div class="info-content">
                            <div class="info-label">${t('listingDetails.info.location')}</div>
                            <div class="info-value">${location}</div>
                        </div>
                    </div>
                    
                    <div class="info-item">
                        <span class="info-icon">📅</span>
                        <div class="info-content">
                            <div class="info-label">${t('listingDetails.info.listedOn')}</div>
                            <div class="info-value">${createdDate}</div>
                        </div>
                    </div>
                </div>
              <!-- Action Buttons - UPDATED WITH MESSAGE INPUT -->
<div class="contact-section">
    <h3 class="contact-title">${t('listingDetails.contact.title')}</h3>
    <div class="message-input-group">
        <input type="text" 
               class="message-input-field" 
               id="firstMessageInput" 
               placeholder="${t('listingDetails.contact.inputPlaceholder')}"
               maxlength="500">
        <button class="btn-send-message" id="sendFirstMessageBtn" onclick="sendFirstMessage()">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
            ${t('listingDetails.contact.sendButton')}
        </button>
    </div>
    <p class="contact-note">${t('listingDetails.contact.note')}</p>
</div>
                
                <!-- Seller Info Card with Reviews -->
                <div class="seller-card">
                    <div class="seller-header">
                        <div class="seller-avatar" id="sellerAvatarContainer">${getInitials(sellerName)}</div>
                        <div style="flex: 1;">
                            <div class="seller-name">${sellerName}</div>
                            <div class="seller-rating">
                                ${ratingInfo.count > 0 ? 
                                    `⭐ ${ratingInfo.average.toFixed(1)} (${ratingInfo.count} ${ratingInfo.count === 1 ? t('listingDetails.seller.review') : t('listingDetails.seller.reviews')})` :
                                    `⭐ ${t('listingDetails.seller.noReviews')}`
                                }
                            </div>
                        </div>
                    </div>
                    <p style="font-size: 14px; color: #666; margin-top: 12px;">
                        ${t('listingDetails.seller.verifiedFarmer')}
                    </p>
                    
                    ${ratingInfo.count > 0 ? `
                        <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e0e0e0;">
                            <button class="view-reviews-btn" onclick="showReviewsModal()">
                                ${t('listingDetails.seller.viewAllReviews')}
                            </button>
                        </div>
                    ` : ''}
                </div>
                
                <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 12px; padding: 16px; margin-top: 16px;">
                    <p style="font-size: 13px; color: #856404; margin: 0; line-height: 1.6;">
                        <strong>${t('listingDetails.note.title')}</strong> ${t('listingDetails.note.message')}
                    </p>
                </div>
            </div>
        </div>
        
        <!-- Description Section -->
        <div class="description-section">
            <h2 class="section-title">${t('listingDetails.description.title')}</h2>
            <div class="description-text">${formatDescription(description)}</div>
        </div>
        
        <!-- Location Section with Static Map -->
        <div class="location-section">
            <h2 class="section-title">${t('listingDetails.location.title')}</h2>
            <div class="location-info">
                <p style="font-size: 15px; color: #333; margin: 0 0 16px 0;">
                    <strong>📍 ${fullAddress}</strong>
                </p>
                
                ${staticMapUrl ? `
                    <div style="border-radius: 12px; overflow: hidden; margin-bottom: 12px; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,0.1); max-width: 600px;" onclick="showMapModal()">
                        <img src="${staticMapUrl}" 
                            alt="Location Map" 
                            style="width: 100%; height: auto; display: block; image-rendering: -webkit-optimize-contrast;"
                            onerror="this.parentElement.style.display='none'">
                    </div>
                    <p style="font-size: 13px; color: #666; margin: 0 0 12px 0; font-style: italic;">
                        ${t('listingDetails.location.clickMap')}
                    </p>
                ` : ''}
                
                <p style="font-size: 14px; color: #666; margin: 0;">
                </p>
                
                ${addressData && addressData.addressLatitude && addressData.addressLongitude ? `
                    <button class="location-map-btn" onclick="showMapModal()">
                        ${t('listingDetails.location.openInteractive')}
                    </button>
                ` : ''}
            </div>
        </div>
    `;
}

// ========== CAROUSEL FUNCTIONS ==========
function initializeCarousel() {
    currentImageIndex = 0;
    console.log('🎠 Carousel initialized with', productImages.length, 'images');
}

window.changeImage = function(direction) {
    if (productImages.length === 0) return;
    
    currentImageIndex += direction;
    
    if (currentImageIndex < 0) {
        currentImageIndex = productImages.length - 1;
    } else if (currentImageIndex >= productImages.length) {
        currentImageIndex = 0;
    }
    
    updateCarousel();
};

window.goToImage = function(index) {
    currentImageIndex = index;
    updateCarousel();
};

function updateCarousel() {
    const carouselImages = document.querySelectorAll('.carousel-container img');
    const indicators = document.querySelectorAll('.indicator');
    
    carouselImages.forEach((img, index) => {
        if (index === currentImageIndex) {
            img.classList.add('active');
        } else {
            img.classList.remove('active');
        }
    });
    
    indicators.forEach((indicator, index) => {
        if (index === currentImageIndex) {
            indicator.classList.add('active');
        } else {
            indicator.classList.remove('active');
        }
    });
}

// ========== REVIEWS MODAL FUNCTIONS ==========
window.showReviewsModal = function() {
    const modal = document.getElementById('reviewsModal');
    const modalBody = document.getElementById('reviewsModalBody');
    
    if (!modal || !modalBody) return;
    
    const ratingInfo = calculateSellerRating();
    const breakdown = getRatingBreakdown();
    const totalReviews = ratingInfo.count;
    
    modalBody.innerHTML = `
        <!-- Rating Summary -->
        <div class="review-stats">
            <div class="rating-summary">
                <div class="rating-number">${ratingInfo.average.toFixed(1)}</div>
                <div class="rating-stars">★★★★★</div>
                <div class="rating-count">${totalReviews} ${t('listingDetails.reviews.basedOn')}</div>
            </div>
            
            <div class="rating-breakdown">
                ${[5, 4, 3, 2, 1].map(star => {
                    const count = breakdown[star] || 0;
                    const percentage = totalReviews > 0 ? (count / totalReviews * 100).toFixed(0) : 0;
                    return `
                        <div class="rating-row">
                            <span class="rating-label">${star} ${star !== 1 ? t('listingDetails.reviews.stars') : t('listingDetails.reviews.star')}</span>
                            <div class="rating-bar">
                                <div class="rating-bar-fill" style="width: ${percentage}%"></div>
                            </div>
                            <span class="rating-value">${count}</span>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
        
        <!-- All Reviews -->
        <div>
            ${sellerReviews.length > 0 ? 
                sellerReviews.map(review => renderReviewItem(review)).join('') :
                `<div class="no-reviews"><p>${t('listingDetails.reviews.noReviews')}</p></div>`
            }
        </div>
    `;
    
    modal.classList.add('active');
};

window.closeReviewsModal = function() {
    const modal = document.getElementById('reviewsModal');
    if (modal) {
        modal.classList.remove('active');
    }
};

function renderReviewItem(review) {
    const date = review.reviewCreatedAt ? formatDate(review.reviewCreatedAt) : t('listingDetails.reviews.recently');
    const stars = '★'.repeat(review.reviewRating) + '☆'.repeat(5 - review.reviewRating);
    
    return `
        <div class="review-item">
            <div class="review-header">
                <div class="reviewer-avatar">${getInitials(t('listingDetails.reviews.buyer'))}</div>
                <div class="review-info">
                    <div class="reviewer-name">${t('listingDetails.reviews.buyer')}</div>
                    <div class="review-rating">${stars}</div>
                    <div class="review-date">${date}</div>
                </div>
            </div>
            ${review.reviewText ? `
                <p class="review-text">${review.reviewText}</p>
            ` : `
                <p class="review-text" style="font-style: italic; color: #999;">${t('listingDetails.reviews.noComments')}</p>
            `}
        </div>
    `;
}

// ========== MAP MODAL FUNCTIONS ==========
window.showMapModal = function() {
    if (!addressData || !addressData.addressLatitude || !addressData.addressLongitude) {
        alert(t('listingDetails.location.notAvailable'));
        return;
    }
    
    const modal = document.getElementById('mapModal');
    const modalTitle = document.getElementById('mapModalTitle');
    
    if (!modal) return;
    
    modalTitle.textContent = addressData.addressName || t('listingDetails.location.title');
    modal.classList.add('active');
    
    // Initialize map after modal is visible
    setTimeout(() => {
        initializeMap();
    }, 300);
};

window.closeMapModal = function() {
    const modal = document.getElementById('mapModal');
    if (modal) {
        modal.classList.remove('active');
    }
};

function initializeMap() {
    if (!window.google) {
        console.error('❌ Google Maps API not loaded');
        alert(t('listingDetails.location.mapsNotAvailable'));
        return;
    }
    
    const mapContainer = document.getElementById('mapContainer');
    if (!mapContainer) return;
    
    const lat = addressData.addressLatitude;
    const lng = addressData.addressLongitude;
    const locationName = addressData.addressName || t('listingDetails.location.title');
    
    console.log('🗺️ Initializing map at:', lat, lng);
    
    // Create map
    const location = { lat: lat, lng: lng };
    
    map = new google.maps.Map(mapContainer, {
        center: location,
        zoom: 15,
        mapTypeControl: true,
        fullscreenControl: true,
        streetViewControl: true,
        zoomControl: true
    });
    
    // Add marker
    marker = new google.maps.Marker({
        position: location,
        map: map,
        title: locationName,
        animation: google.maps.Animation.DROP
    });
    
    // Add info window
    const infoWindow = new google.maps.InfoWindow({
        content: `
            <div style="padding: 8px;">
                <h3 style="margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">${locationName}</h3>
                <p style="margin: 0; font-size: 14px; color: #666;">${t('listingDetails.map.pickupLocation')}</p>
            </div>
        `
    });
    
    marker.addListener('click', () => {
        infoWindow.open(map, marker);
    });
    
    // Show info window by default
    infoWindow.open(map, marker);
}

// ========== LOCATION HELPER FUNCTIONS ==========
function getLocationDisplay() {
    // Use address data if available
    if (addressData && addressData.addressName) {
        return addressData.addressName;
    }
    
    // Fallback to listing location
    if (!currentListing.listingLocation) {
        return t('listingDetails.productDefaults.defaultLocation');
    }
    
    const loc = currentListing.listingLocation;
    
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
    
    return t('listingDetails.productDefaults.defaultLocation');
}

function getFullAddress() {
    // Use address data if available
    if (addressData && addressData.addressName) {
        return addressData.addressName;
    }
    
    // Fallback to listing location
    if (!currentListing.listingLocation) {
        return t('listingDetails.productDefaults.defaultFullAddress');
    }
    
    const loc = currentListing.listingLocation;
    
    if (loc.formattedAddress && loc.formattedAddress !== 'Cebu City, Philippines') {
        return loc.formattedAddress;
    }
    
    if (loc.address && loc.address !== 'Click "Change" to choose pickup location') {
        return loc.address;
    }
    
    return t('listingDetails.productDefaults.defaultFullAddress');
}

// ========== HELPER FUNCTIONS ==========
function getInitials(name) {
    if (!name) return 'SF';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
}

function formatDate(timestamp) {
    if (!timestamp) return t('listingDetails.reviews.recently');
    
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
        return `<p>${t('listingDetails.description.default')}</p>`;
    }
    
    return description.split('\n').filter(p => p.trim()).map(p => `<p>${p}</p>`).join('');
}

// ========== MESSAGING FUNCTION (FIXED) ==========
window.contactSeller = async function() {
    if (!currentUser || !currentListing || !sellerData) {
        console.error('❌ Missing required data for messaging');
        alert(t('listingDetails.error.contactSeller'));
        return;
    }
    
    try {
        console.log(t('listingDetails.messaging.initiating'));
        
        // Fetch current user data
        const currentUserRef = doc(db, COLLECTIONS.USERS, currentUser.uid);
        const currentUserDoc = await getDoc(currentUserRef);
        
        if (!currentUserDoc.exists()) {
            throw new Error(t('listingDetails.error.userNotFound'));
        }
        
        const currentUserData = currentUserDoc.data();
        const buyerName = currentUserData.userName || 'Organic Fertilizer Buyer';
        const buyerType = currentUserData.userType || 'fertilizer_buyer';
        
        // Check for existing conversation
        const conversationsRef = collection(db, COLLECTIONS.CONVERSATIONS);
        const q = query(
            conversationsRef,
            where('participants', 'array-contains', currentUser.uid)
        );
        
        const querySnapshot = await getDocs(q);
        let existingConversation = null;
        
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.participants.includes(currentListing.listingSellerID)) {
                existingConversation = { id: doc.id, ...data };
            }
        });
        
        if (existingConversation) {
            console.log(t('listingDetails.messaging.foundExisting'), existingConversation.id);
            window.location.href = `/messages.html?conversation=${existingConversation.id}`;
            return;
        }
        
        // Create new conversation with CORRECT structure matching messages.js expectations
        const now = serverTimestamp();
        const newConversation = {
            participants: [currentUser.uid, currentListing.listingSellerID],
            participantDetails: {
                [currentUser.uid]: {
                    participantName: buyerName,
                    participantUserType: buyerType,
                    participantLastReadAt: now
                },
                [currentListing.listingSellerID]: {
                    participantName: sellerData.userName || 'Swine Farmer',
                    participantUserType: sellerData.userType || 'swine_farmer',
                    participantLastReadAt: null
                }
            },
            lastMessage: {
                lastMessageText: `Hi! I'm interested in your swine compost listing: ${currentListing.listingProductName}`,
                lastMessageTimestamp: now,
                lastMessageSenderId: currentUser.uid
            },
            listingId: currentListing.id,
            conversationIsActive: true,
            conversationCreatedAt: now,
            conversationUpdatedAt: now,
            canProposeDeal: true,
            buyerTransactionStatus: 'none',
            sellerTransactionStatus: 'none'
        };
        
        const conversationRef = await addDoc(conversationsRef, newConversation);
        console.log(t('listingDetails.messaging.createdNew'), conversationRef.id);
        
        // Send initial message to the conversation
        const messagesRef = collection(db, COLLECTIONS.CONVERSATIONS);
        const conversationMessagesRef = collection(doc(messagesRef, conversationRef.id), COLLECTIONS.MESSAGES);
        
        const initialMessage = {
            messageSenderId: currentUser.uid,
            messageReceiverId: currentListing.listingSellerID,
            messageText: `Hi! I'm interested in your swine compost listing: ${currentListing.listingProductName}`,
            messageType: 'text',
            messageStatus: 'sent',
            messageCreatedAt: now,
            messageDeliveredAt: null,
            messageReadAt: null,
            messageMediaUrl: null,
            messageMetadata: null
        };
        
        await addDoc(conversationMessagesRef, initialMessage);
        console.log(t('listingDetails.messaging.sentInitial'));
        
        // Navigate to the new conversation
        window.location.href = `/messages.html?conversation=${conversationRef.id}`;
        
    } catch (error) {
        console.error('❌ Error contacting seller:', error);
        alert(t('listingDetails.error.sendFailed'));
    }
};// ========== MESSAGING FUNCTION WITH CUSTOM FIRST MESSAGE ==========
window.sendFirstMessage = async function() {
    const messageInput = document.getElementById('firstMessageInput');
    const sendBtn = document.getElementById('sendFirstMessageBtn');
    
    if (!currentUser || !currentListing || !sellerData) {
        console.error(t('listingDetails.error.missingData'));
        alert(t('listingDetails.error.contactSeller'));
        return;
    }
    
    const firstMessage = messageInput.value.trim();
    
    if (!firstMessage) {
        messageInput.focus();
        messageInput.style.borderColor = '#e74c3c';
        setTimeout(() => {
            messageInput.style.borderColor = '#ddd';
        }, 2000);
        return;
    }
    
    // Disable button and show loading state
    sendBtn.disabled = true;
    sendBtn.classList.add('loading');
    sendBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
        ${t('listingDetails.contact.sending')}
    `;
    
    try {
        console.log(t('listingDetails.messaging.checkingExisting'));
        
        // Check for existing conversation between buyer and seller
        const conversationsRef = collection(db, COLLECTIONS.CONVERSATIONS);
        const q = query(
            conversationsRef,
            where('participants', 'array-contains', currentUser.uid),
            where('conversationIsActive', '==', true)
        );
        
        const querySnapshot = await getDocs(q);
        let existingConversation = null;
        
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            // Check if this conversation includes the seller
            if (data.participants.includes(currentListing.listingSellerID)) {
                existingConversation = { id: docSnap.id, ...data };
            }
        });
        
        if (existingConversation) {
            console.log(t('listingDetails.messaging.foundExisting'), existingConversation.id);
            console.log('   Sending message to existing conversation...');
            
            // Send message to existing conversation
            const messagesRef = collection(db, COLLECTIONS.CONVERSATIONS);
            const conversationMessagesRef = collection(doc(messagesRef, existingConversation.id), COLLECTIONS.MESSAGES);
            
            const now = serverTimestamp();
            const newMessage = {
                messageSenderId: currentUser.uid,
                messageReceiverId: currentListing.listingSellerID,
                messageText: firstMessage,
                messageType: 'text',
                messageStatus: 'sent',
                messageCreatedAt: now,
                messageDeliveredAt: null,
                messageReadAt: null,
                messageMediaUrl: null,
                messageMetadata: null
            };
            
            await addDoc(conversationMessagesRef, newMessage);
            
            // Update conversation's last message
            await updateDoc(doc(db, COLLECTIONS.CONVERSATIONS, existingConversation.id), {
                'lastMessage': {
                    lastMessageText: firstMessage,
                    lastMessageTimestamp: now,
                    lastMessageSenderId: currentUser.uid
                },
                conversationUpdatedAt: now
            });
            
            console.log('✅ Message sent to existing conversation');
            
            // Navigate to existing conversation
            window.location.href = `/messages.html?conversation=${existingConversation.id}`;
            return;
        }
        
        // No existing conversation found - create new one
        console.log(t('listingDetails.messaging.noExisting'));
        
        // Fetch current user data
        const currentUserRef = doc(db, COLLECTIONS.USERS, currentUser.uid);
        const currentUserDoc = await getDoc(currentUserRef);
        
        if (!currentUserDoc.exists()) {
            throw new Error(t('listingDetails.error.userNotFound'));
        }
        
        const currentUserData = currentUserDoc.data();
        const buyerName = currentUserData.userName || 'Organic Fertilizer Buyer';
        const buyerType = currentUserData.userType || 'fertilizer_buyer';
        
        // Create new conversation with CORRECT structure
        const now = serverTimestamp();
        const newConversation = {
            participants: [currentUser.uid, currentListing.listingSellerID],
            participantDetails: {
                [currentUser.uid]: {
                    participantName: buyerName,
                    participantUserType: buyerType,
                    participantLastReadAt: now
                },
                [currentListing.listingSellerID]: {
                    participantName: sellerData.userName || 'Swine Farmer',
                    participantUserType: sellerData.userType || 'swine_farmer',
                    participantLastReadAt: null
                }
            },
            lastMessage: {
                lastMessageText: firstMessage,
                lastMessageTimestamp: now,
                lastMessageSenderId: currentUser.uid
            },
            listingId: currentListing.id,
            conversationIsActive: true,
            conversationCreatedAt: now,
            conversationUpdatedAt: now,
            canProposeDeal: true,
            buyerTransactionStatus: 'none',
            sellerTransactionStatus: 'none'
        };
        
        const conversationRef = await addDoc(conversationsRef, newConversation);
        console.log(t('listingDetails.messaging.createdNew'), conversationRef.id);
        
        // Send first message to the conversation
        const messagesRef = collection(db, COLLECTIONS.CONVERSATIONS);
        const conversationMessagesRef = collection(doc(messagesRef, conversationRef.id), COLLECTIONS.MESSAGES);
        
        const initialMessage = {
            messageSenderId: currentUser.uid,
            messageReceiverId: currentListing.listingSellerID,
            messageText: firstMessage,
            messageType: 'text',
            messageStatus: 'sent',
            messageCreatedAt: now,
            messageDeliveredAt: null,
            messageReadAt: null,
            messageMediaUrl: null,
            messageMetadata: null
        };
        
        await addDoc(conversationMessagesRef, initialMessage);
        console.log(t('listingDetails.messaging.sentFirst'));
        
        // Navigate to the new conversation
        window.location.href = `/messages.html?conversation=${conversationRef.id}`;
        
    } catch (error) {
        console.error('❌ Error sending message:', error);
        alert(t('listingDetails.error.sendFailed'));
        
        // Reset button
        sendBtn.disabled = false;
        sendBtn.classList.remove('loading');
        sendBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
            ${t('listingDetails.contact.sendButton')}
        `;
    }
};

// Add Enter key support for the message input
document.addEventListener('DOMContentLoaded', function() {
    // Wait a bit for the input to be rendered
    setTimeout(() => {
        const messageInput = document.getElementById('firstMessageInput');
        if (messageInput) {
            messageInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendFirstMessage();
                }
            });
        }
    }, 1000);
});

// ========== ERROR HANDLING ==========
function showError(message) {
    const loadingState = document.getElementById('loadingState');
    
    if (loadingState) {
        loadingState.innerHTML = `
            <div style="text-align: center; padding: 60px 20px;">
                <div style="font-size: 60px; margin-bottom: 16px;">⚠️</div>
                <h3 style="font-size: 20px; margin-bottom: 8px; color: #333;">${message}</h3>
                <p style="color: #666; font-size: 14px; margin-bottom: 20px;">${t('listingDetails.error.message')}</p>
                <button onclick="window.location.href='/buyer-marketplace.html'" style="background: #4CAF50; color: white; padding: 12px 24px; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 14px; margin-right: 12px;">
                    ${t('listingDetails.error.backButton')}
                </button>
                <button onclick="location.reload()" style="background: white; color: #4CAF50; border: 2px solid #4CAF50; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 14px;">
                    ${t('listingDetails.error.retryButton')}
                </button>
            </div>
        `;
    }
}

// Close modals when clicking outside
window.addEventListener('click', function(event) {
    const reviewsModal = document.getElementById('reviewsModal');
    const mapModal = document.getElementById('mapModal');
    const reportModal = document.getElementById('reportModal');
    const actionsDropdown = document.getElementById('actionsDropdown');
    
    if (event.target === reviewsModal) {
        closeReviewsModal();
    }
    
    if (event.target === mapModal) {
        closeMapModal();
    }
    
    if (event.target === reportModal) {
        closeReportModal();
    }
    
    // Close dropdown if clicking outside
    if (!event.target.closest('.more-actions-container')) {
        if (actionsDropdown) {
            actionsDropdown.classList.remove('active');
        }
    }
});

// ========== REPORT FUNCTIONALITY ==========

// Global variable to store current listing ID
let currentListingId = null;

// Toggle actions dropdown
function toggleActionsDropdown() {
    const dropdown = document.getElementById('actionsDropdown');
    if (dropdown) {
        dropdown.classList.toggle('active');
    }
}

// Open report modal
function openReportModal() {
    const modal = document.getElementById('reportModal');
    if (modal) {
        // Clear any previous selections
        const radioButtons = modal.querySelectorAll('input[name="reportReason"]');
        radioButtons.forEach(radio => radio.checked = false);
        
        const detailsInput = document.getElementById('reportDetailsInput');
        if (detailsInput) {
            detailsInput.value = '';
            updateCharCount();
        }
        
        modal.classList.add('active');
    }
    
    // Close dropdown
    const dropdown = document.getElementById('actionsDropdown');
    if (dropdown) {
        dropdown.classList.remove('active');
    }
}

// Close report modal
function closeReportModal() {
    const modal = document.getElementById('reportModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Make functions globally accessible
window.openReportModal = openReportModal;
window.closeReportModal = closeReportModal;
window.toggleActionsDropdown = toggleActionsDropdown;

// Update character count
function updateCharCount() {
    const textarea = document.getElementById('reportDetailsInput');
    const charCount = document.querySelector('.char-count');
    
    if (textarea && charCount) {
        const currentLength = textarea.value.length;
        charCount.textContent = `${currentLength}/500`;
    }
}

// Check if user has already reported this listing
async function checkIfAlreadyReported(listingId, userId) {
    try {
        const reportsQuery = query(
            collection(db, 'product_listings', listingId, 'reports'),
            where('reportedBy', '==', userId)
        );
        
        const querySnapshot = await getDocs(reportsQuery);
        return !querySnapshot.empty;
    } catch (error) {
        console.error('Error checking existing reports:', error);
        return false;
    }
}

// Submit report
async function submitReport(listingId, reason, details) {
    const currentUser = auth.currentUser;
    
    if (!currentUser) {
        showToast('Please login to report', 'error');
        return;
    }
    
    // Check if already reported
    const alreadyReported = await checkIfAlreadyReported(listingId, currentUser.uid);
    
    if (alreadyReported) {
        showToast('You have already reported this listing', 'warning');
        closeReportModal();
        return;
    }
    
    // Disable submit button and show loading
    const submitBtn = document.getElementById('submitReportBtn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.add('loading');
        submitBtn.textContent = 'Submitting...';
    }
    
    try {
        const reportData = {
            reason: reason,
            details: details,
            reportedBy: currentUser.uid,
            reportedAt: serverTimestamp()
        };
        
        // Add report to subcollection
        await addDoc(
            collection(db, 'product_listings', listingId, 'reports'),
            reportData
        );
        
        showToast('Report submitted successfully. We\'ll review it shortly.', 'success');
        closeReportModal();
        
    } catch (error) {
        console.error('Failed to submit report:', error);
        showToast('Failed to submit report: ' + error.message, 'error');
        
        // Re-enable button
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.classList.remove('loading');
            submitBtn.textContent = 'Submit Report';
        }
    }
}

// Show toast notification
function showToast(message, type = 'info') {
    // Create toast element
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%);
        background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : type === 'warning' ? '#ff9800' : '#333'};
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 10000;
        font-family: 'Poppins', Arial, sans-serif;
        font-size: 14px;
        font-weight: 500;
        max-width: 90%;
        text-align: center;
        animation: slideUp 0.3s ease;
    `;
    toast.textContent = message;
    
    // Add animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideUp {
            from {
                transform: translateX(-50%) translateY(100px);
                opacity: 0;
            }
            to {
                transform: translateX(-50%) translateY(0);
                opacity: 1;
            }
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(toast);
    
    // Remove after 4 seconds
    setTimeout(() => {
        toast.style.animation = 'slideUp 0.3s ease reverse';
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 300);
    }, 4000);
}

// Initialize report functionality when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // More actions button
    const moreActionsBtn = document.getElementById('moreActionsBtn');
    if (moreActionsBtn) {
        moreActionsBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            toggleActionsDropdown();
        });
    }
    
    // Report listing button
    const reportListingBtn = document.getElementById('reportListingBtn');
    if (reportListingBtn) {
        reportListingBtn.addEventListener('click', function() {
            openReportModal();
        });
    }
    
    // Submit report button
    const submitReportBtn = document.getElementById('submitReportBtn');
    if (submitReportBtn) {
        submitReportBtn.addEventListener('click', function() {
            // Get selected reason
            const selectedReason = document.querySelector('input[name="reportReason"]:checked');
            
            if (!selectedReason) {
                showToast('Please select a reason for reporting', 'warning');
                return;
            }
            
            const reason = selectedReason.value;
            const details = document.getElementById('reportDetailsInput').value.trim();
            
            // Get current listing ID
            const urlParams = new URLSearchParams(window.location.search);
            const listingId = urlParams.get('id');
            
            if (listingId) {
                submitReport(listingId, reason, details);
            } else {
                showToast('Unable to report: Listing not found', 'error');
            }
        });
    }
    
    // Character count update
    const reportDetailsInput = document.getElementById('reportDetailsInput');
    if (reportDetailsInput) {
        reportDetailsInput.addEventListener('input', updateCharCount);
    }
});

console.log('🐷✅ PigSoil+ Listing Details loaded with Carousel, Reviews, Maps & Report!');
