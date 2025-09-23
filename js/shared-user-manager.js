// Shared User Manager - Updates user profile across all PigSoil+ pages
import { auth, db } from './init.js';
import { 
    onAuthStateChanged 
} from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js';
import { 
    doc, 
    getDoc,
    onSnapshot 
} from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js';

// Collection names
const COLLECTIONS = {
    USERS: 'users'
};

// Global user state
let currentUser = null;
let currentUserData = null;
let userDataListener = null;

// User data change event
const USER_DATA_CHANGED = 'userDataChanged';

// Initialize shared user manager on all pages
export function initializeSharedUserManager() {
    console.log('🔧 Initializing Shared User Manager');
    
    // Check authentication state
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            console.log('👤 User authenticated:', user.uid);
            
            // Set up real-time listener for user data
            setupUserDataListener(user.uid);
        } else {
            console.log('👤 User signed out');
            currentUser = null;
            currentUserData = null;
            
            // Clean up listener
            if (userDataListener) {
                userDataListener();
                userDataListener = null;
            }
            
            // Clear UI
            clearUserProfile();
        }
    });
}

// Set up real-time listener for user data changes
function setupUserDataListener(uid) {
    const userDocRef = doc(db, COLLECTIONS.USERS, uid);
    
    // Clean up existing listener
    if (userDataListener) {
        userDataListener();
    }
    
    // Set up new listener
    userDataListener = onSnapshot(userDocRef, async (docSnapshot) => {
        if (docSnapshot.exists()) {
            const newUserData = docSnapshot.data();
            
            // Check if data actually changed
            if (JSON.stringify(newUserData) !== JSON.stringify(currentUserData)) {
                currentUserData = newUserData;
                console.log('📡 User data updated from Firestore:', newUserData);
                
                // Update all UI elements
                updateAllUserProfile();
                
                // Dispatch custom event for other components
                dispatchUserDataEvent();
            }
        } else {
            // Create default user data if not found
            console.log('📝 Creating default user data');
            currentUserData = await createDefaultUserData(uid);
            updateAllUserProfile();
        }
    }, (error) => {
        console.error('❌ Error listening to user data:', error);
    });
}

// Create default user data
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
        // Save to Firestore
        await setDoc(doc(db, COLLECTIONS.USERS, uid), defaultData);
        return defaultData;
    } catch (error) {
        console.error('Error creating default user data:', error);
        return defaultData;
    }
}

// Update all user profile elements on the page
function updateAllUserProfile() {
    if (!currentUserData || !currentUser) return;
    
    const userName = currentUserData.userName || currentUser.displayName || 'User';
    const userRole = getUserRoleDisplay(currentUserData.userType);
    const initials = generateInitials(userName);
    
    // Update header user name
    const userNameElements = document.querySelectorAll('.user-name, #headerUserName, #profileUserName');
    userNameElements.forEach(element => {
        if (element) element.textContent = userName;
    });
    
    // Update header user role
    const userRoleElements = document.querySelectorAll('.user-role, #headerUserRole, #profileUserRole');
    userRoleElements.forEach(element => {
        if (element) element.textContent = userRole;
    });
    
    // Update user avatars
    const avatarElements = document.querySelectorAll('.user-avatar, #headerUserAvatar, #profileAvatar');
    avatarElements.forEach(element => {
        if (element) element.textContent = initials;
    });
    
    console.log('🔄 Updated all user profile elements');
}

// Get user role display text
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

// Generate initials from name
function generateInitials(name) {
    if (!name || name === 'User') return 'U';
    
    return name.split(' ')
               .map(word => word.charAt(0))
               .join('')
               .substring(0, 2)
               .toUpperCase();
}

// Clear user profile from UI
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

// Dispatch custom event when user data changes
function dispatchUserDataEvent() {
    const event = new CustomEvent(USER_DATA_CHANGED, {
        detail: {
            user: currentUser,
            userData: currentUserData
        }
    });
    
    document.dispatchEvent(event);
}

// Public functions for other modules to use
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

// Force update user profile (useful after profile changes)
export function forceUpdateUserProfile() {
    updateAllUserProfile();
}

// Check if user is authenticated
export function isAuthenticated() {
    return currentUser !== null;
}

// Check if user is a swine farmer
export function isSwineFarmer() {
    return currentUserData && 
           (currentUserData.userType === 'swine_farmer' || 
            currentUserData.userType === 'Swine Farmer');
}

// Check if user is a fertilizer buyer
export function isFertilizerBuyer() {
    return currentUserData && 
           (currentUserData.userType === 'fertilizer_buyer' || 
            currentUserData.userType === 'Organic Fertilizer Buyer');
}

// Initialize the shared user manager when this module is imported
initializeSharedUserManager();

console.log('🔧 Shared User Manager loaded and initialized!');