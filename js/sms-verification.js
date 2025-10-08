// SMS Verification functionality for PigSoil+ - Firebase Version (FIXED)
import { auth, db } from './init.js';
import { 
    signInWithPhoneNumber,
    RecaptchaVerifier,
    onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js';
import { 
    doc, 
    updateDoc,
    getDoc 
} from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js';

// Global variables
let recaptchaVerifier = null;
let confirmationResult = null;
let pendingUserData = null;

// DOM elements
const codeInputs = document.querySelectorAll('.inputs input');
const verifyBtn = document.querySelector('.btn');
const resendBtn = document.querySelector('.resend');
const phoneDisplay = document.querySelector('p');

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    console.log('SMS Verification page loaded');
    loadPendingUserData();
    setupCodeInputs();
    setupEventListeners();
    
    // Wait a moment before initializing reCAPTCHA and sending SMS
    setTimeout(() => {
        initializeRecaptcha();
        if (pendingUserData && pendingUserData.phone) {
            startPhoneVerification(pendingUserData.phone);
        }
    }, 1000);
});

// Load pending user data from localStorage
function loadPendingUserData() {
    const pending = localStorage.getItem('pendingSignup');
    console.log('Pending signup data:', pending);
    
    if (pending) {
        try {
            pendingUserData = JSON.parse(pending);
            
            // Display phone number
            if (phoneDisplay && pendingUserData.phone) {
                phoneDisplay.textContent = pendingUserData.phone;
                console.log('Displaying phone number:', pendingUserData.phone);
            }
        } catch (error) {
            console.error('Error parsing pending signup data:', error);
            showError('Invalid signup data. Please start over.');
            setTimeout(() => {
                window.location.href = '/html/signup.html';
            }, 2000);
        }
    } else {
        console.log('No pending signup data, redirecting to signup');
        showError('No signup session found. Redirecting...');
        setTimeout(() => {
            window.location.href = '/html/signup.html';
        }, 2000);
    }
}

// Initialize reCAPTCHA
function initializeRecaptcha() {
    try {
        if (!recaptchaVerifier) {
            // Create invisible reCAPTCHA container if it doesn't exist
            let recaptchaContainer = document.getElementById('recaptcha-container');
            if (!recaptchaContainer) {
                recaptchaContainer = document.createElement('div');
                recaptchaContainer.id = 'recaptcha-container';
                recaptchaContainer.style.display = 'none';
                document.body.appendChild(recaptchaContainer);
                console.log('Created reCAPTCHA container');
            }

            recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
                'size': 'invisible',
                'callback': (response) => {
                    console.log('reCAPTCHA solved successfully');
                },
                'expired-callback': () => {
                    console.log('reCAPTCHA expired');
                    showError('Security verification expired. Please try again.');
                }
            });
            
            console.log('reCAPTCHA verifier initialized');
        }
        return recaptchaVerifier;
    } catch (error) {
        console.error('reCAPTCHA initialization failed:', error);
        showError('Security verification failed to initialize.');
        return null;
    }
}

// Start phone verification
async function startPhoneVerification(phoneNumber) {
    try {
        console.log('Starting phone verification for:', phoneNumber);
        showLoading(true);
        
        const recaptcha = initializeRecaptcha();
        if (!recaptcha) {
            throw new Error('reCAPTCHA initialization failed');
        }
        
        console.log('Sending SMS to:', phoneNumber);
        confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, recaptcha);
        
        console.log('SMS sent successfully');
        showSuccess('Verification code sent to your phone!');
        
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
        console.log('Verifying SMS code:', code);
        showLoading(true);
        
        if (!confirmationResult) {
            throw new Error('No verification in progress. Please resend code.');
        }

        // Confirm the SMS code
        const result = await confirmationResult.confirm(code);
        const user = result.user;
        
        console.log('Phone verification successful for user:', user.uid);
        
        // Check if user document exists in Firestore
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
            // Update user's phone verification status
            await updateDoc(userDocRef, {
                userPhoneVerified: true,
                userUpdatedAt: Date.now()
            });
            console.log('Updated user verification status in Firestore');
        } else {
            console.error('User document not found in Firestore');
        }
        
        // Store complete user data for the session
        const completeUserData = {
            uid: user.uid,
            email: pendingUserData.email,
            userName: pendingUserData.username,
            userType: pendingUserData.userType === 'swine_farmer' ? 'Swine Farmer' : 'Organic Fertilizer Buyer',
            userPhone: pendingUserData.phone,
            userPhoneVerified: true
        };
        
        localStorage.setItem('pigsoil_user', JSON.stringify(completeUserData));
        localStorage.removeItem('pendingSignup');
        
        showSuccess('Phone verification successful! Redirecting...');
        
        // Redirect based on user type
        setTimeout(() => {
            if (pendingUserData.userType === 'swine_farmer') {
                window.location.href = '/html/dashboard.html';
            } else {
                window.location.href = '/html/marketplace.html';
            }
        }, 2000);
        
    } catch (error) {
        console.error('SMS verification failed:', error);
        handleVerificationError(error);
    } finally {
        showLoading(false);
    }
}

// Handle SMS sending errors
function handleSMSError(error) {
    console.error('SMS Error details:', error);
    let errorMessage = 'Failed to send verification code. Please try again.';
    
    switch (error.code) {
        case 'auth/invalid-phone-number':
            errorMessage = 'Invalid phone number format. Please check the number and try again.';
            break;
        case 'auth/too-many-requests':
            errorMessage = 'Too many SMS requests. Please wait a few minutes before trying again.';
            break;
        case 'auth/quota-exceeded':
            errorMessage = 'SMS quota exceeded. Please try again later.';
            break;
        case 'auth/captcha-check-failed':
            errorMessage = 'Security verification failed. Please ensure you are accessing from an authorized domain.';
            break;
        case 'auth/missing-app-credential':
            errorMessage = 'Firebase configuration error. Please contact support.';
            break;
        default:
            if (error.message && error.message.includes('captcha')) {
                errorMessage = 'Security verification failed. Please refresh the page and try again.';
            } else if (error.message) {
                errorMessage = error.message;
            }
            break;
    }
    
    showError(errorMessage);
}

// Handle verification errors
function handleVerificationError(error) {
    console.error('Verification Error details:', error);
    let errorMessage = 'Invalid verification code. Please try again.';
    
    switch (error.code) {
        case 'auth/invalid-verification-code':
            errorMessage = 'Invalid verification code. Please check and try again.';
            break;
        case 'auth/code-expired':
            errorMessage = 'Verification code has expired. Please request a new one.';
            break;
        case 'auth/session-expired':
            errorMessage = 'Verification session expired. Please request a new code.';
            break;
        case 'auth/too-many-requests':
            errorMessage = 'Too many failed attempts. Please wait before trying again.';
            break;
        default:
            if (error.message) {
                errorMessage = error.message;
            }
            break;
    }
    
    showError(errorMessage);
    clearCodeInputs();
}

// Setup code input functionality (unchanged)
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
    if (codeInputs.length > 0) {
        codeInputs[0].focus();
    }
}

// Setup event listeners
function setupEventListeners() {
    // Verify button click
    if (verifyBtn) {
        verifyBtn.addEventListener('click', function(e) {
            e.preventDefault();
            const code = getEnteredCode();
            
            if (code.length !== 6) {
                showError('Please enter the complete 6-digit verification code.');
                return;
            }
            
            verifySMSCode(code);
        });
    }
    
    // Resend button click
    if (resendBtn) {
        resendBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Resend button clicked');
            
            if (pendingUserData && pendingUserData.phone) {
                // Clear previous reCAPTCHA and confirmation
                if (recaptchaVerifier) {
                    try {
                        recaptchaVerifier.clear();
                    } catch (error) {
                        console.log('Error clearing reCAPTCHA:', error);
                    }
                    recaptchaVerifier = null;
                }
                
                confirmationResult = null;
                clearCodeInputs();
                
                // Wait a moment then reinitialize and resend
                setTimeout(() => {
                    initializeRecaptcha();
                    startPhoneVerification(pendingUserData.phone);
                }, 1000);
            } else {
                showError('No phone number available. Please return to signup.');
            }
        });
    }
}

// UI Helper functions (unchanged)
function showLoading(isLoading) {
    if (verifyBtn) {
        if (isLoading) {
            verifyBtn.textContent = 'Verifying...';
            verifyBtn.style.opacity = '0.7';
            verifyBtn.disabled = true;
        } else {
            verifyBtn.textContent = 'Verify';
            verifyBtn.style.opacity = '1';
            verifyBtn.disabled = false;
        }
    }
    
    if (resendBtn) {
        resendBtn.style.opacity = isLoading ? '0.5' : '1';
        resendBtn.style.pointerEvents = isLoading ? 'none' : 'auto';
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
    }, 8000);
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