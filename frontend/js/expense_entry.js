let voucherItems = [];
let categoryCache = []; // Store categories to make Select2 fast

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Select2
    $(document).ready(function() {
        $('#sector, #office_id').select2({ width: '100%' });
        $('#object').select2({ width: '100%' });
        $('#ppa_select, #sub_ppa_select, #sub_sub_ppa_select').select2({ width: '100%' });

        // --- SAFE SELECT2 EVENTS ---
        $('#sector').on('change', handleSectorChange);
        
        // When Object changes, load categories
        $('#object').on('change', function() { loadCategories($(this).val()); });

        // Cascading PPA Logic
        $('#ppa_select').on('change', function() { populateSubPpa(); });
        $('#sub_ppa_select').on('change', function() { populateSubSubPpa(); });
        
        // When lowest level changes, check balance
        $('#ppa_select, #sub_ppa_select, #sub_sub_ppa_select').on('change', checkAvailableBalance);
    });

    // 2. Setup Standard Listeners
    populateSectors();
    
    document.getElementById('addItemButton').addEventListener('click', addItemToVoucher);
    document.getElementById('submitVoucherButton').addEventListener('click', submitVoucher);

    // 3. Auto-Calculate Net Amount
    const deductionInputs = document.querySelectorAll('.deductions-grid input');
    deductionInputs.forEach(input => {
        input.addEventListener('input', calculateNet);
    });
    document.getElementById('gross').addEventListener('input', calculateNet);
});

// --- SECTOR & OFFICE LOGIC ---

async function populateSectors() {
    const sectorSelect = document.getElementById('sector');
    try {
        const res = await fetch('/api/office/sectors');
        const data = await res.json();
        
        sectorSelect.innerHTML = '<option value="">-- Select Sector --</option>';
        if (data.success) {
            data.sectors.forEach(sector => {
                sectorSelect.add(new Option(sector, sector));
            });
        }
    } catch (error) { console.error('Error loading sectors:', error); }
}

async function handleSectorChange() {
    // Use jQuery val() for Select2 compatibility
    const sector = $('#sector').val();
    const officeSelect = document.getElementById('office_id');
    
    officeSelect.innerHTML = '<option value="">Loading...</option>';

    try {
        const res = await fetch(`/api/office/list?sector=${encodeURIComponent(sector)}`);
        const data = await res.json();
        
        officeSelect.innerHTML = '<option value="">-- Select Office --</option>';
        if (data.success) {
            data.offices.forEach(office => {
                officeSelect.add(new Option(office.office_name, office.id));
            });
        }
    } catch (error) {
        console.error('Error loading offices:', error);
        officeSelect.innerHTML = '<option>Error loading</option>';
    }
}

// --- PPA & CATEGORY LOGIC (Select2 Powered) ---

async function loadCategories(objectType) {
    categoryCache = []; // Clear cache
    const ppaSelect = document.getElementById('ppa_select');
    populateDropdown(ppaSelect, [], 'Select PPA'); // Clear UI
    
    if (!objectType) return;

    try {
        // Fetch ALL categories for this object type (PS/MOOE/CO)
        const res = await fetch(`/api/category/list?object=${encodeURIComponent(objectType)}`);
        const data = await res.json();
        
        if (data.success && Array.isArray(data.categories)) {
            categoryCache = data.categories; // Save to cache
            
            // Populate Parent PPAs
            const ppas = [...new Set(categoryCache.map(c => c.ppa))];
            populateDropdown(ppaSelect, ppas, 'Select PPA');
            
            // Trigger Select2 update
            $('#ppa_select').trigger('change.select2');
        }
    } catch (err) { console.error(err); }
}

function populateSubPpa() {
    const selectedPpa = $('#ppa_select').val();
    const subPpaSelect = document.getElementById('sub_ppa_select');
    
    if (!selectedPpa) {
        populateDropdown(subPpaSelect, [], '---');
    } else {
        const subPpas = [...new Set(categoryCache.filter(c => c.ppa === selectedPpa && c.sub_ppa).map(c => c.sub_ppa))];
        populateDropdown(subPpaSelect, subPpas, 'Select Sub-PPA (Optional)');
    }
    $('#sub_ppa_select').trigger('change.select2');
    populateSubSubPpa(); // Reset child
}

function populateSubSubPpa() {
    const selectedPpa = $('#ppa_select').val();
    const selectedSub = $('#sub_ppa_select').val();
    const subSubSelect = document.getElementById('sub_sub_ppa_select');
    
    if (!selectedPpa || !selectedSub) {
        populateDropdown(subSubSelect, [], '---');
    } else {
        const items = [...new Set(categoryCache.filter(c => c.ppa === selectedPpa && c.sub_ppa === selectedSub && c.sub_sub_ppa).map(c => c.sub_sub_ppa))];
        populateDropdown(subSubSelect, items, 'Select Sub-Sub (Optional)');
    }
    $('#sub_sub_ppa_select').trigger('change.select2');
    checkAvailableBalance(); // Check balance when selection finishes
}

function populateDropdown(selectElement, items, defaultText) {
    selectElement.innerHTML = `<option value="">-- ${defaultText} --</option>`;
    items.forEach(item => selectElement.add(new Option(item, item)));
}

// --- BALANCE CHECKER ---

async function checkAvailableBalance() {
    const officeId = $('#office_id').val();
    // Default year to current or allow selection
    const year = 2026; // Ideally fetch from a year input if you have one
    const ppa = $('#ppa_select').val();
    const sub = $('#sub_ppa_select').val();
    const subsub = $('#sub_sub_ppa_select').val();

    const display = document.getElementById('display_balance');
    
    if (!officeId || !ppa) {
        display.innerText = '0.00';
        return 0;
    }

    // Find the category ID from cache
    const category = categoryCache.find(c => c.ppa === ppa && c.sub_ppa === (sub||null) && c.sub_sub_ppa === (subsub||null));
    
    if (!category) {
        display.innerText = '0.00';
        return 0;
    }

    try {
        // Reuse the allotment existing-amount API for now
        // NOTE: In the future, this backend endpoint should perform (Total Allotment - Total Vouchers)
        const res = await fetch(`/api/allotment/existing-amount?category_id=${category.id}&office_id=${officeId}&year=${year}`);
        const data = await res.json();
        const balance = data.success ? (data.amount || 0) : 0;
        
        display.innerText = balance.toLocaleString('en-PH', {minimumFractionDigits: 2});
        
        // Visual cue for low balance
        if(balance <= 0) display.style.color = 'red';
        else display.style.color = '#0e6655';
        
        return balance;
    } catch (err) {
        console.error(err);
        return 0;
    }
}

// --- CALCULATION LOGIC ---

function calculateNet() {
    const gross = parseFloat(document.getElementById('gross').value) || 0;
    let totalDeductions = 0;
    const ids = ['ewt', 'vat_pt', 'municipal_tax', 'warranty', 'damages', 'pag_ibig', 'others'];
    ids.forEach(id => {
        totalDeductions += parseFloat(document.getElementById(id).value) || 0;
    });
    const net = gross - totalDeductions;
    document.getElementById('net').value = net.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return net;
}

// --- VOUCHER ITEM LOGIC ---

async function addItemToVoucher() {
    const object = $('#object').val();
    const ppa = $('#ppa_select').val();
    const sub = $('#sub_ppa_select').val();
    const subsub = $('#sub_sub_ppa_select').val();
    const particulars = document.getElementById('particulars').value;
    const gross = parseFloat(document.getElementById('gross').value) || 0;

    if (!object || !ppa || !particulars || gross <= 0) {
        alert("Please fill in all PPA details, Particulars, and a valid Gross Amount.");
        return;
    }

    // --- VALIDATION: Check Balance ---
    // 1. Get current balance from DB
    const currentBalance = await checkAvailableBalance();
    
    // 2. Calculate pending deductions from current list
    // We need to match the exact category ID or string
    const pendingAmount = voucherItems
        .filter(item => item.ppa === ppa && item.sub === sub && item.subsub === subsub)
        .reduce((sum, item) => sum + item.gross, 0);

    const actualAvailable = currentBalance - pendingAmount;

    if (gross > actualAvailable) {
        alert(`Insufficient Balance! Available: ₱${actualAvailable.toLocaleString()}. You are trying to spend ₱${gross.toLocaleString()}.`);
        return;
    }
    // ---------------------------------

    const deductions = {};
    const ids = ['ewt', 'vat_pt', 'municipal_tax', 'warranty', 'damages', 'pag_ibig', 'others'];
    ids.forEach(id => deductions[id] = parseFloat(document.getElementById(id).value) || 0);
    const net = calculateNet();

    // Store simplified strings for display, full data for saving
    const item = { object, ppa, sub, subsub, particulars, gross, deductions, net };

    voucherItems.push(item);
    renderVoucherTable();
    
    // Reset Form
    document.getElementById('gross').value = 0;
    document.getElementById('particulars').value = '';
    ids.forEach(id => document.getElementById(id).value = 0);
    calculateNet();
}

function renderVoucherTable() {
    const listDiv = document.getElementById('items_list');
    if (voucherItems.length === 0) {
        listDiv.innerHTML = '<p style="color:#777; font-style:italic;">No items added yet.</p>';
        document.getElementById('voucher_total').textContent = '0.00';
        return;
    }

    let html = `<table class="report-table">
        <thead>
            <tr>
                <th>PPA Description</th>
                <th>Particulars</th>
                <th>Gross</th>
                <th>Deductions</th>
                <th>Net</th>
                <th>Action</th>
            </tr>
        </thead>
        <tbody>`;
    
    let total = 0;

    voucherItems.forEach((item, index) => {
        const ppaString = `${item.ppa} ${item.sub ? '> '+item.sub : ''} ${item.subsub ? '> '+item.subsub : ''}`;
        const dedTotal = Object.values(item.deductions).reduce((a,b)=>a+b, 0);
        
        html += `<tr>
            <td><small>${item.object}</small><br>${ppaString}</td>
            <td>${item.particulars}</td>
            <td>${item.gross.toLocaleString()}</td>
            <td>${dedTotal.toLocaleString()}</td>
            <td><strong>${item.net.toLocaleString()}</strong></td>
            <td><button onclick="removeItem(${index})" style="color:red; background:none; border:none; cursor:pointer;"><i class="fas fa-trash"></i></button></td>
        </tr>`;
        
        total += item.net; 
    });

    html += `</tbody></table>`;
    listDiv.innerHTML = html;
    document.getElementById('voucher_total').textContent = total.toLocaleString('en-US', { minimumFractionDigits: 2 });
}

window.removeItem = function(index) {
    voucherItems.splice(index, 1);
    renderVoucherTable();
}

async function submitVoucher() {
    if (voucherItems.length === 0) {
        alert("Please add at least one item.");
        return;
    }

    const payload = {
        date: document.getElementById('date').value,
        dv_no: document.getElementById('dv_no').value,
        check_no: document.getElementById('check_no').value,
        office_id: $('#office_id').val(), // Use jQuery val for Select2
        items: voucherItems
    };

    if (!payload.date || !payload.office_id) {
        alert("Please fill in Voucher Date and Office.");
        return;
    }

    try {
        const res = await fetch('/api/expense/add-voucher', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await res.json();
        
        if (result.success) {
            alert("Voucher saved successfully!");
            location.reload();
        } else {
            alert("Error: " + result.message);
        }
    } catch (err) {
        console.error(err);
        alert("Failed to save voucher.");
    }
}