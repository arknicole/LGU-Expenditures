document.addEventListener('DOMContentLoaded', () => {
    // 1. Setup Filters
    populateYearFilter();

    const periodSelect = document.getElementById('period_select');
    if (periodSelect) {
        periodSelect.addEventListener('change', updateSubPeriodFilter);
        updateSubPeriodFilter(); 
    }

    // 2. Attach Listener
    const viewBtn = document.getElementById('viewReportButton');
    if (viewBtn) viewBtn.addEventListener('click', generateReport);
    
    const printBtn = document.getElementById('printReportButton');
    if (printBtn) {
        printBtn.addEventListener('click', () => {
            window.print();
        });
    }
});

async function populateYearFilter() {
    const yearSelect = document.getElementById('year_select');
    try {
        const res = await fetch('/api/reports/available-years');
        const data = await res.json();
        yearSelect.innerHTML = '';
        if (data.success && data.years.length > 0) {
            data.years.forEach(year => yearSelect.add(new Option(year, year)));
            // Optional: Auto-load report on start
            // generateReport(); 
        } else {
            yearSelect.add(new Option(new Date().getFullYear(), new Date().getFullYear()));
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
            // Default to current month
            subPeriodSelect.value = new Date().getMonth() + 1;
        }
    }
}

async function generateReport() {
    const reportContainer = document.getElementById('report_container');
    const year = document.getElementById('year_select').value;
    const period = document.getElementById('period_select').value;
    const subPeriod = document.getElementById('sub_period_select').value;
    
    // Calculate Date Range
    let start_date, end_date;
    if (period === 'yearly') { 
        start_date = `${year}-01-01`; end_date = `${year}-12-31`; 
    } else if (period === 'quarterly') { 
        const q = parseInt(subPeriod);
        const startMonth = (q - 1) * 3 + 1; 
        const endMonth = q * 3;
        start_date = `${year}-${String(startMonth).padStart(2, '0')}-01`;
        const endDay = new Date(year, endMonth, 0).getDate();
        end_date = `${year}-${String(endMonth).padStart(2, '0')}-${endDay}`;
     } else if (period === 'monthly') { 
        const m = parseInt(subPeriod);
        start_date = `${year}-${String(m).padStart(2, '0')}-01`;
        const endDay = new Date(year, m, 0).getDate();
        end_date = `${year}-${String(m).padStart(2, '0')}-${endDay}`;
      }

    reportContainer.innerHTML = '<p>Loading report...</p>';

    try {
        const res = await fetch(`/api/reports/records-of-cheques?start_date=${start_date}&end_date=${end_date}`);
        const result = await res.json();
        
        if (!result.success) throw new Error(result.message);
        renderReport(result.data);
    } catch (error) {
        console.error('Failed to fetch report:', error);
        reportContainer.innerHTML = `<p>An error occurred: ${error.message}</p>`;
    }
}

function renderReport(data) {
    const reportContainer = document.getElementById('report_container');
    
    if (!data || data.length === 0) {
        reportContainer.innerHTML = '<p>No checks found for this period.</p>';
        return;
    }

    // TABLE HEADER
    let html = `<table class="report-table" style="font-size: 0.85em; width:100%;">
        <thead>
            <tr>
                <th>DATE</th>
                <th>CHECK NO.</th>
                <th>DV #</th>
                <th>PARTICULARS</th>
                <th>OFFICE</th>
                <th>PPA / CATEGORY</th>
                <th>GROSS</th>
                <th>EWT</th>
                <th>VAT/PT</th>
                <th>Mun. Tax</th>
                <th>Warranty</th>
                <th>Damages</th>
                <th>Pag-IBIG</th>
                <th>SSS</th>
                <th>Others</th>
                <th>NET</th>
                <th class="no-print">Actions</th> </tr>
        </thead>
        <tbody>`;

    // Initialize Totals
    let totals = { 
        gross: 0, ewt: 0, vat: 0, mun: 0, war: 0, dam: 0, pag: 0, sss: 0, oth: 0, net: 0 
    };

    data.forEach(row => {
        // Parse Financials
        const gross = parseFloat(row.gross) || 0;
        const ewt = parseFloat(row.ewt) || 0;
        const vat = parseFloat(row.vat_pt) || 0;
        const mun = parseFloat(row.municipal_tax) || 0;
        const war = parseFloat(row.warranty) || 0;
        const dam = parseFloat(row.damages) || 0;
        const pag = parseFloat(row.pag_ibig) || 0;
        const sss = parseFloat(row.sss) || 0;
        const oth = parseFloat(row.others) || 0;
        const net = parseFloat(row.net) || 0;

        // Add to Totals
        totals.gross += gross; totals.ewt += ewt; totals.vat += vat; totals.mun += mun;
        totals.war += war; totals.dam += dam; totals.pag += pag; totals.sss += sss; totals.oth += oth; totals.net += net;

        // Prepare Item for Edit (Safe JSON)
        const safeItem = JSON.stringify(row).replace(/'/g, "&#39;");

        // Render Row
        html += `
            <tr>
                <td>${new Date(row.date).toLocaleDateString()}</td>
                <td style="font-weight:bold; color:#d35400;">${row.check_no || ''}</td>
                <td>${row.dv_no || ''}</td>
                <td>${row.particulars || ''}</td>
                <td>${row.office_name || '-'}</td>
                <td><small>${row.category_name || ''}</small></td>
                
                <td style="font-weight:bold;">${format(gross)}</td>
                <td>${format(ewt)}</td>
                <td>${format(vat)}</td>
                <td>${format(mun)}</td>
                <td>${format(war)}</td>
                <td>${format(dam)}</td>
                <td>${format(pag)}</td>
                <td>${format(sss)}</td>
                <td>${format(oth)}</td>
                <td style="font-weight:bold; color: #27ae60;">${format(net)}</td>

                <td class="no-print" style="text-align:center; min-width:80px;">
                    <button onclick='openEditModal(${safeItem})' style="background-color:#ffc107; border:none; padding:4px 8px; border-radius:3px; cursor:pointer; margin-right:5px;" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="deleteItem(${row.id})" style="background-color:#dc3545; color:white; border:none; padding:4px 8px; border-radius:3px; cursor:pointer;" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });

    // FOOTER ROW (Grand Totals)
    html += `</tbody>
        <tfoot>
            <tr class="total-row">
                <td colspan="6" style="text-align:right;">GRAND TOTAL</td>
                <td>${format(totals.gross)}</td>
                <td>${format(totals.ewt)}</td>
                <td>${format(totals.vat)}</td>
                <td>${format(totals.mun)}</td>
                <td>${format(totals.war)}</td>
                <td>${format(totals.dam)}</td>
                <td>${format(totals.pag)}</td>
                <td>${format(totals.sss)}</td>
                <td>${format(totals.oth)}</td>
                <td>${format(totals.net)}</td>
                <td class="no-print"></td>
            </tr>
        </tfoot>
    </table>`;

    reportContainer.innerHTML = html;
}

function format(val) {
    if (val === 0 || val === '0.00') return '0.00';
    return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// --- CRUD FUNCTIONS ---

// 1. DELETE
async function deleteItem(id) {
    if(!confirm("Are you sure you want to PERMANENTLY delete this record?")) return;

    try {
        const res = await fetch('/api/reports/delete-expense', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        const data = await res.json();

        if(data.success) {
            alert("Deleted Successfully");
            generateReport(); // Refresh list automatically
        } else {
            alert("Error: " + data.message);
        }
    } catch(err) {
        console.error(err);
        alert("Failed to delete.");
    }
}

// 2. OPEN MODAL
function openEditModal(item) {
    // Fill the form with existing data
    const idField = document.getElementById('edit_id');
    if (!idField) {
        alert("Edit modal not found in HTML. Please ensure you added the modal code to the HTML file.");
        return;
    }

    document.getElementById('edit_id').value = item.id;
    // Format date for input type="date"
    document.getElementById('edit_date').value = item.date ? new Date(item.date).toISOString().split('T')[0] : ''; 
    document.getElementById('edit_check_no').value = item.check_no || '';
    document.getElementById('edit_dv_no').value = item.dv_no || '';
    document.getElementById('edit_particulars').value = item.particulars || '';
    document.getElementById('edit_amount').value = item.net || 0;

    // Show Modal
    document.getElementById('editModal').style.display = 'block';
}

// 3. SAVE CHANGES
async function saveEdit() {
    const payload = {
        id: document.getElementById('edit_id').value,
        date: document.getElementById('edit_date').value,
        check_no: document.getElementById('edit_check_no').value,
        dv_no: document.getElementById('edit_dv_no').value,
        particulars: document.getElementById('edit_particulars').value,
        amount: document.getElementById('edit_amount').value
    };

    try {
        const res = await fetch('/api/reports/update-expense', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if(data.success) {
            alert("Updated Successfully");
            document.getElementById('editModal').style.display = 'none';
            generateReport(); // Refresh list automatically
        } else {
            alert("Error: " + data.message);
        }
    } catch(err) {
        console.error(err);
        alert("Failed to update.");
    }
}