// Enhanced Login functionality for PigSoil+ - Firebase Version with Buyer Routing and Caching
import { auth, db } from './init.js';
import { 
    signInWithEmailAndPassword,
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
    getCachedProfilePic, 
    DEFAULT_PROFILE_PIC 
} from './shared-user-manager.js';

// Collection names
const COLLECTIONS = {
    USERS: 'users'
};

// DOM elements
const loginForm = document.getElementById('loginForm');
const loginButton = document.getElementById('loginButton');
const alertMessage = document.getElementById('alertMessage');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const inputs = document.querySelectorAll('.form-input');

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

// Enhanced user data retrieval with fallback creation
async function getUserData(userId) {
    try {
        console.log('🔍 Looking up user data for:', userId);
        
        // Try to get user by document ID (UID)
        const userDocRef = doc(db, COLLECTIONS.USERS, userId);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
            const userData = userDoc.data();
            console.log('✅ User data found by UID:', userData);
            return userData;
        }
        
        // If not found by UID, try to find by email
        const currentUser = auth.currentUser;
        if (currentUser?.email) {
            console.log('🔍 Searching for user by email:', currentUser.email);
            
            const usersRef = collection(db, COLLECTIONS.USERS);
            const emailQuery = query(usersRef, where('userEmail', '==', currentUser.email));
            const emailSnapshot = await getDocs(emailQuery);
            
            if (!emailSnapshot.empty) {
                const userData = emailSnapshot.docs[0].data();
                console.log('✅ User data found by email:', userData);
                
                // Update the document with the correct UID as document ID
                await setDoc(userDocRef, {
                    ...userData,
                    userUpdatedAt: Date.now()
                });
                
                return userData;
            }
        }
        
        // If no user data found, create default entry for authenticated user
        console.log('📝 Creating default user data for authenticated user');
        const defaultUserData = {
            userCreatedAt: Date.now(),
            userEmail: currentUser?.email || 'unknown@email.com',
            userIsActive: true,
            userName: currentUser?.displayName || 'User',
            userPhone: currentUser?.phoneNumber || '+639123456789',
            userPhoneVerified: false,
            userType: 'swine_farmer', // Default to swine farmer
            userUpdatedAt: Date.now()
        };
        
        await setDoc(userDocRef, defaultUserData);
        console.log('✅ Default user data created');
        return defaultUserData;
        
    } catch (error) {
        console.error('❌ Error getting user data:', error);
        throw error;
    }
}

// Enhanced redirection logic for Swine Farmers and Organic Fertilizer Buyers
function redirectToAppropriateScreen(userData) {
    const userType = userData.userType;
    
    console.log('🔄 Redirecting user based on type:', userType);
    
    // Store user data in localStorage for quick access
    localStorage.setItem('pigsoil_user', JSON.stringify({
        uid: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        phoneNumber: auth.currentUser?.phoneNumber,
        ...userData
    }));
    
    // Redirect based on user type
    setTimeout(() => {
        // Check for Swine Farmer types
        if (userType === 'swine_farmer' || userType === 'Swine Farmer') {
            console.log('🐷 Redirecting swine farmer to dashboard');
            window.location.href = '/dashboard.html';
        } 
        // Check for Organic Fertilizer Buyer types
        else if (userType === 'fertilizer_buyer' || userType === 'Organic Fertilizer Buyer') {
            console.log('🌱 Redirecting organic fertilizer buyer to buyer dashboard');
            window.location.href = '/buyer-dashboard.html';
        } 
        // Default fallback
        else {
            console.log('❓ Unknown user type, redirecting to dashboard');
            window.location.href = '/dashboard.html';
        }
    }, 1500);
}

// Enhanced Firebase email login with better error handling
async function handleEmailLogin(email, password) {
    try {
        setLoading(true);

        if (!isEmail(email)) {
            throw new Error('Please use your email address to sign in.');
        }

        console.log('🔐 Attempting to sign in user:', email);

        // Sign in with Firebase Auth
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        console.log('✅ Firebase authentication successful for:', user.uid);

        // Get user data from Firestore with enhanced fallback
        const userData = await getUserData(user.uid);

        // Cache the complete user data including profile picture
        console.log('💾 Caching user data after successful login');
        cacheCompleteUserData({
            ...userData,
            userID: user.uid,
            userProfilePictureUrl: userData.userProfilePictureUrl || DEFAULT_PROFILE_PIC
        });

        // Login successful
        showAlert('Login successful! Redirecting...', 'success');
        
        // Redirect with user data
        redirectToAppropriateScreen(userData);

    } catch (error) {
        console.error('❌ Login error:', error);
        let errorMessage = 'Login failed. Please try again.';
        
        switch (error.code) {
            case 'auth/user-not-found':
                errorMessage = 'No account found with this email address. Please sign up first.';
                break;
            case 'auth/wrong-password':
                errorMessage = 'Incorrect password. Please try again.';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Invalid email address format.';
                break;
            case 'auth/user-disabled':
                errorMessage = 'This account has been disabled. Please contact support.';
                break;
            case 'auth/too-many-requests':
                errorMessage = 'Too many failed attempts. Please try again later.';
                break;
            case 'auth/invalid-credential':
                errorMessage = 'Invalid email or password. Please check your credentials.';
                break;
            case 'auth/network-request-failed':
                errorMessage = 'Network error. Please check your internet connection.';
                break;
            default:
                errorMessage = `Login failed: ${error.message}`;
        }
        
        showAlert(errorMessage, 'error');
    } finally {
        setLoading(false);
    }
}

// Enhanced form submission handler
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

// Enhanced auth state listener (check if already logged in and redirect)
onAuthStateChanged(auth, async (user) => {
    if (user) {
        console.log('👤 User is signed in:', user.uid);
        
        // Check if user has complete profile data and redirect
        try {
            const userDocRef = doc(db, COLLECTIONS.USERS, user.uid);
            const userDoc = await getDoc(userDocRef);
            
            if (userDoc.exists()) {
                const userData = userDoc.data();
                const userType = userData.userType;
                
                console.log('🔍 User already logged in with type:', userType);
                
                // Store user data
                localStorage.setItem('pigsoil_user', JSON.stringify({
                    uid: user.uid,
                    email: user.email,
                    phoneNumber: user.phoneNumber,
                    ...userData
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
    } else {
        console.log('👤 User is signed out');
        localStorage.removeItem('pigsoil_user');
    }
});

// Initialize page without auto-login
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Login page initialized');
    
    // Note: Don't clear session here - let onAuthStateChanged handle redirects
    // This allows already logged-in users to be redirected automatically
});

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

// Keep all existing animations and effects
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
`;
document.head.appendChild(style);

// Export functions for potential use in other modules
window.PigSoilLogin = {
    handleEmailLogin,
    getUserData,
    redirectToAppropriateScreen
};

console.log('🐷 PigSoil+ Enhanced Login with Buyer Routing loaded!');