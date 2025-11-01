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
    signInWithPhoneNumber,
    linkWithCredential,
    PhoneAuthProvider,
    updatePhoneNumber
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
    addDoc,
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
    NOTIFICATIONS: 'notifications',
    ADDRESSES: 'addresses'
};

let currentUser = null;
let currentUserData = null;
let isLoading = false;
let recaptchaVerifier = null;
let confirmationResult = null;
let pendingNewPhone = null;
let hasPasswordProvider = false;

// Google Maps variables for address
let addressMap;
let addressMarker;
let selectedAddress = {
    lat: 10.3157,  // Default to Cebu City
    lng: 123.8854,
    name: 'Select address',
    formattedAddress: 'Cebu City, Philippines',
    placeId: ''
};
let addressGeocoder;
let addressAutocomplete;

// DOM elements
const usernameInput = document.getElementById('username');
const emailInput = document.getElementById('email');
const phoneInput = document.getElementById('phone');
const userTypeSelect = document.getElementById('userType');
const addressInput = document.getElementById('address');
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
const changeAddressBtn = document.getElementById('changeAddressBtn');
const passwordSection = document.getElementById('passwordSection');

// Modals
const phoneChangeModal = document.getElementById('phoneChangeModal');
const smsVerificationModal = document.getElementById('smsVerificationModal');
const passwordChangeModal = document.getElementById('passwordChangeModal');
const addEmailModal = document.getElementById('addEmailModal');
const changeEmailModal = document.getElementById('changeEmailModal');
const addressChangeModal = document.getElementById('addressChangeModal');

//merged

// Initialize Google Maps
window.initMap = function() {
    console.log('🗺️ Google Maps API loaded for profile settings');
    addressGeocoder = new google.maps.Geocoder();
};

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
            showAlert(i18next.t('settings.alerts.saveFailed'), 'error');
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
            showAlert(i18next.t('settings.alerts.saveFailed'), 'error');
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
        
        // Load address if userAddressID exists
        if (currentUserData.userAddressID) {
            await loadUserAddress(currentUserData.userAddressID);
        }
    } else {
        currentUserData = {
            userEmail: currentUser.email || null,
            userName: currentUser.displayName || 'User',
            userPhone: currentUser.phoneNumber || '',
            userType: 'swine_farmer',
            userIsActive: true,
            userPhoneVerified: true,
            userCreatedAt: Date.now(),
            userUpdatedAt: Date.now(),
            userAddressID: null
        };
        await setDoc(userDocRef, currentUserData);
    }
}

async function loadUserAddress(addressId) {
    try {
        const addressDocRef = doc(db, COLLECTIONS.ADDRESSES, addressId);
        const addressDoc = await getDoc(addressDocRef);
        
        if (addressDoc.exists()) {
            const addressData = addressDoc.data();
            selectedAddress = {
                lat: addressData.addressLatitude,
                lng: addressData.addressLongitude,
                name: addressData.addressName || 'Your Address',
                formattedAddress: addressData.addressName || 'Saved Address',
                placeId: addressData.addressPlaceId || ''
            };
            console.log('✅ Address loaded:', selectedAddress);
        }
    } catch (error) {
        console.error('Error loading address:', error);
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
    }
    
    if (phoneInput) {
        phoneInput.value = currentUserData.userPhone || '';
        phoneInput.placeholder = 'Enter phone number';
    }
    
    if (userTypeSelect && currentUserData.userType) userTypeSelect.value = currentUserData.userType;
    
    // Populate address field
    if (addressInput) {
        if (currentUserData.userAddressID && selectedAddress.name) {
            addressInput.value = selectedAddress.name;
        } else {
            addressInput.value = 'No address set';
        }
    }
    
    checkEmailAccountStatus();
    updateProfileDisplay();
}

function checkEmailAccountStatus() {
    // Check if user has password provider
    hasPasswordProvider = currentUser.providerData.some(provider => provider.providerId === 'password');
    
    console.log('🔐 Password provider:', hasPasswordProvider);
    console.log('📧 Email:', currentUserData.userEmail);
    
    if (!hasPasswordProvider && !currentUserData.userEmail) {
        // Phone-only user - show "Add Email & Password" button
        if (changeEmailBtn) {
            changeEmailBtn.textContent = '+ Add Email & Password';
            changeEmailBtn.style.display = 'inline-block';
            changeEmailBtn.style.color = '#4CAF50';
        }
        if (passwordSection) passwordSection.style.display = 'none';
        if (emailInput) emailInput.readOnly = true;
    } else if (hasPasswordProvider) {
        // User has email/password - show "Change Email" and "Change Password"
        if (changeEmailBtn) {
            changeEmailBtn.textContent = 'Change Email';
            changeEmailBtn.style.display = 'inline-block';
            changeEmailBtn.style.color = '#4CAF50';
        }
        if (passwordSection) passwordSection.style.display = 'block';
        if (emailInput) emailInput.readOnly = true;
    } else {
        // Has email but no password (shouldn't happen, but handle it)
        if (changeEmailBtn) changeEmailBtn.style.display = 'none';
        if (passwordSection) passwordSection.style.display = 'none';
        if (emailInput) emailInput.readOnly = false;
    }
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
    if (changeEmailBtn) changeEmailBtn.addEventListener('click', handleEmailButtonClick);
    if (changePasswordBtn) changePasswordBtn.addEventListener('click', openPasswordChangeModal);
    if (changeAddressBtn) changeAddressBtn.addEventListener('click', openAddressChangeModal);
    
    setupPhoneChangeModal();
    setupSmsVerificationModal();
    setupPasswordChangeModal();
    setupAddEmailModal();
    setupChangeEmailModal();
    setupAddressChangeModal();
}

// ============================================================
// PROFILE PICTURE UPLOAD (Same pattern as CreateListing.js)
// ============================================================

async function handleProfilePictureUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        showAlert(i18next.t('settings.alerts.profilePictureFailed'), 'error');
        return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
        showAlert(i18next.t('settings.alerts.profilePictureFailed'), 'error');
        return;
    }
    
    try {
        setLoadingState(true);
        showAlert(i18next.t('settings.alerts.profilePictureSuccess'), 'info');
        
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
                showAlert(i18next.t('settings.alerts.profilePictureFailed'), 'error');
                setLoadingState(false);
            },
            async () => {
                const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                console.log('✅ Profile picture uploaded:', downloadURL);
                
                await updateDoc(doc(db, COLLECTIONS.USERS, currentUser.uid), {
                    userProfilePictureUrl: downloadURL,
                    userUpdatedAt: Date.now()
                });
                
                await updateProfile(currentUser, { photoURL: downloadURL });
                
                currentUserData.userProfilePictureUrl = downloadURL;
                updateProfileDisplay();
                
                showAlert(i18next.t('settings.alerts.profilePictureSuccess'), 'success');
                setLoadingState(false);
            }
        );
        
    } catch (error) {
        console.error('❌ Error uploading:', error);
        showAlert(i18next.t('settings.alerts.profilePictureFailed'), 'error');
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
        
        if (!phoneSnapshot.empty && phoneSnapshot.docs[0].id !== currentUser.uid) {
            showModalAlert('phoneChangeAlert', 'This phone number is already registered', 'error');
            return;
        }
        
        // ⚠️ CRITICAL: Use PhoneAuthProvider.verifyPhoneNumber() NOT signInWithPhoneNumber()
        // signInWithPhoneNumber() creates a NEW account!
        // verifyPhoneNumber() just verifies the phone for the EXISTING user
        const phoneProvider = new PhoneAuthProvider(auth);
        const verificationId = await phoneProvider.verifyPhoneNumber(newPhone, recaptchaVerifier);
        
        // Store verification ID for later use
        confirmationResult = { verificationId };
        pendingNewPhone = newPhone;
        
        console.log('✅ Verification SMS sent to:', newPhone);
        
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
        } else if (error.code === 'auth/quota-exceeded') {
            errorMsg = 'SMS quota exceeded. Please try again later';
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
        
        // Create phone credential using the verification ID and code
        const phoneCredential = PhoneAuthProvider.credential(
            confirmationResult.verificationId,
            code
        );
        
        console.log('✅ SMS code verified, updating phone number...');
        
        // Update phone number on the current user (NOT sign in!)
        await updatePhoneNumber(currentUser, phoneCredential);
        
        console.log('✅ Phone number updated in Firebase Auth');
        
        // Update Firestore
        await updateDoc(doc(db, COLLECTIONS.USERS, currentUser.uid), {
            userPhone: pendingNewPhone,
            userPhoneVerified: true,
            userUpdatedAt: Date.now()
        });
        
        currentUserData.userPhone = pendingNewPhone;
        if (phoneInput) phoneInput.value = pendingNewPhone;
        
        showModalAlert('smsVerificationAlert', 'Phone number updated!', 'success');
        
        setTimeout(() => {
            closeSmsVerificationModal();
            showAlert(i18next.t('settings.alerts.phoneChangeSuccess'), 'success');
        }, 1500);
        
    } catch (error) {
        console.error('❌ Verification failed:', error);
        
        let errorMsg = 'Invalid verification code';
        if (error.code === 'auth/invalid-verification-code') {
            errorMsg = 'Invalid code. Please try again';
        } else if (error.code === 'auth/code-expired') {
            errorMsg = 'Code expired. Please request a new one';
        } else if (error.code === 'auth/missing-verification-code') {
            errorMsg = 'Please enter the verification code';
        } else if (error.code === 'auth/credential-already-in-use') {
            errorMsg = 'This phone number is already in use';
        } else if (error.code === 'auth/requires-recent-login') {
            errorMsg = 'For security, please sign out and sign back in, then try again';
        }
        
        showModalAlert('smsVerificationAlert', errorMsg, 'error');
    }
}

// ============================================================
// EMAIL & PASSWORD MANAGEMENT
// ============================================================

function handleEmailButtonClick() {
    if (!hasPasswordProvider && !currentUserData.userEmail) {
        openAddEmailModal();
    } else {
        openChangeEmailModal();
    }
}

// ============================================================
// ADD EMAIL & PASSWORD (Phone-only users)
// ============================================================

function setupAddEmailModal() {
    const closeBtn = document.getElementById('addEmailModalClose');
    const cancelBtn = document.getElementById('cancelAddEmail');
    const addBtn = document.getElementById('addEmailPasswordBtn');
    
    if (closeBtn) closeBtn.addEventListener('click', closeAddEmailModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeAddEmailModal);
    if (addBtn) addBtn.addEventListener('click', handleAddEmailPassword);
}

function openAddEmailModal() {
    if (addEmailModal) {
        addEmailModal.classList.add('show');
        document.getElementById('addEmail').value = '';
        document.getElementById('addPassword').value = '';
        document.getElementById('addConfirmPassword').value = '';
        hideModalAlert('addEmailAlert');
    }
}

function closeAddEmailModal() {
    if (addEmailModal) {
        addEmailModal.classList.remove('show');
        document.getElementById('addEmail').value = '';
        document.getElementById('addPassword').value = '';
        document.getElementById('addConfirmPassword').value = '';
        hideModalAlert('addEmailAlert');
    }
}

async function handleAddEmailPassword() {
    const email = document.getElementById('addEmail').value.trim();
    const password = document.getElementById('addPassword').value;
    const confirmPassword = document.getElementById('addConfirmPassword').value;
    
    // Validation
    if (!email) {
        showModalAlert('addEmailAlert', 'Please enter an email address', 'error');
        return;
    }
    
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        showModalAlert('addEmailAlert', 'Please enter a valid email address', 'error');
        return;
    }
    
    if (!password) {
        showModalAlert('addEmailAlert', 'Please enter a password', 'error');
        return;
    }
    
    if (password.length < 6) {
        showModalAlert('addEmailAlert', 'Password must be at least 6 characters', 'error');
        return;
    }
    
    if (password !== confirmPassword) {
        showModalAlert('addEmailAlert', 'Passwords do not match', 'error');
        return;
    }
    
    try {
        showModalAlert('addEmailAlert', 'Adding email & password...', 'info');
        
        // Check if email already exists
        const emailQuery = query(collection(db, COLLECTIONS.USERS), where('userEmail', '==', email));
        const emailSnapshot = await getDocs(emailQuery);
        
        if (!emailSnapshot.empty && emailSnapshot.docs[0].id !== currentUser.uid) {
            showModalAlert('addEmailAlert', 'This email is already registered', 'error');
            return;
        }
        
        // Link email/password credential to phone account
        const credential = EmailAuthProvider.credential(email, password);
        await linkWithCredential(currentUser, credential);
        
        console.log('✅ Email/password linked successfully');
        
        // Update Firestore
        await updateDoc(doc(db, COLLECTIONS.USERS, currentUser.uid), {
            userEmail: email,
            userUpdatedAt: Date.now()
        });
        
        currentUserData.userEmail = email;
        if (emailInput) emailInput.value = email;
        
        showModalAlert('addEmailAlert', 'Email & password added!', 'success');
        
        setTimeout(() => {
            closeAddEmailModal();
            checkEmailAccountStatus();
            showAlert(i18next.t('settings.alerts.emailChangeSuccess'), 'success');
        }, 1500);
        
    } catch (error) {
        console.error('❌ Failed to add email/password:', error);
        
        let errorMsg = 'Failed to add email & password';
        
        if (error.code === 'auth/email-already-in-use') {
            errorMsg = 'This email is already in use';
        } else if (error.code === 'auth/weak-password') {
            errorMsg = 'Password is too weak';
        } else if (error.code === 'auth/provider-already-linked') {
            errorMsg = 'Email provider already linked';
        } else if (error.code === 'auth/credential-already-in-use') {
            errorMsg = 'This credential is already in use';
        }
        
        showModalAlert('addEmailAlert', errorMsg, 'error');
    }
}

// ============================================================
// CHANGE EMAIL (Users with existing email/password)
// ============================================================

function setupChangeEmailModal() {
    const closeBtn = document.getElementById('changeEmailModalClose');
    const cancelBtn = document.getElementById('cancelChangeEmail');
    const changeBtn = document.getElementById('changeEmailBtn2');
    
    if (closeBtn) closeBtn.addEventListener('click', closeChangeEmailModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeChangeEmailModal);
    if (changeBtn) changeBtn.addEventListener('click', handleChangeEmail);
}

function openChangeEmailModal() {
    if (changeEmailModal) {
        changeEmailModal.classList.add('show');
        document.getElementById('currentPasswordEmail').value = '';
        document.getElementById('newEmail').value = currentUserData.userEmail || '';
        hideModalAlert('changeEmailAlert');
    }
}

function closeChangeEmailModal() {
    if (changeEmailModal) {
        changeEmailModal.classList.remove('show');
        document.getElementById('currentPasswordEmail').value = '';
        document.getElementById('newEmail').value = '';
        hideModalAlert('changeEmailAlert');
    }
}

async function handleChangeEmail() {
    const currentPassword = document.getElementById('currentPasswordEmail').value;
    const newEmail = document.getElementById('newEmail').value.trim();
    const currentEmail = currentUserData.userEmail;
    
    // Validation
    if (!currentPassword) {
        showModalAlert('changeEmailAlert', 'Please enter your current password', 'error');
        return;
    }
    
    if (!newEmail) {
        showModalAlert('changeEmailAlert', 'Please enter a new email', 'error');
        return;
    }
    
    if (!newEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        showModalAlert('changeEmailAlert', 'Please enter a valid email address', 'error');
        return;
    }
    
    if (newEmail === currentEmail) {
        showModalAlert('changeEmailAlert', 'This is your current email', 'error');
        return;
    }
    
    try {
        showModalAlert('changeEmailAlert', 'Changing email...', 'info');
        
        // Check if new email already exists (exclude current user)
        const emailQuery = query(collection(db, COLLECTIONS.USERS), where('userEmail', '==', newEmail));
        const emailSnapshot = await getDocs(emailQuery);
        
        if (!emailSnapshot.empty && emailSnapshot.docs[0].id !== currentUser.uid) {
            showModalAlert('changeEmailAlert', 'This email is already registered', 'error');
            return;
        }
        
        // Reauthenticate with current password
        const credential = EmailAuthProvider.credential(currentEmail, currentPassword);
        await reauthenticateWithCredential(currentUser, credential);
        
        console.log('✅ Reauthenticated successfully');
        
        // Update email in Firebase Auth
        await updateEmail(currentUser, newEmail);
        
        // Update Firestore
        await updateDoc(doc(db, COLLECTIONS.USERS, currentUser.uid), {
            userEmail: newEmail,
            userUpdatedAt: Date.now()
        });
        
        currentUserData.userEmail = newEmail;
        if (emailInput) emailInput.value = newEmail;
        
        showModalAlert('changeEmailAlert', 'Email changed!', 'success');
        
        setTimeout(() => {
            closeChangeEmailModal();
            showAlert(i18next.t('settings.alerts.emailChangeSuccess'), 'success');
        }, 1500);
        
    } catch (error) {
        console.error('❌ Failed to change email:', error);
        
        let errorMsg = 'Failed to change email';
        
        if (error.code === 'auth/wrong-password') {
            errorMsg = 'Current password is incorrect';
        } else if (error.code === 'auth/email-already-in-use') {
            errorMsg = 'This email is already in use';
        } else if (error.code === 'auth/requires-recent-login') {
            errorMsg = 'Please sign out and sign back in, then try again';
        } else if (error.code === 'auth/invalid-email') {
            errorMsg = 'Invalid email format';
        }
        
        showModalAlert('changeEmailAlert', errorMsg, 'error');
    }
}

// ============================================================
// EMAIL CHANGE (Firebase Auth Standard) - REMOVED, REPLACED ABOVE
// ============================================================

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
    if (!hasPasswordProvider) {
        showAlert(i18next.t('settings.alerts.passwordChangeFailed'), 'error');
        return;
    }
    
    if (passwordChangeModal) {
        passwordChangeModal.classList.add('show');
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';
        hideModalAlert('passwordChangeAlert');
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
    
    if (newPassword === currentPassword) {
        showModalAlert('passwordChangeAlert', 'New password must be different from current password', 'error');
        return;
    }
    
    try {
        showModalAlert('passwordChangeAlert', 'Changing password...', 'info');
        
        // Reauthenticate with current password
        const credential = EmailAuthProvider.credential(currentUserData.userEmail, currentPassword);
        await reauthenticateWithCredential(currentUser, credential);
        
        console.log('✅ Reauthenticated successfully');
        
        // Update password
        await updatePassword(currentUser, newPassword);
        
        console.log('✅ Password updated successfully');
        
        showModalAlert('passwordChangeAlert', 'Password changed!', 'success');
        
        setTimeout(() => {
            closePasswordChangeModal();
            showAlert(i18next.t('settings.alerts.passwordChangeSuccess'), 'success');
        }, 1500);
        
    } catch (error) {
        console.error('❌ Password update failed:', error);
        
        let errorMsg = 'Failed to change password';
        
        if (error.code === 'auth/wrong-password') {
            errorMsg = 'Current password is incorrect';
        } else if (error.code === 'auth/weak-password') {
            errorMsg = 'New password is too weak';
        } else if (error.code === 'auth/requires-recent-login') {
            errorMsg = 'Please sign out and sign back in, then try again';
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
            showAlert(i18next.t('settings.alerts.saveSuccess'), 'info');
            setLoadingState(false);
            return;
        }
        
        const updateData = { userUpdatedAt: Date.now() };
        
        if (nameChanged) {
            updateData.userName = newUserName;
            await updateProfile(currentUser, { displayName: newUserName });
        }
        
        if (typeChanged) {
            updateData.userType = newUserType;
            showAlert(i18next.t('settings.alerts.saveSuccess'), 'success');
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
            showAlert(i18next.t('settings.alerts.saveSuccess'), 'success');
        }
        
    } catch (error) {
        console.error('❌ Error updating profile:', error);
        showAlert(i18next.t('settings.alerts.saveFailed'), 'error');
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
    if (!confirm(i18next.t('settings.alerts.logoutConfirm'))) return;
    
    try {
        setLoadingState(true);
        await signOut(auth);
        localStorage.removeItem('pigsoil_user');
        showAlert(i18next.t('settings.alerts.saveSuccess'), 'success');
        setTimeout(() => window.location.href = '/login.html', 1500);
    } catch (error) {
        console.error('❌ Logout error:', error);
        showAlert(i18next.t('settings.alerts.saveFailed'), 'error');
        setLoadingState(false);
    }
}

async function handleDeleteAccount() {
    if (!confirm(i18next.t('settings.alerts.accountDeleteConfirm'))) return;
    
    const confirmText = prompt('Type "DELETE MY ACCOUNT" to confirm:');
    if (confirmText !== 'DELETE MY ACCOUNT') {
        showAlert(i18next.t('settings.alerts.saveFailed'), 'info');
        return;
    }
    
    try {
        setLoadingState(true);
        showAlert(i18next.t('settings.alerts.saveFailed'), 'info');
        
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
        
        showAlert(i18next.t('settings.alerts.accountDeleted'), 'success');
        setTimeout(() => window.location.href = '/login.html', 2000);
        
    } catch (error) {
        console.error('❌ Delete error:', error);
        
        let errorMsg = i18next.t('settings.alerts.accountDeleteFailed');
        if (error.code === 'auth/requires-recent-login') {
            errorMsg = i18next.t('settings.alerts.accountDeleteFailed');
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

// ============================================================
// ADDRESS CHANGE MODAL (Google Maps)
// ============================================================

function setupAddressChangeModal() {
    const closeBtn = document.getElementById('addressModalClose');
    const cancelBtn = document.getElementById('cancelAddressChange');
    const confirmBtn = document.getElementById('confirmAddressChange');
    
    if (closeBtn) {
        closeBtn.addEventListener('click', closeAddressChangeModal);
    }
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeAddressChangeModal);
    }
    
    if (confirmBtn) {
        confirmBtn.addEventListener('click', handleConfirmAddressChange);
    }
    
    if (addressChangeModal) {
        addressChangeModal.addEventListener('click', function(e) {
            if (e.target === addressChangeModal) {
                closeAddressChangeModal();
            }
        });
    }
}

function openAddressChangeModal() {
    if (addressChangeModal) {
        addressChangeModal.classList.add('show');
        setTimeout(() => {
            initializeAddressMap();
        }, 300);
    }
}

function closeAddressChangeModal() {
    if (addressChangeModal) {
        addressChangeModal.classList.remove('show');
    }
}

function initializeAddressMap() {
    const mapContainer = document.getElementById('addressMapContainer');
    const addressSearch = document.getElementById('addressSearch');
    
    if (!mapContainer) {
        console.error('Map container not found');
        return;
    }
    
    addressMap = new google.maps.Map(mapContainer, {
        center: selectedAddress,
        zoom: 13,
        mapTypeId: 'roadmap',
        styles: [{ featureType: 'all', stylers: [{ saturation: -10 }] }]
    });
    
    addressMarker = new google.maps.Marker({
        position: selectedAddress,
        map: addressMap,
        draggable: true,
        title: 'Your address',
        animation: google.maps.Animation.DROP
    });
    
    if (addressSearch) {
        addressAutocomplete = new google.maps.places.Autocomplete(addressSearch, {
            bounds: new google.maps.LatLngBounds(
                new google.maps.LatLng(9.5, 123.0),
                new google.maps.LatLng(11.5, 125.0)
            ),
            strictBounds: true,
            componentRestrictions: { country: 'PH' }
        });
        
        addressAutocomplete.addListener('place_changed', () => {
            const place = addressAutocomplete.getPlace();
            if (place.geometry) {
                const location = {
                    lat: place.geometry.location.lat(),
                    lng: place.geometry.location.lng()
                };
                updateAddressMapLocation(location, place);
            }
        });
    }
    
    // Real-time preview update while dragging
    addressMarker.addListener('drag', (event) => {
        const location = {
            lat: event.latLng.lat(),
            lng: event.latLng.lng()
        };
        // Show dragging status in preview
        updateAddressPreviewWhileDragging(location);
    });
    
    // Final update when drag ends
    addressMarker.addListener('dragend', (event) => {
        const location = {
            lat: event.latLng.lat(),
            lng: event.latLng.lng()
        };
        reverseGeocodeAddress(location);
    });
    
    addressMap.addListener('click', (event) => {
        const location = {
            lat: event.latLng.lat(),
            lng: event.latLng.lng()
        };
        addressMarker.setPosition(location);
        addressMarker.setAnimation(google.maps.Animation.BOUNCE);
        setTimeout(() => addressMarker.setAnimation(null), 750);
        reverseGeocodeAddress(location);
    });
        updateAddressPreview();
}

function updateAddressMapLocation(location, place = null) {
    selectedAddress.lat = location.lat;
    selectedAddress.lng = location.lng;
    
    if (place && place.formatted_address) {
        selectedAddress.formattedAddress = place.formatted_address;
        selectedAddress.name = place.name || 'Selected Location';
        selectedAddress.address = place.formatted_address;
        selectedAddress.placeId = place.place_id || '';
    }
    
    if (addressMap && addressMarker) {
        addressMap.setCenter(location);
        addressMarker.setPosition(location);
    }
    
    // Update preview
    updateAddressPreview();
}

function updateAddressPreview() {
    const previewName = document.getElementById('previewAddressName');
    const previewDetails = document.getElementById('previewAddressDetails');
    
    if (previewName && selectedAddress) {
        previewName.textContent = selectedAddress.name || 'Selected Location';
        previewName.style.color = '#4CAF50';
        
        // Animate update
        previewName.style.transition = 'all 0.3s';
        previewName.style.transform = 'scale(1.05)';
        setTimeout(() => {
            previewName.style.transform = 'scale(1)';
        }, 300);
    }
    
    if (previewDetails && selectedAddress) {
        previewDetails.textContent = selectedAddress.formattedAddress || selectedAddress.address || 'Location selected';
    }
}

// Real-time preview update while dragging marker
function updateAddressPreviewWhileDragging(location) {
    const previewName = document.getElementById('previewAddressName');
    const previewDetails = document.getElementById('previewAddressDetails');
    
    if (previewName) {
        previewName.textContent = '📍 Dragging...';
        previewName.style.color = '#FF9800';
        previewName.style.transition = 'all 0.2s';
    }
    
    if (previewDetails) {
        const lat = location.lat.toFixed(6);
        const lng = location.lng.toFixed(6);
        previewDetails.textContent = `Lat: ${lat}, Lng: ${lng}`;
        previewDetails.style.color = '#999';
        previewDetails.style.fontFamily = 'monospace';
        previewDetails.style.fontSize = '13px';
    }
}

function reverseGeocodeAddress(location) {
    if (!addressGeocoder) return;
    
    // Show loading state immediately
    const previewName = document.getElementById('previewAddressName');
    const previewDetails = document.getElementById('previewAddressDetails');
    
    if (previewName) {
        previewName.textContent = '🔍 Finding address...';
        previewName.style.color = '#2196F3';
    }
    if (previewDetails) {
        previewDetails.textContent = 'Please wait...';
        previewDetails.style.color = '#999';
        previewDetails.style.fontFamily = 'Poppins, Arial, sans-serif';
        previewDetails.style.fontSize = '14px';
    }
    
    addressGeocoder.geocode({ location: location }, (results, status) => {
        if (status === 'OK' && results[0]) {
            const result = results[0];
            selectedAddress.lat = location.lat;
            selectedAddress.lng = location.lng;
            selectedAddress.formattedAddress = result.formatted_address;
            selectedAddress.name = extractAddressLocationName(result);
            selectedAddress.address = result.formatted_address;
            selectedAddress.placeId = result.place_id || '';
            
            // Update preview with success animation
            updateAddressPreview();
            
            // Flash success indicator
            if (previewName) {
                const originalColor = previewName.style.color;
                previewName.style.color = '#4CAF50';
                previewName.style.fontWeight = '600';
                setTimeout(() => {
                    previewName.style.fontWeight = '600';
                }, 500);
            }
        } else {
            // Handle error
            if (previewName) {
                previewName.textContent = '⚠️ Address not found';
                previewName.style.color = '#e74c3c';
            }
            if (previewDetails) {
                previewDetails.textContent = 'Please try a different location';
            }
        }
    });
}

function extractAddressLocationName(result) {
    console.log('📍 Extracting address from:', result.address_components.map(c => ({
        name: c.long_name,
        types: c.types
    })));
    
    // Priority 1: Establishment or Point of Interest (e.g., "SM City Cebu")
    for (let component of result.address_components) {
        if (component.types.includes('establishment') || 
            component.types.includes('point_of_interest')) {
            console.log('✅ Using establishment:', component.long_name);
            return component.long_name;
        }
    }
    
    // Priority 2: Route/Street Name (e.g., "Osmena Boulevard")
    for (let component of result.address_components) {
        if (component.types.includes('route')) {
            console.log('✅ Using route:', component.long_name);
            return component.long_name;
        }
    }
    
    // Priority 3: Neighborhood or Sublocality (e.g., "Mabolo", "IT Park")
    for (let component of result.address_components) {
        if (component.types.includes('neighborhood') || 
            component.types.includes('sublocality') ||
            component.types.includes('sublocality_level_1')) {
            console.log('✅ Using neighborhood:', component.long_name);
            return component.long_name;
        }
    }
    
    // Priority 4: Administrative Level 3 (often Barangay in Philippines)
    for (let component of result.address_components) {
        if (component.types.includes('administrative_area_level_3')) {
            console.log('✅ Using admin level 3:', component.long_name);
            return component.long_name;
        }
    }
    
    // Priority 5: Administrative Level 2 (municipality/city)
    for (let component of result.address_components) {
        if (component.types.includes('administrative_area_level_2')) {
            console.log('✅ Using admin level 2:', component.long_name);
            return component.long_name;
        }
    }
    
    // Priority 6: Locality (city name)
    for (let component of result.address_components) {
        if (component.types.includes('locality')) {
            console.log('✅ Using locality:', component.long_name);
            return component.long_name;
        }
    }
    
    // Fallback: Use first part of formatted address
    if (result.formatted_address) {
        const firstPart = result.formatted_address.split(',')[0].trim();
        console.log('✅ Using formatted address first part:', firstPart);
        return firstPart;
    }
    
    console.log('⚠️ Fallback to generic name');
    return 'Selected Location';
}

async function handleConfirmAddressChange() {
    if (!selectedAddress.lat || !selectedAddress.lng) {
        showModalAlert('addressAlert', 'Please select a valid address', 'error');
        return;
    }
    
    try {
        // Show loading state
        const confirmBtn = document.getElementById('confirmAddressChange');
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = '<span class="loading"></span> Saving...';
        }
        
        // Create address document in addresses collection
        const addressData = {
            addressCreatedAt: serverTimestamp(),
            addressLatitude: selectedAddress.lat,
            addressLongitude: selectedAddress.lng,
            addressName: selectedAddress.name || 'Selected Location',
            addressPlaceId: ''
        };
        
        const addressRef = await addDoc(collection(db, COLLECTIONS.ADDRESSES), addressData);
        const addressId = addressRef.id;
        console.log('✅ Address saved to addresses collection with ID:', addressId);
        
        // Update user document with new addressId
        const userDocRef = doc(db, COLLECTIONS.USERS, currentUser.uid);
        await updateDoc(userDocRef, {
            userAddressID: addressId,
            userUpdatedAt: Date.now()
        });
        
        // Update local data
        currentUserData.userAddressID = addressId;
        
        // Update UI
        if (addressInput) {
            addressInput.value = selectedAddress.name;
        }
        
        showModalAlert('addressAlert', 'Address saved successfully!', 'success');
        
        setTimeout(() => {
            closeAddressChangeModal();
            showAlert(i18next.t('settings.alerts.addressChangeSuccess'), 'success');
        }, 1500);
        
    } catch (error) {
        console.error('Error saving address:', error);
        showModalAlert('addressAlert', 'Error saving address: ' + error.message, 'error');
    } finally {
        const confirmBtn = document.getElementById('confirmAddressChange');
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = 'Save Address';
        }
    }
}

const style = document.createElement('style');
style.textContent = `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
document.head.appendChild(style);

console.log('✅ Profile Settings with complete Firebase integration loaded!');
