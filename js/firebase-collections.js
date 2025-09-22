// firebase-collections.js
// Firebase Collections Setup for PigSoil+ Website

import { auth, db, storage } from './init.js';
import { 
    collection, 
    doc, 
    addDoc, 
    getDocs, 
    getDoc, 
    updateDoc, 
    deleteDoc, 
    query, 
    where, 
    orderBy, 
    limit,
    onSnapshot,
    serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js';

// Collection names matching your project requirements
export const COLLECTIONS = {
    USERS: 'users',
    SWINE_FARMERS: 'swineFarmers',
    FERTILIZER_BUYERS: 'fertilizerBuyers',
    PRODUCT_LISTINGS: 'product_listings',
    COMPOST_BATCHES: 'compost_batches',
    MESSAGES: 'messages',
    CONVERSATIONS: 'conversations',
    TRANSACTIONS: 'transactions',
    SUBSCRIPTIONS: 'subscriptions',
    NOTIFICATIONS: 'notifications'
};

// ===== USER MANAGEMENT FUNCTIONS =====

// Create user profile
export async function createUserProfile(userData) {
    try {
        const userRef = collection(db, COLLECTIONS.USERS);
        const docRef = await addDoc(userRef, {
            uid: userData.uid,
            email: userData.email,
            displayName: userData.displayName || '',
            userType: userData.userType, // 'swine_farmer' or 'fertilizer_buyer'
            phoneNumber: userData.phoneNumber || '',
            address: {
                barangay: userData.address?.barangay || '',
                municipality: userData.address?.municipality || '',
                province: userData.address?.province || '',
                region: userData.address?.region || 'Central Visayas'
            },
            profilePicture: userData.profilePicture || '',
            isVerified: false,
            isActive: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        
        console.log('✅ User profile created:', docRef.id);
        return docRef;
    } catch (error) {
        console.error('❌ Error creating user profile:', error);
        throw error;
    }
}

// Create swine farmer profile
export async function createSwineFarmerProfile(farmerData) {
    try {
        const farmersRef = collection(db, COLLECTIONS.SWINE_FARMERS);
        const docRef = await addDoc(farmersRef, {
            userId: farmerData.userId,
            farmName: farmerData.farmName,
            farmSize: farmerData.farmSize || 0, // in hectares
            swineCount: farmerData.swineCount || 0,
            farmingExperience: farmerData.farmingExperience || 0, // years
            compostTechniques: farmerData.compostTechniques || ['basic_swine_manure', 'hot_composting'],
            subscriptionStatus: 'trial', // 'trial', 'active', 'expired'
            subscriptionPlan: 'basic',
            totalListings: 0,
            totalSales: 0,
            rating: 0,
            reviewCount: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        
        console.log('✅ Swine farmer profile created:', docRef.id);
        return docRef;
    } catch (error) {
        console.error('❌ Error creating farmer profile:', error);
        throw error;
    }
}

// Create fertilizer buyer profile
export async function createFertilizerBuyerProfile(buyerData) {
    try {
        const buyersRef = collection(db, COLLECTIONS.FERTILIZER_BUYERS);
        const docRef = await addDoc(buyersRef, {
            userId: buyerData.userId,
            businessName: buyerData.businessName || '',
            businessType: buyerData.businessType || 'individual', // 'individual', 'farm', 'distributor'
            monthlyRequirement: buyerData.monthlyRequirement || 0, // kg
            preferredCompostTypes: buyerData.preferredCompostTypes || ['basic_swine_manure', 'hot_composting'],
            budget: {
                min: buyerData.budget?.min || 0,
                max: buyerData.budget?.max || 0
            },
            totalPurchases: 0,
            favoriteSuppliers: [],
            rating: 0,
            reviewCount: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        
        console.log('✅ Fertilizer buyer profile created:', docRef.id);
        return docRef;
    } catch (error) {
        console.error('❌ Error creating buyer profile:', error);
        throw error;
    }
}

// ===== COMPOST LISTINGS FUNCTIONS =====

// Create compost listing
export async function createCompostListing(listingData) {
    try {
        const listingsRef = collection(db, COLLECTIONS.COMPOST_LISTINGS);
        const docRef = await addDoc(listingsRef, {
            // Seller information
            sellerId: listingData.sellerId,
            sellerName: listingData.sellerName,
            farmName: listingData.farmName,
            
            // Product information
            title: listingData.title,
            description: listingData.description,
            compostTechnique: listingData.compostTechnique, // 'basic_swine_manure' or 'hot_composting'
            quantity: listingData.quantity, // kg
            pricePerKg: listingData.pricePerKg, // PHP
            totalPrice: listingData.totalPrice, // PHP
            
            // Location information
            location: {
                name: listingData.location.name,
                address: listingData.location.address,
                barangay: listingData.location.barangay,
                municipality: listingData.location.municipality,
                province: listingData.location.province,
                region: listingData.location.region,
                coordinates: listingData.location.coordinates
            },
            
            // Media
            images: listingData.images || [],
            
            // Status and metadata
            availability: 'available', // 'available', 'reserved', 'sold'
            isOrganic: true,
            harvestDate: listingData.harvestDate,
            expiryDate: listingData.expiryDate,
            
            // Nutrients
            nutrients: listingData.nutrients || {
                nitrogen: 2.0,
                phosphorus: 1.5,
                potassium: 1.8,
                organicMatter: 40
            },
            
            // Analytics
            views: 0,
            inquiries: 0,
            
            // Tags for searching
            tags: listingData.tags || ['swine_compost', 'organic'],
            
            // Timestamps
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        
        console.log('✅ Compost listing created:', docRef.id);
        return docRef;
    } catch (error) {
        console.error('❌ Error creating listing:', error);
        throw error;
    }
}

// Get all available listings
export async function getAvailableListings(limitCount = 20) {
    try {
        const listingsRef = collection(db, COLLECTIONS.COMPOST_LISTINGS);
        const q = query(
            listingsRef,
            where('availability', '==', 'available'),
            orderBy('createdAt', 'desc'),
            limit(limitCount)
        );
        
        const querySnapshot = await getDocs(q);
        const listings = [];
        
        querySnapshot.forEach((doc) => {
            listings.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        console.log(`📦 Found ${listings.length} available listings`);
        return listings;
    } catch (error) {
        console.error('❌ Error fetching listings:', error);
        throw error;
    }
}

// Get listings by seller
export async function getListingsBySeller(sellerId) {
    try {
        const listingsRef = collection(db, COLLECTIONS.COMPOST_LISTINGS);
        const q = query(
            listingsRef,
            where('sellerId', '==', sellerId),
            orderBy('createdAt', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        const listings = [];
        
        querySnapshot.forEach((doc) => {
            listings.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        console.log(`📦 Found ${listings.length} listings for seller ${sellerId}`);
        return listings;
    } catch (error) {
        console.error('❌ Error fetching seller listings:', error);
        throw error;
    }
}

// ===== MESSAGING SYSTEM =====

// Create conversation
export async function createConversation(conversationData) {
    try {
        const conversationsRef = collection(db, COLLECTIONS.CONVERSATIONS);
        const docRef = await addDoc(conversationsRef, {
            participants: [
                {
                    userId: conversationData.farmerId,
                    userType: 'swine_farmer',
                    name: conversationData.farmerName
                },
                {
                    userId: conversationData.buyerId,
                    userType: 'fertilizer_buyer',
                    name: conversationData.buyerName
                }
            ],
            listingId: conversationData.listingId,
            listingTitle: conversationData.listingTitle,
            lastMessage: '',
            lastMessageTime: serverTimestamp(),
            unreadCount: {
                [conversationData.farmerId]: 0,
                [conversationData.buyerId]: 0
            },
            isActive: true,
            createdAt: serverTimestamp()
        });
        
        console.log('✅ Conversation created:', docRef.id);
        return docRef;
    } catch (error) {
        console.error('❌ Error creating conversation:', error);
        throw error;
    }
}

// Send message
export async function sendMessage(messageData) {
    try {
        const messagesRef = collection(db, COLLECTIONS.MESSAGES);
        const docRef = await addDoc(messagesRef, {
            conversationId: messageData.conversationId,
            senderId: messageData.senderId,
            senderName: messageData.senderName,
            senderType: messageData.senderType,
            receiverId: messageData.receiverId,
            receiverName: messageData.receiverName,
            receiverType: messageData.receiverType,
            content: messageData.content,
            messageType: 'text',
            isRead: false,
            listingId: messageData.listingId || null,
            createdAt: serverTimestamp()
        });
        
        console.log('✅ Message sent:', docRef.id);
        return docRef;
    } catch (error) {
        console.error('❌ Error sending message:', error);
        throw error;
    }
}

// ===== REAL-TIME LISTENERS =====

// Listen to new listings
export function listenToNewListings(callback) {
    const listingsRef = collection(db, COLLECTIONS.COMPOST_LISTINGS);
    const q = query(
        listingsRef,
        where('availability', '==', 'available'),
        orderBy('createdAt', 'desc'),
        limit(20)
    );
    
    return onSnapshot(q, (snapshot) => {
        const listings = [];
        snapshot.forEach((doc) => {
            listings.push({
                id: doc.id,
                ...doc.data()
            });
        });
        callback(listings);
    });
}

// ===== UTILITY FUNCTIONS =====

// Get user by UID
export async function getUserByUid(uid) {
    try {
        const usersRef = collection(db, COLLECTIONS.USERS);
        const q = query(usersRef, where('uid', '==', uid));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
            const userData = querySnapshot.docs[0].data();
            return {
                id: querySnapshot.docs[0].id,
                ...userData
            };
        }
        return null;
    } catch (error) {
        console.error('❌ Error getting user:', error);
        throw error;
    }
}

// Initialize sample data for testing
export async function initializeSampleData() {
    try {
        console.log('🌱 Initializing sample data for PigSoil+...');
        
        // Create sample swine farmer
        const sampleFarmerData = {
            uid: 'sample-farmer-001',
            email: 'juan.farmer@pigsoil.com',
            displayName: 'Juan Dela Cruz',
            userType: 'swine_farmer',
            phoneNumber: '+639123456789',
            address: {
                barangay: 'San Jose',
                municipality: 'Cebu City',
                province: 'Cebu',
                region: 'Central Visayas'
            }
        };
        
        await createUserProfile(sampleFarmerData);
        
        await createSwineFarmerProfile({
            userId: sampleFarmerData.uid,
            farmName: "Juan's Swine Farm",
            farmSize: 2.5,
            swineCount: 100,
            farmingExperience: 5,
            compostTechniques: ['basic_swine_manure', 'hot_composting']
        });
        
        // Create sample buyer
        const sampleBuyerData = {
            uid: 'sample-buyer-001',
            email: 'maria.buyer@pigsoil.com',
            displayName: 'Maria Santos',
            userType: 'fertilizer_buyer',
            phoneNumber: '+639987654321',
            address: {
                barangay: 'Lahug',
                municipality: 'Cebu City',
                province: 'Cebu',
                region: 'Central Visayas'
            }
        };
        
        await createUserProfile(sampleBuyerData);
        
        await createFertilizerBuyerProfile({
            userId: sampleBuyerData.uid,
            businessName: 'Green Gardens Farm Supply',
            businessType: 'distributor',
            monthlyRequirement: 500,
            budget: { min: 15, max: 30 }
        });
        
        console.log('✅ Sample data initialized successfully!');
        return true;
    } catch (error) {
        console.error('❌ Error initializing sample data:', error);
        throw error;
    }
}

// Test Firebase connection
export async function testFirebaseConnection() {
    try {
        console.log('🔥 Testing Firebase connection...');
        
        const testDoc = await addDoc(collection(db, 'test'), {
            message: 'PigSoil+ Firebase connection test',
            timestamp: serverTimestamp(),
            testTime: new Date().toISOString()
        });
        
        console.log('✅ Firebase connection successful! Test document ID:', testDoc.id);
        return testDoc.id;
    } catch (error) {
        console.error('❌ Firebase connection test failed:', error);
        throw error;
    }
}