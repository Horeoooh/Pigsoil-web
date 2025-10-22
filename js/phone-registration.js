// Phone Registration functionality for PigSoil+ - Firebase Version
import { auth, db } from './init.js';
import { 
    signInWithPhoneNumber,
    RecaptchaVerifier,
    onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js';
import { 
    doc, 
    getDoc
} from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js';

// Global variables
let recaptchaVerifier = null;

// DOM elements
const phoneForm = document.getElementById('phoneForm');
const phoneButton = document.getElementById('phoneButton');
const phoneInput = document.getElementById('phone');
const alertMessage = document.getElementById('alertMessage');

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    checkIfAlreadyLoggedIn();
    setupEventListeners();
    initializeRecaptcha();
});

// Check if user is already logged in and redirect to appropriate dashboard
function checkIfAlreadyLoggedIn() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log('👤 User already logged in:', user.uid);
            
            // Allow unverified users to access phone registration
            if (!user.emailVerified && user.providerData[0]?.providerId === 'password') {
                console.log('📧 Email not verified - allowing access to phone registration');
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
                        showAlert('Already logged in! Redirecting to dashboard...', 'success');
                        setTimeout(() => {
                            window.location.href = '/dashboard.html';
                        }, 1500);
                    } else if (userType === 'fertilizer_buyer' || userType === 'Organic Fertilizer Buyer') {
                        console.log('🌿 Redirecting fertilizer buyer to buyer dashboard');
                        showAlert('Already logged in! Redirecting to buyer dashboard...', 'success');
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
                // Continue with phone registration if error occurs
            }
        } else {
            console.log('👤 No user logged in, continue with phone registration');
        }
    });
}

// Initialize reCAPTCHA
function initializeRecaptcha() {
    if (!recaptchaVerifier) {
        recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
            'size': 'invisible',
            'callback': (response) => {
                console.log('reCAPTCHA solved');
            },
            'expired-callback': () => {
                console.log('reCAPTCHA expired');
                showAlert('reCAPTCHA expired. Please try again.', 'error');
            }
        });
    }
    return recaptchaVerifier;
}

// Validate phone number
function validatePhoneNumber(phone) {
    const phoneRegex = /^\+639\d{9}$/;
    return phoneRegex.test(phone);
}

// Start phone verification
async function startPhoneVerification(phoneNumber) {
    try {
        setLoading(true);
        
        // Validate phone format
        if (!validatePhoneNumber(phoneNumber)) {
            throw new Error('Please enter a valid Philippine mobile number (e.g., +639129731720).');
        }
        
        const recaptcha = initializeRecaptcha();
        const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, recaptcha);
        
        console.log('SMS sent successfully');
        
        // Store confirmation result and phone for SMS verification page
        window.confirmationResult = confirmationResult;
        localStorage.setItem('pendingPhoneVerification', JSON.stringify({
            phone: phoneNumber
        }));
        
        showAlert('SMS code sent successfully!', 'success');
        
        // Redirect to SMS verification
        setTimeout(() => {
            window.location.href = '/sms-verification.html';
        }, 2000);
        
    } catch (error) {
        console.error('SMS sending failed:', error);
        handleSMSError(error);
    } finally {
        setLoading(false);
    }
}

// Handle SMS sending errors
function handleSMSError(error) {
    let errorMessage = 'Failed to send SMS code. Please try again.';
    
    if (error.message.includes('valid Philippine mobile')) {
        errorMessage = error.message;
    } else {
        switch (error.code) {
            case 'auth/invalid-phone-number':
                errorMessage = 'Invalid phone number format.';
                break;
            case 'auth/too-many-requests':
                errorMessage = 'Too many requests. Please try again later.';
                break;
            case 'auth/quota-exceeded':
                errorMessage = 'SMS quota exceeded. Please try again later.';
                break;
        }
    }
    
    showAlert(errorMessage, 'error');
}

// Setup event listeners
function setupEventListeners() {
    // Phone form submission
    if (phoneForm) {
        phoneForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const phone = phoneInput.value.trim();
            if (!phone) {
                showAlert('Please enter your phone number.', 'error');
                return;
            }
            
            startPhoneVerification(phone);
        });
    }
}

// UI Helper functions
function setLoading(loading) {
    if (phoneButton) {
        if (loading) {
            phoneButton.classList.add('loading');
            phoneButton.innerHTML = '<span>Sending Code...</span>';
            phoneButton.disabled = true;
        } else {
            phoneButton.classList.remove('loading');
            phoneButton.innerHTML = '<span>📱</span><span>Send Verification Code</span>';
            phoneButton.disabled = false;
        }
    }
    
    if (phoneInput) {
        phoneInput.disabled = loading;
    }
}

function showAlert(message, type = 'error') {
    if (alertMessage) {
        alertMessage.textContent = message;
        alertMessage.className = `alert ${type}`;
        alertMessage.style.display = 'block';
        alertMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => {
            alertMessage.style.display = 'none';
        }, 6000);
    }
}