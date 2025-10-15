// Subscription Settings JavaScript - Full Version with Xendit Integration
import { auth, db } from './init.js';
import './shared-user-manager.js';
import xenditService from './xendit-service.js';
import { 
    onAuthStateChanged,
    signOut
} from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js';
import { 
    doc, 
    getDoc,
    updateDoc,
    serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js';

// Constants matching Android User model
const TIER_FREE = 'FREE';
const TIER_ESSENTIAL = 'ESSENTIAL';
const TIER_PREMIUM = 'PREMIUM';

const FREE_WEEKLY_MANONG_BOT_LIMIT = 10;
const FREE_WEEKLY_CAMERA_AI_LIMIT = 5;

const ESSENTIAL_PRICE = 149;
const PREMIUM_PRICE = 299;

// State
let currentUser = null;
let currentUserData = null;
let selectedPlanTier = null;
let plans = [];
let isLoading = false;

// DOM Elements
const currentPlanBadge = document.getElementById('currentPlanBadge');
const alertMessage = document.getElementById('alertMessage');
const limitMessage = document.getElementById('limitMessage');
const limitTitle = document.getElementById('limitTitle');
const limitDescription = document.getElementById('limitDescription');
const planToggleButtons = document.getElementById('planToggleButtons');
const plansGrid = document.getElementById('plansGrid');
const usageSection = document.getElementById('usageSection');
const manongBotUsage = document.getElementById('manongBotUsage');
const manongBotProgress = document.getElementById('manongBotProgress');
const cameraAiUsage = document.getElementById('cameraAiUsage');
const cameraAiProgress = document.getElementById('cameraAiProgress');
const weeklyReset = document.getElementById('weeklyReset');
const actionBtn = document.getElementById('actionBtn');
const manageBtn = document.getElementById('manageBtn');
const contactBtn = document.getElementById('contactBtn');
const loadingOverlay = document.getElementById('loadingOverlay');
const logoutBtn = document.getElementById('logoutBtn');
const confirmationModal = document.getElementById('confirmationModal');
const modalTitle = document.getElementById('modalTitle');
const modalTitleText = document.getElementById('modalTitleText');
const modalIcon = document.getElementById('modalIcon');
const modalBody = document.getElementById('modalBody');
const modalActions = document.getElementById('modalActions');

const headerUserName = document.getElementById('headerUserName');
const headerUserRole = document.getElementById('headerUserRole');
const headerUserAvatar = document.getElementById('headerUserAvatar');

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    console.log('Subscription Settings initialized');
    
    checkAuthState();
    setupEventListeners();
    handleUrlParameters();
});

function checkAuthState() {
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            showAlert('Please sign in to access subscription settings.', 'error');
            setTimeout(() => {
                window.location.href = '/login.html';
            }, 2000);
            return;
        }
        
        currentUser = user;
        console.log('User authenticated:', user.uid);
        
        await loadUserSubscriptionData();
    });
}

async function loadUserSubscriptionData() {
    if (!currentUser) {
        showAlert('Not authenticated', 'error');
        return;
    }
    
    showLoading(true);
    
    try {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
            currentUserData = {
                userID: currentUser.uid,
                ...userDoc.data()
            };
            
            console.log('User data loaded:', currentUserData);
            
            // Check and reset weekly limits if needed
            await checkAndResetWeeklyLimits();
            
            // Update UI
            updateUI();
            
            // Hide limit message if user has upgraded
            if (isSubscriptionActive()) {
                hideLimitMessage();
            }
        } else {
            showAlert('User data not found', 'error');
        }
    } catch (error) {
        console.error('Error loading subscription data:', error);
        showAlert('Failed to load subscription data: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function checkAndResetWeeklyLimits() {
    if (!currentUserData) return;
    
    const currentWeekStart = currentUserData.currentWeekStart || 0;
    const weekStart = getWeekStart();
    
    // Check if it's a new week
    if (currentWeekStart < weekStart) {
        console.log('New week detected, resetting limits');
        
        try {
            const userDocRef = doc(db, 'users', currentUser.uid);
            await updateDoc(userDocRef, {
                weeklyManongBotPromptsUsed: 0,
                weeklyCameraAiUsed: 0,
                currentWeekStart: weekStart,
                userUpdatedAt: serverTimestamp()
            });
            
            // Update local data
            currentUserData.weeklyManongBotPromptsUsed = 0;
            currentUserData.weeklyCameraAiUsed = 0;
            currentUserData.currentWeekStart = weekStart;
        } catch (error) {
            console.error('Failed to reset weekly limits:', error);
        }
    }
}

function getWeekStart() {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday.getTime();
}

function handleUrlParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get('status');
    const showLimit = urlParams.get('show_limit');
    const limitType = urlParams.get('limit_type');
    
    // Handle payment return status
    if (status === 'success') {
        handlePaymentSuccess();
    } else if (status === 'failure') {
        handlePaymentFailure();
    }
    
    // Handle limit message
    if (showLimit === 'true' && limitType) {
        showLimitMessage(limitType);
    }
}

async function handlePaymentSuccess() {
    showAlert('Payment successful! Your subscription is being activated...', 'success');
    
    // Wait a bit for webhooks to process
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Poll for subscription activation
    await checkSubscriptionActivation();
}

function handlePaymentFailure() {
    showAlert('Payment was cancelled or failed. Please try again.', 'error');
    
    // Clear URL parameters
    if (window.history.replaceState) {
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
    }
}

async function checkSubscriptionActivation() {
    let attempts = 0;
    const maxAttempts = 5;
    
    const checkStatus = async () => {
        try {
            await loadUserSubscriptionData();
            
            if (isSubscriptionActive()) {
                showActivationSuccess();
                
                // Clear URL parameters
                if (window.history.replaceState) {
                    const cleanUrl = window.location.pathname;
                    window.history.replaceState({}, document.title, cleanUrl);
                }
                
                // Clear cached subscription details
                xenditService.clearCachedSubscriptionDetails(currentUser.uid);
            } else if (attempts < maxAttempts) {
                attempts++;
                setTimeout(checkStatus, 2000);
            } else {
                showDelayedActivation();
            }
        } catch (error) {
            console.error('Error checking subscription status:', error);
        }
    };
    
    checkStatus();
}

function showActivationSuccess() {
    // Hide limit message when subscription is activated
    hideLimitMessage();
    
    const planName = getPlanName();
    showAlert(`🎉 Welcome to ${planName}! Your subscription is now active. Enjoy your unlimited features!`, 'success');
}

function showDelayedActivation() {
    showAlert('⏳ Your payment is being processed. Your subscription will be activated shortly. You will receive a notification once it\'s ready.', 'warning');
}

function updateUI() {
    if (!currentUserData) return;
    
    // Update current plan badge
    const planName = getPlanName();
    const planEmoji = getPlanEmoji();
    currentPlanBadge.innerHTML = `
        <span>${planEmoji}</span>
        <span>Current Plan: ${planName}</span>
    `;
    
    // Update header
    updateHeaderDisplay();
    
    // Build plans list
    buildPlansList();
    
    // Render plan toggles
    renderPlanToggles();
    
    // Render selected plan card
    renderSelectedPlanCard();
    
    // Update usage section
    updateUsageSection();
    
    // Update action button
    updateActionButton();
    
    // Show/hide manage subscription button
    if (isSubscriptionActive()) {
        manageBtn.style.display = 'block';
    } else {
        manageBtn.style.display = 'none';
    }
}

function updateHeaderDisplay() {
    const userName = currentUserData.userName || currentUser.displayName || 'User';
    const userRole = currentUserData.userType === 'swine_farmer' ? 'Swine Farmer' : 'Fertilizer Buyer';
    const initials = generateInitials(userName);
    
    if (headerUserName) headerUserName.textContent = userName;
    if (headerUserRole) headerUserRole.textContent = userRole;
    if (headerUserAvatar) headerUserAvatar.textContent = initials;
}

function generateInitials(name) {
    if (!name) return '?';
    return name.split(' ')
               .map(word => word.charAt(0))
               .join('')
               .substring(0, 2)
               .toUpperCase();
}

function getPlanName() {
    const tier = currentUserData.subscriptionTier || TIER_FREE;
    switch (tier) {
        case TIER_PREMIUM: return 'Premium';
        case TIER_ESSENTIAL: return 'Essential';
        default: return 'Free';
    }
}

function getPlanEmoji() {
    const tier = currentUserData.subscriptionTier || TIER_FREE;
    switch (tier) {
        case TIER_PREMIUM: return '⭐';
        case TIER_ESSENTIAL: return '🌿';
        default: return '🌱';
    }
}

function isSubscriptionActive() {
    const tier = currentUserData.subscriptionTier || TIER_FREE;
    if (tier === TIER_FREE) return false;
    
    const endDate = currentUserData.subscriptionEndDate || 0;
    return endDate > Date.now();
}

function isFree() {
    return (currentUserData.subscriptionTier || TIER_FREE) === TIER_FREE || !isSubscriptionActive();
}

function isEssential() {
    return currentUserData.subscriptionTier === TIER_ESSENTIAL && isSubscriptionActive();
}

function isPremium() {
    return currentUserData.subscriptionTier === TIER_PREMIUM && isSubscriptionActive();
}

function buildPlansList() {
    plans = [];
    
    const userType = currentUserData.userType || 'swine_farmer';
    const isDualRole = currentUserData.isDualRole || false;
    
    // Determine if user should see Premium tier
    const showPremium = isDualRole || userType !== 'fertilizer_buyer';
    
    // FREE Tier
    let freeFeatures = [
        'Marketplace Access',
        'Composting Guides',
        `${FREE_WEEKLY_CAMERA_AI_LIMIT} Camera AI scans/week`
    ];
    
    if (showPremium) {
        freeFeatures = [
            `${FREE_WEEKLY_MANONG_BOT_LIMIT} Manong Bot questions/week`,
            `${FREE_WEEKLY_CAMERA_AI_LIMIT} Camera AI scans/week`,
            'Marketplace Access',
            'Composting Guides'
        ];
    }
    
    plans.push({
        tier: TIER_FREE,
        name: 'Free',
        price: 0,
        priceText: 'Free',
        features: freeFeatures,
        icon: '🌱',
        isCurrentPlan: isFree()
    });
    
    // ESSENTIAL Tier
    const essentialFeatures = userType === 'fertilizer_buyer' && !isDualRole 
        ? [
            'Everything in Free',
            'Unlimited Manong Bot',
            'Priority support'
        ]
        : [
            'Everything in Free',
            'Unlimited Manong Bot',
            `${FREE_WEEKLY_CAMERA_AI_LIMIT} Camera AI scans/week`,
            'Priority support'
        ];
    
    plans.push({
        tier: TIER_ESSENTIAL,
        name: 'Essential',
        price: ESSENTIAL_PRICE,
        priceText: `₱${ESSENTIAL_PRICE}/mo`,
        features: essentialFeatures,
        icon: '🌿',
        badge: showPremium ? 'Best Value' : 'Recommended',
        badgeColor: '#4CAF50',
        isCurrentPlan: isEssential(),
        isUpgradeAvailable: isFree()
    });
    
    // PREMIUM Tier - Only for dual role or swine farmers
    if (showPremium) {
        plans.push({
            tier: TIER_PREMIUM,
            name: 'Premium',
            price: PREMIUM_PRICE,
            priceText: `₱${PREMIUM_PRICE}/mo`,
            features: [
                'Everything in Essential',
                'Unlimited Manong Bot',
                'Unlimited Camera AI',
                'Priority support',
                'Advanced analytics'
            ],
            icon: '⭐',
            badge: 'Most Popular',
            badgeColor: '#FF9800',
            isCurrentPlan: isPremium(),
            isUpgradeAvailable: !isPremium()
        });
    }
    
    // Set initial selected plan to current plan
    const currentPlan = plans.find(p => p.isCurrentPlan);
    if (currentPlan) {
        selectedPlanTier = currentPlan.tier;
    }
}

function renderPlanToggles() {
    planToggleButtons.innerHTML = '';
    
    plans.forEach(plan => {
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'plan-toggle-btn';
        
        if (selectedPlanTier === plan.tier) {
            toggleBtn.classList.add('active');
        }
        
        let badgeHtml = '';
        if (plan.badge) {
            badgeHtml = `<span class="toggle-badge">${plan.badge}</span>`;
        }
        
        const priceText = plan.price === 0 ? 'Free Forever' : `₱${plan.price}/month`;
        
        toggleBtn.innerHTML = `
            ${badgeHtml}
            <span class="toggle-icon">${plan.icon}</span>
            <span class="toggle-name">${plan.name}</span>
            <span class="toggle-price">${priceText}</span>
        `;
        
        toggleBtn.addEventListener('click', () => {
            selectPlan(plan.tier);
        });
        
        planToggleButtons.appendChild(toggleBtn);
    });
}

function renderSelectedPlanCard() {
    const plan = plans.find(p => p.tier === selectedPlanTier);
    if (!plan) return;
    
    plansGrid.innerHTML = '';
    const planCard = createPlanCard(plan);
    plansGrid.appendChild(planCard);
}

function renderPlansGrid() {
    // Deprecated - replaced by renderSelectedPlanCard and renderPlanToggles
    renderSelectedPlanCard();
}

function createPlanCard(plan) {
    const card = document.createElement('div');
    card.className = 'plan-card';
    
    if (plan.isCurrentPlan) {
        card.classList.add('current');
    }
    
    let badgeHtml = '';
    if (plan.badge) {
        badgeHtml = `<span class="plan-badge" style="background: ${plan.badgeColor}">${plan.badge}</span>`;
    }
    
    const priceHtml = plan.price === 0 
        ? `<div class="plan-pricing">
               <span class="price free">Free</span>
           </div>`
        : `<div class="plan-pricing">
               <span class="currency">₱</span>
               <span class="price">${plan.price}</span>
               <span class="period">/month</span>
           </div>`;
    
    const featuresHtml = plan.features.map(feature => 
        `<li>${feature}</li>`
    ).join('');
    
    const currentIndicatorHtml = plan.isCurrentPlan 
        ? '<div class="current-indicator show">✓ Your Current Plan</div>' 
        : '';
    
    const upgradeIndicatorHtml = plan.isUpgradeAvailable && !plan.isCurrentPlan
        ? '<div class="upgrade-indicator show">🚀 Upgrade Available</div>' 
        : '';
    
    card.innerHTML = `
        ${badgeHtml}
        <div class="plan-header">
            <div class="plan-icon">${plan.icon}</div>
            <h2 class="plan-name">${plan.name}</h2>
        </div>
        ${priceHtml}
        <ul class="plan-features">
            ${featuresHtml}
        </ul>
        ${currentIndicatorHtml}
        ${upgradeIndicatorHtml}
    `;
    
    return card;
}

function selectPlan(tier) {
    selectedPlanTier = tier;
    
    // Update toggle button selections
    const toggleBtns = planToggleButtons.querySelectorAll('.plan-toggle-btn');
    toggleBtns.forEach((btn, index) => {
        if (plans[index].tier === tier) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Re-render the selected plan card
    renderSelectedPlanCard();
    
    // Update action button
    updateActionButton();
}

function updateUsageSection() {
    // Always show usage section
    usageSection.style.display = 'block';
    
    // Get current usage values
    const manongUsed = currentUserData.weeklyManongBotPromptsUsed || 0;
    const cameraUsed = currentUserData.weeklyCameraAiUsed || 0;
    
    // Update Manong Bot usage
    if (isEssential() || isPremium()) {
        // Unlimited for Essential and Premium
        manongBotUsage.textContent = 'Unlimited';
        manongBotUsage.classList.add('unlimited');
        manongBotProgress.style.width = '100%';
    } else {
        // Free tier - show actual usage
        manongBotUsage.textContent = `${manongUsed}/${FREE_WEEKLY_MANONG_BOT_LIMIT}`;
        manongBotUsage.classList.remove('unlimited');
        const manongPercent = Math.min((manongUsed / FREE_WEEKLY_MANONG_BOT_LIMIT) * 100, 100);
        manongBotProgress.style.width = `${manongPercent}%`;
    }
    
    // Update Camera AI usage
    if (isPremium()) {
        // Unlimited for Premium only
        cameraAiUsage.textContent = 'Unlimited';
        cameraAiUsage.classList.add('unlimited');
        cameraAiProgress.style.width = '100%';
    } else {
        // Free and Essential - show actual usage
        cameraAiUsage.textContent = `${cameraUsed}/${FREE_WEEKLY_CAMERA_AI_LIMIT}`;
        cameraAiUsage.classList.remove('unlimited');
        const cameraPercent = Math.min((cameraUsed / FREE_WEEKLY_CAMERA_AI_LIMIT) * 100, 100);
        cameraAiProgress.style.width = `${cameraPercent}%`;
    }
    
    // Update reset timer
    if (isFree()) {
        weeklyReset.style.display = 'flex';
        weeklyReset.innerHTML = `
            <span>🔄</span>
            <span>${getWeeklyResetText()}</span>
        `;
    } else {
        // Show for paid users too if they have limits
        if (isEssential() || isPremium()) {
            weeklyReset.style.display = 'flex';
            weeklyReset.innerHTML = `
                <span>🔄</span>
                <span>${getWeeklyResetText()}</span>
            `;
        }
    }
}

function getWeeklyResetText() {
    const weekStart = getWeekStart();
    const nextWeek = new Date(weekStart);
    nextWeek.setDate(nextWeek.getDate() + 7);
    
    const now = Date.now();
    const diff = nextWeek.getTime() - now;
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Resets today';
    if (days === 1) return 'Resets tomorrow';
    return `Resets in ${days} days`;
}

function updateActionButton() {
    const plan = plans.find(p => p.tier === selectedPlanTier);
    if (!plan) return;
    
    if (plan.isCurrentPlan) {
        actionBtn.textContent = '✓ Current Plan';
        actionBtn.disabled = true;
        actionBtn.style.opacity = '0.5';
    } else if (isFree() && plan.tier !== TIER_FREE) {
        actionBtn.textContent = `Subscribe to ${plan.name} - ${plan.priceText}`;
        actionBtn.disabled = false;
        actionBtn.style.opacity = '1';
    } else if (isEssential() && plan.tier === TIER_PREMIUM) {
        actionBtn.textContent = `Upgrade to Premium - ₱${PREMIUM_PRICE}/mo`;
        actionBtn.disabled = false;
        actionBtn.style.opacity = '1';
    } else if (plan.tier === TIER_FREE && !isFree()) {
        actionBtn.textContent = 'Downgrade to Free';
        actionBtn.disabled = false;
        actionBtn.style.opacity = '1';
    } else {
        actionBtn.textContent = 'Not Available';
        actionBtn.disabled = true;
        actionBtn.style.opacity = '0.5';
    }
}

function showLimitMessage(limitType) {
    if (limitType === 'manong_bot') {
        limitTitle.innerHTML = `
            <span>⚠️</span>
            <span>Manong Bot Weekly Limit Reached</span>
        `;
        limitDescription.textContent = `You've used all ${FREE_WEEKLY_MANONG_BOT_LIMIT} Manong Bot questions for this week. Upgrade to Essential or Premium for unlimited access.`;
    } else if (limitType === 'camera_ai') {
        limitTitle.innerHTML = `
            <span>⚠️</span>
            <span>Camera AI Weekly Limit Reached</span>
        `;
        limitDescription.textContent = `You've used all ${FREE_WEEKLY_CAMERA_AI_LIMIT} Camera AI scans for this week. Upgrade to Premium for unlimited access.`;
    }
    limitMessage.classList.add('show');
    
    // Scroll to message
    limitMessage.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function hideLimitMessage() {
    limitMessage.classList.remove('show');
}

function setupEventListeners() {
    if (actionBtn) {
        actionBtn.addEventListener('click', handleSubscribe);
    }
    
    if (manageBtn) {
        manageBtn.addEventListener('click', handleManageSubscription);
    }
    
    if (contactBtn) {
        contactBtn.addEventListener('click', handleContactSupport);
    }
    
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
}

async function handleLogout() {
    showConfirmationModal(
        '🚪',
        'Log Out',
        '<p style="color: #666; line-height: 1.6;">Are you sure you want to log out of your account?</p>',
        [
            {
                text: 'Cancel',
                className: 'modal-btn modal-btn-secondary',
                onClick: () => hideConfirmationModal()
            },
            {
                text: 'Log Out',
                className: 'modal-btn modal-btn-danger',
                onClick: async () => {
                    hideConfirmationModal();
                    try {
                        await signOut(auth);
                        localStorage.removeItem('pigsoil_user');
                        window.location.href = '/login.html';
                    } catch (error) {
                        console.error('Error logging out:', error);
                        showAlert('Error logging out: ' + error.message, 'error');
                    }
                }
            }
        ]
    );
}

async function handleSubscribe() {
    const plan = plans.find(p => p.tier === selectedPlanTier);
    if (!plan || plan.isCurrentPlan) return;
    
    if (isLoading) return;
    
    // Build feature list HTML
    const featuresHtml = plan.features.map(f => `<li>${f}</li>`).join('');
    
    // Build modal content
    const modalContent = `
        <p style="color: #666; margin-bottom: 16px;">Review your subscription details below:</p>
        <div class="modal-details">
            <div class="modal-detail-row">
                <span class="modal-detail-label">Plan</span>
                <span class="modal-detail-value">${plan.name}</span>
            </div>
            <div class="modal-detail-row">
                <span class="modal-detail-label">Price</span>
                <span class="modal-detail-value">${plan.priceText}</span>
            </div>
            ${plan.price > 0 ? `
            <div class="modal-detail-row">
                <span class="modal-detail-label">Billing</span>
                <span class="modal-detail-value">Monthly</span>
            </div>` : ''}
        </div>
        <div style="margin: 16px 0;">
            <p style="font-weight: 600; color: #333; margin-bottom: 8px;">Included Features:</p>
            <ul class="modal-features">
                ${featuresHtml}
            </ul>
        </div>
        <p style="color: #666; font-size: 13px; margin-top: 16px;">
            ${plan.price > 0 ? 'You will be redirected to Xendit payment page to complete your subscription.' : 'Your account will be downgraded to the Free plan.'}
        </p>
    `;
    
    showConfirmationModal(
        '💳',
        'Confirm Subscription',
        modalContent,
        [
            {
                text: 'Cancel',
                className: 'modal-btn modal-btn-secondary',
                onClick: () => hideConfirmationModal()
            },
            {
                text: plan.price > 0 ? 'Proceed to Payment' : 'Confirm Downgrade',
                className: 'modal-btn modal-btn-primary',
                onClick: () => {
                    hideConfirmationModal();
                    startXenditPaymentFlow(plan.tier);
                }
            }
        ]
    );
}

async function startXenditPaymentFlow(targetTier) {
    if (!currentUser || !currentUserData) {
        showAlert('User data not available', 'error');
        return;
    }
    
    showLoading(true, 'Setting up payment...');
    
    try {
        // Step 1: Create or get Xendit customer
        console.log('[Subscription] Creating/getting Xendit customer...');
        const customer = await xenditService.createOrGetCustomer(currentUserData);
        
        if (!customer || !customer.id) {
            throw new Error('Failed to create Xendit customer');
        }
        
        console.log('[Subscription] Customer created:', customer.id);
        
        // Step 2: Create subscription plan
        console.log('[Subscription] Creating subscription plan...');
        const planResponse = await xenditService.createSubscriptionPlan(
            currentUser.uid,
            customer,
            targetTier
        );
        
        if (!planResponse || !planResponse.id) {
            throw new Error('Failed to create subscription plan');
        }
        
        console.log('[Subscription] Plan created:', planResponse.id);
        
        // Step 3: Get payment URL
        const paymentUrl = xenditService.getPaymentUrl(planResponse);
        
        if (!paymentUrl) {
            throw new Error('No payment URL returned from Xendit');
        }
        
        console.log('[Subscription] Payment URL:', paymentUrl);
        
        // Step 4: Cache subscription details
        xenditService.cacheSubscriptionDetails(
            currentUser.uid,
            planResponse.id,
            targetTier
        );
        
        // Step 5: Redirect to Xendit payment page
        showAlert('Redirecting to payment page...', 'success');
        
        setTimeout(() => {
            window.location.href = paymentUrl;
        }, 1000);
        
    } catch (error) {
        console.error('[Subscription] Payment flow error:', error);
        showAlert('Failed to start payment: ' + error.message, 'error');
        showLoading(false);
    }
}

function handleManageSubscription() {
    const currentPlan = getPlanName();
    const endDate = currentUserData.subscriptionEndDate 
        ? new Date(currentUserData.subscriptionEndDate).toLocaleDateString()
        : 'N/A';
    
    const modalContent = `
        <p style="color: #666; margin-bottom: 16px;">Are you sure you want to cancel your subscription?</p>
        <div class="modal-details">
            <div class="modal-detail-row">
                <span class="modal-detail-label">Current Plan</span>
                <span class="modal-detail-value">${currentPlan}</span>
            </div>
            <div class="modal-detail-row">
                <span class="modal-detail-label">Expires</span>
                <span class="modal-detail-value">${endDate}</span>
            </div>
        </div>
        <p style="color: #856404; background: #fff3cd; padding: 12px; border-radius: 8px; font-size: 14px; margin-top: 16px; line-height: 1.6;">
            ⚠️ Your subscription will remain active until ${endDate}, after which you will be downgraded to the Free plan.
        </p>
    `;
    
    showConfirmationModal(
        '⚠️',
        'Cancel Subscription',
        modalContent,
        [
            {
                text: 'Keep Subscription',
                className: 'modal-btn modal-btn-secondary',
                onClick: () => hideConfirmationModal()
            },
            {
                text: 'Yes, Cancel',
                className: 'modal-btn modal-btn-danger',
                onClick: () => {
                    hideConfirmationModal();
                    performCancellation();
                }
            }
        ]
    );
}

async function performCancellation() {
    if (!currentUser) return;
    
    showLoading(true, 'Cancelling subscription...');
    
    try {
        const userDocRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userDocRef, {
            subscriptionTier: TIER_FREE,
            subscriptionStartDate: null,
            subscriptionEndDate: null,
            autoRenew: false,
            xenditSubscriptionId: null,
            weeklyManongBotPromptsUsed: 0,
            weeklyCameraAiUsed: 0,
            userUpdatedAt: serverTimestamp()
        });
        
        showAlert('Subscription cancelled successfully. You have been downgraded to the Free plan.', 'success');
        
        // Reload data
        await loadUserSubscriptionData();
    } catch (error) {
        console.error('Error cancelling subscription:', error);
        showAlert('Failed to cancel subscription: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

function handleContactSupport() {
    const email = 'support@pigsoil.tech';
    const subject = 'Subscription Support - PigSoil+';
    const body = `Hi PigSoil+ Support,

I need assistance with my subscription.

User Details:
- User ID: ${currentUser?.uid}
- Current Plan: ${getPlanName()}
- User Type: ${currentUserData?.userType || 'N/A'}

My question/concern:
[Please describe your issue here]

Thank you!`;
    
    const mailtoLink = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    
    try {
        window.location.href = mailtoLink;
    } catch (error) {
        // Fallback: show email and copy to clipboard
        if (navigator.clipboard) {
            navigator.clipboard.writeText(email).then(() => {
                showAlert(`Support email copied to clipboard: ${email}`, 'success');
            }).catch(() => {
                showAlert(`Support email: ${email}`, 'warning');
            });
        } else {
            showAlert(`Contact us at: ${email}`, 'warning');
        }
    }
}

function showLoading(show, message = 'Processing...') {
    isLoading = show;
    if (show) {
        loadingOverlay.classList.add('show');
        const loadingText = loadingOverlay.querySelector('.loading-text');
        if (loadingText) loadingText.textContent = message;
    } else {
        loadingOverlay.classList.remove('show');
    }
}

function showAlert(message, type) {
    if (!alertMessage) return;
    
    const icons = {
        success: '✓',
        error: '✗',
        warning: '⚠️',
        info: 'ℹ️'
    };
    
    alertMessage.innerHTML = `
        <span style="font-size: 18px;">${icons[type] || icons.info}</span>
        <span>${message}</span>
    `;
    alertMessage.className = `alert ${type} show`;
    
    setTimeout(() => {
        alertMessage.classList.remove('show');
    }, 7000);
    
    alertMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function showConfirmationModal(icon, title, bodyHtml, actions) {
    modalIcon.textContent = icon;
    modalTitleText.textContent = title;
    modalBody.innerHTML = bodyHtml;
    
    // Build action buttons
    modalActions.innerHTML = '';
    actions.forEach(action => {
        const btn = document.createElement('button');
        btn.className = action.className;
        btn.textContent = action.text;
        btn.onclick = action.onClick;
        modalActions.appendChild(btn);
    });
    
    confirmationModal.classList.add('show');
}

function hideConfirmationModal() {
    confirmationModal.classList.remove('show');
}

// Export for debugging
window.PigSoilSubscription = {
    loadUserSubscriptionData,
    showAlert,
    showLimitMessage,
    currentUserData: () => currentUserData,
    plans: () => plans
};

console.log('Subscription Settings JS loaded!');