// Dashboard Auth Guard - Protects dashboard pages from non-verified users or users without phone numbers
// LOGIC: Only email-verified users WITH phone numbers can access dashboard pages
import { auth, db } from './init.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js';

const COLLECTIONS = {
    USERS: 'users'
};

// Pages that require email verification AND phone number
const PROTECTED_DASHBOARD_PAGES = [
    '/dashboard.html',
    '/batches.html',
    '/buyer-dashboard.html',
    '/buyer-marketplace.html',
    '/CreateListing.html'
];

// Check if current page is a protected dashboard page
function isProtectedDashboardPage() {
    const currentPath = window.location.pathname;
    return PROTECTED_DASHBOARD_PAGES.some(page => currentPath.endsWith(page));
}

// Initialize dashboard auth guard
export function initDashboardAuthGuard() {
    // Only run on protected dashboard pages
    if (!isProtectedDashboardPage()) {
        console.log('🔓 Not a protected dashboard page, skipping dashboard auth guard');
        return;
    }

    console.log('🛡️ Dashboard Auth Guard initialized');

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            console.log('❌ No user signed in - redirecting to login');
            window.location.replace('/login.html');
            return;
        }

        console.log('👤 User signed in, checking verification and phone status...');

        // Reload user to get latest verification status
        await user.reload();

        try {
            const userDocRef = doc(db, COLLECTIONS.USERS, user.uid);
            const userDoc = await getDoc(userDocRef);

            if (!userDoc.exists()) {
                console.log('⚠️ No user data found - redirecting to login');
                window.location.replace('/login.html');
                return;
            }

            const userData = userDoc.data();
            const isEmailVerified = user.emailVerified;
            const hasPhone = userData.userPhone && 
                            userData.userPhone !== '' && 
                            userData.userPhone !== '+639123456789'; // Exclude default placeholder

            console.log('📧 Email verified:', isEmailVerified);
            console.log('📞 Has phone:', hasPhone);

            // BLOCK access ONLY if NOT verified AND NO phone
            // Allow access if verified OR has phone
            if (!isEmailVerified && !hasPhone) {
                console.log('🚫 NOT verified AND NO phone - redirecting to email verification');
                window.location.replace('/email-verification.html');
                return;
            }

            // User has verification OR phone - allow access
            console.log('✅ User has verification OR phone - allowing access to dashboard');

        } catch (error) {
            console.error('❌ Error checking user data:', error);
            // On error, redirect to login for safety
            window.location.replace('/login.html');
        }
    });
}

// Auto-initialize when imported
initDashboardAuthGuard();

console.log('🛡️ Dashboard Auth Guard module loaded');
