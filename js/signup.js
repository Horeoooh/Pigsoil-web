// Signup functionality for PigSoil+ - Firebase Version (CORRECTED)
import { auth, db } from './init.js';
import { 
    createUserWithEmailAndPassword,
    signInWithPhoneNumber,
    RecaptchaVerifier
} from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js';
import { 
    doc, 
    setDoc, 
    collection, 
    query, 
    where, 
    getDocs 
} from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js';

// DOM elements
const signupForm = document.getElementById('signupForm');
const signupButton = document.getElementById('signupButton');
const alertMessage = document.getElementById('alertMessage');
const inputs = document.querySelectorAll('.form-input');

let recaptchaVerifier = null;
let confirmationResult = null;

// Helper functions
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

function setLoading(loading) {
    if (signupButton) {
        if (loading) {
            signupButton.classList.add('loading');
            signupButton.innerHTML = '<span>Creating Account...</span>';
            signupButton.disabled = true;
        } else {
            signupButton.classList.remove('loading');
            signupButton.innerHTML = '<span>✏️</span><span>Create Account</span>';
            signupButton.disabled = false;
        }
    }
}

// SINGLE formatPhoneNumber function - handles all cases properly
function formatPhoneNumber(phone) {
    // Remove all spaces and non-digit characters except +
    const cleanPhone = phone.replace(/[^\d+]/g, '');
    
    console.log('Formatting phone:', phone, '-> cleaned:', cleanPhone);
    
    // Convert 09XXXXXXXXX to +639XXXXXXXXX
    if (cleanPhone.startsWith('09') && cleanPhone.length === 11) {
        return '+63' + cleanPhone.substring(1);
    }
    
    // If already in +639XXXXXXXXX format, return as is
    if (cleanPhone.startsWith('+639') && cleanPhone.length === 13) {
        return cleanPhone;
    }
    
    // If in 639XXXXXXXXX format, add +
    if (cleanPhone.startsWith('639') && cleanPhone.length === 12) {
        return '+' + cleanPhone;
    }
    
    // Return as-is if already properly formatted
    return cleanPhone;
}

// Check if username exists in Firestore
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

// Check if phone exists in Firestore
async function checkPhoneExists(phone) {
    try {
        const formattedPhone = formatPhoneNumber(phone);
        console.log('Checking phone exists for:', formattedPhone);
        
        const q = query(collection(db, 'users'), where('userPhone', '==', formattedPhone));
        const querySnapshot = await getDocs(q);
        return !querySnapshot.empty;
    } catch (error) {
        console.error('Phone check failed:', error);
        return false;
    }
}

// Save user data to Firestore
async function saveUserToFirestore(userData) {
    try {
        await setDoc(doc(db, 'users', userData.userID), {
            userID: userData.userID,
            userName: userData.userName,
            userEmail: userData.userEmail,
            userPhone: userData.userPhone,
            userType: userData.userType,
            userIsActive: true,
            userPhoneVerified: false,
            userCreatedAt: Date.now(),
            userUpdatedAt: Date.now()
        });
        
        console.log('User saved to Firestore');
        return { success: true };
    } catch (error) {
        console.error('Save failed:', error);
        return { success: false, error: error.message };
    }
}

// CORRECTED validateForm function
function validateForm() {
    const username = document.getElementById('username').value.trim();
    const email = document.getElementById('email').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const userType = document.querySelector('input[name="userType"]:checked');

    if (!username || !email || !phone || !password || !confirmPassword || !userType) {
        showAlert('Please fill in all fields.', 'error');
        return false;
    }

    if (username.length < 3) {
        showAlert('Username must be at least 3 characters long.', 'error');
        return false;
    }

    if (username.length > 30) {
        showAlert('Username cannot exceed 30 characters.', 'error');
        return false;
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
        showAlert('Please enter a valid email address.', 'error');
        return false;
    }

    // Updated phone validation - more flexible
    const cleanPhone = phone.replace(/\s+/g, '').replace(/[^\d+]/g, '');
    const phoneRegex09 = /^09\d{9}$/; // 09XXXXXXXXX
    const phoneRegex63 = /^\+639\d{9}$/; // +639XXXXXXXXX
    const phoneRegex639 = /^639\d{9}$/; // 639XXXXXXXXX
    
    if (!phoneRegex09.test(cleanPhone) && !phoneRegex63.test(cleanPhone) && !phoneRegex639.test(cleanPhone)) {
        showAlert('Please enter a valid Philippine mobile number (09XXXXXXXXX or +639XXXXXXXXX).', 'error');
        return false;
    }

    if (password.length < 6) {
        showAlert('Password must be at least 6 characters long.', 'error');
        return false;
    }

    if (password !== confirmPassword) {
        showAlert('Passwords do not match.', 'error');
        return false;
    }

    return true;
}

// Main signup function using Firebase
async function handleSignup(userData) {
    try {
        setLoading(true);

        // Format phone number consistently
        const formattedPhone = formatPhoneNumber(userData.phone);
        console.log('Formatted phone for signup:', formattedPhone);

        // Check if username already exists
        const usernameExists = await checkUsernameExists(userData.username);
        if (usernameExists) {
            throw new Error('Username is already taken. Please choose another.');
        }

        // Check if phone already exists
        const phoneExists = await checkPhoneExists(userData.phone);
        if (phoneExists) {
            throw new Error('Phone number is already registered. Please use a different number.');
        }

        // Create Firebase Auth user with email/password
        const userCredential = await createUserWithEmailAndPassword(auth, userData.email, userData.password);
        const user = userCredential.user;

        // Prepare user data for Firestore
        const firestoreUserData = {
            userID: user.uid,
            userName: userData.username,
            userEmail: userData.email,
            userPhone: formattedPhone, // Use consistently formatted phone
            userType: userData.userType === 'swine_farmer' ? 'Swine Farmer' : 'Organic Fertilizer Buyer'
        };

        // Save user data to Firestore
        const saveResult = await saveUserToFirestore(firestoreUserData);
        if (!saveResult.success) {
            throw new Error(saveResult.error);
        }

        // Registration successful
        showAlert('Account created successfully! Redirecting to SMS verification...', 'success');
        
        // Store user data for SMS verification
        localStorage.setItem('pendingSignup', JSON.stringify({
            phone: formattedPhone, // Store the formatted version
            email: userData.email,
            username: userData.username,
            userType: userData.userType,
            userId: user.uid
        }));
        
        // Redirect to SMS verification page
        setTimeout(() => {
            window.location.href = '/html/sms-verification.html';
        }, 2000);
        
    } catch (error) {
        console.error('Signup error:', error);
        let errorMessage = 'Failed to create account. Please try again.';
        
        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessage = 'This email is already registered. Please use a different email or sign in instead.';
                break;
            case 'auth/weak-password':
                errorMessage = 'Password is too weak. Please use a stronger password.';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Invalid email address format.';
                break;
            default:
                if (error.message.includes('already taken') || error.message.includes('already registered')) {
                    errorMessage = error.message;
                }
                break;
        }
        
        showAlert(errorMessage, 'error');
    } finally {
        setLoading(false);
    }
}

// Initialize reCAPTCHA for SMS verification
function initializeRecaptcha() {
    if (!recaptchaVerifier) {
        // Ensure recaptcha container exists
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
                showAlert('reCAPTCHA expired. Please try again.', 'error');
            }
        });
    }
    return recaptchaVerifier;
}

// Form submission handler
if (signupForm) {
    signupForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        if (!validateForm()) {
            return;
        }

        const formData = new FormData(signupForm);
        const userData = {
            username: formData.get('username').trim(),
            email: formData.get('email').trim().toLowerCase(),
            phone: formData.get('phone').trim(),
            password: formData.get('password'),
            userType: formData.get('userType')
        };

        console.log('Form data collected:', { ...userData, password: '[HIDDEN]' });
        await handleSignup(userData);
    });
}

// Keep all existing input animations and interactions
if (inputs.length > 0) {
    inputs.forEach(input => {
        input.addEventListener('focus', function() {
            this.parentElement.style.transform = 'scale(1.02)';
            this.parentElement.style.transition = 'transform 0.3s ease';
        });

        input.addEventListener('blur', function() {
            this.parentElement.style.transform = 'scale(1)';
            if (this.value) {
                this.classList.add('has-value');
            } else {
                this.classList.remove('has-value');
            }
        });

        input.addEventListener('input', function() {
            this.classList.add('typing');
            setTimeout(() => {
                this.classList.remove('typing');
            }, 300);
            
            if (this.value) {
                this.classList.add('has-value');
            } else {
                this.classList.remove('has-value');
            }
        });

        if (input.value) {
            input.classList.add('has-value');
        }
    });
}

// Real-time validation feedback
document.getElementById('username')?.addEventListener('input', function() {
    const username = this.value.trim();
    if (username && username.length < 3) {
        this.style.borderColor = '#ff6b6b';
    } else if (username.length >= 3) {
        this.style.borderColor = '#51cf66';
    } else {
        this.style.borderColor = '#e0e0e0';
    }
});

document.getElementById('email')?.addEventListener('input', function() {
    const email = this.value.trim();
    if (email && !/\S+@\S+\.\S+/.test(email)) {
        this.style.borderColor = '#ff6b6b';
    } else if (email && /\S+@\S+\.\S+/.test(email)) {
        this.style.borderColor = '#51cf66';
    } else {
        this.style.borderColor = '#e0e0e0';
    }
});

document.getElementById('confirmPassword')?.addEventListener('input', function() {
    const password = document.getElementById('password').value;
    const confirmPassword = this.value;
    
    if (confirmPassword && password !== confirmPassword) {
        this.style.borderColor = '#ff6b6b';
    } else if (confirmPassword && password === confirmPassword) {
        this.style.borderColor = '#51cf66';
    } else {
        this.style.borderColor = '#e0e0e0';
    }
});

// Export functions for SMS verification page (if needed)
window.startPhoneVerification = function(phoneNumber) {
    console.error('startPhoneVerification should be handled by SMS verification page');
};

window.verifyPhoneCode = function(code) {
    console.error('verifyPhoneCode should be handled by SMS verification page');
};