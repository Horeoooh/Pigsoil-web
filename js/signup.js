// Signup functionality for PigSoil+ - Firebase Version (Email/Password Only) with Caching
import { auth, db } from './init.js';
import { 
    createUserWithEmailAndPassword,
    onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js';
import { 
    doc, 
    setDoc,
    getDoc, 
    collection, 
    query, 
    where, 
    getDocs 
} from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js';
import { 
    cacheCompleteUserData, 
    DEFAULT_PROFILE_PIC 
} from './shared-user-manager.js';

// DOM elements
const signupForm = document.getElementById('signupForm');
const signupButton = document.getElementById('signupButton');
const alertMessage = document.getElementById('alertMessage');
const inputs = document.querySelectorAll('.form-input');

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

// Save user data to Firestore
async function saveUserToFirestore(userData) {
    try {
        await setDoc(doc(db, 'users', userData.userID), {
            userID: userData.userID,
            userName: userData.userName,
            userEmail: userData.userEmail,
            userPhone: null,
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

function validateForm() {
    const username = document.getElementById('username').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const userType = document.querySelector('input[name="userType"]:checked');

    if (!username || !email || !password || !confirmPassword || !userType) {
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

        // Check if username already exists
        const usernameExists = await checkUsernameExists(userData.username);
        if (usernameExists) {
            throw new Error('Username is already taken. Please choose another.');
        }

        // Create Firebase Auth user with email/password
        const userCredential = await createUserWithEmailAndPassword(auth, userData.email, userData.password);
        const user = userCredential.user;

        // Prepare user data for Firestore
        const firestoreUserData = {
            userID: user.uid,
            userName: userData.username,
            userEmail: userData.email,
            userType: userData.userType === 'swine_farmer' ? 'Swine Farmer' : 'Organic Fertilizer Buyer'
        };

        // Save user data to Firestore
        const saveResult = await saveUserToFirestore(firestoreUserData);
        if (!saveResult.success) {
            throw new Error(saveResult.error);
        }

        // Cache the complete user data including default profile picture
        console.log('💾 Caching user data after successful signup');
        const completeUserData = {
            ...firestoreUserData,
            userPhone: '',
            userPhoneVerified: false,
            userIsActive: true,
            userProfilePictureUrl: DEFAULT_PROFILE_PIC,
            userCreatedAt: Date.now(),
            userUpdatedAt: Date.now()
        };
        cacheCompleteUserData(completeUserData);

        // Registration successful
        showAlert('Account created successfully! Redirecting...', 'success');
        
        // Store user data temporarily
        localStorage.setItem('newUser', JSON.stringify({
            userId: user.uid,
            email: userData.email,
            username: userData.username,
            userType: userData.userType
        }));
        
        // Redirect to phone registration page
        setTimeout(() => {
            window.location.href = '/phone-registration.html';
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
                if (error.message.includes('already taken')) {
                    errorMessage = error.message;
                }
                break;
        }
        
        showAlert(errorMessage, 'error');
    } finally {
        setLoading(false);
    }
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
            password: formData.get('password'),
            userType: formData.get('userType')
        };

        await handleSignup(userData);
    });
}

// Check if user is already logged in and redirect
onAuthStateChanged(auth, async (user) => {
    if (user) {
        console.log('👤 User already logged in:', user.uid);
        
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
                    console.log('🐷 Redirecting logged-in swine farmer to dashboard');
                    window.location.href = '/dashboard.html';
                } else if (userType === 'fertilizer_buyer' || userType === 'Organic Fertilizer Buyer') {
                    console.log('🌿 Redirecting logged-in fertilizer buyer to buyer dashboard');
                    window.location.href = '/buyer-dashboard.html';
                } else {
                    console.log('⚠️ Unknown user type, defaulting to farmer dashboard');
                    window.location.href = '/dashboard.html';
                }
            }
        } catch (error) {
            console.error('Error checking user data:', error);
        }
    }
});

// Input animations and interactions
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

// Language selector interaction
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