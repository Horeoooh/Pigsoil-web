// SMS Verification functionality for PigSoil+ - Firebase Version with Caching
import { auth, db } from './init.js';
import { 
    signInWithPhoneNumber,
    RecaptchaVerifier,
    onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js';
import { 
    doc, 
    getDoc,
    setDoc,
    collection, 
    query, 
    where, 
    getDocs 
} from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js';
import { 
    cacheCompleteUserData, 
    DEFAULT_PROFILE_PIC 
} from './shared-user-manager.js';

// Global variables
let recaptchaVerifier = null;
let confirmationResult = null;
let pendingVerificationData = null;
let verifiedUser = null;

// DOM elements
const codeInputs = document.querySelectorAll('.inputs input');
const verifyBtn = document.getElementById('verifyBtn');
const resendBtn = document.getElementById('resendBtn');
const phoneDisplay = document.getElementById('phoneDisplay');
const verificationContainer = document.getElementById('verificationContainer');
const completeProfileContainer = document.getElementById('completeProfileContainer');
const completeProfileForm = document.getElementById('completeProfileForm');
const profileAlertMessage = document.getElementById('profileAlertMessage');

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    checkIfAlreadyLoggedIn();
    loadPendingVerificationData();
    setupCodeInputs();
    setupEventListeners();
    initializeRecaptcha();
});

// Check if user is already logged in and redirect to appropriate dashboard
function checkIfAlreadyLoggedIn() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log('👤 User already logged in:', user.uid);
            
            // Allow unverified users to access SMS verification
            if (!user.emailVerified && user.providerData[0]?.providerId === 'password') {
                console.log('📧 Email not verified - allowing access to SMS verification');
                return;
            }
            
            try {
                // Get user data from Firestore
                const userDocRef = doc(db, 'users', user.uid);
                const userDoc = await getDoc(userDocRef);
                
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    const userType = userData.userType;
                    
                    console.log('🔍 User type detected:', userType);
                    
                    // Store user data in localStorage
                    localStorage.setItem('pigsoil_user', JSON.stringify({
                        uid: user.uid,
                        userName: userData.userName,
                        userType: userType,
                        userPhone: userData.userPhone,
                        userPhoneVerified: userData.userPhoneVerified
                    }));
                    
                    // Redirect based on user type
                    if (userType === 'swine_farmer' || userType === 'Swine Farmer') {
                        console.log('🐷 Redirecting swine farmer to dashboard');
                        showSuccess(i18next.t('login.success.loginSuccessful'));
                        setTimeout(() => {
                            window.location.href = '/dashboard.html';
                        }, 1500);
                    } else if (userType === 'fertilizer_buyer' || userType === 'Organic Fertilizer Buyer') {
                        console.log('🌿 Redirecting fertilizer buyer to buyer dashboard');
                        showSuccess(i18next.t('login.success.loginSuccessful'));
                        setTimeout(() => {
                            window.location.href = '/buyer-dashboard.html';
                        }, 1500);
                    } else {
                        console.log('⚠️ Unknown user type, defaulting to farmer dashboard');
                        setTimeout(() => {
                            window.location.href = '/dashboard.html';
                        }, 1500);
                    }
                }
            } catch (error) {
                console.error('Error checking user data:', error);
                // Continue with verification process if error occurs
            }
        } else {
            console.log('👤 No user logged in, continue with verification');
        }
    });
}

// Load pending verification data from localStorage
function loadPendingVerificationData() {
    const pending = localStorage.getItem('pendingPhoneVerification');
    if (pending) {
        pendingVerificationData = JSON.parse(pending);
        
        // Display phone number
        if (phoneDisplay && pendingVerificationData.phone) {
            phoneDisplay.textContent = pendingVerificationData.phone;
        }
        
        // Check if we have confirmation result from previous page
        if (window.confirmationResult) {
            confirmationResult = window.confirmationResult;
        } else {
            // Start phone verification automatically if no confirmation result
            startPhoneVerification(pendingVerificationData.phone);
        }
    } else {
        // No pending data, redirect back to phone registration
        window.location.href = '/phone-registration.html';
    }
}

// Initialize reCAPTCHA
function initializeRecaptcha() {
    if (!recaptchaVerifier) {
        let recaptchaContainer = document.getElementById('recaptcha-container');
        if (!recaptchaContainer) {
            recaptchaContainer = document.createElement('div');
            recaptchaContainer.id = 'recaptcha-container';
            recaptchaContainer.style.display = 'none';
            document.body.appendChild(recaptchaContainer);
        }

        recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
            'size': 'invisible',
            'callback': (response) => {
                console.log('reCAPTCHA solved');
            },
            'expired-callback': () => {
                console.log('reCAPTCHA expired');
                showError(i18next.t('signup.errors.signupFailed'));
            }
        });
    }
    return recaptchaVerifier;
}

// Start phone verification
async function startPhoneVerification(phoneNumber) {
    try {
        showLoading(true);
        
        const recaptcha = initializeRecaptcha();
        confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, recaptcha);
        
        console.log('SMS sent successfully');
        showSuccess(i18next.t('smsVerification.success.smsSent'));
        
    } catch (error) {
        console.error('SMS sending failed:', error);
        handleSMSError(error);
    } finally {
        showLoading(false);
    }
}

// Verify SMS code
async function verifySMSCode(code) {
    try {
        showLoading(true);
        
        if (!confirmationResult) {
            throw new Error(i18next.t('signup.errors.signupFailed'));
        }

        // Confirm the SMS code - this creates/signs in the Firebase Auth user
        const result = await confirmationResult.confirm(code);
        verifiedUser = result.user;
        
        console.log('Phone verification successful:', verifiedUser.uid);
        
        // Check if user profile exists in Firestore
        const userDoc = await getDoc(doc(db, 'users', verifiedUser.uid));
        
        if (userDoc.exists()) {
            // Existing user - go to dashboard
            const userData = userDoc.data();
            localStorage.setItem('pigsoil_user', JSON.stringify(userData));
            localStorage.removeItem('pendingPhoneVerification');
            
            showSuccess(i18next.t('smsVerification.success.welcomeBack'));
            
            setTimeout(() => {
               if (userData.userType === 'swine_farmer') {
                    window.location.href = '/dashboard.html';
                } else {
                    window.location.href = '/marketplace.html';
                }
            }, 2000);
        } else {
            // New user - show complete profile form
            showSuccess(i18next.t('smsVerification.success.phoneVerified'));
            setTimeout(() => {
                verificationContainer.style.display = 'none';
                completeProfileContainer.style.display = 'block';
            }, 1500);
        }
        
    } catch (error) {
        console.error('SMS verification failed:', error);
        handleVerificationError(error);
    } finally {
        showLoading(false);
    }
}

// Complete user profile (NO email/password, just username and userType)
async function completeUserProfile(profileData) {
    try {
        setProfileLoading(true);
        
        // Validate inputs
        if (!profileData.username || profileData.username.length < 3) {
            throw new Error(i18next.t('signup.errors.usernameShort'));
        }
        
        if (profileData.username.length > 30) {
            throw new Error(i18next.t('signup.errors.usernameLong'));
        }
        
        if (!profileData.userType) {
            throw new Error(i18next.t('signup.errors.fillAllFields'));
        }
        
        // Check if username exists
        const usernameExists = await checkUsernameExists(profileData.username);
        if (usernameExists) {
            throw new Error(i18next.t('signup.errors.usernameTaken'));
        }
        
        const userType = profileData.userType; // Keep as 'swine_farmer' or 'fertilizer_buyer'
        const completeUserData = {
            userID: verifiedUser.uid,
            userName: profileData.username,
            userEmail: null,
            userPhone: pendingVerificationData.phone,
            userType: userType,
            userIsActive: true,
            userPhoneVerified: true,
            userProfilePictureUrl: DEFAULT_PROFILE_PIC,
            userCreatedAt: Date.now(),
            userUpdatedAt: Date.now(),
            isPro: false,
            isDualRole: false,
            autoRenew: false,
            userIsOnline: false,
            weeklyCameraAiUsed: 0,
            weeklyManongBotPromptsUsed: 0
        };
        
        await setDoc(doc(db, 'users', verifiedUser.uid), completeUserData);
        
        // Cache the complete user data including profile picture
        console.log('💾 Caching user data after phone verification');
        cacheCompleteUserData(completeUserData);
        
        // Store user data in localStorage (backward compatibility)
        localStorage.setItem('pigsoil_user', JSON.stringify({
            uid: verifiedUser.uid,
            userName: profileData.username,
            userType: userType,
            userPhone: pendingVerificationData.phone,
            userPhoneVerified: true
        }));
        localStorage.removeItem('pendingPhoneVerification');
        
        showProfileSuccess(i18next.t('signup.success.accountCreated'));
        
        // Redirect based on user type
        setTimeout(() => {
            if (profileData.userType === 'swine_farmer') {
                window.location.href = '/dashboard.html';
            } else {
                window.location.href = '/buyer-dashboard.html';
            }
        }, 2000);
        
    } catch (error) {
        console.error('Profile completion failed:', error);
        handleProfileError(error);
    } finally {
        setProfileLoading(false);
    }
}

// Check if username exists
async function checkUsernameExists(username) {
    try {
        const q = query(collection(db, 'users'), where('userName', '==', username));
        const querySnapshot = await getDocs(q);
        return !querySnapshot.empty;
    } catch (error) {
        console.error('Username check failed:', error);
        return false;
    }
}

// Handle SMS sending errors
function handleSMSError(error) {
    let errorMessage = i18next.t('signup.errors.signupFailed');
    
    switch (error.code) {
        case 'auth/invalid-phone-number':
            errorMessage = i18next.t('login.errors.invalidEmail');
            break;
        case 'auth/too-many-requests':
            errorMessage = i18next.t('login.errors.tooManyAttempts');
            break;
        case 'auth/quota-exceeded':
            errorMessage = i18next.t('login.errors.tooManyAttempts');
            break;
    }
    
    showError(errorMessage);
}

// Handle verification errors
function handleVerificationError(error) {
    let errorMessage = i18next.t('login.errors.invalidCredentials');
    
    switch (error.code) {
        case 'auth/invalid-verification-code':
            errorMessage = i18next.t('login.errors.invalidCredentials');
            break;
        case 'auth/code-expired':
            errorMessage = i18next.t('login.errors.tooManyAttempts');
            break;
        case 'auth/session-expired':
            errorMessage = i18next.t('login.errors.tooManyAttempts');
            break;
    }
    
    showError(errorMessage);
    clearCodeInputs();
}

// Handle profile completion errors
function handleProfileError(error) {
    let errorMessage = i18next.t('signup.errors.signupFailed');
    
    if (error.message.includes('already taken') || error.message.includes('at least') || error.message.includes('exceed')) {
        errorMessage = error.message;
    }
    
    showProfileError(errorMessage);
}

// Setup code input functionality
function setupCodeInputs() {
    codeInputs.forEach((input, index) => {
        input.addEventListener('input', function(e) {
            const value = e.target.value;
            
            // Only allow numeric input
            if (!/^\d*$/.test(value)) {
                e.target.value = '';
                return;
            }
            
            // Add typing animation
            this.classList.add('typing');
            setTimeout(() => {
                this.classList.remove('typing');
            }, 300);
            
            // Auto-focus next input
            if (value && index < codeInputs.length - 1) {
                codeInputs[index + 1].focus();
            }
            
            // Auto-verify when all inputs are filled
            checkAutoVerify();
        });
        
        input.addEventListener('keydown', function(e) {
            // Handle backspace
            if (e.key === 'Backspace' && !this.value && index > 0) {
                codeInputs[index - 1].focus();
            }
        });
        
        input.addEventListener('paste', function(e) {
            e.preventDefault();
            const paste = e.clipboardData.getData('text');
            const digits = paste.replace(/\D/g, '').slice(0, 6);
            
            // Fill inputs with pasted digits
            for (let i = 0; i < digits.length && i < codeInputs.length; i++) {
                codeInputs[i].value = digits[i];
            }
            
            checkAutoVerify();
        });
    });
}

// Check if all inputs are filled and auto-verify
function checkAutoVerify() {
    const code = getEnteredCode();
    if (code.length === 6) {
        setTimeout(() => {
            verifySMSCode(code);
        }, 500);
    }
}

// Get the complete entered code
function getEnteredCode() {
    return Array.from(codeInputs).map(input => input.value).join('');
}

// Clear all code inputs
function clearCodeInputs() {
    codeInputs.forEach(input => {
        input.value = '';
    });
    codeInputs[0].focus();
}

// Setup event listeners
function setupEventListeners() {
    // Verify button click
    if (verifyBtn) {
        verifyBtn.addEventListener('click', function(e) {
            e.preventDefault();
            const code = getEnteredCode();
            
            if (code.length !== 6) {
                showError(i18next.t('login.errors.fillAllFields'));
                return;
            }
            
            verifySMSCode(code);
        });
    }
    
    // Resend button click
    if (resendBtn) {
        resendBtn.addEventListener('click', function() {
            if (pendingVerificationData && pendingVerificationData.phone) {
                // Clear previous reCAPTCHA
                if (recaptchaVerifier) {
                    recaptchaVerifier.clear();
                    recaptchaVerifier = null;
                }
                
                clearCodeInputs();
                startPhoneVerification(pendingVerificationData.phone);
            }
        });
    }
    
    // Complete profile form submission
    if (completeProfileForm) {
        completeProfileForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const formData = new FormData(completeProfileForm);
            const profileData = {
                username: formData.get('username').trim(),
                userType: formData.get('userType')
            };
            
            completeUserProfile(profileData);
        });
    }
}

// UI Helper functions
function showLoading(isLoading) {
    if (verifyBtn) {
        if (isLoading) {
            verifyBtn.textContent = i18next.t('login.signingIn');
            verifyBtn.style.opacity = '0.7';
            verifyBtn.disabled = true;
        } else {
            verifyBtn.textContent = i18next.t('smsVerification.verifyButton');
            verifyBtn.style.opacity = '1';
            verifyBtn.disabled = false;
        }
    }
    
    if (resendBtn) {
        resendBtn.style.opacity = isLoading ? '0.5' : '1';
        resendBtn.style.pointerEvents = isLoading ? 'none' : 'auto';
    }
}

function setProfileLoading(isLoading) {
    const completeProfileBtn = document.getElementById('completeProfileBtn');
    if (completeProfileBtn) {
        if (isLoading) {
            completeProfileBtn.textContent = i18next.t('signup.creatingAccount');
            completeProfileBtn.style.opacity = '0.7';
            completeProfileBtn.disabled = true;
        } else {
            completeProfileBtn.textContent = i18next.t('smsVerification.completeProfile.completeButton');
            completeProfileBtn.style.opacity = '1';
            completeProfileBtn.disabled = false;
        }
    }
}

function showError(message) {
    let alertDiv = document.getElementById('error-alert');
    if (!alertDiv) {
        alertDiv = document.createElement('div');
        alertDiv.id = 'error-alert';
        alertDiv.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #ff4757;
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(255, 71, 87, 0.3);
        `;
        document.body.appendChild(alertDiv);
    }
    
    alertDiv.textContent = message;
    alertDiv.style.display = 'block';
    
    setTimeout(() => {
        if (alertDiv) {
            alertDiv.style.display = 'none';
        }
    }, 5000);
}

function showSuccess(message) {
    let alertDiv = document.getElementById('success-alert');
    if (!alertDiv) {
        alertDiv = document.createElement('div');
        alertDiv.id = 'success-alert';
        alertDiv.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #2ed573;
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(46, 213, 115, 0.3);
        `;
        document.body.appendChild(alertDiv);
    }
    
    alertDiv.textContent = message;
    alertDiv.style.display = 'block';
    
    setTimeout(() => {
        if (alertDiv) {
            alertDiv.style.display = 'none';
        }
    }, 5000);
}

function showProfileError(message) {
    if (profileAlertMessage) {
        profileAlertMessage.textContent = message;
        profileAlertMessage.className = 'alert error';
        profileAlertMessage.style.display = 'block';
        profileAlertMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => {
            profileAlertMessage.style.display = 'none';
        }, 6000);
    }
}

function showProfileSuccess(message) {
    if (profileAlertMessage) {
        profileAlertMessage.textContent = message;
        profileAlertMessage.className = 'alert success';
        profileAlertMessage.style.display = 'block';
        profileAlertMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}