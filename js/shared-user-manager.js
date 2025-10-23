// Shared User Manager - FIXED VERSION with correct navigation routing
import { auth, db } from './init.js';
import { 
    onAuthStateChanged 
} from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js';
import { 
    doc, 
    getDoc,
    onSnapshot 
} from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js';

const COLLECTIONS = {
    USERS: 'users'
};

const CACHE_KEYS = {
    USER_DATA: 'pigsoil_user_data',
    USER_AUTH: 'pigsoil_user_auth',
    PROFILE_PIC: 'pigsoil_profile_pic',
    CACHE_TIMESTAMP: 'pigsoil_cache_timestamp'
};

const DEFAULT_PROFILE_PIC = 'https://i.pinimg.com/736x/d7/95/c3/d795c373a0539e64c7ee69bb0af3c5c3.jpg';
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

let currentUser = null;
let currentUserData = null;
let userDataListener = null;

const USER_DATA_CHANGED = 'userDataChanged';

export function initializeSharedUserManager() {
    console.log('🔧 Initializing Shared User Manager - FIXED VERSION with Caching');
    
    // Try to load cached data immediately for faster UI
    loadCachedUserData();
    
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            console.log('👤 User authenticated:', user.uid);
            
            // Cache basic auth info
            cacheUserAuth(user);
            
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
            clearUserCache();
        }
    });
}

async function setupUserDataListener(uid) {
    const userDocRef = doc(db, COLLECTIONS.USERS, uid);
    
    // Disable navigation links immediately until user data loads
    const navLinks = document.querySelectorAll('[data-nav]');
    navLinks.forEach(link => {
        link.style.pointerEvents = 'none';
        link.style.opacity = '0.6';
        link.style.cursor = 'wait';
    });
    
    try {
        // Load user data synchronously FIRST
        console.log('🔍 Loading user data for:', uid);
        const docSnapshot = await getDoc(userDocRef);
        
        if (docSnapshot.exists()) {
            const userData = docSnapshot.data();
            
            // CHECK if this is a complete signup (has signupComplete flag or has userName)
            if (userData.signupComplete || userData.userName) {
                currentUserData = userData;
                console.log('📡 Initial user data loaded:', currentUserData);
                console.log('🔍 User type detected:', currentUserData.userType);
                console.log('👤 Username detected:', currentUserData.userName);
                
                // Cache the complete user data
                cacheUserData(currentUserData);
                
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
            } else {
                console.warn('⚠️ Incomplete user data found (missing userName or signupComplete)');
                console.log('User data:', userData);
                // Don't create default - let the signup process handle it
                // Keep navigation disabled
            }
        } else {
            console.warn('⚠️ No user document found in Firestore for UID:', uid);
            console.log('📝 Waiting for signup process to create user document...');
            // Don't create default - wait for signup to complete
            // Keep navigation disabled
        }
        
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
            
            // Only update if this is complete data
            if (newUserData.signupComplete || newUserData.userName) {
                if (JSON.stringify(newUserData) !== JSON.stringify(currentUserData)) {
                    currentUserData = newUserData;
                    console.log('📡 User data updated from Firestore:', newUserData);
                    
                    // Update cache with new data
                    cacheUserData(newUserData);
                    
                    updateAllUserProfile();
                    updateNavigationLinks();
                    dispatchUserDataEvent();
                    
                    // Enable navigation if it was disabled
                    const navLinks = document.querySelectorAll('[data-nav]');
                    navLinks.forEach(link => {
                        link.style.pointerEvents = '';
                        link.style.opacity = '';
                        link.style.cursor = '';
                    });
                }
            } else {
                console.log('⏳ Incomplete user data in snapshot, waiting for complete data...');
            }
        }
    }, (error) => {
        console.error('❌ Error listening to user data:', error);
    });
}

function updateAllUserProfile() {
    if (!currentUserData || !currentUser) return;
    
    const userName = currentUserData.userName || currentUser.displayName || 'User';
    const userRole = getUserRoleDisplay(currentUserData.userType);
    const initials = generateInitials(userName);
    const profilePicUrl = currentUserData.userProfilePictureUrl || currentUser.photoURL;
    
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
        if (element) {
            if (profilePicUrl) {
                element.style.backgroundImage = `url(${profilePicUrl})`;
                element.style.backgroundSize = 'cover';
                element.style.backgroundPosition = 'center';
                element.textContent = '';
            } else {
                element.style.backgroundImage = 'none';
                element.textContent = initials;
            }
        }
    });
    
    console.log('🔄 Updated all user profile elements');
}

// FIXED: Update navigation links based on user type with explicit logging
function updateNavigationLinks() {
    if (!currentUserData) {
        console.log('⏳ Waiting for user data before updating navigation...');
        const navLinks = document.querySelectorAll('[data-nav]');
        navLinks.forEach(link => {
            link.style.pointerEvents = 'none';
            link.style.opacity = '0.5';
        });
        return;
    }
    
    // CRITICAL FIX: Check the EXACT user type string
    const userType = currentUserData.userType;
    console.log('🔍 Current userType value:', userType);
    console.log('🔍 Type of userType:', typeof userType);
    
    // Determine if user is a buyer based on EXACT matching
    const isBuyer = (userType === 'fertilizer_buyer' || userType === 'Organic Fertilizer Buyer');
    const isFarmer = (userType === 'swine_farmer' || userType === 'Swine Farmer');
    
    console.log('👤 User classification:');
    console.log('  - Is Buyer?', isBuyer);
    console.log('  - Is Farmer?', isFarmer);
    
    if (!isBuyer && !isFarmer) {
        console.warn('⚠️ Unknown user type:', userType);
        console.log('Defaulting to FARMER navigation');
    }
    
    const navLinks = document.querySelectorAll('[data-nav]');
    console.log('📍 Found', navLinks.length, 'navigation links to update');
    
    navLinks.forEach(link => {
        // Re-enable links
        link.style.pointerEvents = '';
        link.style.opacity = '';
        
        const navType = link.getAttribute('data-nav');
        const oldHref = link.getAttribute('href');
        let newHref = oldHref; // Default to keeping current href
        
        if (navType === 'dashboard') {
            // FIXED: Use explicit condition
            newHref = isBuyer ? '/buyer-dashboard.html' : '/dashboard.html';
            console.log(`  📊 Dashboard link updated: ${oldHref} → ${newHref} (isBuyer: ${isBuyer})`);
        }
        else if (navType === 'market') {
            // FIXED: Use explicit condition
            newHref = isBuyer ? '/buyer-marketplace.html' : '/farmermarket.html';
            console.log(`  🛒 Market link updated: ${oldHref} → ${newHref} (isBuyer: ${isBuyer})`);
        }
        else if (navType === 'transactions') {
            // Show/hide transactions link based on user type
            const parentLi = link.closest('li');
            if (isBuyer) {
                if (parentLi) parentLi.style.display = '';
                link.style.display = '';
                console.log(`  💳 Transactions link shown for buyer`);
            } else {
                if (parentLi) parentLi.style.display = 'none';
                link.style.display = 'none';
                console.log(`  💳 Transactions link hidden for farmer`);
            }
        }
        
        // Only update if href actually changed
        if (newHref !== oldHref) {
            link.setAttribute('href', newHref);
        }
    });
    
    console.log('✅ Navigation links updated based on user type:', userType);
}

function getUserRoleDisplay(userType) {
    switch(userType) {
        case 'swine_farmer':
        case 'Swine Farmer':
            return 'Swine Farmer';
        case 'fertilizer_buyer':
        case 'Organic Fertilizer Buyer':
            return 'Organic Fertilizer Buyer';
        default:
            return 'User';
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

// CACHING FUNCTIONS
function cacheUserAuth(user) {
    try {
        const authData = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            phoneNumber: user.phoneNumber,
            photoURL: user.photoURL
        };
        
        localStorage.setItem(CACHE_KEYS.USER_AUTH, JSON.stringify(authData));
        localStorage.setItem(CACHE_KEYS.CACHE_TIMESTAMP, Date.now().toString());
        console.log('💾 Cached user auth data');
    } catch (error) {
        console.error('❌ Error caching user auth:', error);
    }
}

function cacheUserData(userData) {
    try {
        if (!userData) return;
        
        // Cache the complete user document
        const dataToCache = {
            userID: userData.userID,
            userName: userData.userName,
            userEmail: userData.userEmail,
            userPhone: userData.userPhone,
            userType: userData.userType,
            userProfilePictureUrl: userData.userProfilePictureUrl || DEFAULT_PROFILE_PIC,
            userIsActive: userData.userIsActive,
            userPhoneVerified: userData.userPhoneVerified,
            isPro: userData.isPro,
            subscriptionTier: userData.subscriptionTier,
            subscriptionEndDate: userData.subscriptionEndDate,
            isDualRole: userData.isDualRole,
            autoRenew: userData.autoRenew,
            currentChatId: userData.currentChatId,
            fcmToken: userData.fcmToken,
            lastSeen: userData.lastSeen,
            userIsOnline: userData.userIsOnline,
            xenditCustomerId: userData.xenditCustomerId,
            xenditSubscriptionId: userData.xenditSubscriptionId,
            weeklyCameraAiUsed: userData.weeklyCameraAiUsed,
            weeklyManongBotPromptsUsed: userData.weeklyManongBotPromptsUsed,
            currentWeekStart: userData.currentWeekStart,
            userCreatedAt: userData.userCreatedAt,
            userUpdatedAt: userData.userUpdatedAt,
            signupComplete: userData.signupComplete
        };
        
        localStorage.setItem(CACHE_KEYS.USER_DATA, JSON.stringify(dataToCache));
        localStorage.setItem(CACHE_KEYS.PROFILE_PIC, userData.userProfilePictureUrl || DEFAULT_PROFILE_PIC);
        localStorage.setItem(CACHE_KEYS.CACHE_TIMESTAMP, Date.now().toString());
        
        console.log('💾 Cached complete user data:', dataToCache);
    } catch (error) {
        console.error('❌ Error caching user data:', error);
    }
}

function loadCachedUserData() {
    try {
        const cachedTimestamp = localStorage.getItem(CACHE_KEYS.CACHE_TIMESTAMP);
        
        // Check if cache is expired
        if (cachedTimestamp) {
            const cacheAge = Date.now() - parseInt(cachedTimestamp);
            if (cacheAge > CACHE_EXPIRY_MS) {
                console.log('🗑️ Cache expired, clearing...');
                clearUserCache();
                return false;
            }
        }
        
        const cachedUserData = localStorage.getItem(CACHE_KEYS.USER_DATA);
        
        if (cachedUserData) {
            currentUserData = JSON.parse(cachedUserData);
            console.log('📦 Loaded cached user data:', currentUserData);
            
            // Update UI with cached data immediately
            updateAllUserProfile();
            updateNavigationLinks();
            
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('❌ Error loading cached data:', error);
        return false;
    }
}

function clearUserCache() {
    try {
        localStorage.removeItem(CACHE_KEYS.USER_DATA);
        localStorage.removeItem(CACHE_KEYS.USER_AUTH);
        localStorage.removeItem(CACHE_KEYS.PROFILE_PIC);
        localStorage.removeItem(CACHE_KEYS.CACHE_TIMESTAMP);
        console.log('🗑️ Cleared user cache');
    } catch (error) {
        console.error('❌ Error clearing cache:', error);
    }
}

function getCachedProfilePicture() {
    try {
        return localStorage.getItem(CACHE_KEYS.PROFILE_PIC) || DEFAULT_PROFILE_PIC;
    } catch (error) {
        console.error('❌ Error getting cached profile picture:', error);
        return DEFAULT_PROFILE_PIC;
    }
}

// EXPORTED FUNCTIONS
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
    updateNavigationLinks();
}

export function isAuthenticated() {
    return currentUser !== null;
}

// FIXED: More explicit checking functions
export function isSwineFarmer() {
    if (!currentUserData) {
        console.log('⚠️ isSwineFarmer() called but no user data yet');
        return false;
    }
    const result = currentUserData.userType === 'swine_farmer' || 
                   currentUserData.userType === 'Swine Farmer';
    console.log('🔍 isSwineFarmer():', result, '(userType:', currentUserData.userType, ')');
    return result;
}

export function isFertilizerBuyer() {
    if (!currentUserData) {
        console.log('⚠️ isFertilizerBuyer() called but no user data yet');
        return false;
    }
    const result = currentUserData.userType === 'fertilizer_buyer' || 
                   currentUserData.userType === 'Organic Fertilizer Buyer';
    console.log('🔍 isFertilizerBuyer():', result, '(userType:', currentUserData.userType, ')');
    return result;
}

// CACHE UTILITY EXPORTS
export function cacheCompleteUserData(userData) {
    cacheUserData(userData);
}

export function getCachedUserData() {
    try {
        const cachedData = localStorage.getItem(CACHE_KEYS.USER_DATA);
        return cachedData ? JSON.parse(cachedData) : null;
    } catch (error) {
        console.error('❌ Error getting cached user data:', error);
        return null;
    }
}

export function getCachedProfilePic() {
    return getCachedProfilePicture();
}

export function clearCache() {
    clearUserCache();
}

export function isCacheValid() {
    try {
        const cachedTimestamp = localStorage.getItem(CACHE_KEYS.CACHE_TIMESTAMP);
        if (!cachedTimestamp) return false;
        
        const cacheAge = Date.now() - parseInt(cachedTimestamp);
        return cacheAge < CACHE_EXPIRY_MS;
    } catch (error) {
        return false;
    }
}

export { DEFAULT_PROFILE_PIC };

// Initialize on load
initializeSharedUserManager();

console.log('🔧 Shared User Manager with FIXED Routing and Caching loaded!');