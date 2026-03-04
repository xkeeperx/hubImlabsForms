// ============================================
// Form JavaScript - Monday.com Integration
// ============================================

// State management
const state = {
    selectedStore: null,
    isSearching: false,
    isSaving: false
};

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
        const response = await fetch(`/api/monday/search?store=${encodeURIComponent(storeNumber)}`);
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
        console.error('Error searching store:', error);
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
    
    // Email validation
    const emailField = document.getElementById('email');
    if (emailField) {
        emailField.addEventListener('blur', () => validateEmail(emailField));
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

function validateEmail(field) {
    const value = field.value.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    field.classList.remove('error', 'success');
    
    if (value && !emailRegex.test(value)) {
        field.classList.add('error');
        return false;
    }
    
    if (value) {
        field.classList.add('success');
    }
    
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
    const columnMapping = {
        firstName: 'texto',           // Replace with actual column ID
        lastName: 'texto2',           // Replace with actual column ID
        email: 'email',               // Replace with actual column ID
        phone: 'telefono',            // Replace with actual column ID
        position: 'estado1',          // Replace with actual column ID
        storeAddress: 'texto4',       // Replace with actual column ID
        city: 'texto5',               // Replace with actual column ID
        region: 'texto6',             // Replace with actual column ID
        openDate: 'fecha',            // Replace with actual column ID
        teamSize: 'estado2',          // Replace with actual column ID
        comments: 'texto_largo'       // Replace with actual column ID
    };
    
    // Build fields object with Monday.com column IDs
    for (const [fieldName, columnId] of Object.entries(columnMapping)) {
        const value = formData.get(fieldName);
        if (value) {
            fields[columnId] = value;
        }
    }
    
    try {
        const response = await fetch('/api/monday/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                itemId: state.selectedStore.itemId,
                fields: fields
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Show success message
            elements.mainFormSection.style.display = 'none';
            elements.activeStore.style.display = 'none';
            elements.successSection.style.display = 'block';
        } else {
            showStatusMessage(data.message || 'Error saving data. Please try again.', 'error');
        }
    } catch (error) {
        console.error('Error submitting form:', error);
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
