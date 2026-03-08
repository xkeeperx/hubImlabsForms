// ============================================
// Form JavaScript - Monday.com Integration
// ============================================

// State management
const state = {
    selectedStore: null,
    isSearching: false,
    isSaving: false
};

// US State codes (2-letter codes)
const usStates = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

// Create a Set for faster lookup
const usStatesSet = new Set(usStates);

// DOM Elements
const elements = {
    // Navbar
    navbar: document.getElementById('navbar'),
    hamburger: document.getElementById('hamburger'),
    navLinks: document.getElementById('navLinks'),
    
    // Search section
    searchForm: document.getElementById('searchForm'),
    storeInput: document.getElementById('storeInput'),
    searchBtn: document.getElementById('searchBtn'),
    statusMessage: document.getElementById('statusMessage'),
    
    // Store selection
    storeSelection: document.getElementById('storeSelection'),
    storeName: document.getElementById('storeName'),
    storeNumber: document.getElementById('storeNumber'),
    selectStoreBtn: document.getElementById('selectStoreBtn'),
    cancelStoreBtn: document.getElementById('cancelStoreBtn'),
    
    // Active store indicator
    activeStore: document.getElementById('activeStore'),
    activeStoreName: document.getElementById('activeStoreName'),
    activeStoreNumber: document.getElementById('activeStoreNumber'),
    changeStoreBtn: document.getElementById('changeStoreBtn'),
    
    // Main form
    mainFormSection: document.getElementById('mainFormSection'),
    mainForm: document.getElementById('mainForm'),
    submitBtn: document.getElementById('submitBtn'),
    
    // Success section
    successSection: document.getElementById('successSection')
};

// ============================================
// Initialization
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initNavbar();
    initSearchForm();
    initStoreSelection();
    initActiveStore();
    initMainForm();
});

// ============================================
// Navbar Functionality
// ============================================
function initNavbar() {
    if (!elements.hamburger || !elements.navLinks) return;
    
    elements.hamburger.addEventListener('click', () => {
        elements.hamburger.classList.toggle('active');
        elements.navLinks.classList.toggle('active');
    });

    // Close mobile menu when clicking a link
    const navLinksItems = elements.navLinks.querySelectorAll('.nav-link');
    navLinksItems.forEach(link => {
        link.addEventListener('click', () => {
            elements.hamburger.classList.remove('active');
            elements.navLinks.classList.remove('active');
        });
    });
}

// ============================================
// Search Form Functionality
// ============================================
function initSearchForm() {
    if (!elements.searchForm) return;
    
    elements.searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const storeNumber = elements.storeInput.value.trim();
        
        if (!storeNumber) {
            showStatusMessage('Please enter a store number', 'error');
            return;
        }
        
        await searchStore(storeNumber);
    });
}

async function searchStore(storeNumber) {
    if (state.isSearching) return;
    
    state.isSearching = true;
    setButtonLoading(elements.searchBtn, true);
    showStatusMessage('Searching store...', 'info');
    
    try {
        const apiUrl = `/api/monday/search?store=${encodeURIComponent(storeNumber)}`;
        const response = await fetch(apiUrl);
        const data = await response.json();
        
        if (data.found) {
            // Store found and is pending
            state.selectedStore = {
                itemId: data.itemId,
                storeName: data.storeName,
                storeNumber: data.storeNumber
            };
            
            // Update store selection card
            elements.storeName.textContent = data.storeName;
            elements.storeNumber.textContent = data.storeNumber;
            
            // Show store selection card
            elements.storeSelection.style.display = 'block';
            elements.statusMessage.style.display = 'none';
            
            // Hide main form if visible
            elements.mainFormSection.style.display = 'none';
            elements.successSection.style.display = 'none';
        } else {
            // Store not found or not pending
            showStatusMessage(data.message || 'Store not found or not in pending status.', 'error');
            elements.storeSelection.style.display = 'none';
        }
    } catch (error) {
        showStatusMessage('Error searching for store. Please try again.', 'error');
    } finally {
        state.isSearching = false;
        setButtonLoading(elements.searchBtn, false);
    }
}

// ============================================
// Store Selection Functionality
// ============================================
function initStoreSelection() {
    if (!elements.selectStoreBtn || !elements.cancelStoreBtn) return;
    
    elements.selectStoreBtn.addEventListener('click', () => {
        if (state.selectedStore) {
            selectStore();
        }
    });
    
    elements.cancelStoreBtn.addEventListener('click', () => {
        cancelStoreSelection();
    });
}

function selectStore() {
    if (!state.selectedStore) return;
    
    // Update active store indicator
    elements.activeStoreName.textContent = state.selectedStore.storeName;
    elements.activeStoreNumber.textContent = `#${state.selectedStore.storeNumber}`;
    
    // Show active store indicator and main form
    elements.activeStore.style.display = 'block';
    elements.mainFormSection.style.display = 'block';
    
    // Hide store selection card
    elements.storeSelection.style.display = 'none';
    
    // Scroll to form
    elements.mainFormSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function cancelStoreSelection() {
    state.selectedStore = null;
    elements.storeSelection.style.display = 'none';
    elements.activeStore.style.display = 'none';
    elements.mainFormSection.style.display = 'none';
    elements.successSection.style.display = 'none';
    elements.storeInput.value = '';
    elements.storeInput.focus();
}

// ============================================
// Active Store Functionality
// ============================================
function initActiveStore() {
    if (!elements.changeStoreBtn) return;
    
    elements.changeStoreBtn.addEventListener('click', () => {
        cancelStoreSelection();
    });
}

// ============================================
// Main Form Functionality
// ============================================
function initMainForm() {
    if (!elements.mainForm) return;
    
    // Form validation
    const requiredFields = elements.mainForm.querySelectorAll('[required]');
    requiredFields.forEach(field => {
        field.addEventListener('blur', () => validateField(field));
        field.addEventListener('input', () => {
            if (field.classList.contains('error')) {
                validateField(field);
            }
        });
    });
       
    // Account State validation
    const accountStateField = document.getElementById('accountState');
    if (accountStateField) {
        accountStateField.addEventListener('blur', () => validateAccountState(accountStateField));
        accountStateField.addEventListener('input', () => {
            if (accountStateField.classList.contains('error')) {
                validateAccountState(accountStateField);
            }
        });
    }
    
    // Form submission
    elements.mainForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Validate all required fields
        let isValid = true;
        requiredFields.forEach(field => {
            if (!validateField(field)) {
                isValid = false;
            }
        });
        
        if (!isValid) {
            showStatusMessage('Please complete all required fields correctly.', 'error');
            return;
        }
        
        await submitForm();
    });
}

function validateField(field) {
    const value = field.value.trim();
    const isRequired = field.hasAttribute('required');
    
    field.classList.remove('error', 'success');
    
    if (isRequired && !value) {
        field.classList.add('error');
        return false;
    }
    
    // Email validation
    if (field.type === 'email' && value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
            field.classList.add('error');
            return false;
        }
    }
    
    // Phone validation (basic)
    if (field.type === 'tel' && value) {
        const phoneRegex = /^[\d\s\+\-\(\)]+$/;
        if (!phoneRegex.test(value)) {
            field.classList.add('error');
            return false;
        }
    }
    
    field.classList.add('success');
    return true;
}

function validateAccountState(field) {
    const value = field.value.trim().toUpperCase();
    const isRequired = field.hasAttribute('required');
    
    field.classList.remove('error', 'success');
    
    if (isRequired && !value) {
        field.classList.add('error');
        return false;
    }
    
    if (value && !usStatesSet.has(value)) {
        field.classList.add('error');
        return false;
    }
    
    field.classList.add('success');
    return true;
}

async function submitForm() {
    if (state.isSaving || !state.selectedStore) return;
    
    state.isSaving = true;
    setButtonLoading(elements.submitBtn, true);
    
    // Collect form data
    const formData = new FormData(elements.mainForm);
    const fields = {};
    
    // Map form fields to Monday.com column IDs
    // NOTE: You need to update these column IDs to match your Monday.com board
    // IMPORTANT: Column IDs in Monday.com CANNOT contain hyphens or dots
    const columnMapping = {
        accountState: 'dropdown_mkzna8xm',              // Replace with actual column ID
        storeOwner: 'text_mkzn3j45',               // Replace with actual column ID
        adsAddress: 'text_mkzng7d9',             // Replace with actual column ID
        mailboxColor: 'color_mkztj02s',             // Replace with actual column ID
        manager: 'text_mm0e3nk4',                 // Replace with actual column ID
        timeSavingKiosk: 'color_mm0ee5w9',         // Replace with actual column ID
        productsNotOffered: 'text_mm0exkpv',   // Replace with actual column ID
        generalFocus: 'text_mm0e6sh4'
    };
    
    // Build fields object with Monday.com column IDs
    for (const [fieldName, columnId] of Object.entries(columnMapping)) {
        const value = formData.get(fieldName);
        if (value) {
            fields[columnId] = value;
        } else {
            console.log(`⚠️  Campo vacío o no encontrado: ${fieldName}`);
        }
    }
        
    try {
        const savePayload = {
            itemId: state.selectedStore.itemId,
            fields: fields
        };
                
        const response = await fetch('/api/monday/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(savePayload)
        }); 
        const data = await response.json();
                
        if (data.success) {
            // Show success message
            elements.mainFormSection.style.display = 'none';
            elements.activeStore.style.display = 'none';
            elements.successSection.style.display = 'block';
        } else {
            console.log('❌ ERROR en respuesta del servidor:', data);
            showStatusMessage(data.message || 'Error saving data. Please try again.', 'error');
        }
    } catch (error) {
        console.error('❌ ERROR al guardar:', error);
        showStatusMessage('Error saving data. Please try again.', 'error');
    } finally {
        state.isSaving = false;
        setButtonLoading(elements.submitBtn, false);
    }
}

// ============================================
// UI Helper Functions
// ============================================
function showStatusMessage(message, type = 'info') {
    if (!elements.statusMessage) return;
    
    elements.statusMessage.className = 'status-message';
    elements.statusMessage.classList.add(type);
    elements.statusMessage.style.display = 'block';
    
    const statusText = elements.statusMessage.querySelector('.status-text');
    if (statusText) {
        statusText.textContent = message;
    }
    
    // Auto-hide success messages
    if (type === 'success') {
        setTimeout(() => {
            elements.statusMessage.style.display = 'none';
        }, 5000);
    }
}

function setButtonLoading(button, isLoading) {
    if (!button) return;
    
    const btnText = button.querySelector('.btn-text');
    const btnLoader = button.querySelector('.btn-loader');
    
    if (isLoading) {
        button.disabled = true;
        if (btnText) btnText.style.display = 'none';
        if (btnLoader) btnLoader.style.display = 'block';
    } else {
        button.disabled = false;
        if (btnText) btnText.style.display = 'block';
        if (btnLoader) btnLoader.style.display = 'none';
    }
}

// ============================================
// Utility Functions
// ============================================
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}