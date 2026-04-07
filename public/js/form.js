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
    mco:                'long_text_mm1yxr45',
    storeAddress:       'text_mm0e9v1j',
    coopBoardMember:    'long_text_mm1ym5z5',
    adsAddress:         'text_mkzng7d9',
    mailboxColor:       'color_mkztj02s',
    manager:            'text_mm0e3nk4',
    timeSavingKiosk:    'color_mm0ee5w9',
    productsNotOffered: 'text_mm0exkpv',
    generalFocus:       'text_mm0e6sh4'
};

// ============================================
// AD Column mapping (Destination Board ID: 18396648497)
// Temporary IDs to be adjusted by user later
// ============================================
const adColumnMapping = {
    storeNumber:     'name', // Identification
    struggle:        'long_text_mm1mahw1',
    profitCenter:    'color_mm0emr3y',
    designReq:       'long_text_mm0826s6',
    budgetCheck:     'boolean_mkztx9ks',
    budgetValue:     'numeric_mkztgwh4',
    month:           'color_mkztmrwm',
    objective:       'color_mkztnkcm',
    radius:          'text_mkztjkth',
    notes:           'long_text_mm1mjnc0',
    adRef:           'board_relation_mm1rqd3x'
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
    // Step 4 (Ad Requests)
    adFormsSection:      document.getElementById('adFormsSection'),
    adFormsContainer:    document.getElementById('adFormsContainer'),
    adFormsCountLabel:   document.getElementById('adFormsCountLabel'),
    submitAdsBtn:        document.getElementById('submitAdsBtn'),
    backToOnboardingBtn: document.getElementById('backToOnboardingBtn'),
    adFormTemplate:      document.getElementById('adFormTemplate'),

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
    initAdFormsSection();
    loadAdReferences();
});
function initAdFormsSection() {
    if (el.submitAdsBtn) el.submitAdsBtn.addEventListener('click', submitAdRequests);
    if (el.backToOnboardingBtn) {
        el.backToOnboardingBtn.addEventListener('click', () => {
            el.adFormsSection.style.display = 'none';
            el.formsSection.style.display = 'block';
            el.formsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }
}

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
// Load Ad References for Step 4
// ============================================
async function loadAdReferences() {
    try {
        const response = await fetch('/api/monday/ad-references');
        const data = await response.json();
        
        if (data.success && data.references && data.references.length > 0) {
            // Find the select element in the template directly
            const adRefSelect = el.adFormTemplate.content.querySelector('select[name="adRef"]');
            if (adRefSelect) {
                // Keep only the first "Select reference" option
                while (adRefSelect.options.length > 1) {
                    adRefSelect.remove(1);
                }
                // Add the dynamic options (value is the item ID, text is the item Name)
                data.references.forEach(ref => {
                    const option = document.createElement('option');
                    option.value = ref.id;
                    option.textContent = ref.name;
                    adRefSelect.appendChild(option);
                });
            }
        }
    } catch (err) {
        console.error("Error loading ad references:", err);
    }
}

// ============================================
// Autocomplete logic for Store Input
// ============================================
let debounceTimeout = null;

function initSearchForm() {
    const searchInput = document.getElementById('searchInput');
    const storeInputSelect = document.getElementById('storeInput');
    const storeSelectWrapper = document.getElementById('storeSelectWrapper');

    if (!searchInput || !storeInputSelect) return;

    searchInput.addEventListener('input', (e) => {
        const queryStr = e.target.value.trim();
        
        if (queryStr.length >= 4) {
            clearTimeout(debounceTimeout);
            debounceTimeout = setTimeout(() => {
                fetchAutocompleteStores(queryStr);
            }, 500); // 500ms debounce
        } else {
            hideStorePreview();
            storeSelectWrapper.style.display = 'none';
        }
    });

    storeInputSelect.addEventListener('change', async (e) => {
        const storeValue = e.target.value.trim();
        if (storeValue) {
            await previewStore(storeValue);
        } else {
            hideStorePreview();
        }
    });
}

async function fetchAutocompleteStores(queryStr) {
    if (state.isSearching) return;
    showStatusMessage('Searching stores...', 'info');

    try {
        const response = await fetch(`/api/monday/autocomplete?query=${encodeURIComponent(queryStr)}`);
        const data = await response.json();
        
        const storeInputSelect = document.getElementById('storeInput');
        const storeSelectWrapper = document.getElementById('storeSelectWrapper');

        // Reset the select dropdown
        while (storeInputSelect.options.length > 1) {
            storeInputSelect.remove(1);
        }
        storeInputSelect.options[0].textContent = "Select a store";
        storeInputSelect.value = "";

        if (data.success && data.stores && data.stores.length > 0) {
            state.stores = data.stores; // Save to state so previewStore can find them
            data.stores.forEach(store => {
                const option = document.createElement('option');
                option.value = store.value;
                option.textContent = store.label;
                storeInputSelect.appendChild(option);
            });
            storeSelectWrapper.style.display = 'block';
            showStatusMessage(`${data.stores.length} store(s) found`, 'success');
        } else {
            storeSelectWrapper.style.display = 'none';
            showStatusMessage('No matching stores found.', 'error');
        }
    } catch (err) {
        showStatusMessage('Error fetching stores.', 'error');
    }
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
                    // Dropdown columns in Monday require { labels: ["VALUE"] } — note plural, and it's an array
                    fields[colId] = { labels: [val.toUpperCase()] };
                } else if (fieldName === 'mailboxColor' || fieldName === 'storeType') {
                    fields[colId] = { label: val };
                } else if (fieldName === 'timeSavingKiosk') {
                    fields[colId] = { index: parseInt(val) };
                } else if (fieldName === 'ownerMobile') {
                    let phoneVal = val;
                    if (phoneVal && !phoneVal.startsWith('+')) {
                        if (phoneVal.length === 11 && phoneVal.startsWith('1')) {
                            phoneVal = `+${phoneVal}`;
                        } else {
                            phoneVal = `+1${phoneVal}`;
                        }
                    }
                    fields[colId] = { phone: phoneVal, countryShortName: "US" }; // Phone columns expect object
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
            // Check if some stores had errors even though others succeeded
            const failedStores = (data.results || []).filter(r => !r.success);
            if (failedStores.length > 0) {
                const errorDetails = failedStores.map(r => 
                    `• ${r.storeName || r.itemId}: ${r.message || 'Unknown error'}`
                ).join('\n');
                alert(`⚠️ Some stores had errors and were NOT saved:\n\n${errorDetails}\n\nPlease review and correct the data for these stores.`);
            }

            // Build per-store results summary
            const details = (data.results || []).map(r => {
                const icon = r.success ? '✅' : '❌';
                return `<div class="success-detail-row ${r.success ? 'ok' : 'fail'}">${icon} <strong>${r.storeName || r.itemId}</strong>: ${r.success ? 'Saved successfully' : (r.message || 'Error saving')}</div>`;
            }).join('');

            if (el.successDetails && details) {
                el.successDetails.innerHTML = details;
            }

            // Transition to Step 4: Ad Requests
            setTimeout(() => {
                el.formsSection.style.display = 'none';
                renderAdForms();
                el.adFormsSection.style.display = 'block';
                el.adFormsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                showStatusMessage('Onboarding saved. Please fill out the Ad Requests.', 'success');
            }, 1000);
        } else {
            // ALL stores failed
            const errorDetails = (data.results || []).map(r => 
                `• ${r.storeName || r.itemId}: ${r.message || 'Unknown error'}`
            ).join('\n');
            const alertMsg = errorDetails 
                ? `❌ Error saving data. None of the stores were saved:\n\n${errorDetails}\n\nPlease review and correct the data.`
                : `❌ Error saving data: ${data.message || 'Unknown error'}\n\nPlease review and correct the data.`;
            alert(alertMsg);
            showStatusMessage(data.message || 'Error saving data. Please try again.', 'error');
        }
    } catch (err) {
        console.error('Error saving:', err);
        alert(`❌ Network or server error while saving:\n\n${err.message || 'Unknown error'}\n\nPlease check your connection and try again.`);
        showStatusMessage('Error saving data. Please try again.', 'error');
    } finally {
        state.isSaving = false;
        setButtonLoading(el.saveAllBtn, false);
    }
}

// ============================================
// Render one Ad form per selected store (Step 4)
// ============================================

// ============================================
// Month Validation (Business Rule)
// ============================================
function getMonthIndex(val) {
    const v = parseInt(val);
    if (isNaN(v)) return -1;
    // Monday status values: 0-4 (Jan-May) map to 0-4.
    if (v <= 4) return v;
    // Monday status values: 6-12 (Jun-Dec) map to 5-11.
    if (v >= 6) return v - 1;
    return -1;
}

function validateMonthSelection(select) {
    const errorDiv = select.parentElement.querySelector('.month-error-message');
    if (!select.value) {
        if (errorDiv) errorDiv.style.display = 'none';
        return;
    }

    const now = new Date();
    const curMonth = now.getMonth();
    const curDay = now.getDate();
    const selMonth = getMonthIndex(select.value);

    // Business rule: If past month OR (current month AND day > 10)
    let isInvalid = false;
    if (selMonth < curMonth) {
        isInvalid = true;
    } else if (selMonth === curMonth && curDay > 10) {
        isInvalid = true;
    }

    if (isInvalid) {
        alert("You will schedule ads for this same month.");
        if (errorDiv) errorDiv.style.display = 'block';
    } else {
        if (errorDiv) errorDiv.style.display = 'none';
    }
}

function renderAdForms() {
    el.adFormsContainer.innerHTML = '';
    const count = state.selectedStores.length;
    if (el.adFormsCountLabel) {
        el.adFormsCountLabel.textContent = `${count} store${count > 1 ? 's' : ''}`;
    }

    state.selectedStores.forEach(store => {
        const clone = el.adFormTemplate.content.cloneNode(true);
        const card = clone.querySelector('.store-ad-card');

        // Set store name in header
        const nameSpan = card.querySelector('.store-form-name');
        if (nameSpan) nameSpan.textContent = store.storeName;

        // Tag the card with relevant IDs
        card.dataset.itemId = store.itemId;
        card.dataset.storeNumber = store.storeNumber; 

        // Focus: prefill for Design Request
        const designReq = card.querySelector('[name="designReq"]');
        if (designReq) designReq.value = 'Focus: \nBenefits to include:';

        // Attach validation
        card.querySelectorAll('input, select, textarea').forEach(field => {
            if (field.hasAttribute('required')) {
                field.addEventListener('blur', () => validateField(field));
                field.addEventListener('input', () => {
                    if (field.classList.contains('error')) validateField(field);
                });
            }
            
            // Specific validation for month selection
            if (field.name === 'month') {
                field.addEventListener('change', () => validateMonthSelection(field));
            }
        });
        el.adFormsContainer.appendChild(clone);
    });
}


// ============================================
// Submit All Ad Requests
// ============================================
async function submitAdRequests() {
    if (state.isSaving) return;

    const tickbox = document.querySelector('input[name="tickbox"]');
    if (tickbox && !tickbox.checked) {
        showStatusMessage('No puede guardar sin confirmar la claridad de su paquete.', 'error');
        alert('No puede guardar. Debe confirmar que tiene claridad sobre lo que su paquete incluye.');
        return;
    }

    let isValid = true;
    const adsPayload = [];
    const adCards = el.adFormsContainer.querySelectorAll('.store-ad-card');

    adCards.forEach(card => {
        const itemId = card.dataset.itemId;
        const storeNumber = card.dataset.storeNumber;
        const storeName = card.querySelector('.store-form-name')?.textContent || 'Store';
        
        // Collect fields
        const fields = { storeNumber }; 
        
        // Loop through all ad inputs
        const inputs = card.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            const name = input.name;
            if (!name) return;

            let val = '';
            if (input.type === 'checkbox') {
                val = input.checked;
            } else {
                val = input.value.trim();
            }

            // All fields in Form 2 are mandatory per user request
            if (input.hasAttribute('required') && !val && input.type !== 'checkbox') {
                isValid = false;
                input.classList.add('error');
            }

            fields[name] = val;
        });

        adsPayload.push({ itemId, storeName, fields });
    });

    if (!isValid) {
        showStatusMessage('Please complete all required fields in all ad forms.', 'error');
        return;
    }

    state.isSaving = true;
    setButtonLoading(el.submitAdsBtn, true);

    try {
        const response = await fetch('/api/monday/save-ads', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ads: adsPayload })
        });

        const data = await response.json();

        if (data.success) {
            el.adFormsSection.style.display = 'none';
            el.successSection.style.display = 'block';
            if (el.successMessage) el.successMessage.textContent = 'Ad Requests submitted successfully!';
            
            const details = (data.results || []).map(r => {
                const icon = r.success ? '✅' : '❌';
                return `<div class="success-detail-row ${r.success ? 'ok' : 'fail'}">${icon} <strong>${r.storeName}</strong>: ${r.success ? 'Ad Request Created' : (r.message || 'Error')}</div>`;
            }).join('');
            
            if (el.successDetails) el.successDetails.innerHTML = details;
        } else {
            showStatusMessage(data.message || 'Error submitting ad requests.', 'error');
        }
    } catch (err) {
        console.error('Error submitting ads:', err);
        showStatusMessage('Network error. Please try again.', 'error');
    } finally {
        state.isSaving = false;
        setButtonLoading(el.submitAdsBtn, false);
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