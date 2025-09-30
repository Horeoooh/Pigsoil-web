// PigSoil+ Batches Page JavaScript - Complete with Firebase Integration

import '../js/shared-user-manager.js';
import { db } from '../js/init.js';
import { COLLECTIONS } from '../js/firebase-collections.js';

// Import Firebase functions from CDN
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js';

document.addEventListener('DOMContentLoaded', function() {
    // Initialize the page
    initializePage();
});

async function initializePage() {
    // Add event listeners
    addEventListeners();
    
    // Load existing batches from Firebase
    await loadBatchesFromDatabase();
    
    // Initialize any dynamic content
    updateProgressBars();
    setDefaultDate();
    updateBatchStatistics();
    
    console.log('PigSoil+ Batches page initialized');
}

function addEventListeners() {
    // New Batch button and modal functionality
    const newBatchBtn = document.getElementById('startNewBatchBtn');
    const modal = document.getElementById('newCompostModal');
    const closeBtn = document.getElementById('closeModal');
    const form = document.getElementById('newCompostForm');

    if (newBatchBtn) {
        newBatchBtn.addEventListener('click', openNewBatchModal);
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', closeNewBatchModal);
    }

    if (modal) {
        modal.addEventListener('click', function(event) {
            if (event.target === modal) {
                closeNewBatchModal();
            }
        });
    }

    if (form) {
        form.addEventListener('submit', handleNewBatchSubmit);
    }

    // Navigation items
    const navItems = document.querySelectorAll('.nav-menu a');
    navItems.forEach(item => {
        item.addEventListener('click', handleNavigation);
    });

    // Icon buttons
    const notificationBtn = document.getElementById('notificationBtn');
    
    if (notificationBtn) {
        notificationBtn.addEventListener('click', handleNotificationClick);
    }

    // Form input interactions
    const formInputs = document.querySelectorAll('.form-input');
    formInputs.forEach(input => {
        input.addEventListener('focus', handleInputFocus);
        input.addEventListener('blur', handleInputBlur);
        input.addEventListener('input', handleInputChange);
    });

    // Compost type selection
    const compostOptions = document.querySelectorAll('.compost-option');
    compostOptions.forEach(option => {
        option.addEventListener('click', handleCompostTypeSelection);
    });

    // Real-time validation
    const compostNameInput = document.getElementById('compostName');
    const manureAmountInput = document.getElementById('manureAmount');
    const startDateInput = document.getElementById('startDate');

    if (compostNameInput) {
        compostNameInput.addEventListener('input', () => validateField('compostName'));
    }
    if (manureAmountInput) {
        manureAmountInput.addEventListener('input', () => validateField('manureAmount'));
    }
    if (startDateInput) {
        startDateInput.addEventListener('change', () => validateField('startDate'));
    }
}

// Firebase Database Functions with better error handling
async function loadBatchesFromDatabase() {
    console.log('Loading batches from database...');
    
    if (!db) {
        console.log('Firebase not available, loading from localStorage');
        loadBatchesFromLocalStorage();
        return;
    }

    try {
        const batchesRef = collection(db, COLLECTIONS.COMPOST_BATCHES);
        console.log('Attempting to query collection:', COLLECTIONS.COMPOST_BATCHES);
        
        // Try to get documents without ordering first (in case indexing isn't set up)
        const querySnapshot = await getDocs(batchesRef);
        
        const batchGrid = document.getElementById('batchGrid');
        batchGrid.innerHTML = ''; // Clear existing content
        
        if (querySnapshot.empty) {
            console.log('No batches found in Firebase, loading sample data');
            loadSampleBatches();
            return;
        }
        
        // Convert to array and sort manually if needed
        const batches = [];
        querySnapshot.forEach((doc) => {
            const batch = doc.data();
            batch.id = doc.id;
            batches.push(batch);
        });
        
        // Sort by createdAt (newest first)
        batches.sort((a, b) => {
            const dateA = a.createdAt ? (a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt)) : new Date();
            const dateB = b.createdAt ? (b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt)) : new Date();
            return dateB - dateA;
        });
        
        batches.forEach(batch => {
            addBatchToGrid(batch);
        });
        
        updateBatchStatistics();
        console.log(`✅ Loaded ${batches.length} batches from Firebase`);
        
    } catch (error) {
        console.error('❌ Error loading batches from Firebase:', error);
        
        if (error.code === 'permission-denied') {
            console.log('Firebase permissions issue. Please check Firestore security rules.');
            showErrorNotification('Database permissions error. Loading offline data instead.');
        } else if (error.code === 'failed-precondition') {
            console.log('Firebase index not ready. Using simple query.');
        }
        
        // Fallback to localStorage
        loadBatchesFromLocalStorage();
    }
}

async function saveBatchToDatabase(batchData) {
    console.log('Saving batch to database...');
    
    if (!db) {
        console.log('Firebase not available, saving to localStorage');
        return saveBatchToLocalStorage(batchData);
    }

    try {
        const batchesRef = collection(db, COLLECTIONS.COMPOST_BATCHES);
        
        // Prepare batch data for Firebase with proper timestamp handling
        const firebaseBatchData = {
            // Basic info
            name: batchData.name.trim(),
            amount: parseInt(batchData.amount),
            type: batchData.type,
            startDate: batchData.startDate,
            
            // Progress tracking
            duration: batchData.duration,
            currentDay: batchData.currentDay,
            progress: batchData.progress,
            status: batchData.status,
            
            // Composting method details
            compostMethod: batchData.type === 'basic' ? 'basic_swine_manure' : 'hot_composting',
            technique: batchData.type === 'basic' ? 'Basic Swine Manure Composting' : 'Hot Composting Method',
            
            // Farmer info (replace with actual user data when authentication is implemented)
            farmerId: 'current-user-id',
            farmerName: 'Juan Dela Cruz',
            
            // Timestamps
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };
        
        const docRef = await addDoc(batchesRef, firebaseBatchData);
        
        console.log('✅ Batch saved to Firebase:', docRef.id);
        return { ...batchData, id: docRef.id };
        
    } catch (error) {
        console.error('❌ Error saving batch to Firebase:', error);
        
        if (error.code === 'permission-denied') {
            showErrorNotification('Permission denied. Saving locally instead.');
        }
        
        // Fallback to localStorage
        return saveBatchToLocalStorage(batchData);
    }
}

async function updateBatchInDatabase(batchId, updates) {
    if (!db) {
        updateBatchInLocalStorage(batchId, updates);
        return;
    }

    try {
        const batchRef = doc(db, COLLECTIONS.COMPOST_BATCHES, batchId);
        await updateDoc(batchRef, {
            ...updates,
            updatedAt: serverTimestamp()
        });
        
        console.log('✅ Batch updated in Firebase:', batchId);
    } catch (error) {
        console.error('❌ Error updating batch in Firebase:', error);
        updateBatchInLocalStorage(batchId, updates);
    }
}

async function deleteBatchFromDatabase(batchId) {
    if (!db) {
        deleteBatchFromLocalStorage(batchId);
        return;
    }

    try {
        const batchRef = doc(db, COLLECTIONS.COMPOST_BATCHES, batchId);
        await deleteDoc(batchRef);
        
        console.log('✅ Batch deleted from Firebase:', batchId);
    } catch (error) {
        console.error('❌ Error deleting batch from Firebase:', error);
        deleteBatchFromLocalStorage(batchId);
    }
}

// LocalStorage Fallback Functions
function loadBatchesFromLocalStorage() {
    console.log('Loading batches from localStorage...');
    const savedBatches = localStorage.getItem('pigsoil_batches');
    if (savedBatches) {
        try {
            const batches = JSON.parse(savedBatches);
            const batchGrid = document.getElementById('batchGrid');
            batchGrid.innerHTML = '';
            
            batches.forEach(batch => {
                addBatchToGrid(batch);
            });
            
            updateBatchStatistics();
            console.log(`✅ Loaded ${batches.length} batches from localStorage`);
        } catch (error) {
            console.error('Error parsing saved batches:', error);
            loadSampleBatches();
        }
    } else {
        // Load default sample batches
        loadSampleBatches();
    }
}

function saveBatchToLocalStorage(batchData) {
    try {
        const savedBatches = localStorage.getItem('pigsoil_batches');
        const batches = savedBatches ? JSON.parse(savedBatches) : [];
        
        const newBatch = { 
            ...batchData, 
            id: Date.now().toString(),
            createdAt: new Date().toISOString()
        };
        batches.unshift(newBatch); // Add to beginning
        
        localStorage.setItem('pigsoil_batches', JSON.stringify(batches));
        console.log('✅ Batch saved to localStorage');
        return newBatch;
    } catch (error) {
        console.error('Error saving to localStorage:', error);
        return batchData;
    }
}

function updateBatchInLocalStorage(batchId, updates) {
    try {
        const savedBatches = localStorage.getItem('pigsoil_batches');
        if (savedBatches) {
            const batches = JSON.parse(savedBatches);
            const batchIndex = batches.findIndex(b => b.id === batchId);
            
            if (batchIndex !== -1) {
                batches[batchIndex] = { ...batches[batchIndex], ...updates, updatedAt: new Date().toISOString() };
                localStorage.setItem('pigsoil_batches', JSON.stringify(batches));
                console.log('✅ Batch updated in localStorage');
            }
        }
    } catch (error) {
        console.error('Error updating localStorage:', error);
    }
}

function deleteBatchFromLocalStorage(batchId) {
    try {
        const savedBatches = localStorage.getItem('pigsoil_batches');
        if (savedBatches) {
            const batches = JSON.parse(savedBatches);
            const filteredBatches = batches.filter(b => b.id !== batchId);
            localStorage.setItem('pigsoil_batches', JSON.stringify(filteredBatches));
            console.log('✅ Batch deleted from localStorage');
        }
    } catch (error) {
        console.error('Error deleting from localStorage:', error);
    }
}

function loadSampleBatches() {
    console.log('Loading sample batches...');
    const sampleBatches = [
        {
            id: 'sample1',
            name: 'Basic Compost A',
            type: 'basic',
            amount: 50,
            startDate: new Date('2025-05-01'),
            currentDay: 14,
            duration: 21,
            progress: 67,
            status: 'ongoing'
        },
        {
            id: 'sample2',
            name: 'Hot Compost A',
            type: 'hot',
            amount: 40,
            startDate: new Date('2025-05-05'),
            currentDay: 9,
            duration: 18,
            progress: 50,
            status: 'ongoing'
        },
        {
            id: 'sample3',
            name: 'Basic Compost B',
            type: 'basic',
            amount: 30,
            startDate: new Date('2025-05-08'),
            currentDay: 7,
            duration: 21,
            progress: 33,
            status: 'ongoing'
        },
        {
            id: 'sample4',
            name: 'Hot Compost B',
            type: 'hot',
            amount: 45,
            startDate: new Date('2025-05-09'),
            currentDay: 5,
            duration: 18,
            progress: 28,
            status: 'ongoing'
        }
    ];
    
    const batchGrid = document.getElementById('batchGrid');
    batchGrid.innerHTML = '';
    
    sampleBatches.forEach(batch => {
        addBatchToGrid(batch);
    });
    
    updateBatchStatistics();
    console.log('✅ Sample batches loaded');
}

// Modal Functions
function openNewBatchModal() {
    const modal = document.getElementById('newCompostModal');
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
    
    // Clear any previous form data and errors
    clearFormErrors();
    resetForm();
    setDefaultDate();
    
    // Animate modal in
    requestAnimationFrame(() => {
        modal.style.opacity = '1';
        const modalContent = modal.querySelector('.modal-content');
        modalContent.style.transform = 'scale(1)';
    });
}

function closeNewBatchModal() {
    const modal = document.getElementById('newCompostModal');
    const modalContent = modal.querySelector('.modal-content');
    
    // Animate modal out
    modal.style.opacity = '0';
    modalContent.style.transform = 'scale(0.9)';
    
    setTimeout(() => {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
        
        // Reset form and clear errors
        resetForm();
        clearFormErrors();
    }, 300);
}

function resetForm() {
    const form = document.getElementById('newCompostForm');
    if (form) {
        form.reset();
        
        // Clear radio button selections visually
        document.querySelectorAll('.compost-option').forEach(option => {
            option.classList.remove('selected');
        });
        
        // Reset input styles
        document.querySelectorAll('.form-input').forEach(input => {
            input.style.borderColor = '';
            input.style.boxShadow = '';
        });
    }
}

// Enhanced Form Handling with Better Validation
async function handleNewBatchSubmit(event) {
    event.preventDefault();
    console.log('Form submitted');
    
    const formData = new FormData(event.target);
    const batchData = {
        name: formData.get('compostName'),
        amount: formData.get('manureAmount'),
        type: formData.get('compostType'),
        startDate: formData.get('startDate')
    };

    // Comprehensive validation
    if (!validateBatchForm(batchData)) {
        console.log('Form validation failed');
        return;
    }

    // Show loading state
    const submitBtn = event.target.querySelector('.submit-btn');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = `
        <svg class="spinning" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
        </svg>
        Creating Batch...
    `;
    submitBtn.disabled = true;

    try {
        // Calculate batch properties
        const duration = batchData.type === 'basic' ? 21 : 18;
        const currentDay = 1;
        const progress = Math.round((currentDay / duration) * 100);
        
        const completeBatchData = {
            name: batchData.name.trim(),
            amount: parseInt(batchData.amount),
            type: batchData.type,
            startDate: new Date(batchData.startDate),
            duration: duration,
            currentDay: currentDay,
            progress: progress,
            status: 'ongoing'
        };

        console.log('Saving batch data:', completeBatchData);

        // Save to database
        const savedBatch = await saveBatchToDatabase(completeBatchData);
        
        // Add to UI
        addBatchToGrid(savedBatch);
        
        // Update statistics
        updateBatchStatistics();
        
        // Close modal
        closeNewBatchModal();
        
        // Show success message
        showSuccessNotification(`${completeBatchData.name} created successfully!`);
        
    } catch (error) {
        console.error('Error creating batch:', error);
        showErrorNotification('Failed to create batch. Please try again.');
    } finally {
        // Reset button state
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// Enhanced Validation Functions
function validateBatchForm(data) {
    console.log('Validating form data:', data);
    clearFormErrors();
    let isValid = true;

    // Validate compost name
    if (!data.name || typeof data.name !== 'string') {
        showFieldError('compostName', 'Compost name is required');
        isValid = false;
    } else if (data.name.trim().length < 3) {
        showFieldError('compostName', 'Compost name must be at least 3 characters long');
        isValid = false;
    } else if (data.name.trim().length > 50) {
        showFieldError('compostName', 'Compost name must be less than 50 characters');
        isValid = false;
    }

    // Validate amount
    const amount = parseInt(data.amount);
    if (!data.amount || isNaN(amount)) {
        showFieldError('manureAmount', 'Amount is required and must be a number');
        isValid = false;
    } else if (amount < 1) {
        showFieldError('manureAmount', 'Amount must be at least 1 kg');
        isValid = false;
    } else if (amount > 10000) {
        showFieldError('manureAmount', 'Amount cannot exceed 10,000 kg');
        isValid = false;
    }

    // Validate compost type
    if (!data.type || (data.type !== 'basic' && data.type !== 'hot')) {
        showFieldError('compostType', 'Please select a composting method');
        isValid = false;
    }

    // Validate start date
    if (!data.startDate) {
        showFieldError('startDate', 'Start date is required');
        isValid = false;
    } else {
        const selectedDate = new Date(data.startDate);
        const today = new Date();
        const maxDate = new Date();
        
        today.setHours(0, 0, 0, 0);
        maxDate.setMonth(maxDate.getMonth() + 3); // Max 3 months in future
        
        if (isNaN(selectedDate.getTime())) {
            showFieldError('startDate', 'Please enter a valid date');
            isValid = false;
        } else if (selectedDate < today) {
            showFieldError('startDate', 'Start date cannot be in the past');
            isValid = false;
        } else if (selectedDate > maxDate) {
            showFieldError('startDate', 'Start date cannot be more than 3 months in the future');
            isValid = false;
        }
    }

    console.log('Form validation result:', isValid);
    return isValid;
}

function validateField(fieldId) {
    const field = document.getElementById(fieldId);
    if (!field) return;

    const fieldGroup = field.closest('.form-group');
    const existingError = fieldGroup.querySelector('.field-error');
    
    let isValid = true;
    let errorMessage = '';

    switch (fieldId) {
        case 'compostName':
            const name = field.value.trim();
            if (!name) {
                errorMessage = 'Compost name is required';
                isValid = false;
            } else if (name.length < 3) {
                errorMessage = 'Must be at least 3 characters long';
                isValid = false;
            } else if (name.length > 50) {
                errorMessage = 'Must be less than 50 characters';
                isValid = false;
            }
            break;

        case 'manureAmount':
            const amount = parseInt(field.value);
            if (!field.value || isNaN(amount)) {
                errorMessage = 'Amount is required and must be a number';
                isValid = false;
            } else if (amount < 1) {
                errorMessage = 'Must be at least 1 kg';
                isValid = false;
            } else if (amount > 10000) {
                errorMessage = 'Cannot exceed 10,000 kg';
                isValid = false;
            }
            break;

        case 'startDate':
            if (!field.value) {
                errorMessage = 'Start date is required';
                isValid = false;
            } else {
                const selectedDate = new Date(field.value);
                const today = new Date();
                const maxDate = new Date();
                
                today.setHours(0, 0, 0, 0);
                maxDate.setMonth(maxDate.getMonth() + 3);
                
                if (selectedDate < today) {
                    errorMessage = 'Cannot be in the past';
                    isValid = false;
                } else if (selectedDate > maxDate) {
                    errorMessage = 'Cannot be more than 3 months in future';
                    isValid = false;
                }
            }
            break;
    }

    // Remove existing error
    if (existingError) {
        existingError.remove();
    }

    // Update field styling and add error if needed
    if (isValid) {
        field.style.borderColor = '#4CAF50';
        field.style.boxShadow = '0 0 0 2px rgba(76, 175, 80, 0.1)';
    } else {
        showFieldError(fieldId, errorMessage);
    }

    return isValid;
}

function showFieldError(fieldId, message) {
    const field = document.getElementById(fieldId);
    if (!field) return;
    
    const formGroup = field.closest('.form-group');
    
    // Remove existing error
    const existingError = formGroup.querySelector('.field-error');
    if (existingError) {
        existingError.remove();
    }

    // Add error message
    const errorElement = document.createElement('div');
    errorElement.className = 'field-error';
    errorElement.textContent = message;
    errorElement.style.cssText = `
        color: #e74c3c;
        font-size: 12px;
        margin-top: 4px;
        animation: fadeIn 0.3s ease;
    `;

    formGroup.appendChild(errorElement);
    
    // Highlight field with error styling
    field.style.borderColor = '#e74c3c';
    field.style.boxShadow = '0 0 0 2px rgba(231, 76, 60, 0.1)';
    
    // Focus the field if it's the first error
    if (!document.querySelector('.field-error:not(:last-child)')) {
        field.focus();
    }
}

function clearFormErrors() {
    const errors = document.querySelectorAll('.field-error');
    errors.forEach(error => error.remove());

    const inputs = document.querySelectorAll('.form-input');
    inputs.forEach(input => {
        input.style.borderColor = '';
        input.style.boxShadow = '';
    });
}

function addBatchToGrid(batch) {
    const batchGrid = document.getElementById('batchGrid');
    const batchCard = createBatchCardHTML(batch);
    batchGrid.insertAdjacentHTML('beforeend', batchCard);
    
    // Add event listeners to the new card
    const newCard = batchGrid.lastElementChild;
    addBatchCardListeners(newCard);
}

function createBatchCardHTML(batch) {
    const methodName = batch.type === 'basic' ? 'Basic Swine Manure Composting' : 'Hot Composting Method';
    const nextAction = getNextAction(batch.type, batch.currentDay);
    const formattedStartDate = formatDate(new Date(batch.startDate));
    
    return `
        <div class="batch-card" data-batch-id="${batch.id}">
            <div class="batch-header">
                <h3 class="batch-title">${batch.name}</h3>
                <div class="batch-actions">
                    <span class="status-badge ${batch.status === 'ready' ? 'ready-badge' : 'ongoing-badge'}">${batch.status === 'ready' ? 'Ready' : 'Ongoing'}</span>
                    <button class="action-btn edit-btn" title="Edit batch">
                        <img src="../images/edit.png" alt="Edit">
                    </button>
                    <button class="action-btn delete-btn" title="Delete batch">
                        <img src="../images/delete.png" alt="Delete">
                    </button>
                </div>
            </div>
            
            <p class="batch-description">${methodName}</p>
            
            <div class="progress-container">
                <div class="progress-header">
                    <span>Progress</span>
                    <span>Day ${batch.currentDay} of ${batch.duration}</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${batch.progress}%"></div>
                </div>
                <div class="progress-percentage">${batch.progress}% Complete</div>
            </div>
            
            <div class="batch-info">
                <div class="info-item">
                    <div class="info-label">
                        <span>📅</span>
                        <span>Started</span>
                    </div>
                    <div class="info-value">${formattedStartDate}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">
                        <span>⚖️</span>
                        <span>Amount</span>
                    </div>
                    <div class="info-value">${batch.amount}kg</div>
                </div>
            </div>
            
            <div class="next-action">
                <div class="next-action-header">
                    <span>⏰</span>
                    <span>Next Action</span>
                </div>
                <div class="next-action-text">
                    <span>${nextAction.action}</span>
                    <span class="due-label ${nextAction.urgency}">${nextAction.due}</span>
                </div>
            </div>
            
            <button class="update-btn">
                <span>✓</span>
                <span>Update Progress</span>
            </button>
        </div>
    `;
}

function getNextAction(type, currentDay) {
    if (type === 'basic') {
        if (currentDay <= 7) return { action: 'Turn compost pile', due: 'Due: Today', urgency: '' };
        if (currentDay <= 14) return { action: 'Add dry carbon materials', due: 'Due: Today', urgency: '' };
        if (currentDay <= 21) return { action: 'Final turn & screen compost', due: 'Due: 7 days', urgency: 'upcoming' };
        return { action: 'Harvest ready compost', due: 'Ready now', urgency: 'ready' };
    } else {
        if (currentDay <= 4) return { action: 'Turn pile daily', due: 'Due: Today', urgency: '' };
        if (currentDay <= 7) return { action: 'Temperature check', due: 'Due: Today', urgency: '' };
        if (currentDay <= 11) return { action: 'Turn and assess moisture', due: 'Due: 2 days', urgency: 'upcoming' };
        if (currentDay <= 18) return { action: 'Monitor cooling phase', due: 'Due: 1 day', urgency: 'upcoming' };
        return { action: 'Harvest ready compost', due: 'Ready now', urgency: 'ready' };
    }
}

function addBatchCardListeners(card) {
    const updateBtn = card.querySelector('.update-btn');
    const editBtn = card.querySelector('.edit-btn');
    const deleteBtn = card.querySelector('.delete-btn');

    if (updateBtn) updateBtn.addEventListener('click', handleUpdateProgress);
    if (editBtn) editBtn.addEventListener('click', handleEditBatch);
    if (deleteBtn) deleteBtn.addEventListener('click', handleDeleteBatch);
}

// Enhanced Form Input Interactions
function handleInputFocus(event) {
    const input = event.target;
    
    // Clear any existing errors when user starts typing
    const formGroup = input.closest('.form-group');
    const existingError = formGroup.querySelector('.field-error');
    if (existingError) {
        existingError.remove();
    }
    
    // Apply focus styling
    input.style.borderColor = '#4CAF50';
    input.style.boxShadow = '0 0 0 3px rgba(76, 175, 80, 0.1)';
}

function handleInputBlur(event) {
    const input = event.target;
    
    // Only reset styling if there's no error
    const formGroup = input.closest('.form-group');
    const hasError = formGroup.querySelector('.field-error');
    
    if (!hasError) {
        input.style.borderColor = '';
        input.style.boxShadow = '';
    }
}

function handleInputChange(event) {
    const input = event.target;
    const fieldId = input.id;
    
    // Debounce validation for better UX
    clearTimeout(input.validationTimeout);
    input.validationTimeout = setTimeout(() => {
        if (input.value.trim()) {
            validateField(fieldId);
        }
    }, 500);
}

function handleCompostTypeSelection(event) {
    const option = event.currentTarget;
    const radioInput = option.querySelector('.radio-input');
    
    // Clear any existing compost type errors
    const formGroup = option.closest('.form-group');
    const existingError = formGroup.querySelector('.field-error');
    if (existingError) {
        existingError.remove();
    }
    
    // Clear previous selections
    document.querySelectorAll('.compost-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    
    // Select current option
    option.classList.add('selected');
    radioInput.checked = true;
    
    // Add visual feedback
    option.style.transform = 'scale(0.98)';
    setTimeout(() => {
        option.style.transform = '';
    }, 150);
}

// Batch Management Functions
async function handleUpdateProgress(event) {
    const button = event.currentTarget;
    const batchCard = button.closest('.batch-card');
    const batchId = batchCard.dataset.batchId;
    const batchTitle = batchCard.querySelector('.batch-title').textContent;
    
    // Show loading state
    button.style.opacity = '0.7';
    button.style.pointerEvents = 'none';
    const originalText = button.innerHTML;
    button.innerHTML = '<span>Updating...</span>';
    
    try {
        // Get current batch data
        const currentDayElement = batchCard.querySelector('.progress-header span:last-child');
        const currentDayText = currentDayElement.textContent;
        const currentDay = parseInt(currentDayText.split(' ')[1]) + 1; // Increment day
        
        const durationText = currentDayText.split(' of ')[1];
        const duration = parseInt(durationText);
        
        const newProgress = Math.min(Math.round((currentDay / duration) * 100), 100);
        const newStatus = newProgress >= 100 ? 'ready' : 'ongoing';
        
        // Update progress in database
        await updateBatchInDatabase(batchId, {
            currentDay: currentDay,
            progress: newProgress,
            status: newStatus
        });
        
        showSuccessNotification(`Progress updated for ${batchTitle}!`);
        
        // Refresh the batch display
        await loadBatchesFromDatabase();
        
    } catch (error) {
        console.error('Error updating progress:', error);
        showErrorNotification('Failed to update progress. Please try again.');
    } finally {
        // Reset button state
        button.style.opacity = '1';
        button.style.pointerEvents = 'auto';
        button.innerHTML = originalText;
    }
}

async function handleEditBatch(event) {
    const batchCard = event.currentTarget.closest('.batch-card');
    const batchTitle = batchCard.querySelector('.batch-title').textContent;
    
    showInfoNotification(`Edit functionality for "${batchTitle}" would be implemented here`);
}

async function handleDeleteBatch(event) {
    const batchCard = event.currentTarget.closest('.batch-card');
    const batchId = batchCard.dataset.batchId;
    const batchTitle = batchCard.querySelector('.batch-title').textContent;
    
    // Enhanced confirmation dialog
    const confirmed = confirm(
        `Delete "${batchTitle}"?\n\n` +
        `This will permanently remove this compost batch and all its progress data.\n\n` +
        `This action cannot be undone. Are you sure you want to continue?`
    );
    
    if (confirmed) {
        try {
            // Animate removal
            batchCard.style.transform = 'scale(0.9)';
            batchCard.style.opacity = '0.5';
            batchCard.style.transition = 'all 0.5s ease';
            
            // Delete from database
            await deleteBatchFromDatabase(batchId);
            
            // Remove from UI after animation
            setTimeout(() => {
                batchCard.remove();
                updateBatchStatistics();
                showSuccessNotification(`${batchTitle} has been deleted`);
            }, 500);
            
        } catch (error) {
            console.error('Error deleting batch:', error);
            showErrorNotification('Failed to delete batch. Please try again.');
            
            // Reset animation on error
            batchCard.style.transform = '';
            batchCard.style.opacity = '';
            batchCard.style.transition = '';
        }
    }
}

function handleNavigation(event) {
    // Don't prevent default navigation for now
    const target = event.currentTarget.getAttribute('href');
    
    // Remove active class from all nav items
    document.querySelectorAll('.nav-menu a').forEach(link => {
        link.classList.remove('active');
    });
    
    // Add active class to clicked item
    event.currentTarget.classList.add('active');
}

function handleNotificationClick() {
    showInfoNotification('No new notifications');
}

// Utility Functions
function updateProgressBars() {
    const progressBars = document.querySelectorAll('.progress-fill');
    
    progressBars.forEach((bar, index) => {
        const targetWidth = bar.style.width;
        bar.style.width = '0%';
        
        setTimeout(() => {
            bar.style.transition = 'width 1s ease-in-out';
            bar.style.width = targetWidth;
        }, 300 + (index * 100));
    });
}

function setDefaultDate() {
    const dateInput = document.getElementById('startDate');
    if (dateInput) {
        const today = new Date();
        const todayString = today.toISOString().split('T')[0];
        dateInput.value = todayString;
        dateInput.min = todayString;
        
        // Set max date to 3 months in future
        const maxDate = new Date();
        maxDate.setMonth(maxDate.getMonth() + 3);
        dateInput.max = maxDate.toISOString().split('T')[0];
    }
}

function formatDate(date) {
    if (!date) return 'Invalid Date';
    
    try {
        // Handle different date formats
        const dateObj = date instanceof Date ? date : new Date(date);
        
        if (isNaN(dateObj.getTime())) {
            return 'Invalid Date';
        }
        
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        }).format(dateObj);
    } catch (error) {
        console.error('Error formatting date:', error);
        return 'Invalid Date';
    }
}

function updateBatchStatistics() {
    const batchCards = document.querySelectorAll('.batch-card');
    
    const activeBatches = Array.from(batchCards).filter(card => {
        const statusBadge = card.querySelector('.status-badge');
        return statusBadge && statusBadge.textContent.trim() === 'Ongoing';
    }).length;
    
    const readyBatches = Array.from(batchCards).filter(card => {
        const statusBadge = card.querySelector('.status-badge');
        return statusBadge && statusBadge.textContent.trim() === 'Ready';
    }).length;
    
    const totalBatches = batchCards.length;
    
    // Update statistics with error handling
    const activeCountElement = document.getElementById('activeBatchCount');
    const readyCountElement = document.getElementById('readyBatchCount');
    const totalCountElement = document.getElementById('totalBatchCount');
    
    if (activeCountElement) activeCountElement.textContent = activeBatches;
    if (readyCountElement) readyCountElement.textContent = readyBatches;
    if (totalCountElement) totalCountElement.textContent = totalBatches;
    
    console.log(`Statistics updated: Active: ${activeBatches}, Ready: ${readyBatches}, Total: ${totalBatches}`);
}

// Enhanced Notification Functions
function showSuccessNotification(message) {
    showNotification(message, 'success');
}

function showErrorNotification(message) {
    showNotification(message, 'error');
}

function showInfoNotification(message) {
    showNotification(message, 'info');
}

function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existing = document.querySelectorAll('.notification');
    existing.forEach(n => n.remove());

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    // Set background color based on type
    const colors = {
        success: '#4CAF50',
        error: '#e74c3c',
        info: '#3498db'
    };
    
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">${getNotificationIcon(type)}</span>
            <span class="notification-message">${message}</span>
            <button class="notification-close" aria-label="Close notification">×</button>
        </div>
    `;

    // Apply styles
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${colors[type]};
        color: white;
        padding: 16px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 10000;
        transform: translateX(400px);
        transition: transform 0.3s ease;
        max-width: 350px;
        font-family: 'Poppins', sans-serif;
        font-size: 14px;
        line-height: 1.4;
    `;

    document.body.appendChild(notification);

    // Animate in
    requestAnimationFrame(() => {
        notification.style.transform = 'translateX(0)';
    });

    // Add close functionality
    const closeBtn = notification.querySelector('.notification-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            notification.style.transform = 'translateX(400px)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        });
    }

    // Auto-hide after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.transform = 'translateX(400px)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }
    }, 5000);
}

function getNotificationIcon(type) {
    const icons = {
        success: '✓',
        error: '✗',
        info: 'ℹ'
    };
    return icons[type] || icons.info;
}

// Keyboard Accessibility
document.addEventListener('keydown', function(event) {
    // Close modal with Escape key
    if (event.key === 'Escape') {
        const modal = document.getElementById('newCompostModal');
        if (modal && modal.style.display === 'block') {
            closeNewBatchModal();
        }
    }
    
    // Close notifications with Escape key
    if (event.key === 'Escape') {
        const notifications = document.querySelectorAll('.notification');
        notifications.forEach(notification => {
            notification.style.transform = 'translateX(400px)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        });
    }
});

// Error Boundary for Unhandled Errors
window.addEventListener('error', function(event) {
    console.error('Unhandled error:', event.error);
    showErrorNotification('An unexpected error occurred. Please refresh the page and try again.');
});

window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
    showErrorNotification('A network error occurred. Please check your connection and try again.');
});

// Export functions for potential use in other modules
window.PigSoilBatches = {
    updateProgressBars,
    updateBatchStatistics,
    formatDate,
    openNewBatchModal,
    closeNewBatchModal,
    loadBatchesFromDatabase,
    showSuccessNotification,
    showErrorNotification,
    showInfoNotification
};

// Initialize page performance monitoring
if (window.performance && window.performance.mark) {
    window.performance.mark('pigsoil-batches-script-loaded');
}

console.log('✅ PigSoil+ Batches module loaded successfully');