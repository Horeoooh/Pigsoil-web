// Index page authentication check for PigSoil+
import { auth, db } from './init.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js';

// Check if user is already logged in and redirect
onAuthStateChanged(auth, async (user) => {
    if (user) {
        console.log('👤 User is signed in:', user.uid);
        
        // Check if user has complete profile data and redirect
        try {
            const userDocRef = doc(db, 'users', user.uid);
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
        console.log('👤 User is signed out - showing landing page');
        localStorage.removeItem('pigsoil_user');
    }
});

console.log('🏠 PigSoil+ Index page initialized with auth check');
