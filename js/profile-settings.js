// Profile Settings JavaScript with Firebase Integration
import { auth, db } from '../js/init.js';
import { 
    onAuthStateChanged,
    signOut,
    updateProfile,
    updateEmail,
    deleteUser,
    reauthenticateWithCredential,
    EmailAuthProvider
} from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js';
import { 
    doc, 
    getDoc, 
    setDoc,
    updateDoc,
    deleteDoc,
    collection,
    query,
    where,
    getDocs,
    writeBatch,
    serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js';

// Collection names
const COLLECTIONS = {
    USERS: 'users',
    SWINE_FARMERS: 'swineFarmers',
    FERTILIZER_BUYERS: 'fertilizerBuyers',
    COMPOST_LISTINGS: 'compost_listings',
    MESSAGES: 'messages',
    CONVERSATIONS: 'conversations',
    NOTIFICATIONS: 'notifications'
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
    checkAuthState();
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
            await loadUserData(user.uid);
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
            // Document doesn't exist, create it with setDoc
            currentUserData = {
                userEmail: currentUser.email,
                userName: currentUser.displayName || 'User',
                userPhone: currentUser.phoneNumber || '',
                userType: 'swine_farmer', // Default code, not display string
                userCreatedAt: Date.now(),
                userUpdatedAt: Date.now(),
                userIsActive: true,
                userPhoneVerified: true
            };
            
            await setDoc(userDocRef, currentUserData);
            console.log('📝 Created default user data with setDoc');
        }

    } catch (error) {
        console.error('❌ Error loading user data:', error);
        throw error;
    }
}

// Populate form fields with user data
function populateForm() {
    if (!currentUserData) return;
    
    usernameInput.value = currentUserData.userName || currentUser.displayName || '';
    emailInput.value = currentUserData.userEmail || currentUser.email || '';
    phoneInput.value = currentUserData.userPhone || currentUser.phoneNumber || '';
    
    const userTypeDisplay = currentUserData.userType === 'swine_farmer' ? 'Swine Farmer' : 'Organic Fertilizer Buyer';
    userTypeInput.value = userTypeDisplay;
    
    updateHeaderDisplay();
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
    if (profileForm) {
        profileForm.addEventListener('submit', handleFormSubmission);
    }
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    if (disableBtn) {
        disableBtn.addEventListener('click', handleDisableAccount);
    }
    
    if (deleteBtn) {
        deleteBtn.addEventListener('click', handleDeleteAccount);
    }
    
    const sidebarItems = document.querySelectorAll('.sidebar-item');
    sidebarItems.forEach(item => {
        item.addEventListener('click', function() {
            sidebarItems.forEach(i => i.classList.remove('active'));
            this.classList.add('active');
            
            if (this.textContent.trim() !== 'Account') {
                showAlert(`${this.textContent.trim()} settings coming soon!`, 'info');
            }
        });
    });
    
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
        setLoading(true);
        
        const newUserName = usernameInput.value.trim();
        const newEmail = emailInput.value.trim();
        const newPhone = phoneInput.value.trim();
        
        if (!newUserName || !newEmail) {
            throw new Error('Username and email are required.');
        }
        
        if (!isValidEmail(newEmail)) {
            throw new Error('Please enter a valid email address.');
        }
        
        if (newPhone && !isValidPhone(newPhone)) {
            throw new Error('Please enter a valid phone number.');
        }
        
        if (newUserName !== currentUser.displayName) {
            await updateProfile(currentUser, {
                displayName: newUserName
            });
            console.log('✅ Firebase Auth profile updated');
        }
        
        if (newEmail !== currentUser.email) {
            await updateEmail(currentUser, newEmail);
            console.log('✅ Firebase Auth email updated');
        }
        
        const userDocRef = doc(db, COLLECTIONS.USERS, currentUser.uid);
        const updateData = {
            userName: newUserName,
            userEmail: newEmail,
            userPhone: newPhone,
            userUpdatedAt: serverTimestamp()
        };
        
        await updateDoc(userDocRef, updateData);
        console.log('✅ Firestore user data updated');
        
        currentUserData = {
            ...currentUserData,
            ...updateData
        };
        
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
    if (!confirm('Are you sure you want to disable your account?\n\nYour account will be deactivated but your data will be preserved. You can reactivate it later by logging in again.')) {
        return;
    }
    
    try {
        setLoading(true);
        
        // Update user document to mark as inactive
        const userDocRef = doc(db, COLLECTIONS.USERS, currentUser.uid);
        await updateDoc(userDocRef, {
            userIsActive: false,
            userDisabledAt: serverTimestamp(),
            userUpdatedAt: serverTimestamp()
        });
        
        // Update related profile (swine farmer or fertilizer buyer)
        const userType = currentUserData.userType;
        const profileCollection = userType === 'swine_farmer' ? COLLECTIONS.SWINE_FARMERS : COLLECTIONS.FERTILIZER_BUYERS;
        
        const profileQuery = query(collection(db, profileCollection), where('userId', '==', currentUser.uid));
        const profileSnapshot = await getDocs(profileQuery);
        
        if (!profileSnapshot.empty) {
            const profileDoc = profileSnapshot.docs[0];
            await updateDoc(doc(db, profileCollection, profileDoc.id), {
                isActive: false,
                updatedAt: serverTimestamp()
            });
        }
        
        // Hide user's listings (if swine farmer)
        if (userType === 'swine_farmer') {
            const listingsQuery = query(
                collection(db, COLLECTIONS.COMPOST_LISTINGS),
                where('sellerId', '==', currentUser.uid)
            );
            const listingsSnapshot = await getDocs(listingsQuery);
            
            const batch = writeBatch(db);
            listingsSnapshot.forEach((listingDoc) => {
                batch.update(doc(db, COLLECTIONS.COMPOST_LISTINGS, listingDoc.id), {
                    availability: 'disabled',
                    updatedAt: serverTimestamp()
                });
            });
            await batch.commit();
        }
        
        await signOut(auth);
        localStorage.removeItem('pigsoil_user');
        
        showAlert('Account disabled successfully. You can reactivate it by logging in again.', 'success');
        
        setTimeout(() => {
            window.location.href = '../html/login.html';
        }, 2000);
        
    } catch (error) {
        console.error('❌ Error disabling account:', error);
        showAlert('Error disabling account: ' + error.message, 'error');
    } finally {
        setLoading(false);
    }
}

// Handle account deletion
async function handleDeleteAccount() {
    // First confirmation
    if (!confirm('⚠️ PERMANENT DELETION WARNING ⚠️\n\nAre you sure you want to permanently delete your account?\n\nThis will delete:\n• Your profile and account information\n• All your listings (if you\'re a swine farmer)\n• All your messages and conversations\n• All your reviews and ratings\n\nThis action CANNOT be undone!')) {
        return;
    }
    
    // Second confirmation with typed verification
    const confirmationText = prompt('To confirm deletion, please type "DELETE MY ACCOUNT" (all caps):');
    
    if (confirmationText !== 'DELETE MY ACCOUNT') {
        showAlert('Account deletion cancelled. The confirmation text did not match.', 'info');
        return;
    }
    
    try {
        setLoading(true);
        
        const uid = currentUser.uid;
        const userType = currentUserData.userType;
        
        // Create a batch for efficient deletion
        const batch = writeBatch(db);
        
        // 1. Delete user document
        const userDocRef = doc(db, COLLECTIONS.USERS, uid);
        batch.delete(userDocRef);
        
        // 2. Delete swine farmer or fertilizer buyer profile
        const profileCollection = userType === 'swine_farmer' ? COLLECTIONS.SWINE_FARMERS : COLLECTIONS.FERTILIZER_BUYERS;
        const profileQuery = query(collection(db, profileCollection), where('userId', '==', uid));
        const profileSnapshot = await getDocs(profileQuery);
        
        profileSnapshot.forEach((profileDoc) => {
            batch.delete(doc(db, profileCollection, profileDoc.id));
        });
        
        // Commit the initial batch
        await batch.commit();
        
        // 3. Delete listings (if swine farmer)
        if (userType === 'swine_farmer') {
            const listingsQuery = query(
                collection(db, COLLECTIONS.COMPOST_LISTINGS),
                where('sellerId', '==', uid)
            );
            const listingsSnapshot = await getDocs(listingsQuery);
            
            const listingsBatch = writeBatch(db);
            listingsSnapshot.forEach((listingDoc) => {
                listingsBatch.delete(doc(db, COLLECTIONS.COMPOST_LISTINGS, listingDoc.id));
            });
            
            if (listingsSnapshot.size > 0) {
                await listingsBatch.commit();
            }
        }
        
        // 4. Delete messages
        const messagesQuery = query(
            collection(db, COLLECTIONS.MESSAGES),
            where('senderId', '==', uid)
        );
        const messagesSnapshot = await getDocs(messagesQuery);
        
        const messagesBatch = writeBatch(db);
        messagesSnapshot.forEach((messageDoc) => {
            messagesBatch.delete(doc(db, COLLECTIONS.MESSAGES, messageDoc.id));
        });
        
        if (messagesSnapshot.size > 0) {
            await messagesBatch.commit();
        }
        
        // 5. Delete conversations where user is a participant
        const conversationsSnapshot = await getDocs(collection(db, COLLECTIONS.CONVERSATIONS));
        const conversationsBatch = writeBatch(db);
        let conversationsDeleted = 0;
        
        conversationsSnapshot.forEach((convDoc) => {
            const convData = convDoc.data();
            if (convData.participants && convData.participants.some(p => p.userId === uid)) {
                conversationsBatch.delete(doc(db, COLLECTIONS.CONVERSATIONS, convDoc.id));
                conversationsDeleted++;
            }
        });
        
        if (conversationsDeleted > 0) {
            await conversationsBatch.commit();
        }
        
        // 6. Delete notifications
        const notificationsQuery = query(
            collection(db, COLLECTIONS.NOTIFICATIONS),
            where('userId', '==', uid)
        );
        const notificationsSnapshot = await getDocs(notificationsQuery);
        
        const notificationsBatch = writeBatch(db);
        notificationsSnapshot.forEach((notifDoc) => {
            notificationsBatch.delete(doc(db, COLLECTIONS.NOTIFICATIONS, notifDoc.id));
        });
        
        if (notificationsSnapshot.size > 0) {
            await notificationsBatch.commit();
        }
        
        // 7. Delete Firebase Auth user account
        try {
            await deleteUser(currentUser);
            console.log('✅ Firebase Auth user deleted');
        } catch (authError) {
            if (authError.code === 'auth/requires-recent-login') {
                showAlert('For security, please sign in again to complete account deletion.', 'error');
                setTimeout(() => {
                    window.location.href = '../html/login.html';
                }, 2000);
                return;
            }
            throw authError;
        }
        
        // Clear local storage
        localStorage.removeItem('pigsoil_user');
        
        showAlert('Account and all associated data have been permanently deleted. Thank you for using PigSoil+.', 'success');
        
        setTimeout(() => {
            window.location.href = '../html/login.html';
        }, 3000);
        
    } catch (error) {
        console.error('❌ Error deleting account:', error);
        
        let errorMessage = 'Error deleting account: ' + error.message;
        
        if (error.code === 'auth/requires-recent-login') {
            errorMessage = 'For security reasons, please sign out and sign back in, then try again.';
        }
        
        showAlert(errorMessage, 'error');
    } finally {
        setLoading(false);
    }
}

// Utility functions
function setLoading(loading) {
    if (saveBtn) {
        saveBtn.disabled = loading;
        saveBtn.innerHTML = loading ? '<div class="loading"></div>Saving...' : 'Save Changes';
    }
    
    if (disableBtn) disableBtn.disabled = loading;
    if (deleteBtn) deleteBtn.disabled = loading;
    
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
    
    setTimeout(() => {
        alertMessage.style.display = 'none';
    }, 5000);
    
    alertMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function isValidPhone(phone) {
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

console.log('✅ Profile Settings with Firebase integration loaded!');