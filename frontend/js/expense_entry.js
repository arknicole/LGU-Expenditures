let voucherItems = [];
let categoryCache = []; 

document.addEventListener('DOMContentLoaded', () => {
    $(document).ready(function() {
        $('#sector, #office_id').select2({ width: '100%' });
        $('#object').select2({ width: '100%' });
        $('#ppa_select, #sub_ppa_select, #sub_sub_ppa_select').select2({ width: '100%' });

        $('#sector').on('change', handleSectorChange);
        $('#object').on('change', function() { loadCategories($(this).val()); });
        $('#ppa_select').on('change', function() { populateSubPpa(); });
        $('#sub_ppa_select').on('change', function() { populateSubSubPpa(); });
        $('#ppa_select, #sub_ppa_select, #sub_sub_ppa_select').on('change', checkAvailableBalance);
    });

    populateSectors();
    document.getElementById('addItemButton').addEventListener('click', addItemToVoucher);
    document.getElementById('submitVoucherButton').addEventListener('click', submitVoucher);

    const deductionInputs = document.querySelectorAll('.deductions-grid input');
    deductionInputs.forEach(input => { input.addEventListener('input', calculateNet); });
    document.getElementById('gross').addEventListener('input', calculateNet);
});

async function populateSectors() {
    const sectorSelect = document.getElementById('sector');
    try {
        const res = await fetch('/api/office/sectors');
        const data = await res.json();
        sectorSelect.innerHTML = '<option value="">-- Select Sector --</option>';
        if (data.success) { data.sectors.forEach(sector => { sectorSelect.add(new Option(sector, sector)); }); }
    } catch (error) { console.error('Error loading sectors:', error); }
}

async function handleSectorChange() {
    const sector = $('#sector').val();
    const officeSelect = document.getElementById('office_id');
    officeSelect.innerHTML = '<option value="">Loading...</option>';
    try {
        const res = await fetch(`/api/office/list?sector=${encodeURIComponent(sector)}`);
        const data = await res.json();
        officeSelect.innerHTML = '<option value="">-- Select Office --</option>';
        if (data.success) { data.offices.forEach(office => { officeSelect.add(new Option(office.office_name, office.id)); }); }
    } catch (error) { console.error('Error loading offices:', error); }
}

async function loadCategories(objectType) {
    categoryCache = []; 
    const ppaSelect = document.getElementById('ppa_select');
    populateDropdown(ppaSelect, [], 'Select PPA');
    if (!objectType) return;
    try {
        const res = await fetch(`/api/category/list?object=${encodeURIComponent(objectType)}`);
        const data = await res.json();
        if (data.success && Array.isArray(data.categories)) {
            categoryCache = data.categories; 
            const ppas = [...new Set(categoryCache.map(c => c.ppa))];
            populateDropdown(ppaSelect, ppas, 'Select PPA');
            $('#ppa_select').trigger('change.select2');
        }
    } catch (err) { console.error(err); }
}

function populateSubPpa() {
    const selectedPpa = $('#ppa_select').val();
    const subPpaSelect = document.getElementById('sub_ppa_select');
    if (!selectedPpa) populateDropdown(subPpaSelect, [], '---');
    else {
        const subPpas = [...new Set(categoryCache.filter(c => c.ppa === selectedPpa && c.sub_ppa).map(c => c.sub_ppa))];
        populateDropdown(subPpaSelect, subPpas, 'Select Sub-PPA (Optional)');
    }
    $('#sub_ppa_select').trigger('change.select2');
    populateSubSubPpa(); 
}

function populateSubSubPpa() {
    const selectedPpa = $('#ppa_select').val();
    const selectedSub = $('#sub_ppa_select').val();
    const subSubSelect = document.getElementById('sub_sub_ppa_select');
    if (!selectedPpa || !selectedSub) populateDropdown(subSubSelect, [], '---');
    else {
        const items = [...new Set(categoryCache.filter(c => c.ppa === selectedPpa && c.sub_ppa === selectedSub && c.sub_sub_ppa).map(c => c.sub_sub_ppa))];
        populateDropdown(subSubSelect, items, 'Select Sub-Sub (Optional)');
    }
    $('#sub_sub_ppa_select').trigger('change.select2');
    checkAvailableBalance(); 
}

function populateDropdown(selectElement, items, defaultText) {
    selectElement.innerHTML = `<option value="">-- ${defaultText} --</option>`;
    items.forEach(item => selectElement.add(new Option(item, item)));
}

async function checkAvailableBalance() {
    const officeId = $('#office_id').val();
    const year = 2026; 
    const ppa = $('#ppa_select').val();
    const sub = $('#sub_ppa_select').val();
    const subsub = $('#sub_sub_ppa_select').val();
    const display = document.getElementById('display_balance');
    
    if (!officeId || !ppa) { display.innerText = '0.00'; return 0; }
    const category = categoryCache.find(c => c.ppa === ppa && c.sub_ppa === (sub||null) && c.sub_sub_ppa === (subsub||null));
    if (!category) { display.innerText = '0.00'; return 0; }

    try {
        const res = await fetch(`/api/allotment/existing-amount?category_id=${category.id}&office_id=${officeId}&year=${year}`);
        const data = await res.json();
        const balance = data.success ? (data.amount || 0) : 0;
        display.innerText = balance.toLocaleString('en-PH', {minimumFractionDigits: 2});
        display.style.color = balance <= 0 ? 'red' : '#0e6655';
        return balance;
    } catch (err) { console.error(err); return 0; }
}

function calculateNet() {
    const gross = parseFloat(document.getElementById('gross').value) || 0;
    let totalDeductions = 0;
    ['ewt', 'vat_pt', 'municipal_tax', 'warranty', 'damages', 'pag_ibig', 'others'].forEach(id => {
        totalDeductions += parseFloat(document.getElementById(id).value) || 0;
    });
    const net = gross - totalDeductions;
    document.getElementById('net').value = net.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return net;
}

async function addItemToVoucher() {
    const object = $('#object').val();
    const ppa = $('#ppa_select').val();
    const sub = $('#sub_ppa_select').val();
    const subsub = $('#sub_sub_ppa_select').val();
    const particulars = document.getElementById('particulars').value;
    const gross = parseFloat(document.getElementById('gross').value) || 0;

    if (!object || !ppa || !particulars || gross <= 0) { alert("Please fill in all details."); return; }

    const currentBalance = await checkAvailableBalance();
    const pendingAmount = voucherItems.filter(item => item.ppa === ppa && item.sub === sub && item.subsub === subsub).reduce((sum, item) => sum + item.gross, 0);
    const actualAvailable = currentBalance - pendingAmount;

    if (gross > actualAvailable) {
        alert(`Insufficient Balance! Available: ₱${actualAvailable.toLocaleString()}.`);
        return;
    }

    const deductions = {};
    ['ewt', 'vat_pt', 'municipal_tax', 'warranty', 'damages', 'pag_ibig', 'others'].forEach(id => deductions[id] = parseFloat(document.getElementById(id).value) || 0);
    const net = calculateNet();

    const item = { object, ppa, sub, subsub, particulars, gross, deductions, net };
    voucherItems.push(item);
    renderVoucherTable();
    
    document.getElementById('gross').value = 0;
    calculateNet();
}

function renderVoucherTable() {
    const listDiv = document.getElementById('items_list');
    if (voucherItems.length === 0) {
        listDiv.innerHTML = '<p style="color:#777; font-style:italic;">No items added yet.</p>';
        document.getElementById('voucher_total').textContent = '0.00';
        return;
    }
    let html = `<table class="report-table"><thead><tr><th>PPA</th><th>Particulars</th><th>Gross</th><th>Deductions</th><th>Net</th><th>Action</th></tr></thead><tbody>`;
    let total = 0;
    voucherItems.forEach((item, index) => {
        const ppaString = `${item.ppa} ${item.sub ? '> '+item.sub : ''}`;
        const dedTotal = Object.values(item.deductions).reduce((a,b)=>a+b, 0);
        html += `<tr><td><small>${item.object}</small><br>${ppaString}</td><td>${item.particulars}</td><td>${item.gross.toLocaleString()}</td><td>${dedTotal.toLocaleString()}</td><td><strong>${item.net.toLocaleString()}</strong></td><td><button onclick="removeItem(${index})" style="color:red; background:none; border:none; cursor:pointer;"><i class="fas fa-trash"></i></button></td></tr>`;
        total += item.net; 
    });
    html += `</tbody></table>`;
    listDiv.innerHTML = html;
    document.getElementById('voucher_total').textContent = total.toLocaleString('en-US', { minimumFractionDigits: 2 });
}

window.removeItem = function(index) { voucherItems.splice(index, 1); renderVoucherTable(); }

async function submitVoucher() {
    if (voucherItems.length === 0) { alert("Please add at least one item."); return; }
    const payload = {
        date: document.getElementById('date').value,
        dv_no: document.getElementById('dv_no').value,
        check_no: document.getElementById('check_no').value,
        office_id: $('#office_id').val(), 
        items: voucherItems
    };
    if (!payload.date || !payload.office_id) { alert("Please fill in Voucher Date and Office."); return; }
    try {
        const res = await fetch('/api/expense/add-voucher', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const result = await res.json();
        if (result.success) { alert("Voucher saved!"); location.reload(); } else { alert("Error: " + result.message); }
    } catch (err) { console.error(err); alert("Failed to save."); }
}