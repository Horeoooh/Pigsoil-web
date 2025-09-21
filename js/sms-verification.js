// SMS Verification functionality for PigSoil+ - Firebase Version
import { auth, db } from './init.js';
import { 
    signInWithPhoneNumber,
    RecaptchaVerifier,
    updateProfile
} from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js';
import { 
    doc, 
    updateDoc 
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
    loadPendingUserData();
    setupCodeInputs();
    setupEventListeners();
    initializeRecaptcha();
});

// Load pending user data from localStorage
function loadPendingUserData() {
    const pending = localStorage.getItem('pendingSignup');
    if (pending) {
        pendingUserData = JSON.parse(pending);
        
        // Display phone number
        if (phoneDisplay && pendingUserData.phone) {
            phoneDisplay.textContent = pendingUserData.phone;
        }
        
        // Start phone verification automatically
        startPhoneVerification(pendingUserData.phone);
    } else {
        // No pending data, redirect back to signup
        window.location.href = 'signup.html';
    }
}

// Initialize reCAPTCHA
function initializeRecaptcha() {
    if (!recaptchaVerifier) {
        // Create invisible reCAPTCHA container
        const recaptchaContainer = document.createElement('div');
        recaptchaContainer.id = 'recaptcha-container';
        recaptchaContainer.style.display = 'none';
        document.body.appendChild(recaptchaContainer);

        recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
            'size': 'invisible',
            'callback': (response) => {
                console.log('reCAPTCHA solved');
            },
            'expired-callback': () => {
                console.log('reCAPTCHA expired');
                showError('reCAPTCHA expired. Please try again.');
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
        showSuccess('SMS code sent successfully!');
        
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
            throw new Error('No verification in progress. Please resend code.');
        }

        // Confirm the SMS code
        const result = await confirmationResult.confirm(code);
        const user = result.user;
        
        console.log('Phone verification successful:', user.uid);
        
        // Update user's phone verification status in Firestore
        await updateDoc(doc(db, 'users', user.uid), {
            userPhoneVerified: true,
            userUpdatedAt: Date.now()
        });
        
        // Store complete user data
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
    let errorMessage = 'Failed to send SMS code. Please try again.';
    
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
    
    showError(errorMessage);
}

// Handle verification errors
function handleVerificationError(error) {
    let errorMessage = 'Invalid verification code. Please try again.';
    
    switch (error.code) {
        case 'auth/invalid-verification-code':
            errorMessage = 'Invalid verification code. Please check and try again.';
            break;
        case 'auth/code-expired':
            errorMessage = 'Verification code has expired. Please request a new one.';
            break;
        case 'auth/session-expired':
            errorMessage = 'Session expired. Please request a new verification code.';
            break;
    }
    
    showError(errorMessage);
    clearCodeInputs();
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
                showError('Please enter the complete 6-digit code.');
                return;
            }
            
            verifySMSCode(code);
        });
    }
    
    // Resend button click
    if (resendBtn) {
        resendBtn.addEventListener('click', function() {
            if (pendingUserData && pendingUserData.phone) {
                // Clear previous reCAPTCHA
                if (recaptchaVerifier) {
                    recaptchaVerifier.clear();
                    recaptchaVerifier = null;
                }
                
                clearCodeInputs();
                startPhoneVerification(pendingUserData.phone);
            }
        });
    }
}

// UI Helper functions
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
    // Create or update error alert
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
    // Create or update success alert
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