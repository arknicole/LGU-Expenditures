document.addEventListener('DOMContentLoaded', () => {
    fetchDashboardStats();
});

async function fetchDashboardStats() {
    try {
        const response = await fetch('/api/reports/dashboard-stats');
        const result = await response.json();

        if (result.success) {
            const data = result.data;

            // Update the DOM elements with formatted currency
            updateStat('stat_appropriations', data.total_appropriations);
            updateStat('stat_obligations', data.total_obligations);
            updateStat('stat_balance', data.remaining_balance);
            updateStat('stat_payables', data.pending_payables);
        } else {
            console.error('Failed to load stats:', result.message);
        }
    } catch (error) {
        console.error('Error fetching stats:', error);
    }
}

function updateStat(elementId, value) {
    const el = document.getElementById(elementId);
    if (el) {
        // Format as Currency (PHP)
        el.textContent = '₱ ' + value.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }
}