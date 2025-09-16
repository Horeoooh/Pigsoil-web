// Login functionality for PigSoil+ - Backend API Version
const API_BASE_URL = 'http://localhost:3000/api';

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

// Login function that calls your backend API
async function handleLogin(email, password) {
    try {
        setLoading(true);

        if (!isEmail(email)) {
            throw new Error('Please use your email address to sign in.');
        }

        // Make API call to your backend
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: email,
                password: password
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Login failed');
        }

        // Login successful
        showAlert('Login successful! Redirecting...', 'success');
        
        // Store user data
        localStorage.setItem('pigsoil_user', JSON.stringify(data.user));
        localStorage.setItem('auth_token', data.token);
        
        // Redirect based on user type
        setTimeout(() => {
            if (data.user.userType === 'Swine Farmer' || data.user.userType === 'swine_farmer') {
                window.location.href = '/html/dashboard.html';
            } else if (data.user.userType === 'Organic Fertilizer Buyer' || data.user.userType === 'fertilizer_buyer') {
                window.location.href = '/html/marketplace.html';
            } else {
                window.location.href = '/html/dashboard.html';
            }
        }, 1500);

    } catch (error) {
        console.error('Login error:', error);
        showAlert(error.message || 'Login failed. Please try again.', 'error');
    } finally {
        setLoading(false);
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

        handleLogin(email, password);
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