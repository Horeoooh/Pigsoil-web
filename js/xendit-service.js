// Xendit API Service for PigSoil+ Web
// WARNING: This implementation exposes the secret key in client-side code
// For production, move these API calls to Firebase Functions

const XENDIT_CONFIG = {
    // REPLACE WITH YOUR ACTUAL XENDIT SECRET KEY
    SECRET_KEY: 'xnd_development_WIsr9JYEru2kl6zMnIARfnWBUbPPVummOl3Kl0If2nSd6cmDbGsq8wyYWWJFNs',
    BASE_URL: 'https://api.xendit.co',
    API_VERSION: '2020-10-31'
};

class XenditService {
    constructor() {
        this.secretKey = XENDIT_CONFIG.SECRET_KEY;
        this.baseUrl = XENDIT_CONFIG.BASE_URL;
        this.apiVersion = XENDIT_CONFIG.API_VERSION;
    }

    /**
     * Get Authorization header for Xendit API
     * Format: Basic base64(secret_key:)
     */
    getAuthHeader() {
        const credentials = `${this.secretKey}:`;
        const encoded = btoa(credentials);
        return `Basic ${encoded}`;
    }

    /**
     * Make authenticated request to Xendit API
     */
    async makeRequest(endpoint, method = 'POST', body = null) {
        const url = `${this.baseUrl}${endpoint}`;
        
        const headers = {
            'Authorization': this.getAuthHeader(),
            'Content-Type': 'application/json'
        };

        // Add API version header for certain endpoints
        if (endpoint.includes('/customers') || endpoint.includes('/recurring')) {
            headers['api-version'] = this.apiVersion;
        }

        const options = {
            method,
            headers
        };

        if (body && (method === 'POST' || method === 'PATCH')) {
            options.body = JSON.stringify(body);
        }

        try {
            console.log(`[Xendit] ${method} ${url}`, body);
            
            const response = await fetch(url, options);
            const data = await response.json();

            if (!response.ok) {
                console.error('[Xendit] API Error:', data);
                throw new Error(data.message || data.error_code || 'Xendit API request failed');
            }

            console.log('[Xendit] Response:', data);
            return data;
        } catch (error) {
            console.error('[Xendit] Request failed:', error);
            throw error;
        }
    }

    /**
     * Create or get Xendit customer
     * @param {Object} userData - User data from Firebase
     * @returns {Promise<Object>} Customer object with id
     */
    async createOrGetCustomer(userData) {
        const userId = userData.userID;
        
        // Check if customer already exists in Firestore
        if (userData.xenditCustomerId) {
            console.log('[Xendit] Using existing customer ID:', userData.xenditCustomerId);
            return { id: userData.xenditCustomerId };
        }

        // Create new customer
        const name = userData.userName || 'PigSoil User';
        const nameParts = name.trim().split(' ');
        const givenNames = nameParts[0] || 'PigSoil';
        const surname = nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'User';

        const customerData = {
            reference_id: userId,
            type: 'INDIVIDUAL',
            individual_detail: {
                given_names: givenNames,
                surname: surname,
                nationality: 'PH',
                gender: 'MALE'
            }
        };

        // Add email if available (optional)
        if (userData.userEmail && userData.userEmail.trim()) {
            customerData.email = userData.userEmail.trim();
        }

        // Add mobile number if available (optional)
        if (userData.userPhone && userData.userPhone.trim()) {
            customerData.mobile_number = userData.userPhone.trim();
        }

        try {
            const customer = await this.makeRequest('/customers', 'POST', customerData);
            
            // Save customer ID to Firestore for future use
            const { getFirestore, doc, updateDoc } = await import('https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js');
            const db = getFirestore();
            await updateDoc(doc(db, 'users', userId), {
                xenditCustomerId: customer.id,
                userUpdatedAt: Date.now()
            });

            console.log('[Xendit] Created customer:', customer.id);
            return customer;
        } catch (error) {
            console.error('[Xendit] Failed to create customer:', error);
            throw new Error('Failed to create Xendit customer: ' + error.message);
        }
    }

    /**
     * Create subscription plan
     * @param {string} userId - User ID (reference_id)
     * @param {Object} customer - Xendit customer object
     * @param {string} tier - Subscription tier (ESSENTIAL or PREMIUM)
     * @returns {Promise<Object>} Subscription plan response with actions
     */
    async createSubscriptionPlan(userId, customer, tier) {
        // Determine amount based on tier
        let amount = 149;
        if (tier === 'PREMIUM') {
            amount = 299;
        } else if (tier === 'ESSENTIAL') {
            amount = 149;
        }

        // Get current date for anchor_date
        const now = new Date();
        const anchorDate = now.toISOString();

        // Build subscription request
        const subscriptionData = {
            reference_id: userId,
            customer_id: customer.id,
            recurring_action: 'PAYMENT',
            currency: 'PHP',
            amount: amount,
            schedule: {
                reference_id: `schedule_${Date.now()}`,
                interval: 'MONTH',
                interval_count: 1,
                anchor_date: anchorDate,
                retry_interval: 'DAY',
                retry_interval_count: 3,
                total_retry: 3,
                failed_attempt_notifications: [1, 2]
            },
            immediate_action_type: 'FULL_AMOUNT',
            notification_config: {
                recurring_created: ['EMAIL'],
                recurring_succeeded: ['EMAIL'],
                recurring_failed: ['EMAIL']
            },
            failed_cycle_action: 'STOP',
            success_return_url: `${window.location.origin}/setting-subscription.html?status=success`,
            failure_return_url: `${window.location.origin}/setting-subscription.html?status=failure`,
            description: `PigSoil+ ${tier} Subscription`,
            metadata: {
                tier: tier,
                user_id: userId,
                created_at: new Date().toISOString()
            }
        };

        try {
            const plan = await this.makeRequest('/recurring/plans', 'POST', subscriptionData);
            console.log('[Xendit] Subscription plan created:', plan);
            return plan;
        } catch (error) {
            console.error('[Xendit] Failed to create subscription:', error);
            throw new Error('Failed to create subscription plan: ' + error.message);
        }
    }

    /**
     * Get payment URL from subscription plan response
     * @param {Object} planResponse - Response from createSubscriptionPlan
     * @returns {string|null} Payment URL or null
     */
    getPaymentUrl(planResponse) {
        if (!planResponse || !planResponse.actions || planResponse.actions.length === 0) {
            return null;
        }

        const action = planResponse.actions[0];
        return action.url || null;
    }

    /**
     * Cache subscription details in localStorage
     * @param {string} userId - User ID
     * @param {string} subscriptionId - Xendit subscription ID
     * @param {string} tier - Subscription tier
     */
    cacheSubscriptionDetails(userId, subscriptionId, tier) {
        try {
            localStorage.setItem(`pending_subscription_${userId}`, subscriptionId);
            localStorage.setItem(`pending_tier_${userId}`, tier);
            console.log('[Xendit] Cached subscription details');
        } catch (error) {
            console.warn('[Xendit] Failed to cache subscription:', error);
        }
    }

    /**
     * Get cached subscription details
     * @param {string} userId - User ID
     * @returns {Object|null} Cached subscription details or null
     */
    getCachedSubscriptionDetails(userId) {
        try {
            const subscriptionId = localStorage.getItem(`pending_subscription_${userId}`);
            const tier = localStorage.getItem(`pending_tier_${userId}`);
            
            if (subscriptionId && tier) {
                return { subscriptionId, tier };
            }
        } catch (error) {
            console.warn('[Xendit] Failed to get cached subscription:', error);
        }
        return null;
    }

    /**
     * Clear cached subscription details
     * @param {string} userId - User ID
     */
    clearCachedSubscriptionDetails(userId) {
        try {
            localStorage.removeItem(`pending_subscription_${userId}`);
            localStorage.removeItem(`pending_tier_${userId}`);
            console.log('[Xendit] Cleared subscription cache');
        } catch (error) {
            console.warn('[Xendit] Failed to clear cache:', error);
        }
    }
}

// Export singleton instance
const xenditService = new XenditService();
export default xenditService;

// Also export for non-module scripts
if (typeof window !== 'undefined') {
    window.XenditService = xenditService;
}