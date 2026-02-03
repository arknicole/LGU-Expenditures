document.addEventListener('DOMContentLoaded', () => {
    // 1. Setup Filters
    populateYearFilter();

    const periodSelect = document.getElementById('period_select');
    if (periodSelect) {
        periodSelect.addEventListener('change', updateSubPeriodFilter);
        updateSubPeriodFilter(); // Initialize sub-period
    }

    // 2. Attach Listener
    document.getElementById('viewReportButton').addEventListener('click', generateReport);
});

// Fetch only years that exist in the database
async function populateYearFilter() {
    const yearSelect = document.getElementById('year_select');
    if (!yearSelect) return;

    try {
        const res = await fetch('/api/reports/available-years');
        const data = await res.json();
        
        yearSelect.innerHTML = ''; 

        if (data.success && data.years.length > 0) {
            data.years.forEach(year => yearSelect.add(new Option(year, year)));
            generateReport(); // Auto-load
        } else {
            const currentYear = new Date().getFullYear();
            yearSelect.add(new Option(currentYear, currentYear));
        }
    } catch (error) {
        console.error('Error loading years:', error);
        yearSelect.innerHTML = '<option>Error</option>';
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

async function generateReport() {
    const reportContainer = document.getElementById('report_container');
    const yearSelect = document.getElementById('year_select');
    
    if (!yearSelect.value) {
        reportContainer.innerHTML = '<p>Loading years...</p>';
        return;
    }

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

    try {
        const res = await fetch(`/api/reports/summary-appropriations?start_date=${start_date}&end_date=${end_date}`);
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
        reportContainer.innerHTML = '<p>No data found for this period.</p>';
        return;
    }

    // Header Info
    const periodLabel = getPeriodLabel(document.getElementById('period_select').value, document.getElementById('sub_period_select'), reportYear);
    let html = `<div style="text-align:center; font-weight:bold; font-size: 1.1em;">LGU: TUBLAY, BENGUET</div>`;
    html += `<div style="text-align:center;">Period: ${periodLabel} ${reportYear}</div>`;
    html += `<div style="text-align:center; font-weight:bold; margin-bottom: 15px;">SUMMARY OF APPROPRIATIONS AND EXPENDITURES</div>`;

    html += `<table class="report-table" style="font-size: 0.9em;">
        <thead>
            <tr>
                <th rowspan="2">SECTOR / OFFICE</th>
                <th colspan="4" style="text-align:center;">APPROPRIATION (Budget)</th>
                <th colspan="4" style="text-align:center;">EXPENDITURES (Obligations)</th>
                <th colspan="4" style="text-align:center;">BALANCE</th>
            </tr>
            <tr>
                <th>PS</th>
                <th>MOOE</th>
                <th>CO</th>
                <th>TOTAL</th>
                <th>PS</th>
                <th>MOOE</th>
                <th>CO</th>
                <th>TOTAL</th>
                <th>PS</th>
                <th>MOOE</th>
                <th>CO</th>
                <th>TOTAL</th>
            </tr>
        </thead>
        <tbody>`;

    // Initialize Grand Totals
    let grandTotal = {
        app_ps: 0, app_mooe: 0, app_co: 0, app_total: 0,
        exp_ps: 0, exp_mooe: 0, exp_co: 0, exp_total: 0,
        bal_ps: 0, bal_mooe: 0, bal_co: 0, bal_total: 0
    };

    let currentSector = '';

    data.forEach(row => {
        // --- Group by Sector ---
        if (row.sector !== currentSector) {
            html += `<tr class="sector-row"><td colspan="13"><strong>${row.sector}</strong></td></tr>`;
            currentSector = row.sector;
        }

        // Calculations
        const app_ps = parseFloat(row.appropriation_ps) || 0;
        const app_mooe = parseFloat(row.appropriation_mooe) || 0;
        const app_co = parseFloat(row.appropriation_co) || 0;
        const app_total = app_ps + app_mooe + app_co;

        const exp_ps = parseFloat(row.expenditure_ps) || 0;
        const exp_mooe = parseFloat(row.expenditure_mooe) || 0;
        const exp_co = parseFloat(row.expenditure_co) || 0;
        const exp_total = exp_ps + exp_mooe + exp_co;

        const bal_ps = app_ps - exp_ps;
        const bal_mooe = app_mooe - exp_mooe;
        const bal_co = app_co - exp_co;
        const bal_total = app_total - exp_total;

        // Add to Grand Totals
        grandTotal.app_ps += app_ps; grandTotal.app_mooe += app_mooe; grandTotal.app_co += app_co; grandTotal.app_total += app_total;
        grandTotal.exp_ps += exp_ps; grandTotal.exp_mooe += exp_mooe; grandTotal.exp_co += exp_co; grandTotal.exp_total += exp_total;
        grandTotal.bal_ps += bal_ps; grandTotal.bal_mooe += bal_mooe; grandTotal.bal_co += bal_co; grandTotal.bal_total += bal_total;

        html += `
            <tr>
                <td>${row.office_name}</td>
                <td>${formatCurrency(app_ps)}</td>
                <td>${formatCurrency(app_mooe)}</td>
                <td>${formatCurrency(app_co)}</td>
                <td><strong>${formatCurrency(app_total)}</strong></td>
                
                <td>${formatCurrency(exp_ps)}</td>
                <td>${formatCurrency(exp_mooe)}</td>
                <td>${formatCurrency(exp_co)}</td>
                <td><strong>${formatCurrency(exp_total)}</strong></td>
                
                <td>${formatCurrency(bal_ps)}</td>
                <td>${formatCurrency(bal_mooe)}</td>
                <td>${formatCurrency(bal_co)}</td>
                <td><strong>${formatCurrency(bal_total)}</strong></td>
            </tr>
        `;
    });

    html += `</tbody>
        <tfoot>
            <tr class="total-row">
                <td><strong>GRAND TOTAL</strong></td>
                <td><strong>${formatCurrency(grandTotal.app_ps)}</strong></td>
                <td><strong>${formatCurrency(grandTotal.app_mooe)}</strong></td>
                <td><strong>${formatCurrency(grandTotal.app_co)}</strong></td>
                <td><strong>${formatCurrency(grandTotal.app_total)}</strong></td>
                
                <td><strong>${formatCurrency(grandTotal.exp_ps)}</strong></td>
                <td><strong>${formatCurrency(grandTotal.exp_mooe)}</strong></td>
                <td><strong>${formatCurrency(grandTotal.exp_co)}</strong></td>
                <td><strong>${formatCurrency(grandTotal.exp_total)}</strong></td>
                
                <td><strong>${formatCurrency(grandTotal.bal_ps)}</strong></td>
                <td><strong>${formatCurrency(grandTotal.bal_mooe)}</strong></td>
                <td><strong>${formatCurrency(grandTotal.bal_co)}</strong></td>
                <td><strong>${formatCurrency(grandTotal.bal_total)}</strong></td>
            </tr>
        </tfoot>
    </table>`;

    reportContainer.innerHTML = html;
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
    if (value === undefined || value === null || isNaN(value)) return '-';
    if (value === 0) return '-'; 
    return parseFloat(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}