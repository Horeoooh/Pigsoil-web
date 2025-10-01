// Shared User Manager - Updates user profile AND navigation routing
import { auth, db } from './init.js';
import { 
    onAuthStateChanged 
} from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js';
import { 
    doc, 
    getDoc,
    setDoc,
    onSnapshot 
} from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js';

const COLLECTIONS = {
    USERS: 'users'
};

let currentUser = null;
let currentUserData = null;
let userDataListener = null;

const USER_DATA_CHANGED = 'userDataChanged';

export function initializeSharedUserManager() {
    console.log('🔧 Initializing Shared User Manager');
    
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            console.log('👤 User authenticated:', user.uid);
            
            setupUserDataListener(user.uid);
        } else {
            console.log('👤 User signed out');
            currentUser = null;
            currentUserData = null;
            
            if (userDataListener) {
                userDataListener();
                userDataListener = null;
            }
            
            clearUserProfile();
        }
    });
}

async function setupUserDataListener(uid) {
    const userDocRef = doc(db, COLLECTIONS.USERS, uid);
    
    // CRITICAL: Disable all navigation links immediately
    const navLinks = document.querySelectorAll('[data-nav]');
    navLinks.forEach(link => {
        link.style.pointerEvents = 'none';
        link.style.opacity = '0.6';
        link.style.cursor = 'wait';
    });
    
    try {
        // Load user data synchronously FIRST
        const docSnapshot = await getDoc(userDocRef);
        
        if (docSnapshot.exists()) {
            currentUserData = docSnapshot.data();
            console.log('📡 Initial user data loaded:', currentUserData);
        } else {
            console.log('📝 Creating default user data');
            currentUserData = await createDefaultUserData(uid);
        }
        
        // Update UI and navigation BEFORE enabling links
        updateAllUserProfile();
        updateNavigationLinks();
        dispatchUserDataEvent();
        
        // NOW enable navigation links
        navLinks.forEach(link => {
            link.style.pointerEvents = '';
            link.style.opacity = '';
            link.style.cursor = '';
        });
        
        console.log('✅ Navigation enabled and ready');
        
    } catch (error) {
        console.error('❌ Error loading initial user data:', error);
    }
    
    // Set up real-time listener for future updates
    if (userDataListener) {
        userDataListener();
    }
    
    userDataListener = onSnapshot(userDocRef, async (docSnapshot) => {
        if (docSnapshot.exists()) {
            const newUserData = docSnapshot.data();
            
            if (JSON.stringify(newUserData) !== JSON.stringify(currentUserData)) {
                currentUserData = newUserData;
                console.log('📡 User data updated from Firestore:', newUserData);
                
                updateAllUserProfile();
                updateNavigationLinks();
                dispatchUserDataEvent();
            }
        }
    }, (error) => {
        console.error('❌ Error listening to user data:', error);
    });
}
async function createDefaultUserData(uid) {
    const defaultData = {
        userEmail: currentUser.email || 'unknown@email.com',
        userName: currentUser.displayName || 'User',
        userPhone: currentUser.phoneNumber || '',
        userType: 'swine_farmer',
        userIsActive: true,
        userCreatedAt: new Date(),
        userUpdatedAt: new Date()
    };
    
    try {
        await setDoc(doc(db, COLLECTIONS.USERS, uid), defaultData);
        return defaultData;
    } catch (error) {
        console.error('Error creating default user data:', error);
        return defaultData;
    }
}

function updateAllUserProfile() {
    if (!currentUserData || !currentUser) return;
    
    const userName = currentUserData.userName || currentUser.displayName || 'User';
    const userRole = getUserRoleDisplay(currentUserData.userType);
    const initials = generateInitials(userName);
    
    const userNameElements = document.querySelectorAll('.user-name, #headerUserName, #profileUserName');
    userNameElements.forEach(element => {
        if (element) element.textContent = userName;
    });
    
    const userRoleElements = document.querySelectorAll('.user-role, #headerUserRole, #profileUserRole');
    userRoleElements.forEach(element => {
        if (element) element.textContent = userRole;
    });
    
    const avatarElements = document.querySelectorAll('.user-avatar, #headerUserAvatar, #profileAvatar');
    avatarElements.forEach(element => {
        if (element) element.textContent = initials;
    });
    
    console.log('🔄 Updated all user profile elements');
}

// NEW FUNCTION: Update navigation links based on user type
 function updateNavigationLinks() {
    if (!currentUserData) {
        console.log('⏳ Waiting for user data before updating navigation...');
        // Disable all nav links until data loads
        const navLinks = document.querySelectorAll('[data-nav]');
        navLinks.forEach(link => {
            link.style.pointerEvents = 'none';
            link.style.opacity = '0.5';
        });
        return;
    }
    
    const isBuyer = isFertilizerBuyer();
    console.log('🔗 Updating navigation links for:', isBuyer ? 'BUYER' : 'FARMER');
    console.log('🔍 Current user type:', currentUserData.userType);
    
    const navLinks = document.querySelectorAll('[data-nav]');
    
    console.log('📍 Found', navLinks.length, 'navigation links to update');
    
    navLinks.forEach(link => {
        // Re-enable links
        link.style.pointerEvents = '';
        link.style.opacity = '';
        
        const navType = link.getAttribute('data-nav');
        const oldHref = link.getAttribute('href');
        
        if (navType === 'dashboard') {
            const newHref = isBuyer ? '../html/buyer-dashboard.html' : '../html/dashboard.html';
            link.setAttribute('href', newHref);
            console.log('  Dashboard link:', oldHref, '→', newHref);
        }
        else if (navType === 'market') {
            const newHref = isBuyer ? '../html/buyer-marketplace.html' : '../html/farmermarket.html';
            link.setAttribute('href', newHref);
            console.log('  Market link:', oldHref, '→', newHref);
        }
    });
    
    console.log('✅ Navigation links updated successfully');
}
function getUserRoleDisplay(userType) {
    switch(userType) {
        case 'swine_farmer':
        case 'Swine Farmer':
            return 'Swine Farmer';
        case 'fertilizer_buyer':
        case 'Organic Fertilizer Buyer':
            return 'Fertilizer Buyer';
        default:
            return 'Active Farmer';
    }
}

function generateInitials(name) {
    if (!name || name === 'User') return 'U';
    
    return name.split(' ')
               .map(word => word.charAt(0))
               .join('')
               .substring(0, 2)
               .toUpperCase();
}

function clearUserProfile() {
    const userNameElements = document.querySelectorAll('.user-name, #headerUserName, #profileUserName');
    userNameElements.forEach(element => {
        if (element) element.textContent = 'Guest';
    });
    
    const userRoleElements = document.querySelectorAll('.user-role, #headerUserRole, #profileUserRole');
    userRoleElements.forEach(element => {
        if (element) element.textContent = 'Not Signed In';
    });
    
    const avatarElements = document.querySelectorAll('.user-avatar, #headerUserAvatar, #profileAvatar');
    avatarElements.forEach(element => {
        if (element) element.textContent = '?';
    });
}

function dispatchUserDataEvent() {
    const event = new CustomEvent(USER_DATA_CHANGED, {
        detail: {
            user: currentUser,
            userData: currentUserData
        }
    });
    
    document.dispatchEvent(event);
}

export function getCurrentUser() {
    return currentUser;
}

export function getCurrentUserData() {
    return currentUserData;
}

export function onUserDataChange(callback) {
    document.addEventListener(USER_DATA_CHANGED, (event) => {
        callback(event.detail);
    });
}

export function forceUpdateUserProfile() {
    updateAllUserProfile();
    updateNavigationLinks(); // NEW: Also update navigation
}

export function isAuthenticated() {
    return currentUser !== null;
}

export function isSwineFarmer() {
    return currentUserData && 
           (currentUserData.userType === 'swine_farmer' || 
            currentUserData.userType === 'Swine Farmer');
}

export function isFertilizerBuyer() {
    return currentUserData && 
           (currentUserData.userType === 'fertilizer_buyer' || 
            currentUserData.userType === 'Organic Fertilizer Buyer');
}

initializeSharedUserManager();

console.log('🔧 Shared User Manager with Routing loaded!');