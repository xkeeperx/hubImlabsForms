// ============================================
// Form JavaScript - Multi-Store Mode
// Monday.com Integration
// ============================================

// ============================================
// Column mapping: formFieldName → mondayColumnId
// ============================================
const columnMapping = {
    accountState:       'dropdown_mkzna8xm',
    storeOwner:         'text_mkzn3j45',
    ownerEmail:         'long_text_mkztccnb',
    storeType:          'color_mm1tkp4y',
    ownerMobile:        'phone_mm0e9qe0',
    accountManager:     'person',
    storeAddress:       'text_mm0e9v1j',
    coopBoardMember:    'color_mm1vhm22',
    adsAddress:         'text_mkzng7d9',
    mailboxColor:       'color_mkztj02s',
    manager:            'text_mm0e3nk4',
    timeSavingKiosk:    'color_mm0ee5w9',
    productsNotOffered: 'text_mm0exkpv',
    generalFocus:       'text_mm0e6sh4'
};

// Reverse map: mondayColumnId → formFieldName
const reverseColumnMapping = Object.fromEntries(
    Object.entries(columnMapping).map(([field, col]) => [col, field])
);

// US State codes for validation
const usStatesSet = new Set([
    'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
    'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
    'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
    'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
    'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'
]);

// ============================================
// State management
// ============================================
const state = {
    // Array of { itemId, storeName, storeNumber, storeStatus, fields: {} }
    selectedStores: [],
    // { itemId, storeName, storeNumber, storeStatus } of the store currently previewed
    pendingStore: null,
    isSearching: false,
    isSaving: false,
    stores: []  // full list loaded from API
};

// ============================================
// DOM element references
// ============================================
const el = {
    navbar:              document.getElementById('navbar'),
    hamburger:           document.getElementById('hamburger'),
    navLinks:            document.getElementById('navLinks'),
    searchForm:          document.getElementById('searchForm'),
    storeInput:          document.getElementById('storeInput'),
    statusMessage:       document.getElementById('statusMessage'),
    searchView:          document.getElementById('searchView'),
    selectionResult:     document.getElementById('selectionResult'),
    storeName:           document.getElementById('storeNameResult'),
    storeOwner:          document.getElementById('storeOwnerResult'),
    addStoreBtn:         document.getElementById('addStoreBtn'),
    cancelStoreBtn:      document.getElementById('cancelStoreBtn'),
    selectedStoresPanel: document.getElementById('selectedStoresPanel'),
    chipsContainer:      document.getElementById('chipsContainer'),
    storesCountBadge:    document.getElementById('storesCountBadge'),
    proceedToFormBtn:    document.getElementById('proceedToFormBtn'),
    formsSection:        document.getElementById('formsSection'),
    formsContainer:      document.getElementById('formsContainer'),
    formsCountLabel:     document.getElementById('formsCountLabel'),
    saveAllBtn:          document.getElementById('saveAllBtn'),
    backToSearchBtn:     document.getElementById('backToSearchBtn'),
    successSection:      document.getElementById('successSection'),
    successMessage:      document.getElementById('successMessage'),
    successDetails:      document.getElementById('successDetails'),
    formTemplate:        document.getElementById('formTemplate')
};

// ============================================
// Initialization
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initNavbar();
    initSearchForm();
    initStorePreview();
    initSelectedStoresPanel();
    initFormsSection();
    loadStores();
});

// ============================================
// Navbar
// ============================================
function initNavbar() {
    if (!el.hamburger || !el.navLinks) return;
    el.hamburger.addEventListener('click', () => {
        el.hamburger.classList.toggle('active');
        el.navLinks.classList.toggle('active');
    });
    el.navLinks.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            el.hamburger.classList.remove('active');
            el.navLinks.classList.remove('active');
        });
    });
}

// ============================================
// Load stores on page load
// ============================================
async function loadStores() {
    if (state.isSearching) return;
    state.isSearching = true;
    showStatusMessage('Loading stores...', 'info');

    try {
        const response = await fetch('/api/monday/stores');
        const data = await response.json();

        if (data.success && data.stores.length > 0) {
            state.stores = data.stores;

            // Clear existing options except first placeholder
            while (el.storeInput.options.length > 1) {
                el.storeInput.remove(1);
            }

            data.stores.forEach(store => {
                const option = document.createElement('option');
                option.value = store.value;
                option.dataset.id = store.id;
                option.textContent = store.label;
                el.storeInput.appendChild(option);
            });

            showStatusMessage(`${data.stores.length} stores available`, 'success');
        } else {
            showStatusMessage(data.message || 'No stores found with pending status.', 'error');
        }
    } catch (err) {
        showStatusMessage('Error loading stores. Please try again.', 'error');
    } finally {
        state.isSearching = false;
    }
}

// ============================================
// Search Form: select dropdown triggers preview
// ============================================
function initSearchForm() {
    if (!el.storeInput) return;

    el.storeInput.addEventListener('change', async (e) => {
        const storeValue = e.target.value.trim();
        if (storeValue) {
            await previewStore(storeValue);
        } else {
            hideStorePreview();
        }
    });
}

async function previewStore(storeValue) {
    if (state.isSearching) return;
    state.isSearching = true;
    showStatusMessage('Searching store...', 'info');

    try {
        let data;
        const foundLocal = state.stores.find(s => s.value === storeValue);

        if (foundLocal) {
            // Parse label: "123 - Store X (Pending Kick-Off)"
            const labelParts = foundLocal.label.split(' - ');
            const storeNum = labelParts[0];
            const nameAndStatus = labelParts.slice(1).join(' - ');
            const splitIdx = nameAndStatus.lastIndexOf(' (');
            const storeName = nameAndStatus.substring(0, splitIdx);
            const storeStatus = nameAndStatus.substring(splitIdx + 2, nameAndStatus.length - 1);
            data = {
                found: true,
                itemId: foundLocal.id,
                storeName,
                storeNumber: storeNum,
                storeStatus
            };
        } else {
            const apiRes = await fetch(`/api/monday/search?store=${encodeURIComponent(storeValue)}`);
            data = await apiRes.json();
        }

        if (data.found) {
            // Check if already added
            if (state.selectedStores.find(s => s.itemId === data.itemId)) {
                showStatusMessage('This store is already in your selection.', 'error');
                el.storeInput.value = '';
                return;
            }

            state.pendingStore = {
                itemId: data.itemId,
                storeName: data.storeName,
                storeNumber: data.storeNumber,
                storeStatus: data.storeStatus
            };

            if (el.storeName) el.storeName.textContent = data.storeName;
            if (el.storeOwner) el.storeOwner.textContent = 'Loading...';

            // Switch to result view
            el.searchView.style.display = 'none';
            el.selectionResult.style.display = 'block';
            el.statusMessage.style.display = 'none';

            // Fetch owner details in background
            fetchOwnerDetails(data.itemId);
        } else {
            showStatusMessage(data.message || 'Store not found or not in pending status.', 'error');
            el.selectionResult.style.display = 'none';
            el.searchView.style.display = 'block';
        }
    } catch (err) {
        showStatusMessage('Error searching for store. Please try again.', 'error');
    } finally {
        state.isSearching = false;
    }
}

function hideStorePreview() {
    state.pendingStore = null;
    el.selectionResult.style.display = 'none';
    el.searchView.style.display = 'block';
}

async function fetchOwnerDetails(itemId) {
    try {
        const res = await fetch(`/api/monday/item/${itemId}`);
        const data = await res.json();
        if (data.success && data.fields) {
            const ownerId = columnMapping.storeOwner;
            const ownerName = data.fields[ownerId] || 'Not specified';
            if (el.storeOwner) el.storeOwner.textContent = ownerName;
        } else {
            if (el.storeOwner) el.storeOwner.textContent = 'N/A';
        }
    } catch (err) {
        if (el.storeOwner) el.storeOwner.textContent = 'Error loading';
    }
}

// ============================================
// Store Preview Card: "Add this store" / Cancel
// ============================================
function initStorePreview() {
    el.addStoreBtn.addEventListener('click', async () => {
        if (!state.pendingStore) return;
        await addStoreToSelection(state.pendingStore);
    });

    el.cancelStoreBtn.addEventListener('click', () => {
        hideStorePreview();
        el.storeInput.value = '';
        el.statusMessage.style.display = 'none';
    });
}

async function addStoreToSelection(storeInfo) {
    // Show loading state on button
    el.addStoreBtn.disabled = true;
    el.addStoreBtn.textContent = 'Loading data...';

    try {
        // Fetch Monday data for this item to prefill the form
        const res = await fetch(`/api/monday/item/${storeInfo.itemId}`);
        const data = await res.json();
        console.log(res);
        const fields = data.success ? data.fields : {};

        state.selectedStores.push({
            itemId: storeInfo.itemId,
            storeName: storeInfo.storeName,
            storeNumber: storeInfo.storeNumber,
            storeStatus: storeInfo.storeStatus,
            fields
        });

        // Reset preview card
        hideStorePreview();
        el.storeInput.value = '';
        el.statusMessage.style.display = 'none';

        renderSelectedStoresPanel();
        showStatusMessage(`"${storeInfo.storeName}" added to selection.`, 'success');

    } catch (err) {
        showStatusMessage('Error fetching store data. Try again.', 'error');
    } finally {
        el.addStoreBtn.disabled = false;
        el.addStoreBtn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;margin-right:6px;">
                <circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/>
            </svg>
            Add this store`;
    }
}

// ============================================
// Selected Stores Panel: chips
// ============================================
function initSelectedStoresPanel() {
    el.proceedToFormBtn.addEventListener('click', proceedToForm);
}

function renderSelectedStoresPanel() {
    const count = state.selectedStores.length;

    if (count === 0) {
        el.selectedStoresPanel.style.display = 'none';
        return;
    }

    el.selectedStoresPanel.style.display = 'block';
    if (el.storesCountBadge) el.storesCountBadge.textContent = count;

    // Render chips
    el.chipsContainer.innerHTML = '';
    state.selectedStores.forEach(store => {
        const chip = document.createElement('div');
        chip.className = 'store-chip';
        chip.dataset.itemId = store.itemId;
        chip.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 20h16V8l-8-4-8 4v12z"/>
                <path d="M9 20v-8h6v8"/>
            </svg>
            <span class="store-chip-name">${store.storeName}</span>
            <span class="store-chip-number">${store.storeNumber}</span>
            <button class="store-chip-remove" aria-label="Remove ${store.storeName}" data-item-id="${store.itemId}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        `;
        el.chipsContainer.appendChild(chip);
    });

    // Remove buttons
    el.chipsContainer.querySelectorAll('.store-chip-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const itemId = btn.dataset.itemId;
            removeStore(itemId);
        });
    });
}

function removeStore(itemId) {
    state.selectedStores = state.selectedStores.filter(s => s.itemId !== itemId);
    renderSelectedStoresPanel();
    if (state.selectedStores.length === 0) {
        showStatusMessage('All stores removed. Please add a store to continue.', 'info');
    }
}

// ============================================
// Proceed to Form
// ============================================
function proceedToForm() {
    if (state.selectedStores.length === 0) return;

    // Hide search area and panel
    el.selectedStoresPanel.style.display = 'none';
    el.selectionResult.style.display = 'none';
    el.searchView.style.display = 'none';
    document.getElementById('searchSection').style.display = 'none';

    renderForms();
    el.formsSection.style.display = 'block';
    el.formsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ============================================
// Render one form per selected store
// ============================================
function renderForms() {
    el.formsContainer.innerHTML = '';
    const count = state.selectedStores.length;
    if (el.formsCountLabel) {
        el.formsCountLabel.textContent = `${count} store${count > 1 ? 's' : ''}`;
    }

    state.selectedStores.forEach(store => {
        const clone = el.formTemplate.content.cloneNode(true);
        const card = clone.querySelector('.store-form-card');

        // Set store name in header
        const nameSpan = card.querySelector('.store-form-name');
        if (nameSpan) nameSpan.textContent = store.storeName;

        // Tag the card with the itemId
        card.dataset.itemId = store.itemId;

        // Prefill fields from store.fields (Monday data)
        Object.entries(columnMapping).forEach(([fieldName, colId]) => {
            const value = store.fields[colId] || '';
            const input = card.querySelector(`[name="${fieldName}"]`);
            if (!input || !value) return;

            if (input.tagName === 'SELECT') {
                // Try to find matching option (case-insensitive)
                const option = Array.from(input.options).find(
                    o => o.value.toLowerCase() === value.toLowerCase() ||
                         o.textContent.toLowerCase() === value.toLowerCase()
                );
                if (option) input.value = option.value;
            } else if (input.tagName === 'SPAN' || input.tagName === 'DIV' || input.tagName === 'P') {
                input.textContent = value;
            } else {
                input.value = value;
            }
        });

        // Attach field validation
        card.querySelectorAll('[required]').forEach(field => {
            field.addEventListener('blur', () => validateField(field));
            field.addEventListener('input', () => {
                if (field.classList.contains('error')) validateField(field);
            });
        });

        const accountStateInput = card.querySelector('[name="accountState"]');
        if (accountStateInput) {
            accountStateInput.addEventListener('blur', () => validateAccountState(accountStateInput));
        }

        el.formsContainer.appendChild(clone);
    });
}

// ============================================
// Forms Section: Save All + Back
// ============================================
function initFormsSection() {
    el.saveAllBtn.addEventListener('click', submitAll);
    el.backToSearchBtn.addEventListener('click', backToSearch);
}

function backToSearch() {
    el.formsSection.style.display = 'none';
    el.formsContainer.innerHTML = '';
    document.getElementById('searchSection').style.display = 'block';
    renderSelectedStoresPanel();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function submitAll() {
    if (state.isSaving) return;

    // Validate all forms
    let isValid = true;
    const storesPayload = [];

    const formCards = el.formsContainer.querySelectorAll('.store-form-card');

    formCards.forEach(card => {
        const itemId = card.dataset.itemId;

        // Validate required fields
        card.querySelectorAll('[required]').forEach(field => {
            if (!validateField(field)) isValid = false;
        });

        // Validate account state specifically
        const accountStateInput = card.querySelector('[name="accountState"]');
        if (accountStateInput && !validateAccountState(accountStateInput)) {
            isValid = false;
        }

        // Collect form fields and map to Monday column IDs
        const fields = {};
        Object.entries(columnMapping).forEach(([fieldName, colId]) => {
            if (fieldName === 'storeAddress') return; // Informative only, do not send back to Monday
            
            const input = card.querySelector(`[name="${fieldName}"]`);
            if (input && input.value && input.value.trim()) {
                const val = input.value.trim();
                if (fieldName === 'accountState') {
                    fields[colId] = { label: val.toUpperCase() };
                } else if (fieldName === 'mailboxColor' || fieldName === 'storeType' || fieldName === 'coopBoardMember') {
                    fields[colId] = { label: val };
                } else if (fieldName === 'timeSavingKiosk') {
                    fields[colId] = { index: parseInt(val) };
                } else if (fieldName === 'ownerMobile') {
                    fields[colId] = { phone: val, countryShortName: "US" }; // Phone columns expect object
                } else {
                    fields[colId] = val; // Text, person (via parsing usually), etc.
                }
            }
        });

        storesPayload.push({ itemId, fields });
    });

    if (!isValid) {
        showStatusMessage('Please complete all required fields correctly in all forms.', 'error');
        return;
    }

    state.isSaving = true;
    setButtonLoading(el.saveAllBtn, true);

    try {
        const response = await fetch('/api/monday/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stores: storesPayload })
        });

        const data = await response.json();

        if (data.success || (data.results && data.results.some(r => r.success))) {
            // Build per-store results summary
            const details = (data.results || []).map(r => {
                const icon = r.success ? '✅' : '❌';
                return `<div class="success-detail-row ${r.success ? 'ok' : 'fail'}">${icon} <strong>${r.storeName || r.itemId}</strong>: ${r.success ? 'Saved successfully' : (r.message || 'Error saving')}</div>`;
            }).join('');

            el.formsSection.style.display = 'none';
            el.successSection.style.display = 'block';
            if (el.successMessage) {
                el.successMessage.textContent = data.message || 'Store data saved successfully.';
            }
            if (el.successDetails && details) {
                el.successDetails.innerHTML = details;
            }
        } else {
            showStatusMessage(data.message || 'Error saving data. Please try again.', 'error');
        }
    } catch (err) {
        console.error('Error saving:', err);
        showStatusMessage('Error saving data. Please try again.', 'error');
    } finally {
        state.isSaving = false;
        setButtonLoading(el.saveAllBtn, false);
    }
}

// ============================================
// Validation helpers
// ============================================
function validateField(field) {
    const value = field.value.trim();
    field.classList.remove('error', 'success');

    if (field.hasAttribute('required') && !value) {
        field.classList.add('error');
        return false;
    }

    if (field.type === 'email' && value) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            field.classList.add('error');
            return false;
        }
    }

    field.classList.add('success');
    return true;
}

function validateAccountState(field) {
    const value = field.value.trim().toUpperCase();
    field.classList.remove('error', 'success');

    if (field.hasAttribute('required') && !value) {
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

// ============================================
// UI Helpers
// ============================================
function showStatusMessage(message, type = 'info') {
    if (!el.statusMessage) return;
    el.statusMessage.className = 'status-message';
    el.statusMessage.classList.add(type);
    el.statusMessage.style.display = 'block';
    const text = el.statusMessage.querySelector('.status-text');
    if (text) text.textContent = message;

    if (type === 'success') {
        setTimeout(() => { el.statusMessage.style.display = 'none'; }, 5000);
    }
}

function setButtonLoading(button, isLoading) {
    if (!button) return;
    const btnText = button.querySelector('.btn-text');
    const btnLoader = button.querySelector('.btn-loader');
    button.disabled = isLoading;
    if (btnText) btnText.style.display = isLoading ? 'none' : 'flex';
    if (btnLoader) btnLoader.style.display = isLoading ? 'block' : 'none';
}