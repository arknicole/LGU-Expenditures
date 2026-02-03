document.addEventListener('DOMContentLoaded', () => {
    // 1. Setup Filters
    populateYearFilter(); 
    loadPayableTypesFilter();

    const periodSelect = document.getElementById('period_select');
    if (periodSelect) {
        periodSelect.addEventListener('change', updateSubPeriodFilter);
        updateSubPeriodFilter(); // Init sub-period
    }

    // 2. Attach Listener
    document.getElementById('viewReportButton').addEventListener('click', generateReport);
    
    // 3. Print Listener
    const printBtn = document.getElementById('printReportButton');
    if(printBtn) {
        printBtn.addEventListener('click', () => {
            window.print();
        });
    }
});

// --- FILTER FUNCTIONS ---

async function populateYearFilter() {
    const yearSelect = document.getElementById('year_select');
    if (!yearSelect) return;

    try {
        const res = await fetch('/api/reports/available-years');
        const data = await res.json();
        
        yearSelect.innerHTML = ''; 

        if (data.success && data.years.length > 0) {
            data.years.forEach(year => yearSelect.add(new Option(year, year)));
            // generateReport(); // Optional: Auto-load
        } else {
            const currentYear = new Date().getFullYear();
            yearSelect.add(new Option(currentYear, currentYear));
        }
    } catch (error) {
        console.error('Error loading years:', error);
    }
}

function updateSubPeriodFilter() {
    const period = document.getElementById('period_select').value;
    const subPeriodSection = document.getElementById('sub_period_section');
    const subPeriodLabel = document.getElementById('sub_period_label');
    const subPeriodSelect = document.getElementById('sub_period_select');
    
    subPeriodSelect.innerHTML = '';
    
    if (period === 'yearly') {
        subPeriodSection.style.display = 'none';
    } else {
        subPeriodSection.style.display = 'inline-block';
        if (period === 'quarterly') {
            subPeriodLabel.textContent = 'Quarter:';
            ['1st Quarter', '2nd Quarter', '3rd Quarter', '4th Quarter'].forEach((q, i) => {
                subPeriodSelect.add(new Option(q, i + 1));
            });
        } else if (period === 'monthly') {
            subPeriodLabel.textContent = 'Month:';
            const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
            monthNames.forEach((m, i) => {
                subPeriodSelect.add(new Option(m, i + 1));
            });
        }
    }
}

async function loadPayableTypesFilter() {
    const select = document.getElementById('payable_type_select');
    if (!select) return;
    try {
        const res = await fetch('/api/payable-types/list');
        const result = await res.json();
        if (!result.success) throw new Error(result.message);
        
        // select.innerHTML = '<option value="All">All Types</option>'; // Keep default if you want
        result.types.forEach(type => {
            select.add(new Option(type.type_name, type.type_name));
        });
    } catch(error) {
        console.error("Error loading types:", error);
    }
}

// --- REPORT GENERATION ---

async function generateReport() {
    const reportContainer = document.getElementById('report_container');
    const yearSelect = document.getElementById('year_select');
    
    if (!yearSelect.value) return; 

    reportContainer.innerHTML = '<p>Loading report...</p>';

    const year = yearSelect.value;
    const period = document.getElementById('period_select').value;
    const subPeriod = document.getElementById('sub_period_select').value;
    
    let start_date, end_date;
    if (period === 'yearly') { 
        start_date = `${year}-01-01`; end_date = `${year}-12-31`; 
    } else if (period === 'quarterly') { 
        const q = parseInt(subPeriod);
        const startMonth = (q - 1) * 3 + 1; const endMonth = q * 3;
        start_date = `${year}-${String(startMonth).padStart(2, '0')}-01`;
        const endDay = new Date(year, endMonth, 0).getDate();
        end_date = `${year}-${String(endMonth).padStart(2, '0')}-${endDay}`;
     } else if (period === 'monthly') { 
        const m = parseInt(subPeriod);
        start_date = `${year}-${String(m).padStart(2, '0')}-01`;
        const endDay = new Date(year, m, 0).getDate();
        end_date = `${year}-${String(m).padStart(2, '0')}-${endDay}`;
      }

    const payableType = document.getElementById('payable_type_select').value;

    try {
        const res = await fetch(`/api/reports/accounts-payable?start_date=${start_date}&end_date=${end_date}&payable_type=${encodeURIComponent(payableType)}`);
        const result = await res.json();
        if (!result.success) throw new Error(result.message);
        renderReport(result.data, year);
    } catch (error) {
        console.error('Failed to fetch report:', error);
        reportContainer.innerHTML = `<p>An error occurred: ${error.message}</p>`;
    }
}

function renderReport(data, reportYear) {
    const reportContainer = document.getElementById('report_container');
    if (!data || data.length === 0) {
        reportContainer.innerHTML = '<p>No paid Accounts Payable found for this period.</p>';
        return;
    }

    const periodLabel = getPeriodLabel(document.getElementById('period_select').value, document.getElementById('sub_period_select'), reportYear);
    
    // Header Info
    let html = `<div style="text-align:center; font-weight:bold; font-size: 1.1em;">LGU: TUBLAY, BENGUET</div>`;
    html += `<div style="text-align:center;">Period: ${periodLabel} ${reportYear}</div>`;
    html += `<div style="text-align:center; font-weight:bold; margin-bottom: 15px;">RECORDS OF PRIOR YEAR ACCOUNTS PAYABLE PAYMENT</div>`;

    // Table Header (Added "Actions" column)
    html += `<table class="report-table">
        <thead>
            <tr>
                <th>DV NO.</th>
                <th>Particulars</th>
                <th>Date</th>
                <th>PS</th>
                <th>MOOE</th>
                <th>CO</th>
                <th>Total</th>
                <th class="no-print">Actions</th>
            </tr>
        </thead>
        <tbody>`;

    let grandTotal = { ps: 0, mooe: 0, co: 0, total: 0 };
    let currentMonth = -1;
    let monthlyTotal = { ps: 0, mooe: 0, co: 0, total: 0 };
    const monthNames = ["", "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
    let currentFundGroup = null;

    data.forEach((item, index) => {
        const itemDate = new Date(item.date);
        const itemMonth = itemDate.getMonth() + 1;
        const itemFundGroup = item.fund_group || 'Uncategorized';

        // 1. Handle Fund Group Change
        if (itemFundGroup !== currentFundGroup) {
            if (currentFundGroup !== null && currentMonth !== -1) {
                 html += renderSubtotalRow(monthNames[currentMonth], reportYear, monthlyTotal);
                 monthlyTotal = { ps: 0, mooe: 0, co: 0, total: 0 };
                 currentMonth = -1; 
            }
            // Colspan increased to 8 to cover Actions column
            html += `<tr class="sector-row"><td colspan="8"><strong>${itemFundGroup.toUpperCase()}</strong></td></tr>`;
            currentFundGroup = itemFundGroup;
        }

        // 2. Handle Month Change
        if (itemMonth !== currentMonth && currentMonth !== -1) {
            html += renderSubtotalRow(monthNames[currentMonth], reportYear, monthlyTotal);
            monthlyTotal = { ps: 0, mooe: 0, co: 0, total: 0 };
        }
        currentMonth = itemMonth;
        
        const ps = parseFloat(item.ps) || 0;
        const mooe = parseFloat(item.mooe) || 0;
        const co = parseFloat(item.co) || 0;
        const total = parseFloat(item.total) || 0;
        
        monthlyTotal.ps += ps; monthlyTotal.mooe += mooe; monthlyTotal.co += co; monthlyTotal.total += total;
        grandTotal.ps += ps; grandTotal.mooe += mooe; grandTotal.co += co; grandTotal.total += total;
        
        // Prepare Safe JSON for Edit Button
        const safeItem = JSON.stringify(item).replace(/'/g, "&#39;");

        // Render Row
        html += `
            <tr>
                <td>${item.dv_no || ''}</td>
                <td>${item.particulars}</td>
                <td>${itemDate.toLocaleDateString()}</td>
                <td>${ps > 0 ? formatCurrency(ps) : ''}</td>
                <td>${mooe > 0 ? formatCurrency(mooe) : ''}</td>
                <td>${co > 0 ? formatCurrency(co) : ''}</td>
                <td><strong>${formatCurrency(total)}</strong></td>
                
                <td class="no-print" style="text-align:center; min-width:80px;">
                    <button onclick='openEditModal(${safeItem})' style="background:#ffc107; border:none; padding:3px 6px; cursor:pointer; border-radius:3px; margin-right:5px;" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteItem(${item.id || item.expense_id})" style="background:#dc3545; color:white; border:none; padding:3px 6px; cursor:pointer; border-radius:3px;" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>`;

        // End of list subtotal
        if (index === data.length - 1) {
             html += renderSubtotalRow(monthNames[currentMonth], reportYear, monthlyTotal);
        }
    });

    // FOOTER (Grand Total)
    html += `</tbody>
        <tfoot>
            <tr class="total-row">
                <td colspan="3"><strong>GRAND TOTAL</strong></td>
                <td><strong>${formatCurrency(grandTotal.ps)}</strong></td>
                <td><strong>${formatCurrency(grandTotal.mooe)}</strong></td>
                <td><strong>${formatCurrency(grandTotal.co)}</strong></td>
                <td><strong>${formatCurrency(grandTotal.total)}</strong></td>
                <td class="no-print"></td> </tr>
        </tfoot>
    </table>`;

    reportContainer.innerHTML = html;
}

function renderSubtotalRow(monthName, year, totals) {
     // Added extra empty <td> at end for Actions column alignment
     return `<tr class="subtotal-row">
            <td colspan="3"><strong>EXPENDITURE - ${monthName}.${year}</strong></td>
            <td><strong>${formatCurrency(totals.ps)}</strong></td>
            <td><strong>${formatCurrency(totals.mooe)}</strong></td>
            <td><strong>${formatCurrency(totals.co)}</strong></td>
            <td><strong>${formatCurrency(totals.total)}</strong></td>
            <td class="no-print"></td>
        </tr>`;
}

function getPeriodLabel(periodType, subPeriodSelect, year) {
    if (periodType === 'yearly') return `January-December`;
    else if (periodType === 'quarterly') {
        const q = subPeriodSelect.value;
        if (q === '1') return `January-March`; if (q === '2') return `April-June`;
        if (q === '3') return `July-September`; if (q === '4') return `October-December`;
    } else if (periodType === 'monthly') return subPeriodSelect.options[subPeriodSelect.selectedIndex]?.text;
    return '';
}

function formatCurrency(value) {
    if (value === undefined || value === null || isNaN(value)) return '0.00'; 
    return parseFloat(value).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// --- CRUD FUNCTIONS ---

async function deleteItem(id) {
    if(!id) return alert("Error: No ID found for this item.");
    if(!confirm("Are you sure you want to PERMANENTLY delete this record?")) return;

    try {
        const res = await fetch('/api/reports/delete-expense', { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({id}) 
        });
        const data = await res.json();
        if(data.success) {
            alert("Deleted Successfully!");
            generateReport(); // Refresh the report
        } else {
            alert("Error: " + data.message);
        }
    } catch(e) { 
        console.error(e);
        alert("Failed to delete.");
    }
}

function openEditModal(item) {
    // Determine ID (depends on query alias)
    const id = item.id || item.expense_id;
    if(!id) { alert("Error: ID missing."); return; }

    document.getElementById('edit_id').value = id;
    document.getElementById('edit_date').value = item.date ? new Date(item.date).toISOString().split('T')[0] : '';
    document.getElementById('edit_dv_no').value = item.dv_no || '';
    document.getElementById('edit_particulars').value = item.particulars || '';
    // For AP, we usually edit the 'total' or 'net'
    document.getElementById('edit_amount').value = item.total || item.net || 0;
    
    document.getElementById('editModal').style.display = 'block';
}

async function saveEdit() {
    const payload = {
        id: document.getElementById('edit_id').value,
        date: document.getElementById('edit_date').value,
        dv_no: document.getElementById('edit_dv_no').value,
        particulars: document.getElementById('edit_particulars').value,
        amount: document.getElementById('edit_amount').value
    };

    try {
        const res = await fetch('/api/reports/update-expense', {
            method: 'POST', 
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload) 
        });
        const data = await res.json();
        if(data.success) {
            alert("Updated Successfully!");
            document.getElementById('editModal').style.display = 'none';
            generateReport(); // Refresh the report
        } else {
            alert("Error: " + data.message);
        }
    } catch(e) { 
        console.error(e); 
        alert("Failed to update.");
    }
}