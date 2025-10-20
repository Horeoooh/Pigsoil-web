// js/CreateListing.js - Updated with Google Maps integration
import { auth, db, storage } from '../js/init.js';
import '../js/shared-user-manager.js';
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

// ===== USER TYPE CHECK - REDIRECT FERTILIZER BUYERS =====
function checkUserTypeAndRedirect() {
    try {
        const cachedUserData = localStorage.getItem('pigsoil_user_data');
        if (cachedUserData) {
            const userData = JSON.parse(cachedUserData);
            const userType = userData.userType;
            
            // Redirect fertilizer buyers to buyer dashboard
            if (userType === 'fertilizer_buyer' || userType === 'Organic Fertilizer Buyer') {
                console.log('🚫 Fertilizer buyer detected on farmer page, redirecting to buyer dashboard...');
                window.location.href = '/buyer-dashboard.html';
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
let selectedTechnique = 'basic_swine_manure';
let currentUser = null;
let currentUserData = null;

// Google Maps variables
let map;
let marker;
let selectedLocation = {
    lat: 10.3157,  // Default to Cebu City
    lng: 123.8854,
    name: 'Select farm location',
    address: 'Click "Change" to choose pickup location',
    formattedAddress: 'Cebu City, Philippines'
};
let geocoder;
let placesService;
let autocomplete;

// Initialize Google Maps
window.initMap = function() {
    console.log('🗺️ Google Maps API loaded');
    geocoder = new google.maps.Geocoder();
    
    // Initialize map in modal (will be created when modal opens)
    setupLocationModal();
};

document.addEventListener('DOMContentLoaded', function() {
    console.log('🐷 PigSoil+ CreateListing.js loaded with Google Maps integration');
    
    // Load cached profile immediately
    loadUserProfileFromCache();
    
    // Wait a bit for HTML to initialize first
    setTimeout(() => {
        initializePigSoilCreateListing();
    }, 100);
});

// Load user profile from cache immediately for faster UI
function loadUserProfileFromCache() {
    const userData = getCurrentUserData() || getCachedUserData();
    const user = getCurrentUser();
    
    if (!userData && !user) {
        console.log('⏳ No cached user data available yet');
        return;
    }
    
    updateUserProfileUI(userData, user);
}

// Update user profile UI elements
function updateUserProfileUI(userData, user) {
    const userName = userData?.userName || user?.displayName || 'User';
    const userType = userData?.userType || 'swine_farmer';
    
    // Get profile picture with proper fallback chain
    let profilePicUrl = userData?.userProfilePictureUrl || user?.photoURL || getCachedProfilePic();
    
    // If still no profile pic or it's the default, use the DEFAULT_PROFILE_PIC
    if (!profilePicUrl || profilePicUrl === DEFAULT_PROFILE_PIC) {
        profilePicUrl = DEFAULT_PROFILE_PIC;
    }
    
    // Determine user role display
    let roleDisplay = 'Swine Farmer'; // Default
    if (userType === 'swine_farmer' || userType === 'Swine Farmer') {
        roleDisplay = 'Swine Farmer';
    } else if (userType === 'fertilizer_buyer' || userType === 'Organic Fertilizer Buyer') {
        roleDisplay = 'Organic Fertilizer Buyer';
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
    
    console.log('👤 User profile loaded on CreateListing:', { 
        userName, 
        roleDisplay, 
        profilePicUrl, 
        usingDefault: profilePicUrl === DEFAULT_PROFILE_PIC 
    });
}

// Initialize PigSoil+ create listing functionality
function initializePigSoilCreateListing() {
    checkAuthState();
    setupIntegratedPhotoUpload();
    setupIntegratedFormValidation();
    setupCharacterCounters();
    setupLocationHandlers();
    setupFirebaseFormSubmission();
    setupCompostTechnique();
    setupUserDataListener();
    
    // Test Firebase connection
    testFirebaseConnection();
    
    console.log('✅ PigSoil+ Create Listing with Google Maps ready!');
}

// Setup listener for user data changes
function setupUserDataListener() {
    onUserDataChange((userInfo) => {
        const { user, userData } = userInfo;
        if (user && userData) {
            console.log('CreateListing: User data updated', userData);
            updateUserProfileUI(userData, user);
        }
    });
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
            console.log('No user authenticated, redirecting to login');
            showNotification('Please sign in to create a listing', 'error');
            
            const submitBtn = document.getElementById('submitBtn');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Sign In Required';
                submitBtn.style.background = '#ccc';
            }
            
            setTimeout(() => {
                window.location.href = '/login.html';
            }, 2000);
            
            return;
        }
        
        console.log('User authenticated:', user.uid);
        currentUser = user;
        
        try {
            currentUserData = await getUserData(user.uid);
            console.log('User data loaded:', currentUserData);
            
            if (currentUserData.userType !== 'swine_farmer' && currentUserData.userType !== 'Swine Farmer') {
                showNotification('Only swine farmers can create listings', 'error');
                setTimeout(() => {
                    window.location.href = '/marketplace.html';
                }, 2000);
                return;
            }
            
        } catch (error) {
            console.error('Error loading user data:', error);
            showNotification('Error loading user profile. Please try again.', 'error');
            
            currentUserData = {
                userType: 'swine_farmer',
                userName: user.displayName || 'Swine Farmer',
                userEmail: user.email || 'unknown@email.com',
                userPhone: user.phoneNumber || '+639123456789'
            };
        }
    });
}

// Get user data from your users collection
async function getUserData(uid) {
    try {
        const userDoc = await getDoc(doc(db, COLLECTIONS.USERS, uid));
        
        if (userDoc.exists()) {
            const userData = userDoc.data();
            console.log('User found by UID:', userData);
            return userData;
        }
        
        if (currentUser?.email) {
            const usersRef = collection(db, COLLECTIONS.USERS);
            const userQuery = query(usersRef, where('userEmail', '==', currentUser.email));
            const userSnapshot = await getDocs(userQuery);
            
            if (!userSnapshot.empty) {
                const userData = userSnapshot.docs[0].data();
                console.log('User found by email:', userData);
                return userData;
            }
        }
        
        console.log('No user data found, creating default entry for authenticated user');
        const defaultUserData = {
            userCreatedAt: serverTimestamp(),
            userEmail: currentUser.email || 'unknown@email.com',
            userIsActive: true,
            userName: currentUser.displayName || 'Swine Farmer',
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

// Setup composting technique selection
function setupCompostTechnique() {
    const techniqueOptions = document.querySelectorAll('.technique-option');
    const hiddenInput = document.getElementById('compostTechnique');
    
    techniqueOptions.forEach(option => {
        option.addEventListener('click', function() {
            techniqueOptions.forEach(opt => opt.classList.remove('selected'));
            this.classList.add('selected');
            selectedTechnique = this.getAttribute('data-technique');
            hiddenInput.value = selectedTechnique;
        });
    });
}

// Google Maps Location Functionality
function setupLocationHandlers() {
    const changeLocationBtn = document.getElementById('changeLocationBtn');
    const locationModal = document.getElementById('locationModal');
    const modalClose = document.getElementById('modalClose');
    const cancelLocation = document.getElementById('cancelLocation');
    const confirmLocation = document.getElementById('confirmLocation');
    
    if (changeLocationBtn) {
        changeLocationBtn.addEventListener('click', () => {
            openLocationPicker();
        });
    }
    
    if (modalClose) {
        modalClose.addEventListener('click', closeLocationPicker);
    }
    
    if (cancelLocation) {
        cancelLocation.addEventListener('click', closeLocationPicker);
    }
    
    if (confirmLocation) {
        confirmLocation.addEventListener('click', confirmLocationSelection);
    }
    
    // Close modal when clicking overlay
    if (locationModal) {
        locationModal.addEventListener('click', function(e) {
            if (e.target === locationModal) {
                closeLocationPicker();
            }
        });
    }
}

function setupLocationModal() {
    console.log('🗺️ Setting up location modal functionality');
}

function openLocationPicker() {
    console.log('📍 Opening location picker with Google Maps');
    
    const locationModal = document.getElementById('locationModal');
    if (locationModal) {
        locationModal.classList.add('show');
        
        // Initialize map when modal opens
        setTimeout(() => {
            initializeMap();
        }, 300);
    }
}

function closeLocationPicker() {
    console.log('📍 Closing location picker');
    
    const locationModal = document.getElementById('locationModal');
    if (locationModal) {
        locationModal.classList.remove('show');
    }
}

function initializeMap() {
    console.log('🗺️ Initializing Google Maps in modal');
    
    const mapContainer = document.getElementById('mapContainer');
    const locationSearch = document.getElementById('locationSearch');
    
    if (!mapContainer) {
        console.error('Map container not found');
        return;
    }
    
    // Initialize map centered on Cebu
    map = new google.maps.Map(mapContainer, {
        center: selectedLocation,
        zoom: 13,
        mapTypeId: 'roadmap',
        styles: [
            {
                featureType: 'all',
                stylers: [{ saturation: -10 }]
            }
        ]
    });
    
    // Initialize marker
    marker = new google.maps.Marker({
        position: selectedLocation,
        map: map,
        draggable: true,
        title: 'Your swine farm location'
    });
    
    // Set up places autocomplete for search
    if (locationSearch) {
        autocomplete = new google.maps.places.Autocomplete(locationSearch, {
            bounds: new google.maps.LatLngBounds(
                new google.maps.LatLng(9.5, 123.0),  // Southwest bounds (Southern Cebu)
                new google.maps.LatLng(11.5, 125.0)  // Northeast bounds (Northern Cebu)
            ),
            strictBounds: true,
            componentRestrictions: { country: 'PH' }
        });
        
        autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace();
            
            if (place.geometry) {
                const location = {
                    lat: place.geometry.location.lat(),
                    lng: place.geometry.location.lng()
                };
                
                updateMapLocation(location, place);
            }
        });
    }
    
    // Handle marker drag
    marker.addListener('dragend', (event) => {
        const location = {
            lat: event.latLng.lat(),
            lng: event.latLng.lng()
        };
        
        reverseGeocode(location);
    });
    
    // Handle map click
    map.addListener('click', (event) => {
        const location = {
            lat: event.latLng.lat(),
            lng: event.latLng.lng()
        };
        
        marker.setPosition(location);
        reverseGeocode(location);
    });
    
    console.log('✅ Google Maps initialized successfully');
}

function updateMapLocation(location, place = null) {
    selectedLocation.lat = location.lat;
    selectedLocation.lng = location.lng;
    
    if (place && place.formatted_address) {
        selectedLocation.formattedAddress = place.formatted_address;
        selectedLocation.name = place.name || 'Selected Location';
        selectedLocation.address = place.formatted_address;
    }
    
    // Update map and marker
    if (map && marker) {
        map.setCenter(location);
        marker.setPosition(location);
    }
    
    console.log('📍 Location updated:', selectedLocation);
}

function reverseGeocode(location) {
    if (!geocoder) {
        console.error('Geocoder not initialized');
        return;
    }
    
    geocoder.geocode({ location: location }, (results, status) => {
        if (status === 'OK' && results[0]) {
            const result = results[0];
            
            selectedLocation.lat = location.lat;
            selectedLocation.lng = location.lng;
            selectedLocation.formattedAddress = result.formatted_address;
            selectedLocation.name = extractLocationName(result);
            selectedLocation.address = result.formatted_address;
            
            console.log('📍 Reverse geocoded location:', selectedLocation);
        } else {
            console.error('Reverse geocoding failed:', status);
        }
    });
}

function extractLocationName(result) {
    // Try to get a meaningful name from the geocoding result
    for (let component of result.address_components) {
        if (component.types.includes('establishment') || 
            component.types.includes('point_of_interest')) {
            return component.long_name;
        }
    }
    
    // Fallback to locality or political area
    for (let component of result.address_components) {
        if (component.types.includes('locality') || 
            component.types.includes('administrative_area_level_3')) {
            return component.long_name + ' Area';
        }
    }
    
    return 'Farm Location';
}

function confirmLocationSelection() {
    console.log('✅ Confirming location selection:', selectedLocation);
    
    // Update the display
    updateLocationDisplay();
    
    // Update static map preview
    updateStaticMapPreview();
    
    // Close modal
    closeLocationPicker();
    
    showNotification('Farm location updated successfully!', 'success');
}

function updateLocationDisplay() {
    const locationName = document.getElementById('selectedLocationName');
    const locationAddress = document.getElementById('selectedLocationAddress');
    const locationContainer = document.getElementById('locationContainer');
    
    if (locationName) {
        locationName.textContent = selectedLocation.name;
    }
    
    if (locationAddress) {
        locationAddress.textContent = selectedLocation.address;
    }
    
    if (locationContainer) {
        locationContainer.classList.add('active');
        setTimeout(() => {
            locationContainer.classList.remove('active');
        }, 1000);
    }
}

function updateStaticMapPreview() {
    const staticMapContainer = document.getElementById('staticMap');
    
    if (staticMapContainer && selectedLocation.lat && selectedLocation.lng) {
        const staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?` +
            `center=${selectedLocation.lat},${selectedLocation.lng}` +
            `&zoom=15` +
            `&size=400x200` +
            `&markers=color:red%7C${selectedLocation.lat},${selectedLocation.lng}` +
            `&key=AIzaSyDxldiepJaqTaCW9kxCr-3cYgSlVD0fQYg` +
            `&style=saturation:-10`;
        
        staticMapContainer.innerHTML = `
            <img src="${staticMapUrl}" 
                 style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;" 
                 alt="Selected farm location">
        `;
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
    
    clearPhotoErrors();
    
    const isValid = validatePhotoFile(file);
    
    if (!isValid.isValid) {
        showNotification(isValid.message, 'error');
        input.value = '';
        return;
    }
    
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
            uploadedPhotos[index] = file;
            showNotification('Photo ready for upload!', 'success');
            validatePhotos();
        } catch (error) {
            console.error('Error creating photo preview:', error);
            showNotification('Failed to process image. Please try again.', 'error');
            resetPhotoUpload(upload, index);
        }
    };
    
    reader.onerror = () => {
        console.error('Error reading file');
        showNotification('Error reading image file', 'error');
        resetPhotoUpload(upload, index);
    };
    
    reader.readAsDataURL(file);
}

// Basic photo validation
function validatePhotoFile(file) {
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
    newInput.uploadFile = file;
    
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
    validatePhotos();
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
    const fields = [
        { id: 'productTitle', validator: validateProductTitle },
        { id: 'quantity', validator: validateQuantity },
        { id: 'price', validator: validatePrice },
        { id: 'description', validator: validateDescription }
    ];
    
    fields.forEach(field => {
        const element = document.getElementById(field.id);
        if (element) {
            element.addEventListener('input', field.validator);
            element.addEventListener('blur', field.validator);
        }
    });
}

// Firebase-specific form submission
function setupFirebaseFormSubmission() {
    const form = document.getElementById('createListingForm');
    if (form) {
        form.addEventListener('submit', handleFirebaseFormSubmission);
    }
}

function handleFirebaseFormSubmission(e) {
    e.preventDefault();
    
    if (isFormSubmitting) {
        return;
    }
    
    console.log('🚀 Firebase form submission started');
    
    const isValidTitle = validateProductTitle();
    const isValidQuantity = validateQuantity();
    const isValidPrice = validatePrice();
    const isValidDescription = validateDescription();
    const isValidPhotos = validatePhotos();
    const isValidLocation = validateLocation();
    
    if (!isValidTitle || !isValidQuantity || !isValidPrice || !isValidPhotos || !isValidLocation) {
        showNotification('Please fix all errors before submitting', 'error');
        
        const firstError = document.querySelector('.form-input.error, .photo-upload-grid.error');
        if (firstError) {
            firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
    }
    
    isFormSubmitting = true;
    showLoadingOverlay('Preparing your swine compost listing...');
    
    const formData = collectFirebaseFormData();
    submitListingToFirebase(formData);
}

// Validate location
function validateLocation() {
    if (!selectedLocation.lat || !selectedLocation.lng) {
        showNotification('Please select a pickup location for your swine compost', 'error');
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
        location: selectedLocation,
        sellerId: currentUser?.uid || 'test-swine-farmer-' + Date.now(),
        sellerName: currentUserData?.userName || currentUser?.displayName || 'Test Swine Farmer'
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
            listingAddressId: 'default_address',
            listingBatchID: 'batch_' + Date.now(),
            listingCreatedAt: serverTimestamp(),
            listingDescription: formData.description,
            listingIsAvailable: true,
            listingPricePerKG: formData.price.toString(),
            listingProductImages: photoUrls.map(photo => photo.url),
            listingProductName: formData.title,
            listingQuantityKG: formData.quantity.toString(),
            listingSellerID: formData.sellerId,
            listingTotalPrice: formData.quantity * formData.price,
            listingUpdatedAt: serverTimestamp(),
            // Add location data
            listingLocation: {
                lat: formData.location.lat,
                lng: formData.location.lng,
                name: formData.location.name,
                address: formData.location.address,
                formattedAddress: formData.location.formattedAddress
            },
            // Add composting technique
            compostTechnique: formData.technique
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
            hideLoadingOverlay();
            showNotification('Swine compost listing posted successfully!', 'success');
            isFormSubmitting = false;
            
            // Redirect after successful creation
            setTimeout(() => {
                showNotification('Redirecting to marketplace...', 'info');
                window.location.href = '/farmermarket.html';
            }, 2000);
        }, 1000);
        
    } catch (error) {
        console.error('❌ Error creating listing:', error);
        
        hideLoadingOverlay();
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

// Form validation functions
function validateProductTitle() {
    const field = document.getElementById('productTitle');
    const value = field.value.trim();
    
    if (value.length === 0) {
        setFieldError(field, 'Product title is required');
        return false;
    }
    
    if (value.length < 3) {
        setFieldError(field, 'Product title must be at least 3 characters');
        return false;
    }
    
    if (value.length > 100) {
        setFieldError(field, 'Product title must be less than 100 characters');
        return false;
    }
    
    setFieldSuccess(field);
    return true;
}

function validateQuantity() {
    const field = document.getElementById('quantity');
    const value = parseFloat(field.value);
    
    if (!field.value || isNaN(value)) {
        setFieldError(field, 'Quantity is required');
        return false;
    }
    
    if (value <= 0) {
        setFieldError(field, 'Quantity must be greater than 0');
        return false;
    }
    
    if (value > 10000) {
        setFieldError(field, 'Quantity seems too large. Maximum is 10,000 kg');
        return false;
    }
    
    setFieldSuccess(field);
    return true;
}

function validatePrice() {
    const field = document.getElementById('price');
    const value = parseFloat(field.value);
    
    if (!field.value || isNaN(value)) {
        setFieldError(field, 'Price is required');
        return false;
    }
    
    if (value <= 0) {
        setFieldError(field, 'Price must be greater than 0');
        return false;
    }
    
    if (value > 5000) {
        setFieldError(field, 'Price seems too high. Maximum is ₱5,000 per kg');
        return false;
    }
    
    setFieldSuccess(field);
    return true;
}

function validateDescription() {
    const field = document.getElementById('description');
    const value = field.value.trim();
    
    if (value.length > 500) {
        setFieldError(field, 'Description must be less than 500 characters');
        return false;
    }
    
    clearFieldError(field);
    return true;
}

// Validate photos
function validatePhotos() {
    const hasPhotos = uploadedPhotos.some(photo => photo !== null && photo !== undefined);
    
    if (!hasPhotos) {
        showPhotoError('Please upload at least one photo of your swine compost');
        return false;
    }
    
    clearPhotoErrors();
    return true;
}

// Photo error handling
function showPhotoError(message) {
    const photoError = document.getElementById('photoError');
    const photoGrid = document.getElementById('photoUploadGrid');
    
    photoError.textContent = message;
    photoError.style.display = 'flex';
    photoGrid.classList.add('error');
}

function clearPhotoErrors() {
    const photoError = document.getElementById('photoError');
    const photoGrid = document.getElementById('photoUploadGrid');
    
    photoError.style.display = 'none';
    photoGrid.classList.remove('error');
}

function setFieldError(field, message) {
    field.classList.remove('success');
    field.classList.add('error');
    
    const existingMessage = field.parentNode.querySelector('.error-message, .success-message');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    field.parentNode.appendChild(errorDiv);
}

function setFieldSuccess(field) {
    field.classList.remove('error');
    field.classList.add('success');
    clearFieldError(field);
}

function clearFieldError(field) {
    field.classList.remove('error');
    
    const existingMessage = field.parentNode.querySelector('.error-message, .success-message');
    if (existingMessage) {
        existingMessage.remove();
    }
}

// Character counters
function setupCharacterCounters() {
    const description = document.getElementById('description');
    const counter = document.getElementById('descriptionCounter');
    
    if (description && counter) {
        description.addEventListener('input', () => {
            const length = description.value.length;
            counter.textContent = `${length}/500 characters`;
            
            if (length > 450) {
                counter.style.color = '#e74c3c';
            } else if (length > 400) {
                counter.style.color = '#ff9800';
            } else {
                counter.style.color = '#666';
            }
        });
    }
}

// Utility Functions
function showLoadingOverlay(message) {
    const overlay = document.getElementById('loadingOverlay');
    const text = document.getElementById('loadingText');
    const submitBtn = document.getElementById('submitBtn');
    const progressIndicator = document.getElementById('progressIndicator');
    const progressBar = document.getElementById('progressBar');
    
    if (text) text.textContent = message;
    if (overlay) overlay.classList.add('show');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.add('loading');
    }
    if (progressIndicator) progressIndicator.style.display = 'block';
    if (progressBar) progressBar.style.width = '0%';
}

function hideLoadingOverlay() {
    const overlay = document.getElementById('loadingOverlay');
    const submitBtn = document.getElementById('submitBtn');
    
    if (overlay) overlay.classList.remove('show');
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.classList.remove('loading');
    }
    
    isFormSubmitting = false;
}

function showNotification(message, type = 'info') {
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

console.log('🐷 PigSoil+ CreateListing.js with Google Maps integration fully loaded and ready!');