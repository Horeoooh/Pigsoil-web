// SMS verification handler for PigSoil+ - Backend API Version
const API_BASE_URL = 'http://localhost:3000/api';

// Get pending signup data
const pendingSignup = JSON.parse(localStorage.getItem('pendingSignup') || '{}');

// Update phone number display
const phoneDisplay = document.querySelector('p');
if (phoneDisplay && pendingSignup.phone) {
    phoneDisplay.textContent = pendingSignup.phone;
}

// Handle SMS code verification
const verifyBtn = document.querySelector('.btn');
const inputs = document.querySelectorAll('.inputs input');
const resendBtn = document.querySelector('.resend');

// Auto-focus and auto-advance inputs
inputs.forEach((input, index) => {
    input.addEventListener('input', function(e) {
        // Add typing animation
        this.classList.add('typing');
        setTimeout(() => {
            this.classList.remove('typing');
        }, 300);

        // Only allow numbers
        this.value = this.value.replace(/[^0-9]/g, '');
        
        // Auto-advance to next input
        if (this.value.length === 1 && index < inputs.length - 1) {
            inputs[index + 1].focus();
        }
    });

    input.addEventListener('keydown', function(e) {
        // Handle backspace to go to previous input
        if (e.key === 'Backspace' && this.value.length === 0 && index > 0) {
            inputs[index - 1].focus();
            inputs[index - 1].value = '';
        }
    });

    input.addEventListener('paste', function(e) {
        e.preventDefault();
        const paste = e.clipboardData.getData('text');
        const digits = paste.replace(/[^0-9]/g, '').split('');
        
        digits.forEach((digit, i) => {
            if (inputs[index + i]) {
                inputs[index + i].value = digit;
            }
        });
        
        // Focus on the next empty input or the last filled input
        const nextIndex = Math.min(index + digits.length, inputs.length - 1);
        inputs[nextIndex].focus();
    });
});

// Complete signup process after SMS verification
async function completeSignup() {
    try {
        // For now, we'll complete the registration without actual SMS verification
        // In production, you'd verify the SMS code with your backend
        
        const response = await fetch(`${API_BASE_URL}/auth/complete-verification`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                userId: pendingSignup.userId,
                phone: pendingSignup.phone,
                verified: true
            })
        });

        if (response.ok) {
            // Store user data
            localStorage.setItem('pigsoil_user', JSON.stringify({
                uid: pendingSignup.userId,
                email: pendingSignup.email,
                userName: pendingSignup.username,
                userType: pendingSignup.userType,
                userPhone: pendingSignup.phone
            }));
            
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('Complete signup error:', error);
        return false;
    }
}

// Verify button click handler
verifyBtn.addEventListener('click', async function(e) {
    e.preventDefault();
    
    // Get the verification code
    const code = Array.from(inputs).map(input => input.value).join('');
    
    if (code.length !== 6) {
        alert('Please enter the complete 6-digit verification code.');
        inputs[0].focus();
        return;
    }

    // Add loading effect
    this.textContent = 'Verifying...';
    this.style.pointerEvents = 'none';
    this.style.opacity = '0.7';
    
    try {
        // For demo purposes, accept any 6-digit code
        // In production, you'd verify this with your backend SMS service
        if (!/^\d{6}$/.test(code)) {
            throw new Error('Invalid verification code format');
        }
        
        // Complete the signup process
        const success = await completeSignup();
        
        if (success) {
            this.textContent = 'Verified! ✓';
            this.style.background = '#28a745';
            
            // Clear stored data
            localStorage.removeItem('pendingSignup');
            
            // Show success message
            alert('Phone verified successfully! Account created. Welcome to PigSoil+!');
            
            setTimeout(() => {
                // Redirect based on user type
                if (pendingSignup.userType === 'swine_farmer') {
                    window.location.href = '/html/dashboard.html';
                } else {
                    window.location.href = '/html/marketplace.html';
                }
            }, 2000);
        } else {
            throw new Error('Failed to complete account creation');
        }
        
    } catch (error) {
        console.error('SMS verification error:', error);
        
        let errorMessage = 'Verification failed. Please try again.';
        alert(errorMessage);
        
        // Reset button
        this.textContent = 'Verify';
        this.style.background = '#4a6741';
        this.style.pointerEvents = '';
        this.style.opacity = '1';
        
        // Clear inputs and focus first one
        inputs.forEach(input => input.value = '');
        inputs[0].focus();
    }
});

// Resend functionality
let resendTimer = 0;

if (resendBtn) {
    resendBtn.addEventListener('click', async function() {
        if (resendTimer > 0) return;
        
        try {
            // In a real implementation, you would resend the SMS here
            // For now, just show success message
            this.textContent = 'Code sent!';
            this.style.color = '#28a745';
            
            // Start countdown
            resendTimer = 30;
            const countdown = setInterval(() => {
                this.textContent = `Resend in ${resendTimer}s`;
                resendTimer--;
                
                if (resendTimer < 0) {
                    clearInterval(countdown);
                    this.textContent = 'Resend';
                    this.style.color = '#4a6741';
                    resendTimer = 0;
                }
            }, 1000);
            
        } catch (error) {
            console.error('Resend error:', error);
            alert('Failed to resend code. Please try again.');
        }
    });
}

// Auto-focus first input on page load
document.addEventListener('DOMContentLoaded', function() {
    // Check if we have pending signup data
    if (!pendingSignup.phone) {
        alert('No pending signup found. Redirecting to signup page.');
        window.location.href = '/html/signup.html';
        return;
    }
    
    // Focus first input
    if (inputs[0]) {
        inputs[0].focus();
    }
    
    // For demo purposes, show a hint
    console.log('Demo mode: Any 6-digit code will work for testing');
});