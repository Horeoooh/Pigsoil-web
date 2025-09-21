// Login functionality for PigSoil+ - Firebase Version
import { auth, db } from './init.js';
import { 
    signInWithEmailAndPassword,
    signInWithPhoneNumber,
    RecaptchaVerifier
} from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js';
import { 
    doc, 
    getDoc 
} from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js';

// DOM elements
const loginForm = document.getElementById('loginForm');
const loginButton = document.getElementById('loginButton');
const alertMessage = document.getElementById('alertMessage');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const inputs = document.querySelectorAll('.form-input');

let recaptchaVerifier = null;
let confirmationResult = null;

// Helper functions
function showAlert(message, type = 'error') {
    if (alertMessage) {
        alertMessage.textContent = message;
        alertMessage.className = `alert ${type}`;
        alertMessage.style.display = 'block';
        setTimeout(() => {
            alertMessage.style.display = 'none';
        }, 5000);
    }
}

function isEmail(value) {
    return /\S+@\S+\.\S+/.test(value);
}

function setLoading(loading) {
    if (loginButton) {
        if (loading) {
            loginButton.classList.add('loading');
            loginButton.innerHTML = '<span>Signing In...</span>';
            loginButton.disabled = true;
        } else {
            loginButton.classList.remove('loading');
            loginButton.innerHTML = '<span>✏️</span><span>Log In</span>';
            loginButton.disabled = false;
        }
    }
}

// Get user data from Firestore
async function getUserData(userId) {
    try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
            return userDoc.data();
        } else {
            throw new Error('User data not found');
        }
    } catch (error) {
        console.error('Error getting user data:', error);
        throw error;
    }
}

// Firebase email login
async function handleEmailLogin(email, password) {
    try {
        setLoading(true);

        if (!isEmail(email)) {
            throw new Error('Please use your email address to sign in.');
        }

        // Sign in with Firebase Auth
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Get user data from Firestore
        const userData = await getUserData(user.uid);

        // Login successful
        showAlert('Login successful! Redirecting...', 'success');
        
        // Store user data
        localStorage.setItem('pigsoil_user', JSON.stringify({
            uid: user.uid,
            email: user.email,
            ...userData
        }));
        
        // Redirect based on user type
        setTimeout(() => {
            if (userData.userType === 'Swine Farmer' || userData.userType === 'swine_farmer') {
                window.location.href = '/html/dashboard.html';
            } else if (userData.userType === 'Organic Fertilizer Buyer' || userData.userType === 'fertilizer_buyer') {
                window.location.href = '/html/marketplace.html';
            } else {
                window.location.href = '/html/dashboard.html';
            }
        }, 1500);

    } catch (error) {
        console.error('Login error:', error);
        let errorMessage = 'Login failed. Please try again.';
        
        switch (error.code) {
            case 'auth/user-not-found':
                errorMessage = 'No account found with this email address.';
                break;
            case 'auth/wrong-password':
                errorMessage = 'Incorrect password. Please try again.';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Invalid email address format.';
                break;
            case 'auth/user-disabled':
                errorMessage = 'This account has been disabled.';
                break;
            case 'auth/too-many-requests':
                errorMessage = 'Too many failed attempts. Please try again later.';
                break;
            case 'auth/invalid-credential':
                errorMessage = 'Invalid email or password. Please check your credentials.';
                break;
        }
        
        showAlert(errorMessage, 'error');
    } finally {
        setLoading(false);
    }
}

// Initialize reCAPTCHA for phone login
function initializeRecaptcha() {
    if (!recaptchaVerifier) {
        recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
            'size': 'invisible',
            'callback': (response) => {
                console.log('reCAPTCHA solved');
            },
            'expired-callback': () => {
                console.log('reCAPTCHA expired');
                showAlert('reCAPTCHA expired. Please try again.');
            }
        });
    }
    return recaptchaVerifier;
}

// Firebase phone login - start verification
async function startPhoneLogin(phoneNumber) {
    try {
        // Initialize reCAPTCHA
        const recaptcha = initializeRecaptcha();
        
        // Send verification code
        confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, recaptcha);
        console.log('SMS sent');
        
        showAlert('Verification code sent to your phone!', 'success');
        
        // Show verification code input (you need to add this HTML section)
        const verificationSection = document.getElementById('verificationCodeSection');
        if (verificationSection) {
            verificationSection.style.display = 'block';
        }
        
        return { success: true };
    } catch (error) {
        console.error('Phone login failed:', error);
        let errorMessage = 'Failed to send verification code. Please try again.';
        
        switch (error.code) {
            case 'auth/invalid-phone-number':
                errorMessage = 'Invalid phone number format.';
                break;
            case 'auth/too-many-requests':
                errorMessage = 'Too many requests. Please try again later.';
                break;
        }
        
        showAlert(errorMessage, 'error');
        return { success: false };
    }
}

// Verify phone code and login
async function verifyPhoneCode(verificationCode) {
    try {
        if (!confirmationResult) {
            throw new Error('No verification in progress. Please start over.');
        }

        const result = await confirmationResult.confirm(verificationCode);
        const user = result.user;

        // Get user data from Firestore
        const userData = await getUserData(user.uid);
        
        showAlert('Phone login successful! Redirecting...', 'success');
        
        // Store user data
        localStorage.setItem('pigsoil_user', JSON.stringify({
            uid: user.uid,
            phoneNumber: user.phoneNumber,
            ...userData
        }));
        
        // Redirect based on user type
        setTimeout(() => {
            if (userData.userType === 'Swine Farmer' || userData.userType === 'swine_farmer') {
                window.location.href = '/html/dashboard.html';
            } else if (userData.userType === 'Organic Fertilizer Buyer' || userData.userType === 'fertilizer_buyer') {
                window.location.href = '/html/marketplace.html';
            } else {
                window.location.href = '/html/dashboard.html';
            }
        }, 1500);
        
        return { success: true };
    } catch (error) {
        console.error('Phone verification failed:', error);
        let errorMessage = 'Invalid verification code. Please try again.';
        
        switch (error.code) {
            case 'auth/invalid-verification-code':
                errorMessage = 'Invalid verification code.';
                break;
            case 'auth/code-expired':
                errorMessage = 'Verification code has expired. Please request a new one.';
                break;
        }
        
        showAlert(errorMessage, 'error');
        return { success: false };
    }
}

// Form submission handler
if (loginForm) {
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const email = usernameInput.value.trim();
        const password = passwordInput.value;

        if (!email || !password) {
            showAlert('Please fill in all fields.', 'error');
            return;
        }

        if (email.length < 3) {
            showAlert('Please enter a valid email address.', 'error');
            return;
        }

        if (password.length < 6) {
            showAlert('Password must be at least 6 characters long.', 'error');
            return;
        }

        handleEmailLogin(email, password);
    });
}

// Keep all your existing input animations and interactions (unchanged)
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

// Keep all your existing animations and effects (unchanged)
const languageSelector = document.querySelector('.language-btn');
if (languageSelector) {
    languageSelector.addEventListener('click', function(e) {
        e.preventDefault();
        this.style.transform = 'scale(0.95)';
        setTimeout(() => {
            this.style.transform = '';
        }, 150);
    });
}

const checkboxes = document.querySelectorAll('input[type="checkbox"]');
checkboxes.forEach(checkbox => {
    checkbox.addEventListener('change', function() {
        const customCheckbox = this.nextElementSibling;
        if (this.checked) {
            customCheckbox.style.animation = 'none';
            setTimeout(() => {
                customCheckbox.style.animation = 'bounce 0.6s ease';
            }, 10);
        }
    });
});

function createFloatingParticle() {
    const particle = document.createElement('div');
    particle.style.cssText = `
        position: fixed;
        width: 4px;
        height: 4px;
        background: rgba(74, 103, 65, 0.3);
        border-radius: 50%;
        pointer-events: none;
        z-index: -1;
        left: ${Math.random() * window.innerWidth}px;
        top: ${window.innerHeight + 10}px;
        animation: floatUp ${3 + Math.random() * 4}s linear forwards;
    `;
    
    document.body.appendChild(particle);
    
    setTimeout(() => {
        particle.remove();
    }, 7000);
}

setInterval(createFloatingParticle, 3000);

const style = document.createElement('style');
style.textContent = `
    @keyframes floatUp {
        to {
            transform: translateY(-${window.innerHeight + 100}px) rotate(360deg);
            opacity: 0;
        }
    }
    @keyframes bounce {
        0%, 20%, 50%, 80%, 100% {
            transform: translateY(0);
        }
        40% {
            transform: translateY(-4px);
        }
        60% {
            transform: translateY(-2px);
        }
    }
`;
document.head.appendChild(style);

// Check if user is already logged in
document.addEventListener('DOMContentLoaded', function() {
    const storedUser = localStorage.getItem('pigsoil_user');
    if (storedUser) {
        const userData = JSON.parse(storedUser);
        if (userData.userType === 'Swine Farmer' || userData.userType === 'swine_farmer') {
            window.location.href = '/html/dashboard.html';
        } else if (userData.userType === 'Organic Fertilizer Buyer' || userData.userType === 'fertilizer_buyer') {
            window.location.href = '/html/marketplace.html';
        }
    }
});

// Listen to auth state changes
auth.onAuthStateChanged((user) => {
    if (user) {
        console.log('User is signed in:', user.uid);
    } else {
        console.log('User is signed out');
        localStorage.removeItem('pigsoil_user');
    }
});