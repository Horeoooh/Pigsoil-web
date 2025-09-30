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

function setupUserDataListener(uid) {
    const userDocRef = doc(db, COLLECTIONS.USERS, uid);
    
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
                updateNavigationLinks(); // NEW: Update navigation based on user type
                
                dispatchUserDataEvent();
            }
        } else {
            console.log('📝 Creating default user data');
            currentUserData = await createDefaultUserData(uid);
            updateAllUserProfile();
            updateNavigationLinks(); // NEW: Update navigation
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
   if (!currentUserData) return;
    
    const isBuyer = isFertilizerBuyer();
    console.log('🔗 Updating navigation links for:', isBuyer ? 'BUYER' : 'FARMER');
    
    // Find all navigation links with data-nav attribute
    const navLinks = document.querySelectorAll('[data-nav]');
    
    navLinks.forEach(link => {
        const navType = link.getAttribute('data-nav');
        
        // Update based on nav type
        if (navType === 'dashboard') {
            link.setAttribute('href', isBuyer ? '../html/buyer-dashboard.html' : '../html/dashboard.html');
        }
        else if (navType === 'market') {
            link.setAttribute('href', isBuyer ? '../html/buyer-marketplace.html' : '../html/farmermarket.html');
        }
        
        // Guides and Settings remain the same (shared)
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