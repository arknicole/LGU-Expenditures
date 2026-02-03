let fromPPAs = [], toPPAs = [], ppas = [];
let allCategoriesCache = [], fromCategoriesCache = [], toCategoriesCache = [];

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Select2 (Searchable Dropdowns)
    $(document).ready(function() {
        const dropdowns = [
            '#ppa_select', '#sub_ppa_select', '#sub_sub_ppa_select',
            '#from_ppa_select', '#from_sub_ppa_select', '#from_sub_sub_ppa_select',
            '#to_ppa_select', '#to_sub_ppa_select', '#to_sub_sub_ppa_select'
        ];
        
        // Init Select2
        $(dropdowns.join(',')).select2({ width: '100%' });

        // --- SAFE EVENT LISTENERS (Prevents Infinite Loops) ---
        // Instead of triggering 'change', we directly call the populate functions
        
        // Simple Allotment Chain
        $('#ppa_select').on('change', function() { populateSubPpa('ppa_select', 'sub_ppa_select', allCategoriesCache); });
        $('#sub_ppa_select').on('change', function() { populateSubSubPpa('ppa_select', 'sub_ppa_select', 'sub_sub_ppa_select', allCategoriesCache); });
        
        // From Chain
        $('#from_ppa_select').on('change', function() { populateSubPpa('from_ppa_select', 'from_sub_ppa_select', fromCategoriesCache, true); });
        $('#from_sub_ppa_select').on('change', function() { populateSubSubPpa('from_ppa_select', 'from_sub_ppa_select', 'from_sub_sub_ppa_select', fromCategoriesCache, true); });
        $('#from_sub_sub_ppa_select').on('change', function() { showExistingAmount(); });

        // To Chain
        $('#to_ppa_select').on('change', function() { populateSubPpa('to_ppa_select', 'to_sub_ppa_select', toCategoriesCache); });
        $('#to_sub_ppa_select').on('change', function() { populateSubSubPpa('to_ppa_select', 'to_sub_ppa_select', 'to_sub_sub_ppa_select', toCategoriesCache); });
    });

    // 2. Attach Standard Listeners
    document.getElementById('type').addEventListener('change', toggleSections);
    document.getElementById('year').addEventListener('change', handleYearOrOfficeChange);
    document.getElementById('submitAllotmentButton').addEventListener('click', submitAllotment);

    // Filters
    document.getElementById('sector').addEventListener('change', () => loadOffices('sector', 'office_id'));
    document.getElementById('office_id').addEventListener('change', handleYearOrOfficeChange);
    document.getElementById('object').addEventListener('change', () => loadAndPopulateCategories('object', allCategoriesCache));
    document.getElementById('addPpaButton').addEventListener('click', addPPA);

    // FROM Filters
    document.getElementById('from_sector').addEventListener('change', () => loadOffices('from_sector', 'from_office_id'));
    document.getElementById('from_office_id').addEventListener('change', handleYearOrOfficeChange);
    document.getElementById('from_object').addEventListener('change', () => loadAndPopulateCategories('from_object', fromCategoriesCache, true));
    document.getElementById('addFromPpaButton').addEventListener('click', addFromPPA);

    // TO Filters
    document.getElementById('to_sector').addEventListener('change', () => loadOffices('to_sector', 'to_office_id'));
    document.getElementById('to_office_id').addEventListener('change', handleYearOrOfficeChange);
    document.getElementById('to_object').addEventListener('change', () => loadAndPopulateCategories('to_object', toCategoriesCache));
    document.getElementById('addToPpaButton').addEventListener('click', addToPPA);
    
    // Dynamic List Remove Buttons
    document.getElementById('ppas_list').addEventListener('click', (e) => handleListClick(e, 'ppas_list'));
    document.getElementById('from_list').addEventListener('click', (e) => handleListClick(e, 'from_list'));
    document.getElementById('to_list').addEventListener('click', (e) => handleListClick(e, 'to_list'));

    // Initial load
    ['sector', 'from_sector', 'to_sector'].forEach(id => populateSectorDropdown(id));
    loadRecentTable();
});

// --- CORE LOGIC ---

function handleYearOrOfficeChange() { 
    const type = document.getElementById('type').value;
    if (type === 'Realignment') showExistingAmount(); 
}

function toggleSections() { 
    const type = document.getElementById('type').value;
    document.getElementById('allotment_section').style.display = (type === 'Allotment' || type === 'Supplemental') ? 'block' : 'none';
    document.getElementById('realignment_section').style.display = (type === 'Realignment') ? 'flex' : 'none';
    const descSection = document.getElementById('desc_section');
    if(descSection) descSection.style.display = (type === 'Supplemental' || type === 'Realignment') ? 'block' : 'none';
    
    ppas = []; fromPPAs = []; toPPAs = [];
    renderList('ppas_list', ppas); renderList('from_list', fromPPAs); renderList('to_list', toPPAs);
    updateRealignmentTotals();
}

// --- DATA FETCHING ---

async function loadOffices(sectorElementId, officeElementId) { 
    const sector = document.getElementById(sectorElementId).value;
    const officeSelect = document.getElementById(officeElementId);
    officeSelect.innerHTML = '<option value="">Loading...</option>';
    try {
        const res = await fetch(`/api/office/list?sector=${encodeURIComponent(sector)}`);
        const data = await res.json();
        officeSelect.innerHTML = '<option value="">-- Select Office --</option>';
        if (data.success && Array.isArray(data.offices)) {
            data.offices.forEach(o => officeSelect.add(new Option(o.office_name, o.id)));
        }
        handleYearOrOfficeChange();
    } catch (error) { console.error('Failed to load offices:', error); }
}

function populateSectorDropdown(elementId) { 
    const select = document.getElementById(elementId);
    if (!select) return;
    select.innerHTML = `<option value="">-- Select Sector --</option><option value="GENERAL PUBLIC SERVICES">GENERAL PUBLIC SERVICES</option><option value="SOCIAL SERVICES AND PUBLIC WELFARE">SOCIAL SERVICES AND PUBLIC WELFARE</option><option value="ECONOMIC SERVICES">ECONOMIC SERVICES</option><option value="SPECIAL EDUCATION FUND">SPECIAL EDUCATION FUND</option>`;
}

async function loadAndPopulateCategories(objectId, targetCache, shouldShowExisting = false) {
    const object = document.getElementById(objectId).value;
    targetCache.length = 0;
    const ppaSelectId = objectId.replace('object', 'ppa_select');
    populatePpa(ppaSelectId, targetCache); // Clear first

    if (!object) return;

    try {
        const res = await fetch(`/api/category/list?object=${encodeURIComponent(object)}`);
        const data = await res.json();
        if (data.success && Array.isArray(data.categories)) {
            targetCache.push(...data.categories);
        }
        populatePpa(ppaSelectId, targetCache);
        if (shouldShowExisting) showExistingAmount();
    } catch (error) { console.error("Failed to load categories:", error); }
}

function populatePpa(ppaSelectId, sourceCache) {
    const ppaSelect = document.getElementById(ppaSelectId);
    const ppas = [...new Set(sourceCache.map(c => c.ppa))]; 
    populateDropdown(ppaSelect, ppas, 'Select PPA');
    // Trigger change safely for Select2
    $(ppaSelect).trigger('change.select2'); 
}

function populateSubPpa(ppaSelectId, subPpaSelectId, sourceCache, shouldShowExisting = false) {
    const selectedPpa = $(`#${ppaSelectId}`).val();
    const subPpaSelect = document.getElementById(subPpaSelectId);
    
    if (!selectedPpa) {
        populateDropdown(subPpaSelect, [], '---');
    } else {
        const subPpas = [...new Set(sourceCache.filter(c => c.ppa === selectedPpa && c.sub_ppa).map(c => c.sub_ppa))];
        populateDropdown(subPpaSelect, subPpas, 'Select Sub-PPA');
    }
    // Trigger change safely
    $(subPpaSelect).trigger('change.select2');
}

function populateSubSubPpa(ppaSelectId, subPpaSelectId, subSubPpaSelectId, sourceCache, shouldShowExisting = false) {
    const selectedPpa = $(`#${ppaSelectId}`).val();
    const selectedSubPpa = $(`#${subPpaSelectId}`).val();
    const subSubPpaSelect = document.getElementById(subSubPpaSelectId);
    
    if (!selectedPpa || !selectedSubPpa) {
        populateDropdown(subSubPpaSelect, [], '---');
    } else {
        const subSubPpas = [...new Set(sourceCache.filter(c => c.ppa === selectedPpa && c.sub_ppa === selectedSubPpa && c.sub_sub_ppa).map(c => c.sub_sub_ppa))];
        populateDropdown(subSubPpaSelect, subSubPpas, 'Select Sub-Sub-PPA');
    }
    
    // Final Trigger (Important for 'showExistingAmount')
    $(subSubPpaSelect).trigger('change.select2'); 
    
    if (shouldShowExisting) showExistingAmount();
}

function populateDropdown(selectElement, items, defaultOption) {
    selectElement.innerHTML = `<option value="">-- ${defaultOption} --</option>`;
    items.forEach(item => selectElement.add(new Option(item, item)));
}

// --- ITEM MANAGEMENT & VALIDATION ---

function getSelectedCategory(ppaId, subPpaId, subSubPpaId, sourceCache) {
    const ppa = $(`#${ppaId}`).val();
    const subPpa = $(`#${subPpaId}`).val() || null;
    const subSubPpa = $(`#${subSubPpaId}`).val() || null;
    return sourceCache.find(c => c.ppa === ppa && c.sub_ppa === subPpa && c.sub_sub_ppa === subSubPpa);
}

function addPPA() {
    const selectedCategory = getSelectedCategory('ppa_select', 'sub_ppa_select', 'sub_sub_ppa_select', allCategoriesCache);
    const amountInput = document.getElementById('ppa_amount');
    const amount = parseFloat(amountInput.value);
    
    if (!selectedCategory || !selectedCategory.id) return alert('Please select a complete PPA.');
    if (isNaN(amount) || amount <= 0) return alert('Invalid amount.');
    
    addToList(ppas, {
        category_id: selectedCategory.id,
        name: formatCategoryName(selectedCategory),
        amount: amount
    });
    renderList('ppas_list', ppas);
    amountInput.value = '';
}

// --- NEW: VALIDATED SOURCE ADDITION ---
function addFromPPA() {
    const selectedCategory = getSelectedCategory('from_ppa_select', 'from_sub_ppa_select', 'from_sub_sub_ppa_select', fromCategoriesCache);
    const amountInput = document.getElementById('from_amount');
    const officeSelect = document.getElementById('from_office_id');
    const amount = parseFloat(amountInput.value);

    // 1. Basic Checks
    if (!selectedCategory || !selectedCategory.id) return alert('Select complete PPA.');
    if (isNaN(amount) || amount <= 0) return alert('Invalid amount.');

    // 2. CHECK BALANCE (The Deduction Logic)
    const existingAmountText = document.getElementById('existing_amount').innerText.replace(/,/g, '');
    const currentDbBalance = parseFloat(existingAmountText) || 0;

    // Check if we already have this PPA in the pending list (subtract that too!)
    const pendingAmount = fromPPAs
        .filter(p => p.category_id === selectedCategory.id && p.office_id === parseInt(officeSelect.value))
        .reduce((sum, p) => sum + p.amount, 0);

    const actualAvailable = currentDbBalance - pendingAmount;

    // 3. Block if insufficient
    if (amount > actualAvailable) {
        alert(`Insufficient Balance! You only have ${formatCurrency(actualAvailable)} available for this PPA.`);
        return; 
    }

    addToList(fromPPAs, {
        office_id: parseInt(officeSelect.value),
        office_name: officeSelect.options[officeSelect.selectedIndex].text,
        category_id: selectedCategory.id,
        category_name: formatCategoryName(selectedCategory),
        amount: amount
    });
    renderList('from_list', fromPPAs);
    updateRealignmentTotals();
    amountInput.value = '';
}

function addToPPA() {
    const selectedCategory = getSelectedCategory('to_ppa_select', 'to_sub_ppa_select', 'to_sub_sub_ppa_select', toCategoriesCache);
    const amountInput = document.getElementById('to_amount');
    const officeSelect = document.getElementById('to_office_id');
    const amount = parseFloat(amountInput.value);

    if (!selectedCategory || !selectedCategory.id) return alert('Select complete PPA.');
    if (isNaN(amount) || amount <= 0) return alert('Invalid amount.');

    addToList(toPPAs, {
        office_id: parseInt(officeSelect.value),
        office_name: officeSelect.options[officeSelect.selectedIndex].text,
        category_id: selectedCategory.id,
        category_name: formatCategoryName(selectedCategory),
        amount: amount
    });
    renderList('to_list', toPPAs);
    updateRealignmentTotals();
    amountInput.value = '';
}

function formatCategoryName(c) {
    return `${c.ppa} ${c.sub_ppa ? '> '+c.sub_ppa : ''} ${c.sub_sub_ppa ? '> '+c.sub_sub_ppa : ''}`;
}

function addToList(list, item) { list.push(item); }

function renderList(divId, list) { 
    const div = document.getElementById(divId);
    div.innerHTML = list.map((p, i) => `
        <div style="margin-bottom:5px; padding:5px; border-bottom:1px solid #eee; display:flex; justify-content:space-between;">
            <span>${p.office_name ? p.office_name + ' | ' : ''}${p.name || p.category_name}: <b>${formatCurrency(p.amount)}</b></span>
            <button data-index="${i}" style="color:red; background:none; border:none; cursor:pointer;">[Remove]</button>
        </div>`
    ).join('');
}

function handleListClick(event, listId) {
    if (event.target.tagName !== 'BUTTON') return;
    const index = parseInt(event.target.dataset.index);
    if (event.target.textContent === '[Remove]') {
        const list = getListByDiv(listId);
        list.splice(index, 1);
        renderList(listId, list);
        if (listId !== 'ppas_list') updateRealignmentTotals();
    }
}

function getListByDiv(divId) { 
    if (divId === 'ppas_list') return ppas;
    if (divId === 'from_list') return fromPPAs;
    if (divId === 'to_list') return toPPAs;
    return [];
}

function updateRealignmentTotals() { 
    const totalFrom = fromPPAs.reduce((sum, p) => sum + p.amount, 0);
    const totalTo = toPPAs.reduce((sum, p) => sum + p.amount, 0);
    document.getElementById('total_from_amount').innerText = formatCurrency(totalFrom);
    document.getElementById('total_to_amount').innerText = formatCurrency(totalTo);
}

async function showExistingAmount() {
    const selectedCategory = getSelectedCategory('from_ppa_select', 'from_sub_ppa_select', 'from_sub_sub_ppa_select', fromCategoriesCache);
    const officeId = document.getElementById('from_office_id').value;
    const year = document.getElementById('year').value;
    const el = document.getElementById('existing_amount');
    
    if (!selectedCategory || !selectedCategory.id || !officeId || !year) {
        if(el) el.innerText = '0.00';
        return;
    }

    try {
        // This queries the DB for the true balance (Allotments - RealignmentsOut + RealignmentsIn)
        const res = await fetch(`/api/allotment/existing-amount?category_id=${selectedCategory.id}&office_id=${officeId}&year=${year}`);
        const data = await res.json();
        if(el) el.innerText = data.success ? formatCurrency(data.amount || 0) : '0.00';
    } catch (error) { console.error(error); }
}

async function submitAllotment() { 
    const type = document.getElementById('type').value;
    const year = parseInt(document.getElementById('year').value);
    const description = document.getElementById('description').value;   
    
    if (!type || !year) return alert('Please complete Type and Year.');
    
    let body = { type, year, description };
    
    if (type === 'Allotment' || type === 'Supplemental') {
        const office_id = parseInt(document.getElementById('office_id').value);
        if (!office_id) return alert('Please select an office.');
        if (ppas.length === 0) return alert('Please add at least one PPA.');
        body.office_id = office_id;
        body.ppas = ppas.map(p => ({ category_id: p.category_id, amount: p.amount }));
    } else if (type === 'Realignment') {
        if (fromPPAs.length === 0 || toPPAs.length === 0) return alert('Please add at least one FROM and one TO PPA.');
        const totalFrom = fromPPAs.reduce((sum, p) => sum + p.amount, 0);
        const totalTo = toPPAs.reduce((sum, p) => sum + p.amount, 0);
        if (Math.abs(totalFrom - totalTo) > 0.001) return alert('Total FROM amount must equal Total TO amount.');
        
        body.from_items = fromPPAs.map(p => ({ office_id: p.office_id, category_id: p.category_id, amount: p.amount }));
        body.to_items = toPPAs.map(p => ({ office_id: p.office_id, category_id: p.category_id, amount: p.amount }));
    }

    try {
        const res = await fetch('/api/allotment/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        const data = await res.json();
        alert(data.message);
        if (data.success) {
            document.getElementById('type').value = '';
            toggleSections();
            loadRecentTable(); // Refresh table
        }
    } catch (error) { 
        console.error(error); 
        alert('An error occurred.'); 
    }
}

function formatCurrency(val) {
    return parseFloat(val || 0).toLocaleString('en-PH', {minimumFractionDigits: 2});
}

// --- TABLE FUNCTIONS ---

async function loadRecentTable() {
    try {
        const res = await fetch('/api/allotment/list?limit=50'); 
        const data = await res.json();
        const tbody = document.getElementById('recentTableBody');
        tbody.innerHTML = '';

        if (data.success && data.allotments) {
            data.allotments.forEach(row => {
                const safeItem = JSON.stringify({id: row.detail_id, amount: row.amount}).replace(/'/g, "&#39;");
                
                // Show Source as negative
                let displayAmount = row.amount;
                if(row.is_from === 1) displayAmount = -row.amount;

                tbody.innerHTML += `
                    <tr>
                        <td>${row.year}</td>
                        <td>${row.type}</td>
                        <td>${row.office_name}</td>
                        <td><small>${row.ppa} ${row.sub_ppa ? '> '+row.sub_ppa : ''}</small></td>
                        <td style="text-align:right;">${parseFloat(displayAmount).toLocaleString('en-PH', {minimumFractionDigits:2})}</td>
                        <td style="text-align:center;">
                            <button onclick='openEditModal(${safeItem})' style="background:#ffc107; border:none; cursor:pointer; padding:3px 6px; border-radius:3px;"><i class="fas fa-edit"></i></button>
                            <button onclick="deleteItem(${row.detail_id})" style="background:#dc3545; color:white; border:none; cursor:pointer; padding:3px 6px; border-radius:3px; margin-left:5px;"><i class="fas fa-trash"></i></button>
                        </td>
                    </tr>
                `;
            });
        }
    } catch (e) { console.error(e); }
}

function openEditModal(item) {
    document.getElementById('edit_id').value = item.id;
    document.getElementById('edit_amount').value = item.amount;
    document.getElementById('editModal').style.display = 'block';
}

async function saveEdit() {
    const id = document.getElementById('edit_id').value;
    const amount = document.getElementById('edit_amount').value;
    try {
        const res = await fetch('/api/allotment/update', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ id, amount })
        });
        const data = await res.json();
        if(data.success) {
            alert('Updated!');
            document.getElementById('editModal').style.display = 'none';
            loadRecentTable();
        } else alert(data.message);
    } catch(e) { alert('Error updating.'); }
}

async function deleteItem(id) {
    if(!confirm("Delete this entry?")) return;
    try {
        const res = await fetch('/api/allotment/delete', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ id })
        });
        const data = await res.json();
        if(data.success) loadRecentTable();
        else alert(data.message);
    } catch(e) { alert('Error deleting.'); }
}