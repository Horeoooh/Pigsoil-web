// Auth Guard - Protects public pages from verified users or users with phone numbers
// LOGIC: Only non-verified users WITHOUT phone numbers can access public pages
import { auth, db } from './init.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js';

const COLLECTIONS = {
    USERS: 'users'
};

// Pages that should only be accessible to non-verified users WITHOUT phone numbers
const PROTECTED_PUBLIC_PAGES = [
    '/login.html',
    '/signup.html',
    '/index.html',
    '/forgot-password.html',
    '/sms-verification.html',
    '/phone-registration.html',
    '/email-verification.html'
];

// Check if current page is a protected public page
function isProtectedPublicPage() {
    const currentPath = window.location.pathname;
    return PROTECTED_PUBLIC_PAGES.some(page => 
        currentPath.endsWith(page) || 
        currentPath === '/' || 
        currentPath === '/index.html'
    );
}

// Initialize auth guard
export function initAuthGuard() {
    // Only run on protected public pages
    if (!isProtectedPublicPage()) {
        console.log('🔓 Not a protected public page, skipping auth guard');
        return;
    }

    console.log('🛡️ Auth Guard initialized for public page');

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            console.log('👤 No user signed in - allowing access to public page');
            return;
        }

        console.log('👤 User signed in, checking verification and phone status...');

        try {
            const userDocRef = doc(db, COLLECTIONS.USERS, user.uid);
            const userDoc = await getDoc(userDocRef);

            if (!userDoc.exists()) {
                console.log('⚠️ No user data found - allowing access to public page');
                return;
            }

            const userData = userDoc.data();
            const isEmailVerified = user.emailVerified;
            const hasPhone = userData.userPhone && 
                            userData.userPhone !== '' && 
                            userData.userPhone !== '+639123456789'; // Exclude default placeholder

            console.log('📧 Email verified:', isEmailVerified);
            console.log('📞 Has phone:', hasPhone);

            // Allow access ONLY if NOT verified AND NOT has phone
            // Block access if verified OR has phone
            if (!isEmailVerified && !hasPhone) {
                console.log('✅ NOT verified AND NO phone - allowing access to public page');
                return;
            }

            // User is verified OR has phone - redirect them away
            console.log('🚫 User is verified OR has phone - redirecting to appropriate dashboard');
            
            const userType = userData.userType;
            
            // Store user data
            localStorage.setItem('pigsoil_user', JSON.stringify({
                uid: user.uid,
                email: user.email,
                phoneNumber: user.phoneNumber,
                ...userData
            }));

            // Redirect based on user type
            if (userType === 'swine_farmer' || userType === 'Swine Farmer') {
                console.log('🐷 Redirecting swine farmer to dashboard');
                window.location.replace('/dashboard.html');
            } else if (userType === 'fertilizer_buyer' || userType === 'Organic Fertilizer Buyer') {
                console.log('🌱 Redirecting fertilizer buyer to buyer dashboard');
                window.location.replace('/buyer-dashboard.html');
            } else {
                console.log('❓ Unknown user type, redirecting to dashboard');
                window.location.replace('/dashboard.html');
            }
        } catch (error) {
            console.error('❌ Error checking user data:', error);
            // On error, allow access to public page
        }
    });
}

// Auto-initialize when imported
initAuthGuard();

console.log('🛡️ Auth Guard module loaded');
