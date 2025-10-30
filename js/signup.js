// Signup functionality for PigSoil+ - Simplified
import { auth, db } from './init.js';
import { 
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    sendEmailVerification
} from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js';
import { 
    doc, 
    getDoc, 
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
            signupButton.innerHTML = `<span>${window.i18n.t('signup.creatingAccount')}</span>`;
            signupButton.disabled = true;
        } else {
            signupButton.classList.remove('loading');
            signupButton.innerHTML = `<span>✏️</span><span>${window.i18n.t('signup.signupButton')}</span>`;
            signupButton.disabled = false;
        }
    }
}

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

function validateForm() {
    const username = document.getElementById('username').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const userType = document.querySelector('input[name="userType"]:checked');

    if (!username || !email || !password || !confirmPassword || !userType) {
        showAlert(window.i18n.t('signup.errors.fillAllFields'), 'error');
        return false;
    }

    if (username.length < 3) {
        showAlert(window.i18n.t('signup.errors.usernameShort'), 'error');
        return false;
    }

    if (username.length > 30) {
        showAlert(window.i18n.t('signup.errors.usernameLong'), 'error');
        return false;
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
        showAlert(window.i18n.t('signup.errors.validEmail'), 'error');
        return false;
    }

    if (password.length < 6) {
        showAlert(window.i18n.t('signup.errors.passwordLength'), 'error');
        return false;
    }

    if (password !== confirmPassword) {
        showAlert(window.i18n.t('signup.errors.passwordMismatch'), 'error');
        return false;
    }

    return true;
}

// Simplified signup - just create auth user and store temp data
async function handleSignup(userData) {
    try {
        setLoading(true);

        console.log('📝 Starting signup with username:', userData.username);

        // Check if username already exists
        const usernameExists = await checkUsernameExists(userData.username);
        if (usernameExists) {
            throw new Error(window.i18n.t('signup.errors.usernameTaken'));
        }

        // Create Firebase Auth user
        const userCredential = await createUserWithEmailAndPassword(auth, userData.email, userData.password);
        const user = userCredential.user;
        
        console.log('✅ Firebase Auth user created:', user.uid);

        // Store signup data in sessionStorage for email-verification.html to use
        // Keep userType in underscore format (swine_farmer, fertilizer_buyer)
        const pendingData = {
            userID: user.uid,
            userName: userData.username,
            userEmail: userData.email,
            userType: userData.userType // Keep as swine_farmer or fertilizer_buyer
        };
        
        sessionStorage.setItem('pendingSignup', JSON.stringify(pendingData));
        console.log('💾 Stored pending signup data with userType:', userData.userType);

        // Send verification email
        try {
            await sendEmailVerification(user, {
                url: 'https://www.pigsoil.tech/verifyEmail.html',
                handleCodeInApp: true,
                android: {
                    packageName: 'com.android.pigsoil_final',
                    installApp: true,
                    minimumVersion: '1'
                }
            });
            console.log('✅ Verification email sent');
        } catch (emailError) {
            console.warn('⚠️ Failed to send verification email:', emailError);
        }

        showAlert(window.i18n.t('signup.success.accountCreated'), 'success');
        
        // Quick redirect - email-verification.html will save to Firestore
        setTimeout(() => {
            window.location.href = '/email-verification.html';
        }, 1000);
        
    } catch (error) {
        console.error('Signup error:', error);
        let errorMessage = window.i18n.t('signup.errors.signupFailed');
        
        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessage = window.i18n.t('signup.errors.emailInUse');
                break;
            case 'auth/weak-password':
                errorMessage = window.i18n.t('signup.errors.weakPassword');
                break;
            case 'auth/invalid-email':
                errorMessage = window.i18n.t('signup.errors.invalidEmail');
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

// Form submission
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

// Check if user is already logged in
onAuthStateChanged(auth, async (user) => {
    if (user) {
        console.log('👤 User already logged in:', user.uid);
        
        // Allow unverified users to stay on signup page
        if (!user.emailVerified) {
            console.log('📧 Email not verified - allowing access to signup page');
            return;
        }
        
        try {
            const userDocRef = doc(db, 'users', user.uid);
            const userDoc = await getDoc(userDocRef);
            
            if (userDoc.exists()) {
                const userData = userDoc.data();
                const userType = userData.userType;
                
                console.log('🔍 User type from Firestore:', userType);
                
                if (userType === 'swine_farmer') {
                    console.log('🚀 Redirecting to Farmer Dashboard');
                    window.location.href = '/dashboard.html';
                } else if (userType === 'fertilizer_buyer') {
                    console.log('🚀 Redirecting to Buyer Dashboard');
                    window.location.href = '/buyer-dashboard.html';
                } else {
                    console.warn('⚠️ Unknown userType, defaulting to Farmer Dashboard');
                    window.location.href = '/dashboard.html';
                }
            }
        } catch (error) {
            console.error('Error checking user data:', error);
        }
    }
});

// Input animations
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

// Real-time validation
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