// js/CreateListing.js - Updated for your folder structure
import { auth, db, storage } from './init.js';
import { 
    createCompostListing,
    COLLECTIONS
} from '../js/firebase-collections.js';
import { 
    collection, 
    addDoc, 
    serverTimestamp, 
    query, 
    where, 
    getDocs 
} from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js';
import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-storage.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js';

document.addEventListener('DOMContentLoaded', function() {
    console.log('PigSoil+ CreateListing.js loaded');
    checkAuthState();
    initializeCreateListing();
});

// Check if user is authenticated and get user data
function checkAuthState() {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            // For testing, create a test user
            console.log('No user authenticated, using test user');
            window.currentUser = { 
                uid: 'test-swine-farmer-' + Date.now(), 
                displayName: 'Test Swine Farmer', 
                email: 'test@pigsoil.com' 
            };
            window.currentUserData = {
                userType: 'swine_farmer',
                farmName: 'Test Swine Farm',
                farmerId: window.currentUser.uid
            };
        } else {
            console.log('User authenticated:', user.uid);
            window.currentUser = user;
            
            // Get user data from Firestore
            try {
                const userData = await getUserData(user.uid);
                window.currentUserData = userData;
                console.log('User data loaded:', userData);
            } catch (error) {
                console.error('Error loading user data:', error);
                // Use fallback data
                window.currentUserData = {
                    userType: 'swine_farmer',
                    farmName: `${user.displayName || 'Unknown'}'s Farm`,
                    farmerId: user.uid
                };
            }
        }
    });
}

// Get user data from Firestore
async function getUserData(uid) {
    try {
        // First check users collection
        const usersRef = collection(db, COLLECTIONS.USERS);
        const userQuery = query(usersRef, where('uid', '==', uid));
        const userSnapshot = await getDocs(userQuery);
        
        if (!userSnapshot.empty) {
            const userData = userSnapshot.docs[0].data();
            
            // If swine farmer, get farmer-specific data
            if (userData.userType === 'swine_farmer') {
                const farmersRef = collection(db, COLLECTIONS.SWINE_FARMERS);
                const farmerQuery = query(farmersRef, where('userId', '==', uid));
                const farmerSnapshot = await getDocs(farmerQuery);
                
                if (!farmerSnapshot.empty) {
                    const farmerData = farmerSnapshot.docs[0].data();
                    return { ...userData, ...farmerData };
                }
            }
            
            return userData;
        }
        
        throw new Error('User data not found');
    } catch (error) {
        console.error('Error fetching user data:', error);
        throw error;
    }
}

function initializeCreateListing() {
    setupPhotoUpload();
    setupFormValidation();
    setupLocationHandlers();
    setupFormSubmission();
    console.log('PigSoil+ Create Listing initialized successfully!');
}

// Photo Upload Functionality
function setupPhotoUpload() {
    const photoUploads = document.querySelectorAll('.photo-upload');
    
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
                handlePhotoSelection(file, upload, index);
            }
        });

        removeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            removePhotoFromUpload(upload, index);
        });
    });
}

function handlePhotoSelection(file, upload, index) {
    if (!file.type.startsWith('image/')) {
        showNotification('Please select a valid image file (JPG, PNG, GIF)', 'error');
        return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
        showNotification('Image size should be less than 5MB', 'error');
        return;
    }
    
    upload.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;">
            <div style="font-size: 20px;">⏳</div>
            <div style="font-size: 12px; margin-top: 8px;">Loading...</div>
        </div>
    `;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = document.createElement('img');
        img.src = e.target.result;
        img.classList.add('photo-preview');
        img.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
        
        const newInput = document.createElement('input');
        newInput.type = 'file';
        newInput.className = 'photo-input';
        newInput.accept = 'image/*';
        newInput.setAttribute('data-index', index);
        newInput.style.display = 'none';
        
        const newRemoveBtn = document.createElement('button');
        newRemoveBtn.type = 'button';
        newRemoveBtn.className = 'photo-remove';
        newRemoveBtn.innerHTML = '&times;';
        newRemoveBtn.style.cssText = `
            position: absolute; top: 4px; right: 4px; background: #e74c3c;
            color: white; border: none; border-radius: 50%; width: 24px; height: 24px;
            cursor: pointer; font-size: 12px; display: flex; align-items: center; justify-content: center;
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
                handlePhotoSelection(file, upload, index);
            }
        });
        
        newRemoveBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            removePhotoFromUpload(upload, index);
        });
        
        upload.addEventListener('click', (e) => {
            e.preventDefault();
            if (e.target !== newRemoveBtn && !e.target.closest('.photo-remove')) {
                newInput.click();
            }
        });
        
        showNotification('Photo uploaded successfully!', 'success');
    };
    
    reader.onerror = () => {
        showNotification('Error reading image file', 'error');
        removePhotoFromUpload(upload, index);
    };
    
    reader.readAsDataURL(file);
}

function removePhotoFromUpload(upload, index) {
    upload.classList.remove('has-image');
    upload.innerHTML = `
        <span class="photo-upload-icon" style="font-size: 32px; color: #ccc;">+</span>
        <input type="file" class="photo-input" accept="image/*" data-index="${index}" style="display: none;">
        <button type="button" class="photo-remove" style="display: none;">&times;</button>
    `;
    
    const input = upload.querySelector('.photo-input');
    const removeBtn = upload.querySelector('.photo-remove');
    
    input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            handlePhotoSelection(file, upload, index);
        }
    });
    
    removeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        removePhotoFromUpload(upload, index);
    });
    
    upload.addEventListener('click', (e) => {
        e.preventDefault();
        if (e.target !== removeBtn && !e.target.closest('.photo-remove')) {
            input.click();
        }
    });
    
    showNotification('Photo removed', 'info');
}

// Form Validation
function setupFormValidation() {
    const productTitle = document.getElementById('productTitle');
    const quantity = document.getElementById('quantity');
    const price = document.getElementById('price');
    const description = document.getElementById('description');
    
    if (productTitle) productTitle.addEventListener('input', validateProductTitle);
    if (quantity) quantity.addEventListener('input', validateQuantity);
    if (price) price.addEventListener('input', validatePrice);
    if (description) description.addEventListener('input', validateDescription);
}

function validateProductTitle() {
    const productTitle = document.getElementById('productTitle');
    if (!productTitle) return true;
    
    const value = productTitle.value.trim();
    
    if (value.length < 3) {
        setFieldError(productTitle, 'Product title must be at least 3 characters');
        return false;
    }
    
    if (value.length > 100) {
        setFieldError(productTitle, 'Product title must be less than 100 characters');
        return false;
    }
    
    clearFieldError(productTitle);
    return true;
}

function validateQuantity() {
    const quantity = document.getElementById('quantity');
    if (!quantity) return true;
    
    const value = parseFloat(quantity.value);
    
    if (!value || value <= 0) {
        setFieldError(quantity, 'Quantity must be greater than 0');
        return false;
    }
    
    if (value > 10000) {
        setFieldError(quantity, 'Quantity seems too large. Please verify.');
        return false;
    }
    
    clearFieldError(quantity);
    return true;
}

function validatePrice() {
    const price = document.getElementById('price');
    if (!price) return true;
    
    const value = parseFloat(price.value);
    
    if (!value || value <= 0) {
        setFieldError(price, 'Price must be greater than 0');
        return false;
    }
    
    if (value > 5000) {
        setFieldError(price, 'Price seems too high. Please verify.');
        return false;
    }
    
    clearFieldError(price);
    return true;
}

function validateDescription() {
    const description = document.getElementById('description');
    if (!description) return true;
    
    const value = description.value.trim();
    
    if (value.length > 500) {
        setFieldError(description, 'Description must be less than 500 characters');
        description.value = value.substring(0, 500);
        return false;
    }
    
    clearFieldError(description);
    return true;
}

function setFieldError(field, message) {
    field.style.borderColor = '#e74c3c';
    
    const existingError = field.parentNode.querySelector('.error-message');
    if (existingError) {
        existingError.remove();
    }
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.style.cssText = 'color: #e74c3c; font-size: 12px; margin-top: 4px;';
    errorDiv.textContent = message;
    field.parentNode.appendChild(errorDiv);
}

function clearFieldError(field) {
    field.style.borderColor = '#e0e0e0';
    
    const existingError = field.parentNode.querySelector('.error-message');
    if (existingError) {
        existingError.remove();
    }
}

// Location Handlers
function setupLocationHandlers() {
    const changeLocationBtn = document.querySelector('.change-location');
    
    if (changeLocationBtn) {
        changeLocationBtn.addEventListener('click', () => {
            openLocationPicker();
        });
    }
}

function openLocationPicker() {
    // Simple location picker for now
    const locations = [
        { name: 'Ayala Center Cebu', address: 'Cebu Business Park, Cebu City', lat: 10.3157, lng: 123.9054 },
        { name: 'SM City Cebu', address: 'Juan Luna Ave, Cebu City', lat: 10.3181, lng: 123.9044 },
        { name: 'IT Park', address: 'Apas, Cebu City', lat: 10.3272, lng: 123.9069 },
        { name: 'Colon Street', address: 'Downtown, Cebu City', lat: 10.2966, lng: 123.9018 }
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
        window.selectedLocationData = locations[index];
        updateLocationDisplay(locations[index]);
        closeModal();
    };
}

function updateLocationDisplay(location) {
    const locationName = document.querySelector('.location-name');
    const locationAddress = document.querySelector('.location-address');
    
    if (locationName) locationName.textContent = location.name;
    if (locationAddress) locationAddress.textContent = location.address;
}

// Form Submission
function setupFormSubmission() {
    const form = document.getElementById('createListingForm');
    
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            handleFormSubmission();
        });
    }
}

function handleFormSubmission() {
    console.log('Form submission started');
    
    const isValidTitle = validateProductTitle();
    const isValidQuantity = validateQuantity();
    const isValidPrice = validatePrice();
    const isValidDescription = validateDescription();
    
    if (!isValidTitle || !isValidQuantity || !isValidPrice) {
        showNotification('Please fix the errors before submitting', 'error');
        return;
    }
    
    const photoInputs = document.querySelectorAll('.photo-input');
    const hasPhotos = Array.from(photoInputs).some(input => input.files.length > 0);
    
    if (!hasPhotos) {
        showNotification('Please upload at least one product photo', 'error');
        return;
    }
    
    const formData = collectFormData();
    submitListing(formData);
}

function collectFormData() {
    const title = document.getElementById('productTitle')?.value.trim() || 'Premium Swine Compost';
    const quantity = document.getElementById('quantity')?.value || '100';
    const price = document.getElementById('price')?.value || '15';
    const description = document.getElementById('description')?.value.trim() || 'High quality organic compost made from swine manure using traditional composting methods. Rich in nutrients and perfect for organic farming.';
    
    // Default location if none selected
    let locationData;
    if (window.selectedLocationData) {
        locationData = window.selectedLocationData;
    } else {
        locationData = {
            name: 'Ayala Center Cebu',
            address: 'Cebu Business Park, Cebu City',
            lat: 10.3157,
            lng: 123.9054
        };
    }
    
    const photos = [];
    const photoInputs = document.querySelectorAll('.photo-input');
    photoInputs.forEach((input, index) => {
        if (input.files[0]) {
            photos.push({
                index: index,
                file: input.files[0],
                fileName: `compost_listing_${Date.now()}_${index}.${input.files[0].name.split('.').pop()}`
            });
        }
    });
    
    return {
        title,
        quantity: parseFloat(quantity),
        price: parseFloat(price),
        description,
        location: {
            name: locationData.name,
            address: locationData.address,
            coordinates: {
                latitude: locationData.lat,
                longitude: locationData.lng
            },
            barangay: 'Cebu Business Park',
            municipality: 'Cebu City',
            province: 'Cebu',
            region: 'Central Visayas'
        },
        photos,
        sellerId: window.currentUser?.uid || 'anonymous',
        sellerName: window.currentUserData?.displayName || window.currentUser?.displayName || 'Anonymous Swine Farmer',
        farmName: window.currentUserData?.farmName || `${window.currentUser?.displayName || 'Unknown'}'s Farm`,
        compostTechnique: 'basic_swine_manure', // Default technique
        availability: 'available',
        views: 0,
        inquiries: 0
    };
}

async function submitListing(formData) {
    const submitBtn = document.querySelector('.submit-btn');
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Uploading photos...';
    submitBtn.style.background = '#ccc';
    
    try {
        console.log('Starting photo upload...');
        const photoUrls = await uploadPhotos(formData.photos);
        console.log('Photos uploaded successfully:', photoUrls);
        
        submitBtn.textContent = 'Creating listing...';
        
        // Create listing data following your project structure
        const listingData = {
            // Seller information
            sellerId: formData.sellerId,
            sellerName: formData.sellerName,
            farmName: formData.farmName,
            
            // Product information
            title: formData.title,
            description: formData.description,
            compostTechnique: formData.compostTechnique,
            quantity: formData.quantity,
            pricePerKg: formData.price,
            totalPrice: formData.quantity * formData.price,
            
            // Location information
            location: formData.location,
            
            // Media
            images: photoUrls.map(photo => photo.url),
            
            // Status and metadata
            availability: formData.availability,
            isOrganic: true,
            harvestDate: new Date(),
            expiryDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
            
            // Nutrients (estimated based on basic swine manure composting)
            nutrients: {
                nitrogen: 2.0,
                phosphorus: 1.5,
                potassium: 1.8,
                organicMatter: 40
            },
            
            // Analytics
            views: formData.views,
            inquiries: formData.inquiries,
            
            // Tags for searching
            tags: ['swine_compost', 'organic', 'basic_composting', 'ready_to_use'],
            
            // Timestamps
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };
        
        console.log('Saving listing to Firestore:', listingData);
        
        // Save to compostListings collection using the function from firebase-collections.js
        const docRef = await createCompostListing(listingData);
        
        console.log('Listing created with ID:', docRef.id);
        
        showNotification('Listing posted successfully!', 'success');
        
        submitBtn.disabled = false;
        submitBtn.textContent = 'Post Listing';
        submitBtn.style.background = '#4CAF50';
        
        // Redirect after successful creation
        setTimeout(() => {
            window.location.href = 'farmermarket.html';
        }, 2000);
        
    } catch (error) {
        console.error('Error creating listing:', error);
        
        showNotification('Error creating listing: ' + error.message, 'error');
        
        submitBtn.disabled = false;
        submitBtn.textContent = 'Post Listing';
        submitBtn.style.background = '#4CAF50';
    }
}

async function uploadPhotos(photos) {
    const photoUrls = [];
    
    for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        
        try {
            console.log(`Uploading photo ${i + 1}/${photos.length}:`, photo.fileName);
            
            const storageRef = ref(storage, `compost-listings/${photo.fileName}`);
            const snapshot = await uploadBytes(storageRef, photo.file);
            console.log(`Photo ${i + 1} uploaded to storage`);
            
            const downloadURL = await getDownloadURL(snapshot.ref);
            
            photoUrls.push({
                url: downloadURL,
                fileName: photo.fileName,
                index: photo.index
            });
            
            console.log(`Photo ${i + 1} uploaded successfully:`, downloadURL);
            
        } catch (error) {
            console.error(`Error uploading photo ${i + 1}:`, error);
            throw new Error(`Failed to upload photo ${i + 1}: ${error.message}`);
        }
    }
    
    return photoUrls;
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
        z-index: 1001; font-weight: 600; max-width: 300px;
    `;
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 4000);
}

// Global functions
window.closeModal = closeModal;