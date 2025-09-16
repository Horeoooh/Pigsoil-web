// Signup functionality for PigSoil+ - Backend API Version
const API_BASE_URL = 'http://localhost:3000/api';

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

function formatPhoneNumber(phone) {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('9')) {
        cleaned = '63' + cleaned;
    }
    if (!cleaned.startsWith('63')) {
        cleaned = '63' + cleaned;
    }
    return '+' + cleaned;
}

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

    const formattedPhone = formatPhoneNumber(phone);
    if (!formattedPhone.match(/^\+639\d{9}$/)) {
        showAlert('Please enter a valid Philippine mobile number (e.g., 09XX XXX XXXX).', 'error');
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

// Main signup function that calls backend API
async function handleSignup(userData) {
    try {
        setLoading(true);

        // Make API call to your backend
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userName: userData.username,
                userEmail: userData.email,
                userPhone: formatPhoneNumber(userData.phone),
                userType: userData.userType === 'swine_farmer' ? 'Swine Farmer' : 'Organic Fertilizer Buyer',
                password: userData.password
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Registration failed');
        }

        // Registration successful
        showAlert('Account created successfully! Redirecting to SMS verification...', 'success');
        
        // Store user data for SMS verification
        localStorage.setItem('pendingSignup', JSON.stringify({
            phone: formatPhoneNumber(userData.phone),
            email: userData.email,
            username: userData.username,
            userType: userData.userType,
            userId: data.user.uid
        }));
        
        // Redirect to SMS verification page
        setTimeout(() => {
            window.location.href = '/html/sms verification.html';
        }, 2000);
        
    } catch (error) {
        console.error('Signup error:', error);
        let errorMessage = 'Failed to create account. Please try again.';
        
        if (error.message.includes('already registered') || error.message.includes('Email already')) {
            errorMessage = 'This email is already registered. Please use a different email or sign in instead.';
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
            phone: formData.get('phone').trim(),
            password: formData.get('password'),
            userType: formData.get('userType')
        };

        await handleSignup(userData);
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

// Real-time validation feedback (unchanged)
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

// Keep language selector interaction (unchanged)
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

// Check if user is already logged in (unchanged)
document.addEventListener('DOMContentLoaded', function() {
    const storedUser = localStorage.getItem('pigsoil_user');
    if (storedUser) {
        const userData = JSON.parse(storedUser);
        showAlert('You are already signed in. Redirecting...', 'success');
        setTimeout(() => {
            if (userData.userType === 'Swine Farmer' || userData.userType === 'swine_farmer') {
                window.location.href = '/html/dashboard.html';
            } else if (userData.userType === 'Organic Fertilizer Buyer' || userData.userType === 'fertilizer_buyer') {
                window.location.href = '/html/marketplace.html';
            }
        }, 2000);
    }
});