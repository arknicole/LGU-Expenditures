document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Filters
    populateYearFilter(); 
    populateSectorFilter();
    
    // 2. Attach Listeners
    document.getElementById('period_select').addEventListener('change', updateSubPeriodFilter);
    updateSubPeriodFilter(); // Initialize based on default selection

    document.getElementById('sector').addEventListener('change', () => populateOfficeFilter());
    
    // Changing year or office triggers report generation automatically
    document.getElementById('office_id').addEventListener('change', generateReport);
    document.getElementById('year_select').addEventListener('change', () => {
        populateOfficeFilter(); 
    });
    
    // Manual Refresh Button
    document.getElementById('viewReportButton').addEventListener('click', generateReport);
    
    // Print Button
    const printBtn = document.getElementById('printReportButton');
    if(printBtn) {
        printBtn.addEventListener('click', () => window.print());
    }
});

// --- FILTER LOGIC ---

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

async function populateYearFilter() {
    const yearSelect = document.getElementById('year_select');
    if (!yearSelect) return;
    try {
        const res = await fetch('/api/reports/available-years');
        const data = await res.json();
        yearSelect.innerHTML = '';
        if (data.success && data.years.length > 0) {
            data.years.forEach(year => yearSelect.add(new Option(year, year)));
        } else {
            const currentYear = new Date().getFullYear();
            yearSelect.add(new Option(currentYear, currentYear));
        }
    } catch (error) {
        console.error('Failed to load available years:', error);
        yearSelect.innerHTML = '<option>Error</option>';
    }
}

async function populateSectorFilter() {
    const sectorSelect = document.getElementById('sector');
    if (!sectorSelect) return;
    try {
        const res = await fetch('/api/reports/available-sectors');
        const data = await res.json();
        sectorSelect.innerHTML = '<option value="">-- Select Sector --</option>';
        if (data.success && data.sectors.length > 0) {
            data.sectors.forEach(sector => sectorSelect.add(new Option(sector, sector)));
            // Trigger office load if sector is already selected or updated
            await populateOfficeFilter();
        } else {
            sectorSelect.innerHTML = '<option value="">No sectors with data</option>';
        }
    } catch (error) {
        console.error('Failed to load available sectors:', error);
        sectorSelect.innerHTML = '<option>Error</option>';
    }
}

async function populateOfficeFilter() {
    const sector = document.getElementById('sector').value;
    const officeSelect = document.getElementById('office_id');
    if (!officeSelect) return;
    
    officeSelect.innerHTML = '<option value="">Loading...</option>';
    
    if (!sector) {
        officeSelect.innerHTML = '<option value="">-- Select a Sector --</option>';
        return;
    }
    
    try {
        const res = await fetch(`/api/reports/available-offices?sector=${encodeURIComponent(sector)}`);
        const data = await res.json();
        officeSelect.innerHTML = '<option value="">-- Select Office --</option>';
        if (data.success && data.offices.length > 0) {
            data.offices.forEach(office => officeSelect.add(new Option(office.office_name, office.id)));
            generateReport(); 
        } else {
            officeSelect.innerHTML = '<option value="">No offices with data</option>';
            document.getElementById('report_container').innerHTML = ''; 
        }
    } catch (error) {
        console.error('Failed to load available offices:', error);
        officeSelect.innerHTML = '<option>Error</option>';
    }
}

// --- REPORT GENERATION ---

async function generateReport() {
    const year = document.getElementById('year_select').value;
    const office_id = document.getElementById('office_id').value;
    const reportContainer = document.getElementById('report_container');

    if (!year || !office_id) {
        reportContainer.innerHTML = '<p>Please select a Year and an Office to view the report.</p>';
        return;
    }

    // Calculate Dates based on Period
    const period = document.getElementById('period_select').value;
    const subPeriod = document.getElementById('sub_period_select').value;
    let start_date, end_date;

    if (period === 'yearly') {
        start_date = `${year}-01-01`;
        end_date = `${year}-12-31`;
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
        const res = await fetch(`/api/reports/record-of-expenditures?year=${year}&office_id=${office_id}&start_date=${start_date}&end_date=${end_date}`);
        const result = await res.json();
        if (!result.success) throw new Error(result.message);
        renderRecordOfExpenditures(result.data);
    } catch (error) {
        console.error('Failed to fetch report:', error);
        reportContainer.innerHTML = `<p>An error occurred: ${error.message}</p>`;
    }
}

function renderRecordOfExpenditures(data) {
    const { ppa_structure, flat_headers, allotment_transactions, expenses } = data || {};
    const reportContainer = document.getElementById('report_container');

    let html = `<h3>Record of Expenditures</h3>`;
    html += `<table class="report-table" style="width:100%; border-collapse: collapse; table-layout: auto;">`;

    // --- HEADER LOGIC ---
    const countLeafNodes = (node) => {
        if (!node || typeof node !== 'object') return 1;
        if (node.id && Object.keys(node).length === 1) return 1; 
        let count = 0;
        for (const key in node) {
            if (key !== 'id') { 
                count += countLeafNodes(node[key]);
            }
        }
        return count || 1; 
    };
    
    const headerRows = { 0: [], 1: [], 2: [], 3: [] };
    
    // --- FIX: DEFINED COLUMN WIDTHS ---
    const staticColumns = [
        { name: 'DV NO.', width: '100px' },
        { name: 'Particulars', width: '350px' }, // Made this much wider
        { name: 'Date', width: '100px' }
    ];

    // Standard styling for all header cells
    const baseThStyle = 'text-align:center; vertical-align:middle; background-color:#f2f2f2; border:1px solid #ccc; padding:5px;';
    
    // Generate the static first 3 columns with Specific Widths
    staticColumns.forEach(col => {
        headerRows[0].push(`<th rowspan="4" style="${baseThStyle} width:${col.width}; min-width:${col.width};">${col.name}</th>`);
    });

    // MAPPING FOR FULL NAMES
    const fullNames = {
        'PS': 'Personal Services',
        'MOOE': 'Maintenance & Other Operating Expenditures',
        'CO': 'Capital Outlay'
    };

    const sortedObjectKeys = Object.keys(ppa_structure).sort((a, b) => {
        const order = { 'PS': 1, 'MOOE': 2, 'CO': 3 };
        return (order[a] || 99) - (order[b] || 99);
    });

    for (const objectKey of sortedObjectKeys) {
        const objectNode = ppa_structure[objectKey];
        const objectColspan = countLeafNodes(objectNode);
        const displayKey = fullNames[objectKey] || objectKey;

        if (objectColspan > 0) headerRows[0].push(`<th colspan="${objectColspan}" style="${baseThStyle}">${displayKey}</th>`);

        for (const ppaKey in objectNode) {
            if (ppaKey === 'id') continue;
            const ppaNode = objectNode[ppaKey];
            const ppaColspan = countLeafNodes(ppaNode);
            const hasSubItems = Object.keys(ppaNode).some(k => k !== 'id'); 
            const ppaRowspan = ppaNode.id ? 3 : (hasSubItems ? 1 : 3); 
            if (ppaColspan > 0) headerRows[1].push(`<th colspan="${ppaColspan}" rowspan="${ppaRowspan}" style="${baseThStyle}">${ppaKey}</th>`);
            
            if (!ppaNode.id && hasSubItems) {
                for (const subPpaKey in ppaNode) {
                    if (subPpaKey === 'id') continue;
                    const subPpaNode = ppaNode[subPpaKey];
                    const subPpaColspan = countLeafNodes(subPpaNode);
                    const hasSubSubItems = Object.keys(subPpaNode).some(k => k !== 'id');
                    const subPpaRowspan = subPpaNode.id ? 2 : (hasSubSubItems ? 1 : 2); 
                    if (subPpaColspan > 0) headerRows[2].push(`<th colspan="${subPpaColspan}" rowspan="${subPpaRowspan}" style="${baseThStyle}">${subPpaKey}</th>`);
                    
                    if (!subPpaNode.id && hasSubSubItems) {
                        for (const subSubPpaKey in subPpaNode) {
                            if (subSubPpaKey !== 'id') {
                                headerRows[3].push(`<th style="${baseThStyle}">${subSubPpaKey}</th>`);
                            }
                        }
                    }
                }
            }
        }
    }
    
    headerRows[0].push(`<th rowspan="4" style="${baseThStyle} width:120px;">TOTAL</th>`);

    html += `<thead>`;
    for(let i=0; i<4; i++){
        const rowContent = headerRows[i].join('');
        if(rowContent.replace(/<th[^>]*><\/th>/g, '').trim() !== '') {
            html += `<tr>${rowContent}</tr>`;
        }
    }
    html += `</thead>`;

    // --- TABLE BODY ---
    html += `<tbody>`;

    if (!flat_headers || flat_headers.length === 0) {
        const colspan = staticColumns.length + 1; // +1 for Total
        html += `<tr><td colspan="${colspan}" style="text-align:center; padding:10px;">No data available for this selection.</td></tr>`;
    } else {
        const totalBudget = {};
        flat_headers.forEach(h => totalBudget[h.id] = 0);

        // 1. Calculate Budgets
        const budgetSummary = { Allotment: {}, Supplemental: {} };
        const realignments = [];

        allotment_transactions.forEach(t => {
            if (t.type === 'Allotment') {
                (t.details || []).forEach(d => {
                    const amt = parseFloat(d.amount);
                    if (!budgetSummary.Allotment[d.category_id]) budgetSummary.Allotment[d.category_id] = 0;
                    budgetSummary.Allotment[d.category_id] += amt;
                    totalBudget[d.category_id] += amt;
                });
            } else if (t.type === 'Supplemental') {
                (t.details || []).forEach(d => {
                    const amt = parseFloat(d.amount);
                    if (!budgetSummary.Supplemental[d.category_id]) budgetSummary.Supplemental[d.category_id] = 0;
                    budgetSummary.Supplemental[d.category_id] += amt;
                    totalBudget[d.category_id] += amt;
                });
            } else if (t.type === 'Realignment') {
                realignments.push(t);
                (t.details || []).forEach(d => {
                    let amt = parseFloat(d.amount);
                    if (t.is_from === 1) amt = -amt; // Subtract if Source
                    totalBudget[d.category_id] += amt;
                });
            }
        });

        // 2. Render Budget Rows
        const renderBudgetRow = (label, dataMap) => {
            if (Object.keys(dataMap).length === 0) return '';
            
            let rowHtml = `<tr class="budget-row"><td colspan="3"><strong>${label}</strong></td>`;
            let rowTotal = 0;
            flat_headers.forEach(header => {
                const amount = dataMap[header.id] || 0;
                rowTotal += amount;
                rowHtml += `<td style="text-align:right;"><strong>${amount ? formatCurrency(amount) : ''}</strong></td>`;
            });
            rowHtml += `<td style="text-align:right;"><strong>${formatCurrency(rowTotal)}</strong></td></tr>`;
            return rowHtml;
        };

        html += renderBudgetRow('Budget - Allotment', budgetSummary.Allotment);
        html += renderBudgetRow('Budget - Supplemental', budgetSummary.Supplemental);

        realignments.forEach(transaction => {
            let description = transaction.is_from === 1 
                ? `(-) Realignment to ${transaction.other_office_name || 'Unknown'}` 
                : `(+) Realignment from ${transaction.other_office_name || 'Unknown'}`;
            
            html += `<tr class="budget-row"><td colspan="3"><strong>${description}</strong></td>`;
            let rowTotal = 0;
            flat_headers.forEach(header => {
                const detail = (transaction.details || []).find(d => d.category_id === header.id);
                let amount = detail ? parseFloat(detail.amount) : 0;
                if(transaction.is_from === 1 && amount > 0) amount = -amount; 
                
                rowTotal += amount;
                html += `<td style="text-align:right;"><strong>${amount ? formatCurrency(amount) : ''}</strong></td>`;
            });
            html += `<td style="text-align:right;"><strong>${formatCurrency(rowTotal)}</strong></td></tr>`;
        });

        // Total Budget Row
        let grandTotalBudget = Object.values(totalBudget).reduce((sum, val) => sum + val, 0);
        html += `<tr class="total-row" style="background-color:#e0f7fa;"><td colspan="3"><strong>Total Budget</strong></td>`;
        flat_headers.forEach(header => {
            const budgetAmount = totalBudget[header.id] || 0;
            html += `<td style="text-align:right;"><strong>${formatCurrency(budgetAmount)}</strong></td>`;
        });
        html += `<td style="text-align:right;"><strong>${formatCurrency(grandTotalBudget)}</strong></td></tr>`;

        // 3. Render Expenses
        if (expenses && expenses.length > 0) {
            let cumulativeExpenditure = {};
            flat_headers.forEach(h => cumulativeExpenditure[h.id] = 0);
            
            expenses.forEach(exp => {
                html += `<tr><td>${exp.dv_no || ''}</td><td>${exp.particulars || ''}</td><td>${new Date(exp.date).toLocaleDateString()}</td>`;
                let rowTotal = 0;
                flat_headers.forEach(header => {
                    const amount = (exp.category_id === header.id) ? parseFloat(exp.net) : 0;
                    html += `<td style="text-align:right;">${amount ? formatCurrency(amount) : ''}</td>`;
                    if(exp.category_id === header.id) {
                       cumulativeExpenditure[header.id] += amount;
                       rowTotal += amount;
                    }
                });
                html += `<td style="text-align:right;">${formatCurrency(rowTotal)}</td></tr>`;
            });

            // Balance Row
            let balanceTotal = 0;
            html += `<tr class="total-row" style="background-color:#ffe0b2;"><td colspan="3"><strong>Balance</strong></td>`;
            flat_headers.forEach(header => {
                const balance = totalBudget[header.id] - cumulativeExpenditure[header.id];
                balanceTotal += balance;
                html += `<td style="text-align:right;"><strong>${formatCurrency(balance)}</strong></td>`;
            });
            html += `<td style="text-align:right;"><strong>${formatCurrency(balanceTotal)}</strong></td></tr>`;
        } else {
            // Balance Row (No Expenses)
            let balanceTotal = 0;
            html += `<tr class="total-row" style="background-color:#ffe0b2;"><td colspan="3"><strong>Balance</strong></td>`;
            flat_headers.forEach(header => {
                const balance = totalBudget[header.id] || 0;
                balanceTotal += balance;
                html += `<td style="text-align:right;"><strong>${formatCurrency(balance)}</strong></td>`;
            });
            html += `<td style="text-align:right;"><strong>${formatCurrency(balanceTotal)}</strong></td></tr>`;
        }
    }

    html += `</tbody></table>`;
    reportContainer.innerHTML = html;
}

function formatCurrency(value) {
    if (value === undefined || value === null || isNaN(value)) return '';
    return parseFloat(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}