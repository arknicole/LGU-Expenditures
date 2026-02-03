document.addEventListener('DOMContentLoaded', () => {
    // Set default dates to the current month
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    document.getElementById('start_date').value = firstDayOfMonth;
    document.getElementById('end_date').value = today.toISOString().split('T')[0];

    document.getElementById('viewReportButton').addEventListener('click', generateReport);
    generateReport(); // Load initial report
});

async function generateReport() {
    const startDate = document.getElementById('start_date').value;
    const endDate = document.getElementById('end_date').value;
    const reportContainer = document.getElementById('report_container');
    reportContainer.innerHTML = '<p>Loading report...</p>';

    if (!startDate || !endDate) {
        reportContainer.innerHTML = '<p>Please select a start and end date.</p>';
        return;
    }

    try {
        const res = await fetch(`/api/reports/records-of-cheques?start_date=${startDate}&end_date=${endDate}`);
        const result = await res.json();

        if (!result.success) {
            reportContainer.innerHTML = `<p>Error loading report: ${result.message}</p>`;
            return;
        }
        renderDetailedReport(result.data);
    } catch (error) {
        console.error('Failed to fetch report:', error);
        reportContainer.innerHTML = '<p>A network error occurred while fetching the report.</p>';
    }
}

function renderDetailedReport(data) {
    const reportContainer = document.getElementById('report_container');
    let html = `
        <table class="report-table">
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
                    <th>Municipal Tax</th>
                    <th>Warranty</th>
                    <th>Damages</th>
                    <th>Pag-IBIG</th>
                    <th>SSS</th>
                    <th>Others</th>
                    <th>NET</th>
                </tr>
            </thead>
            <tbody>
    `;

    const totals = { gross: 0, ewt: 0, vat_pt: 0, municipal_tax: 0, warranty: 0, damages: 0, pagibig: 0, others: 0, net: 0, sss: 0 };

    if (data && data.length > 0) {
        data.forEach(row => {
            // Logic to determine what to show in the new columns
            const office = row.office_name || `A/P (${row.payable_type || ''})`;
            const category = row.category_name || row.object_of_expenditure || '';

            html += `
                <tr>
                    <td>${new Date(row.date).toLocaleDateString()}</td>
                    <td>${row.check_no || ''}</td>
                    <td>${row.dv_no || ''}</td>
                    <td>${row.particulars || ''}</td>
                    <td>${office}</td>
                    <td>${category}</td>
                    <td>${formatCurrency(row.gross)}</td>
                    <td>${formatCurrency(row.ewt)}</td>
                    <td>${formatCurrency(row.vat_pt)}</td>
                    <td>${formatCurrency(row.municipal_tax)}</td>
                    <td>${formatCurrency(row.warranty)}</td>
                    <td>${formatCurrency(row.damages)}</td>
                    <td>${formatCurrency(row.pagibig)}</td>
                    <td>${formatCurrency(row.sss)}</td>
                    <td>${formatCurrency(row.others)}</td>
                    <td>${formatCurrency(row.net)}</td>
                </tr>
            `;
            for (const key in totals) {
                totals[key] += parseFloat(row[key]) || 0;
            }
        });
    } else {
        html += '<tr><td colspan="16" style="text-align: center;">No data found for the selected date range.</td></tr>';
    }

    html += `
            </tbody>
            <tfoot>
                <tr class="total-row">
                    <td colspan="6"><strong>GRAND TOTAL</strong></td>
                    <td><strong>${formatCurrency(totals.gross)}</strong></td>
                    <td><strong>${formatCurrency(totals.ewt)}</strong></td>
                    <td><strong>${formatCurrency(totals.vat_pt)}</strong></td>
                    <td><strong>${formatCurrency(totals.municipal_tax)}</strong></td>
                    <td><strong>${formatCurrency(totals.warranty)}</strong></td>
                    <td><strong>${formatCurrency(totals.damages)}</strong></td>
                    <td><strong>${formatCurrency(totals.pagibig)}</strong></td>
                    <td><strong>${formatCurrency(totals.sss)}</strong></td>
                    <td><strong>${formatCurrency(totals.others)}</strong></td>
                    <td><strong>${formatCurrency(totals.net)}</strong></td>
                </tr>
            </tfoot>
        </table>
    `;
    reportContainer.innerHTML = html;
}