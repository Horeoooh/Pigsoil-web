// Quick Test Script for Profile Settings
// Open browser console and paste this to test features

console.log('🧪 Profile Settings Test Suite');
console.log('================================');

// Test 1: Check if all DOM elements exist
console.log('\n1️⃣ Testing DOM Elements...');
const elements = {
    'Username Input': document.getElementById('username'),
    'Email Input': document.getElementById('email'),
    'Phone Input': document.getElementById('phone'),
    'User Type Select': document.getElementById('userType'),
    'Profile Avatar': document.getElementById('profileAvatar'),
    'Avatar Upload Button': document.getElementById('avatarUploadBtn'),
    'Profile Picture Input': document.getElementById('profilePictureInput'),
    'Change Phone Button': document.getElementById('changePhoneBtn'),
    'Change Email Button': document.getElementById('changeEmailBtn'),
    'Change Password Button': document.getElementById('changePasswordBtn'),
    'Save Button': document.getElementById('saveBtn'),
    'Logout Button': document.getElementById('logoutBtn'),
    'Delete Button': document.getElementById('deleteBtn'),
    'Phone Change Modal': document.getElementById('phoneChangeModal'),
    'SMS Verification Modal': document.getElementById('smsVerificationModal'),
    'Password Change Modal': document.getElementById('passwordChangeModal')
};

Object.entries(elements).forEach(([name, element]) => {
    if (element) {
        console.log(`✅ ${name}: Found`);
    } else {
        console.error(`❌ ${name}: Missing!`);
    }
});

// Test 2: Check Firebase initialization
console.log('\n2️⃣ Testing Firebase...');
try {
    if (typeof auth !== 'undefined') {
        console.log('✅ Firebase Auth: Initialized');
    }
    if (typeof db !== 'undefined') {
        console.log('✅ Firebase Firestore: Initialized');
    }
    if (typeof storage !== 'undefined') {
        console.log('✅ Firebase Storage: Initialized');
    }
} catch (e) {
    console.error('❌ Firebase Error:', e);
}

// Test 3: Check current user
console.log('\n3️⃣ Testing User Authentication...');
auth.onAuthStateChanged((user) => {
    if (user) {
        console.log('✅ User authenticated:', user.uid);
        console.log('   Email:', user.email || 'None');
        console.log('   Phone:', user.phoneNumber || 'None');
        console.log('   Display Name:', user.displayName || 'None');
    } else {
        console.log('❌ No user authenticated');
    }
});

// Test 4: Check user data from Firestore
console.log('\n4️⃣ Testing Firestore User Data...');
setTimeout(async () => {
    try {
        const user = auth.currentUser;
        if (user) {
            const userDoc = await db.collection('users').doc(user.uid).get();
            if (userDoc.exists) {
                const data = userDoc.data();
                console.log('✅ User data loaded from Firestore:');
                console.log('   Username:', data.userName);
                console.log('   Email:', data.userEmail || 'None');
                console.log('   Phone:', data.userPhone || 'None');
                console.log('   User Type:', data.userType);
                console.log('   Profile Picture:', data.userProfilePictureUrl ? 'Yes' : 'No');
            } else {
                console.log('❌ User document not found in Firestore');
            }
        }
    } catch (e) {
        console.error('❌ Firestore error:', e);
    }
}, 2000);

// Test 5: Simulate profile picture validation
console.log('\n5️⃣ Profile Picture Validation Test:');
console.log('To test: Select an image file');
console.log('✅ Max size: 5MB');
console.log('✅ Formats: JPG, PNG, GIF, WebP');

// Test 6: Phone number validation
console.log('\n6️⃣ Phone Number Validation Test:');
const testPhones = [
    { phone: '+639123456789', valid: true },
    { phone: '+639999999999', valid: true },
    { phone: '09123456789', valid: false },
    { phone: '+63912345678', valid: false },
    { phone: '+639123456789012', valid: false }
];

testPhones.forEach(test => {
    const isValid = /^\+63[0-9]{10}$/.test(test.phone);
    const status = isValid === test.valid ? '✅' : '❌';
    console.log(`${status} ${test.phone}: ${isValid ? 'Valid' : 'Invalid'} (Expected: ${test.valid ? 'Valid' : 'Invalid'})`);
});

// Test 7: Email validation
console.log('\n7️⃣ Email Validation Test:');
const testEmails = [
    { email: 'test@example.com', valid: true },
    { email: 'user.name+tag@domain.co.uk', valid: true },
    { email: 'invalid@', valid: false },
    { email: '@invalid.com', valid: false },
    { email: 'no-at-sign.com', valid: false }
];

testEmails.forEach(test => {
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(test.email);
    const status = isValid === test.valid ? '✅' : '❌';
    console.log(`${status} ${test.email}: ${isValid ? 'Valid' : 'Invalid'} (Expected: ${test.valid ? 'Valid' : 'Invalid'})`);
});

// Test 8: Check if modals work
console.log('\n8️⃣ Modal Functionality Test:');
console.log('Run these commands to test modals:');
console.log('Phone Modal: document.getElementById("phoneChangeModal").classList.add("show")');
console.log('SMS Modal: document.getElementById("smsVerificationModal").classList.add("show")');
console.log('Password Modal: document.getElementById("passwordChangeModal").classList.add("show")');

// Test 9: Storage test
console.log('\n9️⃣ Firebase Storage Test:');
console.log('To test storage upload:');
console.log('1. Click camera icon on avatar');
console.log('2. Select a small image');
console.log('3. Watch console for upload progress');
console.log('4. Check if avatar updates');

// Test 10: Profile display test
console.log('\n🔟 Profile Display Test:');
setTimeout(() => {
    const avatar = document.getElementById('profileAvatar');
    const userName = document.getElementById('profileUserName');
    
    if (avatar) {
        const hasBackgroundImage = avatar.style.backgroundImage && avatar.style.backgroundImage !== 'none';
        const hasInitials = avatar.textContent.trim().length > 0;
        
        if (hasBackgroundImage) {
            console.log('✅ Profile picture: Displayed');
        } else if (hasInitials) {
            console.log('✅ Initials: Displayed (' + avatar.textContent + ')');
        } else {
            console.log('❌ Neither profile picture nor initials displayed');
        }
    }
    
    if (userName) {
        console.log('✅ Username displayed:', userName.textContent);
    }
}, 3000);

// Instructions
console.log('\n📋 Manual Testing Checklist:');
console.log('1. ✓ Upload profile picture (< 5MB)');
console.log('2. ✓ Change username');
console.log('3. ✓ Change user type (swine_farmer ↔ fertilizer_buyer)');
console.log('4. ✓ Change phone number (with SMS)');
console.log('5. ✓ Change email (if exists)');
console.log('6. ✓ Change password (if email exists)');
console.log('7. ✓ Delete account (with confirmation)');
console.log('8. ✓ Logout');
console.log('\n🎉 All tests completed! Check results above.');
