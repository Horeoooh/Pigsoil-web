// Profile Settings JavaScript with Firebase Integration
import { auth, db } from '../js/init.js';
import { 
    onAuthStateChanged,
    signOut,
    updateProfile,
    updateEmail,
    updatePassword
} from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js';
import { 
    doc, 
    getDoc, 
    updateDoc,
    deleteDoc,
    serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js';

// Collection names
const COLLECTIONS = {
    USERS: 'users'
};

// Global variables
let currentUser = null;
let currentUserData = null;

// DOM elements
const usernameInput = document.getElementById('username');
const emailInput = document.getElementById('email');
const phoneInput = document.getElementById('phone');
const userTypeInput = document.getElementById('userType');
const profileForm = document.getElementById('profileForm');
const alertMessage = document.getElementById('alertMessage');
const saveBtn = document.getElementById('saveBtn');
const logoutBtn = document.getElementById('logoutBtn');
const disableBtn = document.getElementById('disableBtn');
const deleteBtn = document.getElementById('deleteBtn');

// Header elements
const headerUserName = document.getElementById('headerUserName');
const headerUserRole = document.getElementById('headerUserRole');
const headerUserAvatar = document.getElementById('headerUserAvatar');

// Profile header elements
const profileAvatar = document.getElementById('profileAvatar');
const profileUserName = document.getElementById('profileUserName');
const profileUserRole = document.getElementById('profileUserRole');

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 Profile Settings page initialized');
    
    // Check authentication state
    checkAuthState();
    
    // Set up event listeners
    setupEventListeners();
});

// Check authentication state and load user data
function checkAuthState() {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            showAlert('Please sign in to access your profile settings.', 'error');
            setTimeout(() => {
                window.location.href = '../html/login.html';
            }, 2000);
            return;
        }
        
        currentUser = user;
        console.log('👤 User authenticated:', user.uid);
        
        try {
            // Load user data from Firestore
            await loadUserData(user.uid);
            
            // Populate form fields
            populateForm();
            
            console.log('✅ Profile data loaded successfully');
        } catch (error) {
            console.error('❌ Error loading profile data:', error);
            showAlert('Error loading profile data: ' + error.message, 'error');
        }
    });
}

// Load user data from Firestore
async function loadUserData(uid) {
    try {
        console.log('📋 Loading user data for:', uid);
        
        const userDocRef = doc(db, COLLECTIONS.USERS, uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
            currentUserData = userDoc.data();
            console.log('✅ User data loaded:', currentUserData);
        } else {
            // If no user data found, create basic data from Firebase Auth
            currentUserData = {
                userEmail: currentUser.email,
                userName: currentUser.displayName || 'User',
                userPhone: currentUser.phoneNumber || '',
                userType: 'swine_farmer',
                userCreatedAt: serverTimestamp(),
                userUpdatedAt: serverTimestamp(),
                userIsActive: true
            };
            
            // Save to Firestore
            await updateDoc(userDocRef, currentUserData);
            console.log('📝 Created default user data');
        }
    } catch (error) {
        console.error('❌ Error loading user data:', error);
        throw error;
    }
}

// Populate form fields with user data
function populateForm() {
    if (!currentUserData) return;
    
    // Populate form inputs
    usernameInput.value = currentUserData.userName || currentUser.displayName || '';
    emailInput.value = currentUserData.userEmail || currentUser.email || '';
    phoneInput.value = currentUserData.userPhone || currentUser.phoneNumber || '';
    
    // Set user type (readonly)
    const userTypeDisplay = currentUserData.userType === 'swine_farmer' ? 'Swine Farmer' : 'Organic Fertilizer Buyer';
    userTypeInput.value = userTypeDisplay;
    
    // Update header display
    updateHeaderDisplay();
    
    // Update profile header
    updateProfileHeader();
    
    console.log('📋 Form populated with user data');
}

// Update header user display
function updateHeaderDisplay() {
    const userName = currentUserData.userName || currentUser.displayName || 'User';
    const userRole = currentUserData.userType === 'swine_farmer' ? 'Swine Farmer' : 'Fertilizer Buyer';
    const initials = generateInitials(userName);
    
    if (headerUserName) headerUserName.textContent = userName;
    if (headerUserRole) headerUserRole.textContent = userRole;
    if (headerUserAvatar) headerUserAvatar.textContent = initials;
}

// Update profile header
function updateProfileHeader() {
    const userName = currentUserData.userName || currentUser.displayName || 'User';
    const userRole = currentUserData.userType === 'swine_farmer' ? 'Swine Farmer' : 'Fertilizer Buyer';
    const initials = generateInitials(userName);
    
    if (profileUserName) profileUserName.textContent = userName;
    if (profileUserRole) profileUserRole.textContent = userRole;
    if (profileAvatar) profileAvatar.textContent = initials;
}

// Generate initials from name
function generateInitials(name) {
    if (!name) return '?';
    return name.split(' ')
               .map(word => word.charAt(0))
               .join('')
               .substring(0, 2)
               .toUpperCase();
}

// Set up event listeners
function setupEventListeners() {
    // Form submission
    if (profileForm) {
        profileForm.addEventListener('submit', handleFormSubmission);
    }
    
    // Logout button
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    // Account management buttons
    if (disableBtn) {
        disableBtn.addEventListener('click', handleDisableAccount);
    }
    
    if (deleteBtn) {
        deleteBtn.addEventListener('click', handleDeleteAccount);
    }
    
    // Sidebar navigation
    const sidebarItems = document.querySelectorAll('.sidebar-item');
    sidebarItems.forEach(item => {
        item.addEventListener('click', function() {
            sidebarItems.forEach(i => i.classList.remove('active'));
            this.classList.add('active');
            
            // Show placeholder for other sections
            if (this.textContent.trim() !== 'Account') {
                showAlert(`${this.textContent.trim()} settings coming soon!`, 'info');
            }
        });
    });
    
    // Input focus effects
    const inputs = document.querySelectorAll('.form-input');
    inputs.forEach(input => {
        input.addEventListener('focus', function() {
            this.parentElement.style.transform = 'scale(1.02)';
            this.parentElement.style.transition = 'transform 0.3s ease';
        });

        input.addEventListener('blur', function() {
            this.parentElement.style.transform = 'scale(1)';
        });
    });
}

// Handle form submission
async function handleFormSubmission(e) {
    e.preventDefault();
    
    if (!currentUser || !currentUserData) {
        showAlert('User data not loaded. Please refresh the page.', 'error');
        return;
    }
    
    try {
        // Show loading state
        setLoading(true);
        
        // Get form values
        const newUserName = usernameInput.value.trim();
        const newEmail = emailInput.value.trim();
        const newPhone = phoneInput.value.trim();
        
        // Validate inputs
        if (!newUserName || !newEmail) {
            throw new Error('Username and email are required.');
        }
        
        if (!isValidEmail(newEmail)) {
            throw new Error('Please enter a valid email address.');
        }
        
        if (newPhone && !isValidPhone(newPhone)) {
            throw new Error('Please enter a valid phone number.');
        }
        
        // Update Firebase Auth profile if username changed
        if (newUserName !== currentUser.displayName) {
            await updateProfile(currentUser, {
                displayName: newUserName
            });
            console.log('✅ Firebase Auth profile updated');
        }
        
        // Update Firebase Auth email if changed
        if (newEmail !== currentUser.email) {
            await updateEmail(currentUser, newEmail);
            console.log('✅ Firebase Auth email updated');
        }
        
        // Update Firestore user document
        const userDocRef = doc(db, COLLECTIONS.USERS, currentUser.uid);
        const updateData = {
            userName: newUserName,
            userEmail: newEmail,
            userPhone: newPhone,
            userUpdatedAt: serverTimestamp()
        };
        
        await updateDoc(userDocRef, updateData);
        console.log('✅ Firestore user data updated');
        
        // Update current user data
        currentUserData = {
            ...currentUserData,
            ...updateData
        };
        
        // Update displays
        updateHeaderDisplay();
        updateProfileHeader();
        
        showAlert('Profile updated successfully!', 'success');
        
    } catch (error) {
        console.error('❌ Error updating profile:', error);
        
        let errorMessage = 'Failed to update profile. Please try again.';
        
        switch (error.code) {
            case 'auth/requires-recent-login':
                errorMessage = 'For security reasons, please sign out and sign back in to update your email.';
                break;
            case 'auth/email-already-in-use':
                errorMessage = 'This email address is already in use by another account.';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Please enter a valid email address.';
                break;
            case 'auth/weak-password':
                errorMessage = 'Password should be at least 6 characters long.';
                break;
            default:
                errorMessage = error.message || errorMessage;
        }
        
        showAlert(errorMessage, 'error');
    } finally {
        setLoading(false);
    }
}

// Handle logout
async function handleLogout() {
    if (!confirm('Are you sure you want to log out?')) {
        return;
    }
    
    try {
        await signOut(auth);
        localStorage.removeItem('pigsoil_user');
        
        showAlert('Logged out successfully. Redirecting...', 'success');
        
        setTimeout(() => {
            window.location.href = '../html/login.html';
        }, 1500);
        
    } catch (error) {
        console.error('❌ Error logging out:', error);
        showAlert('Error logging out: ' + error.message, 'error');
    }
}

// Handle account disable
async function handleDisableAccount() {
    if (!confirm('Are you sure you want to disable your account? You can reactivate it later by logging in again.')) {
        return;
    }
    
    try {
        setLoading(true);
        
        // Update user as inactive in Firestore
        const userDocRef = doc(db, COLLECTIONS.USERS, currentUser.uid);
        await updateDoc(userDocRef, {
            userIsActive: false,
            userUpdatedAt: serverTimestamp()
        });
        
        // Sign out user
        await signOut(auth);
        localStorage.removeItem('pigsoil_user');
        
        showAlert('Account disabled successfully. You can reactivate it by logging in again.', 'success');
        
        setTimeout(() => {
            window.location.href = '../html/login.html';
        }, 2000);
        
    } catch (error) {
        console.error('Error disabling account:', error);
        showAlert('Error disabling account: ' + error.message, 'error');
    } finally {
        setLoading(false);
    }
}

// Handle account deletion
async function handleDeleteAccount() {
    if (!confirm('Are you sure you want to permanently delete your account? This action cannot be undone.')) {
        return;
    }
    
    if (!confirm('This will permanently delete all your data including listings, messages, and profile information. Are you absolutely sure?')) {
        return;
    }
    
    try {
        setLoading(true);
        
        // Delete user document from Firestore
        const userDocRef = doc(db, COLLECTIONS.USERS, currentUser.uid);
        await deleteDoc(userDocRef);
        
        // Note: In a production app, you'd also want to:
        // - Delete user's listings
        // - Delete user's messages
        // - Delete user's other data
        // - Delete Firebase Auth user (requires recent authentication)
        
        // Sign out user
        await signOut(auth);
        localStorage.removeItem('pigsoil_user');
        
        showAlert('Account deletion initiated. Thank you for using PigSoil+.', 'success');
        
        setTimeout(() => {
            window.location.href = '../html/login.html';
        }, 2000);
        
    } catch (error) {
        console.error('Error deleting account:', error);
        showAlert('Error deleting account: ' + error.message, 'error');
    } finally {
        setLoading(false);
    }
}

// Utility functions
function setLoading(loading) {
    if (saveBtn) {
        if (loading) {
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<div class="loading"></div>Saving...';
        } else {
            saveBtn.disabled = false;
            saveBtn.innerHTML = 'Save Changes';
        }
    }
    
    // Disable form inputs during loading
    const inputs = [usernameInput, emailInput, phoneInput];
    inputs.forEach(input => {
        if (input) input.disabled = loading;
    });
}

function showAlert(message, type) {
    if (!alertMessage) return;
    
    alertMessage.textContent = message;
    alertMessage.className = `alert ${type}`;
    alertMessage.style.display = 'block';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        alertMessage.style.display = 'none';
    }, 5000);
    
    // Scroll to alert
    alertMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function isValidPhone(phone) {
    // Basic phone validation - adjust regex as needed
    const phoneRegex = /^[\+]?[\d\s\-\(\)]{10,}$/;
    return phoneRegex.test(phone);
}

// Export for potential use in other modules
window.PigSoilProfileSettings = {
    loadUserData,
    updateHeaderDisplay,
    generateInitials,
    showAlert
};

console.log('Profile Settings with Firebase integration loaded!');