// Phone Registration functionality for PigSoil+ - Firebase Version
import { auth, db } from './init.js';
import { 
    signInWithPhoneNumber,
    RecaptchaVerifier
} from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js';

// Global variables
let recaptchaVerifier = null;

// DOM elements
const phoneForm = document.getElementById('phoneForm');
const phoneButton = document.getElementById('phoneButton');
const phoneInput = document.getElementById('phone');
const alertMessage = document.getElementById('alertMessage');

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    initializeRecaptcha();
});

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