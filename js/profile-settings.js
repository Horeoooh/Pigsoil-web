// Profile Settings JavaScript - Complete Implementation with Firebase Standards
import { auth, db, storage } from '../js/init.js';
import '../js/shared-user-manager.js';
import { 
    onAuthStateChanged,
    signOut,
    updateProfile,
    updateEmail,
    updatePassword,
    deleteUser,
    EmailAuthProvider,
    reauthenticateWithCredential,
    sendPasswordResetEmail,
    RecaptchaVerifier,
    signInWithPhoneNumber
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
import {
    ref,
    uploadBytesResumable,
    getDownloadURL
} from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-storage.js';

// Default profile picture
const DEFAULT_PROFILE_PICTURE = 'https://i.pinimg.com/736x/d7/95/c3/d795c373a0539e64c7ee69bb0af3c5c3.jpg';

const COLLECTIONS = {
    USERS: 'users',
    PRODUCT_LISTINGS: 'product_listings',
    MESSAGES: 'messages',
    CONVERSATIONS: 'conversations',
    NOTIFICATIONS: 'notifications'
};

let currentUser = null;
let currentUserData = null;
let isLoading = false;
let recaptchaVerifier = null;
let confirmationResult = null;
let pendingNewPhone = null;

// DOM elements
const usernameInput = document.getElementById('username');
const emailInput = document.getElementById('email');
const phoneInput = document.getElementById('phone');
const userTypeSelect = document.getElementById('userType');
const profileForm = document.getElementById('profileForm');
const alertMessage = document.getElementById('alertMessage');
const saveBtn = document.getElementById('saveBtn');
const logoutBtn = document.getElementById('logoutBtn');
const deleteBtn = document.getElementById('deleteBtn');

const profileAvatar = document.getElementById('profileAvatar');
const profileUserName = document.getElementById('profileUserName');
const avatarUploadBtn = document.getElementById('avatarUploadBtn');
const profilePictureInput = document.getElementById('profilePictureInput');

const changePhoneBtn = document.getElementById('changePhoneBtn');
const changeEmailBtn = document.getElementById('changeEmailBtn');
const changePasswordBtn = document.getElementById('changePasswordBtn');
const passwordSection = document.getElementById('passwordSection');

// Modals
const phoneChangeModal = document.getElementById('phoneChangeModal');
const smsVerificationModal = document.getElementById('smsVerificationModal');
const passwordChangeModal = document.getElementById('passwordChangeModal');

//merged

document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 Profile Settings page initialized');
    
    showPageLoading();
    checkAuthState();
    setupEventListeners();
});

// Show/hide loading
function showPageLoading() {
    document.querySelectorAll('.form-group').forEach(group => {
        group.style.opacity = '0.5';
        group.style.pointerEvents = 'none';
    });
}

function hidePageLoading() {
    document.querySelectorAll('.form-group').forEach((group, index) => {
        setTimeout(() => {
            group.style.transition = 'opacity 0.3s ease';
            group.style.opacity = '1';
            group.style.pointerEvents = 'auto';
        }, index * 100);
    });
}

function checkAuthState() {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            showAlert('Please sign in to access your profile settings.', 'error');
            setTimeout(() => window.location.href = '/login.html', 2000);
            return;
        }
        
        currentUser = user;
        console.log('👤 User authenticated:', user.uid);
        
        try {
            await loadUserData(user.uid);
            populateForm();
            hidePageLoading();
        } catch (error) {
            console.error('❌ Error loading profile data:', error);
            showAlert('Error loading profile data', 'error');
            hidePageLoading();
        }
    });
}

async function loadUserData(uid) {
    const userDocRef = doc(db, COLLECTIONS.USERS, uid);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
        currentUserData = userDoc.data();
        console.log('✅ User data loaded:', currentUserData);
    } else {
        currentUserData = {
            userEmail: currentUser.email || null,
            userName: currentUser.displayName || 'User',
            userPhone: currentUser.phoneNumber || '',
            userType: 'swine_farmer',
            userIsActive: true,
            userPhoneVerified: true,
            userCreatedAt: Date.now(),
            userUpdatedAt: Date.now()
        };
        await setDoc(userDocRef, currentUserData);
    }
}

function populateForm() {
    if (!currentUserData) return;
    
    if (usernameInput) {
        usernameInput.value = currentUserData.userName || '';
        usernameInput.placeholder = 'Enter your name';
    }
    
    if (emailInput) {
        emailInput.value = currentUserData.userEmail || '';
        emailInput.placeholder = 'Enter your email';
        if (currentUserData.userEmail && changeEmailBtn) changeEmailBtn.style.display = 'inline-block';
        if (currentUserData.userEmail && passwordSection) passwordSection.style.display = 'block';
    }
    
    if (phoneInput) {
        phoneInput.value = currentUserData.userPhone || '';
        phoneInput.placeholder = 'Enter phone number';
    }
    
    if (userTypeSelect && currentUserData.userType) userTypeSelect.value = currentUserData.userType;
    
    updateProfileDisplay();
}

function updateProfileDisplay() {
    const userName = currentUserData.userName || currentUser.displayName || 'User';
    const initials = generateInitials(userName);
    const profilePicture = currentUserData.userProfilePictureUrl || DEFAULT_PROFILE_PICTURE;
    
    if (profileUserName) profileUserName.textContent = userName;
    
    if (profileAvatar) {
        profileAvatar.style.backgroundImage = `url(${profilePicture})`;
        profileAvatar.style.backgroundSize = 'cover';
        profileAvatar.style.backgroundPosition = 'center';
        profileAvatar.textContent = '';
    }
    
    const headerUserName = document.getElementById('headerUserName');
    const headerUserAvatar = document.getElementById('headerUserAvatar');
    
    if (headerUserName) headerUserName.textContent = userName;
    if (headerUserAvatar) {
        headerUserAvatar.style.backgroundImage = `url(${profilePicture})`;
        headerUserAvatar.style.backgroundSize = 'cover';
        headerUserAvatar.style.backgroundPosition = 'center';
        headerUserAvatar.textContent = '';
    }
}

function generateInitials(name) {
    if (!name) return '?';
    return name.split(' ').map(word => word.charAt(0)).join('').substring(0, 2).toUpperCase();
}

function setupEventListeners() {
    if (profileForm) profileForm.addEventListener('submit', handleFormSubmission);
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    if (deleteBtn) deleteBtn.addEventListener('click', handleDeleteAccount);
    
    if (avatarUploadBtn && profilePictureInput) {
        avatarUploadBtn.addEventListener('click', () => profilePictureInput.click());
        profilePictureInput.addEventListener('change', handleProfilePictureUpload);
    }
    
    if (changePhoneBtn) changePhoneBtn.addEventListener('click', openPhoneChangeModal);
    if (changeEmailBtn) changeEmailBtn.addEventListener('click', handleEmailChange);
    if (changePasswordBtn) changePasswordBtn.addEventListener('click', openPasswordChangeModal);
    
    setupPhoneChangeModal();
    setupSmsVerificationModal();
    setupPasswordChangeModal();
}

// ============================================================
// PROFILE PICTURE UPLOAD (Same pattern as CreateListing.js)
// ============================================================

async function handleProfilePictureUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        showAlert('Please select a valid image file', 'error');
        return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
        showAlert('Image size must be less than 5MB', 'error');
        return;
    }
    
    try {
        setLoadingState(true);
        showAlert('Uploading profile picture...', 'info');
        
        // Create preview
        const reader = new FileReader();
        reader.onload = (e) => {
            if (profileAvatar) {
                profileAvatar.style.backgroundImage = `url(${e.target.result})`;
                profileAvatar.style.backgroundSize = 'cover';
                profileAvatar.style.backgroundPosition = 'center';
                profileAvatar.textContent = '';
            }
        };
        reader.readAsDataURL(file);
        
        // Upload to Firebase Storage (same as CreateListing.js)
        const timestamp = Date.now();
        const storageRef = ref(storage, `profile_pictures/${currentUser.uid}/${timestamp}_${file.name}`);
        const uploadTask = uploadBytesResumable(storageRef, file);
        
        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                console.log('📤 Upload progress:', progress.toFixed(0) + '%');
            },
            (error) => {
                console.error('❌ Upload error:', error);
                showAlert('Failed to upload: ' + error.message, 'error');
                setLoadingState(false);
            },
            async () => {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                console.log('✅ Profile picture uploaded:', downloadURL);
                
                await updateDoc(doc(db, COLLECTIONS.USERS, currentUser.uid), {
                    userProfilePictureUrl: downloadURL,
                    userUpdatedAt: serverTimestamp()
                });
                
                await updateProfile(currentUser, { photoURL: downloadURL });
                
                currentUserData.userProfilePictureUrl = downloadURL;
                updateProfileDisplay();
                
                showAlert('Profile picture updated!', 'success');
                setLoadingState(false);
            }
        );
        
    } catch (error) {
        console.error('❌ Error uploading:', error);
        showAlert('Failed to upload: ' + error.message, 'error');
        setLoadingState(false);
    }
}

// ============================================================
// PHONE NUMBER CHANGE (Same pattern as sms-verification.js)
// ============================================================

function setupPhoneChangeModal() {
    const closeBtn = document.getElementById('phoneModalClose');
    const cancelBtn = document.getElementById('cancelPhoneChange');
    const sendCodeBtn = document.getElementById('sendPhoneCode');
    
    if (closeBtn) closeBtn.addEventListener('click', closePhoneChangeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closePhoneChangeModal);
    if (sendCodeBtn) sendCodeBtn.addEventListener('click', handleSendPhoneCode);
}

function openPhoneChangeModal() {
    if (phoneChangeModal) {
        phoneChangeModal.classList.add('show');
        initializePhoneRecaptcha();
    }
}

function closePhoneChangeModal() {
    if (phoneChangeModal) {
        phoneChangeModal.classList.remove('show');
        document.getElementById('newPhoneNumber').value = '';
        hideModalAlert('phoneChangeAlert');
    }
}

function initializePhoneRecaptcha() {
    if (!recaptchaVerifier) {
        recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container-phone', {
            'size': 'invisible',
            'callback': () => console.log('✅ reCAPTCHA solved')
        });
    }
}

async function handleSendPhoneCode() {
    const newPhone = document.getElementById('newPhoneNumber').value.trim();
    
    if (!newPhone) {
        showModalAlert('phoneChangeAlert', 'Please enter a phone number', 'error');
        return;
    }
    
    if (!newPhone.match(/^\+63[0-9]{10}$/)) {
        showModalAlert('phoneChangeAlert', 'Please enter a valid Philippine phone number (+63XXXXXXXXXX)', 'error');
        return;
    }
    
    if (newPhone === currentUserData.userPhone) {
        showModalAlert('phoneChangeAlert', 'This is your current phone number', 'error');
        return;
    }
    
    try {
        showModalAlert('phoneChangeAlert', 'Sending verification code...', 'info');
        
        // Check if phone exists
        const phoneQuery = query(collection(db, COLLECTIONS.USERS), where('userPhone', '==', newPhone));
        const phoneSnapshot = await getDocs(phoneQuery);
        
        if (!phoneSnapshot.empty) {
            showModalAlert('phoneChangeAlert', 'This phone number is already registered', 'error');
            return;
        }
        
        // Send SMS
        confirmationResult = await signInWithPhoneNumber(auth, newPhone, recaptchaVerifier);
        pendingNewPhone = newPhone;
        
        showModalAlert('phoneChangeAlert', 'Verification code sent!', 'success');
        
        setTimeout(() => {
            closePhoneChangeModal();
            openSmsVerificationModal(newPhone);
        }, 1000);
        
    } catch (error) {
        console.error('❌ Error sending SMS:', error);
        let errorMsg = 'Failed to send verification code';
        
        if (error.code === 'auth/too-many-requests') {
            errorMsg = 'Too many requests. Please try again later';
        } else if (error.code === 'auth/invalid-phone-number') {
            errorMsg = 'Invalid phone number format';
        }
        
        showModalAlert('phoneChangeAlert', errorMsg, 'error');
    }
}

// ============================================================
// SMS VERIFICATION MODAL
// ============================================================

function setupSmsVerificationModal() {
    const closeBtn = document.getElementById('smsModalClose');
    const cancelBtn = document.getElementById('cancelSmsVerification');
    const verifyBtn = document.getElementById('verifySmsCode');
    const codeInputs = document.querySelectorAll('.code-input');
    
    if (closeBtn) closeBtn.addEventListener('click', closeSmsVerificationModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeSmsVerificationModal);
    if (verifyBtn) verifyBtn.addEventListener('click', handleVerifySmsCode);
    
    codeInputs.forEach((input, index) => {
        input.addEventListener('input', function(e) {
            const value = e.target.value;
            
            if (!/^\d*$/.test(value)) {
                e.target.value = '';
                return;
            }
            
            if (value && index < codeInputs.length - 1) {
                codeInputs[index + 1].focus();
            }
            
            const code = Array.from(codeInputs).map(i => i.value).join('');
            if (code.length === 6) {
                setTimeout(() => handleVerifySmsCode(), 500);
            }
        });
        
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Backspace' && !this.value && index > 0) {
                codeInputs[index - 1].focus();
            }
        });
    });
}

function openSmsVerificationModal(phoneNumber) {
    if (smsVerificationModal) {
        smsVerificationModal.classList.add('show');
        document.getElementById('verifyPhoneDisplay').textContent = phoneNumber;
        document.querySelectorAll('.code-input').forEach(input => input.value = '');
        document.querySelectorAll('.code-input')[0].focus();
    }
}

function closeSmsVerificationModal() {
    if (smsVerificationModal) {
        smsVerificationModal.classList.remove('show');
        document.querySelectorAll('.code-input').forEach(input => input.value = '');
        hideModalAlert('smsVerificationAlert');
    }
}

async function handleVerifySmsCode() {
    const codeInputs = document.querySelectorAll('.code-input');
    const code = Array.from(codeInputs).map(input => input.value).join('');
    
    if (code.length !== 6) {
        showModalAlert('smsVerificationAlert', 'Please enter the complete 6-digit code', 'error');
        return;
    }
    
    try {
        showModalAlert('smsVerificationAlert', 'Verifying code...', 'info');
        
        await confirmationResult.confirm(code);
        
        await updateDoc(doc(db, COLLECTIONS.USERS, currentUser.uid), {
            userPhone: pendingNewPhone,
            userPhoneVerified: true,
            userUpdatedAt: serverTimestamp()
        });
        
        currentUserData.userPhone = pendingNewPhone;
        if (phoneInput) phoneInput.value = pendingNewPhone;
        
        showModalAlert('smsVerificationAlert', 'Phone number updated!', 'success');
        
        setTimeout(() => {
            closeSmsVerificationModal();
            showAlert('Phone number updated successfully!', 'success');
        }, 1500);
        
    } catch (error) {
        console.error('❌ Verification failed:', error);
        
        let errorMsg = 'Invalid verification code';
        if (error.code === 'auth/invalid-verification-code') {
            errorMsg = 'Invalid code. Please try again';
        } else if (error.code === 'auth/code-expired') {
            errorMsg = 'Code expired. Please request a new one';
        }
        
        showModalAlert('smsVerificationAlert', errorMsg, 'error');
    }
}

// ============================================================
// EMAIL CHANGE (Firebase Auth Standard)
// ============================================================

async function handleEmailChange() {
    const currentEmail = emailInput.value.trim();
    const newEmail = prompt('Enter your new email address:', currentEmail);
    
    if (!newEmail || newEmail === currentEmail) return;
    
    if (!newEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        showAlert('Please enter a valid email address', 'error');
        return;
    }
    
    try {
        setLoadingState(true);
        showAlert('Updating email address...', 'info');
        
        await updateEmail(currentUser, newEmail);
        
        await updateDoc(doc(db, COLLECTIONS.USERS, currentUser.uid), {
            userEmail: newEmail,
            userUpdatedAt: serverTimestamp()
        });
        
        currentUserData.userEmail = newEmail;
        emailInput.value = newEmail;
        
        showAlert('Email updated successfully!', 'success');
        
    } catch (error) {
        console.error('❌ Email update failed:', error);
        
        let errorMsg = 'Failed to update email';
        
        if (error.code === 'auth/requires-recent-login') {
            errorMsg = 'For security, please sign out and sign back in to update your email';
        } else if (error.code === 'auth/email-already-in-use') {
            errorMsg = 'This email is already in use';
        }
        
        showAlert(errorMsg, 'error');
    } finally {
        setLoadingState(false);
    }
}

// ============================================================
// PASSWORD CHANGE (Firebase Auth Standard)
// ============================================================

function setupPasswordChangeModal() {
    const closeBtn = document.getElementById('passwordModalClose');
    const cancelBtn = document.getElementById('cancelPasswordChange');
    const saveBtn = document.getElementById('saveNewPassword');
    
    if (closeBtn) closeBtn.addEventListener('click', closePasswordChangeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closePasswordChangeModal);
    if (saveBtn) saveBtn.addEventListener('click', handlePasswordChange);
}

function openPasswordChangeModal() {
    if (!currentUserData.userEmail) {
        showAlert('Please add an email address first to enable password management', 'error');
        return;
    }
    
    if (passwordChangeModal) {
        passwordChangeModal.classList.add('show');
    }
}

function closePasswordChangeModal() {
    if (passwordChangeModal) {
        passwordChangeModal.classList.remove('show');
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';
        hideModalAlert('passwordChangeAlert');
    }
}

async function handlePasswordChange() {
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    if (!currentPassword) {
        showModalAlert('passwordChangeAlert', 'Please enter your current password', 'error');
        return;
    }
    
    if (!newPassword) {
        showModalAlert('passwordChangeAlert', 'Please enter a new password', 'error');
        return;
    }
    
    if (newPassword.length < 6) {
        showModalAlert('passwordChangeAlert', 'Password must be at least 6 characters', 'error');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showModalAlert('passwordChangeAlert', 'Passwords do not match', 'error');
        return;
    }
    
    try {
        showModalAlert('passwordChangeAlert', 'Updating password...', 'info');
        
        const credential = EmailAuthProvider.credential(currentUserData.userEmail, currentPassword);
        await reauthenticateWithCredential(currentUser, credential);
        await updatePassword(currentUser, newPassword);
        
        showModalAlert('passwordChangeAlert', 'Password updated!', 'success');
        
        setTimeout(() => {
            closePasswordChangeModal();
            showAlert('Password updated successfully!', 'success');
        }, 1500);
        
    } catch (error) {
        console.error('❌ Password update failed:', error);
        
        let errorMsg = 'Failed to update password';
        
        if (error.code === 'auth/wrong-password') {
            errorMsg = 'Current password is incorrect';
        } else if (error.code === 'auth/weak-password') {
            errorMsg = 'Password is too weak';
        }
        
        showModalAlert('passwordChangeAlert', errorMsg, 'error');
    }
}

// ============================================================
// FORM SUBMISSION (Username & User Type)
// ============================================================

async function handleFormSubmission(e) {
    e.preventDefault();
    
    if (!currentUser || !currentUserData || isLoading) return;
    
    try {
        setLoadingState(true);
        
        const newUserName = usernameInput.value.trim();
        const newUserType = userTypeSelect.value;
        const newEmail = emailInput.value.trim();
        
        if (!newUserName || newUserName.length < 3) {
            throw new Error('Username must be at least 3 characters');
        }
        
        const nameChanged = newUserName !== currentUserData.userName;
        const typeChanged = newUserType !== currentUserData.userType;
        const emailChanged = newEmail !== (currentUserData.userEmail || '');
        
        if (!nameChanged && !typeChanged && !emailChanged) {
            showAlert('No changes to save', 'info');
            setLoadingState(false);
            return;
        }
        
        const updateData = { userUpdatedAt: serverTimestamp() };
        
        if (nameChanged) {
            updateData.userName = newUserName;
            await updateProfile(currentUser, { displayName: newUserName });
        }
        
        if (typeChanged) {
            updateData.userType = newUserType;
            showAlert('User type updated! The app will reload...', 'success');
        }
        
        if (emailChanged && newEmail) {
            updateData.userEmail = newEmail;
        }
        
        await updateDoc(doc(db, COLLECTIONS.USERS, currentUser.uid), updateData);
        currentUserData = { ...currentUserData, ...updateData };
        updateProfileDisplay();
        
        if (typeChanged) {
            setTimeout(() => window.location.reload(), 1500);
        } else {
            showAlert('Profile updated successfully!', 'success');
        }
        
    } catch (error) {
        console.error('❌ Error updating profile:', error);
        showAlert(error.message || 'Failed to update profile', 'error');
    } finally {
        if (userTypeSelect.value === currentUserData.userType) {
            setLoadingState(false);
        }
    }
}

// ============================================================
// LOGOUT & DELETE ACCOUNT
// ============================================================

async function handleLogout() {
    if (!confirm('Are you sure you want to log out?')) return;
    
    try {
        setLoadingState(true);
        await signOut(auth);
        localStorage.removeItem('pigsoil_user');
        showAlert('Logged out successfully', 'success');
        setTimeout(() => window.location.href = '/login.html', 1500);
    } catch (error) {
        console.error('❌ Logout error:', error);
        showAlert('Error logging out', 'error');
        setLoadingState(false);
    }
}

async function handleDeleteAccount() {
    if (!confirm('⚠️ PERMANENT DELETION\n\nDelete your account and all data?\n\nThis CANNOT be undone!')) return;
    
    const confirmText = prompt('Type "DELETE MY ACCOUNT" to confirm:');
    if (confirmText !== 'DELETE MY ACCOUNT') {
        showAlert('Deletion cancelled', 'info');
        return;
    }
    
    try {
        setLoadingState(true);
        showAlert('Deleting account...', 'info');
        
        const uid = currentUser.uid;
        const batch = writeBatch(db);
        
        batch.delete(doc(db, COLLECTIONS.USERS, uid));
        await batch.commit();
        
        // Delete listings
        const listingsQuery = query(collection(db, COLLECTIONS.PRODUCT_LISTINGS), where('listingSellerID', '==', uid));
        const listingsSnapshot = await getDocs(listingsQuery);
        
        if (listingsSnapshot.size > 0) {
            const listingsBatch = writeBatch(db);
            listingsSnapshot.forEach(doc => listingsBatch.delete(doc.ref));
            await listingsBatch.commit();
        }
        
        // Delete messages
        const messagesQuery = query(collection(db, COLLECTIONS.MESSAGES), where('senderId', '==', uid));
        const messagesSnapshot = await getDocs(messagesQuery);
        
        if (messagesSnapshot.size > 0) {
            const messagesBatch = writeBatch(db);
            messagesSnapshot.forEach(doc => messagesBatch.delete(doc.ref));
            await messagesBatch.commit();
        }
        
        await deleteUser(currentUser);
        localStorage.removeItem('pigsoil_user');
        
        showAlert('Account deleted successfully', 'success');
        setTimeout(() => window.location.href = '/login.html', 2000);
        
    } catch (error) {
        console.error('❌ Delete error:', error);
        
        let errorMsg = 'Error deleting account';
        if (error.code === 'auth/requires-recent-login') {
            errorMsg = 'For security, please sign out and sign back in, then try again';
        }
        
        showAlert(errorMsg, 'error');
        setLoadingState(false);
    }
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function setLoadingState(loading) {
    isLoading = loading;
    
    if (saveBtn) {
        saveBtn.disabled = loading;
        saveBtn.innerHTML = loading ? 
            '<div style="display: inline-block; width: 16px; height: 16px; border: 2px solid #fff; border-top: 2px solid transparent; border-radius: 50%; animation: spin 0.6s linear infinite; margin-right: 8px;"></div>Saving...' :
            'Save Changes';
    }
    
    if (deleteBtn) deleteBtn.disabled = loading;
    if (logoutBtn) logoutBtn.disabled = loading;
    
    [usernameInput, emailInput, userTypeSelect].forEach(input => {
        if (input) input.disabled = loading;
    });
}

function showAlert(message, type) {
    if (!alertMessage) return;
    
    alertMessage.textContent = message;
    alertMessage.className = `alert ${type}`;
    alertMessage.style.display = 'block';
    alertMessage.style.opacity = '0';
    alertMessage.style.transform = 'translateY(-10px)';
    
    setTimeout(() => {
        alertMessage.style.transition = 'all 0.3s ease';
        alertMessage.style.opacity = '1';
        alertMessage.style.transform = 'translateY(0)';
    }, 100);
    
    if (type !== 'info') {
        setTimeout(() => {
            alertMessage.style.opacity = '0';
            setTimeout(() => alertMessage.style.display = 'none', 300);
        }, 5000);
    }
}

function showModalAlert(modalAlertId, message, type) {
    const modalAlert = document.getElementById(modalAlertId);
    if (modalAlert) {
        modalAlert.textContent = message;
        modalAlert.className = `alert ${type}`;
        modalAlert.style.display = 'block';
    }
}

function hideModalAlert(modalAlertId) {
    const modalAlert = document.getElementById(modalAlertId);
    if (modalAlert) modalAlert.style.display = 'none';
}

const style = document.createElement('style');
style.textContent = `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
document.head.appendChild(style);

console.log('✅ Profile Settings with complete Firebase integration loaded!');
