// js/CreateListing.js - Updated to use your exact Firebase collections
import { auth, db, storage } from '../js/init.js';
import { 
    collection, 
    addDoc, 
    serverTimestamp, 
    query, 
    where, 
    getDocs,
    doc,
    setDoc,
    getDoc
} from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js';
import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-storage.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js';

// Updated collection names to match your EXACT Firebase structure
const COLLECTIONS = {
    ADDRESSES: 'addresses',
    COMPOST_BATCHES: 'compost_batches',
    COMPOSTING_METHODS: 'composting_methods',
    CONVERSATIONS: 'conversations',
    MESSAGES: 'messages',
    NOTIFICATIONS: 'notifications',
    PRODUCT_LISTINGS: 'product_listings', // This is the one we need!
    REVIEWS: 'reviews',
    TRANSACTIONS: 'transactions',
    USERS: 'users'
};

// Global variables for integration with enhanced UI
let uploadedPhotos = [];
let isFormSubmitting = false;

document.addEventListener('DOMContentLoaded', function() {
    console.log('🐷 PigSoil+ CreateListing.js loaded with YOUR Firebase collections');
    
    // Wait a bit for HTML to initialize first
    setTimeout(() => {
        initializePigSoilCreateListing();
    }, 100);
});

// Initialize PigSoil+ create listing functionality
function initializePigSoilCreateListing() {
    checkAuthState();
    setupIntegratedPhotoUpload();
    setupIntegratedFormValidation();
    setupLocationHandlers();
    setupFirebaseFormSubmission();
    
    // Test Firebase connection
    testFirebaseConnection();
    
    console.log('✅ PigSoil+ Create Listing with YOUR Firebase collections ready!');
}

// Test Firebase connection using your collections
async function testFirebaseConnection() {
    try {
        console.log('🔥 Testing Firebase connection with your collections...');
        
        // Test with your actual product_listings collection
        const testQuery = query(collection(db, COLLECTIONS.PRODUCT_LISTINGS));
        const testSnapshot = await getDocs(testQuery);
        
        console.log('✅ Firebase connection successful! Found', testSnapshot.size, 'product listings');
        showNotification('Firebase connected to your collections!', 'success');
        
        return true;
    } catch (error) {
        console.error('❌ Firebase connection test failed:', error);
        showNotification('Firebase connection failed: ' + error.message, 'error');
        throw error;
    }
}

// Check if user is authenticated and get user data
function checkAuthState() {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            // Redirect to login instead of creating test user
            console.log('No user authenticated, redirecting to login');
            showNotification('Please sign in to create a listing', 'error');
            
            // Disable form to prevent submission
            const submitBtn = document.getElementById('submitBtn');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Sign In Required';
                submitBtn.style.background = '#ccc';
            }
            
            // Redirect to login after a brief delay
            setTimeout(() => {
                window.location.href = '../html/login.html';
            }, 2000);
            
            return;
        }
        
        console.log('User authenticated:', user.uid);
        window.currentUser = user;
        
        try {
            const userData = await getUserData(user.uid);
            window.currentUserData = userData;
            console.log('User data loaded:', userData);
            
            // Check if user is a swine farmer
            if (userData.userType !== 'swine_farmer' && userData.userType !== 'Swine Farmer') {
                showNotification('Only swine farmers can create listings', 'error');
                setTimeout(() => {
                    window.location.href = '../html/marketplace.html';
                }, 2000);
                return;
            }
            
        } catch (error) {
            console.error('Error loading user data:', error);
            showNotification('Error loading user profile. Please try again.', 'error');
            
            // Create minimal user data for authenticated users
            window.currentUserData = {
                userType: 'swine_farmer',
                userName: user.displayName || 'Swine Farmer',
                userEmail: user.email || 'unknown@email.com',
                userPhone: user.phoneNumber || '+639123456789'
            };
        }
    });
}

// Remove the test user creation function since we're using real auth only
// createTestUser function removed - no longer needed with proper auth

// Get user data from your users collection
async function getUserData(uid) {
    try {
        // Try to find user by uid first
        const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, uid));
        
        if (userDoc.exists()) {
            const userData = userDoc.data();
            console.log('User found by UID:', userData);
            return userData;
        }
        
        // If not found by UID, try to find by email
        if (window.currentUser?.email) {
            const usersRef = collection(db, COLLECTIONS.USERS);
            const userQuery = query(usersRef, where('userEmail', '==', window.currentUser.email));
            const userSnapshot = await getDocs(userQuery);
            
            if (!userSnapshot.empty) {
                const userData = userSnapshot.docs[0].data();
                console.log('User found by email:', userData);
                return userData;
            }
        }
        
        // If no user data found, create a default entry for authenticated users
        console.log('No user data found, creating default entry for authenticated user');
        const defaultUserData = {
            userCreatedAt: serverTimestamp(),
            userEmail: window.currentUser.email || 'unknown@email.com',
            userIsActive: true,
            userName: window.currentUser.displayName || 'Swine Farmer',
            userPhone: '+639123456789',
            userPhoneVerified: false,
            userType: 'swine_farmer',
            userUpdatedAt: serverTimestamp()
        };
        
        await setDoc(doc(db, COLLECTIONS.USERS, uid), defaultUserData);
        console.log('Default user data created for authenticated user');
        return defaultUserData;
        
    } catch (error) {
        console.error('Error fetching user data:', error);
        throw error;
    }
}

// Integrated Photo Upload - Works with Enhanced UI
function setupIntegratedPhotoUpload() {
    const photoUploads = document.querySelectorAll('.photo-upload');
    console.log('🖼️ Setting up integrated photo upload for', photoUploads.length, 'areas');
    
    photoUploads.forEach((upload, index) => {
        const input = upload.querySelector('.photo-input');
        const removeBtn = upload.querySelector('.photo-remove');
        
        upload.addEventListener('click', (e) => {
            e.preventDefault();
            if (e.target === removeBtn || e.target.closest('.photo-remove')) {
                return;
            }
            input.click();
        });

        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                handleEnhancedPhotoSelection(file, upload, index, input);
            }
        });

        removeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            removeEnhancedPhoto(upload, index);
        });
    });
}

// Enhanced photo selection that integrates with UI
function handleEnhancedPhotoSelection(file, upload, index, input) {
    console.log('📷 Processing photo with Firebase integration:', file.name);
    
    // Clear any previous errors using HTML's function if available
    if (typeof clearPhotoErrors === 'function') {
        clearPhotoErrors();
    }
    
    // Use HTML's validation if available, otherwise use basic validation
    const isValid = validatePhotoFile ? validatePhotoFile(file) : basicPhotoValidation(file);
    
    if (!isValid.isValid) {
        if (typeof showPhotoError === 'function') {
            showPhotoError(isValid.message);
        } else {
            showNotification(isValid.message, 'error');
        }
        input.value = '';
        return;
    }
    
    // Show loading state
    upload.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
            <div style="font-size: 24px; animation: spin 1s linear infinite;">⏳</div>
            <div style="font-size: 12px; margin-top: 8px; color: #666;">Processing...</div>
        </div>
    `;
    
    const reader = new FileReader();
    
    reader.onload = (e) => {
        try {
            createFirebasePhotoPreview(e.target.result, upload, index, file);
            uploadedPhotos[index] = file; // Store for Firebase upload
            showNotification('Photo ready for upload!', 'success');
            
            // Validate using HTML function if available
            if (typeof validatePhotos === 'function') {
                validatePhotos();
            }
        } catch (error) {
            console.error('Error creating photo preview:', error);
            if (typeof showPhotoError === 'function') {
                showPhotoError('Failed to process image. Please try again.');
            } else {
                showNotification('Failed to process image. Please try again.', 'error');
            }
            resetPhotoUpload(upload, index);
        }
    };
    
    reader.onerror = () => {
        console.error('Error reading file');
        if (typeof showPhotoError === 'function') {
            showPhotoError('Error reading image file. Please try a different file.');
        } else {
            showNotification('Error reading image file', 'error');
        }
        resetPhotoUpload(upload, index);
    };
    
    reader.readAsDataURL(file);
}

// Basic photo validation fallback
function basicPhotoValidation(file) {
    if (!file.type.startsWith('image/')) {
        return {
            isValid: false,
            message: 'Please select a valid image file (JPG, PNG, GIF, WebP)'
        };
    }
    
    if (file.size > 5 * 1024 * 1024) {
        return {
            isValid: false,
            message: 'Image size must be less than 5MB'
        };
    }
    
    return { isValid: true };
}

// Create photo preview for Firebase integration
function createFirebasePhotoPreview(imageSrc, upload, index, file) {
    const img = document.createElement('img');
    img.src = imageSrc;
    img.className = 'photo-preview';
    img.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
    
    const newInput = document.createElement('input');
    newInput.type = 'file';
    newInput.className = 'photo-input';
    newInput.accept = 'image/*';
    newInput.setAttribute('data-index', index);
    newInput.style.display = 'none';
    newInput.uploadFile = file; // Store file for Firebase upload
    
    const newRemoveBtn = document.createElement('button');
    newRemoveBtn.type = 'button';
    newRemoveBtn.className = 'photo-remove';
    newRemoveBtn.innerHTML = '&times;';
    newRemoveBtn.style.cssText = `
        position: absolute; top: 4px; right: 4px; background: #e74c3c;
        color: white; border: none; border-radius: 50%; width: 24px; height: 24px;
        cursor: pointer; font-size: 12px; display: flex; align-items: center; justify-content: center;
        transition: background 0.3s;
    `;
    
    upload.innerHTML = '';
    upload.appendChild(img);
    upload.appendChild(newInput);
    upload.appendChild(newRemoveBtn);
    upload.classList.add('has-image');
    
    // Re-attach event listeners
    newInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            handleEnhancedPhotoSelection(file, upload, index, newInput);
        }
    });
    
    newRemoveBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        removeEnhancedPhoto(upload, index);
    });
    
    upload.addEventListener('click', (e) => {
        e.preventDefault();
        if (e.target !== newRemoveBtn && !e.target.closest('.photo-remove')) {
            newInput.click();
        }
    });
}

// Remove photo (compatible with enhanced UI)
function removeEnhancedPhoto(upload, index) {
    uploadedPhotos[index] = null;
    resetPhotoUpload(upload, index);
    
    // Use HTML validation if available
    if (typeof validatePhotos === 'function') {
        validatePhotos();
    }
    
    showNotification('Photo removed', 'info');
}

// Reset photo upload area
function resetPhotoUpload(upload, index) {
    upload.classList.remove('has-image');
    upload.innerHTML = `
        <span class="photo-upload-icon">+</span>
        <input type="file" class="photo-input" accept="image/*" data-index="${index}">
        <button type="button" class="photo-remove">&times;</button>
    `;
    
    const input = upload.querySelector('.photo-input');
    const removeBtn = upload.querySelector('.photo-remove');
    
    input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            handleEnhancedPhotoSelection(file, upload, index, input);
        }
    });
    
    removeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        removeEnhancedPhoto(upload, index);
    });
    
    upload.addEventListener('click', (e) => {
        e.preventDefault();
        if (e.target !== removeBtn && !e.target.closest('.photo-remove')) {
            input.click();
        }
    });
}

// Integrated Form Validation - Works with Enhanced UI
function setupIntegratedFormValidation() {
    // Don't override HTML validation, just add Firebase-specific validation
    const form = document.getElementById('createListingForm');
    if (form) {
        // Remove any existing Firebase handlers
        form.removeEventListener('submit', handleFormSubmission);
        // Add our Firebase handler
        form.addEventListener('submit', handleFirebaseFormSubmission);
    }
}

// Firebase-specific form submission
function handleFirebaseFormSubmission(e) {
    e.preventDefault();
    
    if (isFormSubmitting) {
        return;
    }
    
    console.log('🚀 Firebase form submission started');
    
    // Use HTML validation functions if available
    const isValidTitle = typeof validateProductTitle === 'function' ? validateProductTitle() : true;
    const isValidQuantity = typeof validateQuantity === 'function' ? validateQuantity() : true;
    const isValidPrice = typeof validatePrice === 'function' ? validatePrice() : true;
    const isValidDescription = typeof validateDescription === 'function' ? validateDescription() : true;
    const isValidPhotos = typeof validatePhotos === 'function' ? validatePhotos() : checkPhotosBasic();
    
    if (!isValidTitle || !isValidQuantity || !isValidPrice || !isValidPhotos) {
        showNotification('Please fix all errors before submitting', 'error');
        
        // Scroll to first error if HTML function is available
        const firstError = document.querySelector('.form-input.error, .photo-upload-grid.error');
        if (firstError) {
            firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
    }
    
    isFormSubmitting = true;
    
    // Use HTML loading overlay if available
    if (typeof showLoadingOverlay === 'function') {
        showLoadingOverlay('Preparing your swine compost listing...');
    }
    
    const formData = collectFirebaseFormData();
    submitListingToFirebase(formData);
}

// Basic photo check fallback
function checkPhotosBasic() {
    const hasPhotos = uploadedPhotos.some(photo => photo !== null && photo !== undefined);
    if (!hasPhotos) {
        showNotification('Please upload at least one product photo', 'error');
        return false;
    }
    return true;
}

// Collect form data for Firebase using your schema
function collectFirebaseFormData() {
    const title = document.getElementById('productTitle')?.value.trim() || 'Premium Swine Compost';
    const quantity = document.getElementById('quantity')?.value || '100';
    const price = document.getElementById('price')?.value || '15';
    const description = document.getElementById('description')?.value.trim() || 'High quality organic compost made from swine manure using traditional composting methods. Rich in nutrients and perfect for organic farming.';
    const technique = document.getElementById('compostTechnique')?.value || 'basic_swine_manure';
    
    const photos = [];
    uploadedPhotos.forEach((file, index) => {
        if (file) {
            photos.push({
                index: index,
                file: file,
                fileName: `swine_compost_${Date.now()}_${index}.${file.name.split('.').pop()}`
            });
        }
    });
    
    return {
        title,
        quantity: parseFloat(quantity),
        price: parseFloat(price),
        description,
        technique,
        photos,
        sellerId: window.currentUser?.uid || 'test-swine-farmer-' + Date.now(),
        sellerName: window.currentUserData?.userName || window.currentUser?.displayName || 'Test Swine Farmer'
    };
}

// Submit listing to Firebase using YOUR EXACT product_listings schema
async function submitListingToFirebase(formData) {
    const submitBtn = document.querySelector('.submit-btn');
    const progressBar = document.getElementById('progressBar');
    const loadingText = document.getElementById('loadingText');
    const progressIndicator = document.getElementById('progressIndicator');
    
    try {
        // Step 1: Upload photos
        updateProgress(loadingText, progressBar, progressIndicator, 'Uploading compost photos...', 25);
        
        console.log('📤 Starting photo upload...');
        const photoUrls = await uploadPhotosToFirebase(formData.photos);
        console.log('✅ Photos uploaded successfully:', photoUrls);
        
        // Step 2: Create listing data using YOUR EXACT schema
        updateProgress(loadingText, progressBar, progressIndicator, 'Creating swine compost listing...', 50);
        
        // Using your exact product_listings schema from Firebase
        const listingData = {
            // These match your Firebase product_listings collection exactly
            listingAddressId: 'default_address', // We'll use a default for now
            listingBatchID: 'batch_' + Date.now(), // Generate a batch ID
            listingCreatedAt: serverTimestamp(),
            listingDescription: formData.description,
            listingIsAvailable: true,
            listingPricePerKG: formData.price.toString(),
            listingProductImages: photoUrls.map(photo => photo.url), // Array of image URLs
            listingProductName: formData.title,
            listingQuantityKG: formData.quantity.toString(),
            listingSellerID: formData.sellerId,
            listingTotalPrice: formData.quantity * formData.price,
            listingUpdatedAt: serverTimestamp()
        };
        
        // Step 3: Save to YOUR product_listings collection
        updateProgress(loadingText, progressBar, progressIndicator, 'Saving to your database...', 75);
        
        console.log('💾 Saving listing to YOUR product_listings collection:', listingData);
        const docRef = await addDoc(collection(db, COLLECTIONS.PRODUCT_LISTINGS), listingData);
        
        // Step 4: Complete
        updateProgress(loadingText, progressBar, progressIndicator, 'Listing created successfully!', 100);
        
        console.log('✅ Swine compost listing created with ID:', docRef.id);
        
        // Hide loading and show success
        setTimeout(() => {
            if (typeof hideLoadingOverlay === 'function') {
                hideLoadingOverlay();
            }
            
            showNotification('Swine compost listing posted successfully!', 'success');
            isFormSubmitting = false;
            
            // Redirect after successful creation
            setTimeout(() => {
                showNotification('Redirecting to marketplace...', 'info');
                window.location.href = 'farmermarket.html';
            }, 2000);
        }, 1000);
        
    } catch (error) {
        console.error('❌ Error creating listing:', error);
        
        if (typeof hideLoadingOverlay === 'function') {
            hideLoadingOverlay();
        }
        
        showNotification('Error creating listing: ' + error.message, 'error');
        isFormSubmitting = false;
        
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Post Swine Compost Listing';
        }
    }
}

// Update progress indicators
function updateProgress(loadingText, progressBar, progressIndicator, message, percent) {
    if (loadingText) loadingText.textContent = message;
    if (progressBar) progressBar.style.width = `${percent}%`;
    if (progressIndicator) progressIndicator.style.display = 'block';
}

// Upload photos to Firebase Storage
async function uploadPhotosToFirebase(photos) {
    const photoUrls = [];
    
    for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        
        try {
            console.log(`📤 Uploading photo ${i + 1}/${photos.length}:`, photo.fileName);
            
            const storageRef = ref(storage, `swine-compost-listings/${photo.fileName}`);
            const snapshot = await uploadBytes(storageRef, photo.file);
            console.log(`✅ Photo ${i + 1} uploaded to Firebase Storage`);
            
            const downloadURL = await getDownloadURL(snapshot.ref);
            
            photoUrls.push({
                url: downloadURL,
                fileName: photo.fileName,
                index: photo.index
            });
            
            console.log(`✅ Photo ${i + 1} URL generated:`, downloadURL);
            
        } catch (error) {
            console.error(`❌ Error uploading photo ${i + 1}:`, error);
            throw new Error(`Failed to upload photo ${i + 1}: ${error.message}`);
        }
    }
    
    return photoUrls;
}

// Location Handlers
function setupLocationHandlers() {
    const changeLocationBtn = document.querySelector('.change-location') || document.getElementById('changeLocationBtn');
    
    if (changeLocationBtn) {
        changeLocationBtn.addEventListener('click', () => {
            openLocationPicker();
        });
    }
}

function openLocationPicker() {
    const locations = [
        { name: 'Ayala Center Cebu', address: 'Cebu Business Park, Cebu City' },
        { name: 'SM City Cebu', address: 'Juan Luna Ave, Cebu City' },
        { name: 'IT Park', address: 'Apas, Cebu City' },
        { name: 'Talamban Area', address: 'Talamban, Cebu City' },
        { name: 'Mandaue City Center', address: 'Mandaue City, Cebu' }
    ];
    
    const modal = createModal('Select Location', `
        <div style="max-height: 300px; overflow-y: auto;">
            ${locations.map((loc, index) => `
                <div onclick="selectLocation(${index})" style="
                    padding: 12px; border: 1px solid #ddd; border-radius: 8px; 
                    margin-bottom: 8px; cursor: pointer; transition: all 0.3s;
                " onmouseover="this.style.backgroundColor='#f0f8e8'" onmouseout="this.style.backgroundColor='white'">
                    <div style="font-weight: 600; color: #333;">${loc.name}</div>
                    <div style="font-size: 12px; color: #666;">${loc.address}</div>
                </div>
            `).join('')}
        </div>
    `);
    
    window.selectLocation = (index) => {
        const location = locations[index];
        updateLocationDisplay(location);
        closeModal();
    };
}

function updateLocationDisplay(location) {
    const locationName = document.querySelector('.location-name');
    const locationAddress = document.querySelector('.location-address');
    
    if (locationName) locationName.textContent = location.name;
    if (locationAddress) locationAddress.textContent = location.address;
}

// Utility Functions
function createModal(title, content) {
    const existingModal = document.querySelector('.modal-overlay');
    if (existingModal) {
        existingModal.remove();
    }
    
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'modal-overlay';
    modalOverlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.5);
        display: flex; align-items: center; justify-content: center; z-index: 1000; backdrop-filter: blur(5px);
    `;
    
    const modal = document.createElement('div');
    modal.style.cssText = `
        background: white; border-radius: 20px; padding: 30px; max-width: 600px; width: 90%;
        max-height: 80vh; overflow-y: auto; position: relative;
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
    
    modalOverlay.addEventListener('click', function(e) {
        if (e.target === modalOverlay) {
            closeModal();
        }
    });
    
    return modal;
}

function closeModal() {
    const modal = document.querySelector('.modal-overlay');
    if (modal) {
        modal.remove();
    }
}

function showNotification(message, type = 'info') {
    // Try to use HTML's enhanced notification if available
    if (window.showNotification && typeof window.showNotification === 'function') {
        window.showNotification(message, type);
        return;
    }
    
    // Fallback to basic notification
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    const colors = {
        success: '#4CAF50',
        error: '#e74c3c',
        info: '#2196F3',
        warning: '#ff9800'
    };
    
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.style.cssText = `
        position: fixed; top: 20px; right: 20px; background: ${colors[type]}; color: white;
        padding: 15px 25px; border-radius: 10px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        z-index: 1001; font-weight: 600; max-width: 300px; transform: translateX(100%);
        transition: transform 0.3s ease;
    `;
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 300);
    }, 4000);
}

// Global functions
window.closeModal = closeModal;

console.log('🐷 PigSoil+ CreateListing.js using YOUR Firebase collections fully loaded and ready!');