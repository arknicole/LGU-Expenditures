document.addEventListener('DOMContentLoaded', () => {
    loadPayableTypes(); // Call the function to fetch types on page load
    document.getElementById('addEntryButton').addEventListener('click', addPayableEntry);
    // Set default date after loading types, to avoid potential conflicts
    document.getElementById('date').value = new Date().toISOString().split('T')[0]; 
});

async function loadPayableTypes() {
    const select = document.getElementById('payable_type');
    select.innerHTML = '<option>Loading...</option>';
    try {
        const res = await fetch('/api/payable-types/list'); // Fetch from the API
        const result = await res.json();
        if (!result.success) throw new Error(result.message);
        
        select.innerHTML = ''; 
        let currentGroup = '';
        let optgroup;

        // Build the dropdown from the fetched data
        result.types.forEach(type => {
            if (type.fund_group !== currentGroup) {
                currentGroup = type.fund_group;
                optgroup = document.createElement('optgroup');
                optgroup.label = currentGroup;
                select.appendChild(optgroup);
            }
            const option = new Option(type.type_name, type.type_name);
            // Append to optgroup if it exists, otherwise directly to select
            (optgroup || select).appendChild(option); 
        });
    } catch(error) {
        select.innerHTML = `<option>Error loading types</option>`;
        console.error("Error loading payable types:", error);
    }
}

async function addPayableEntry() {
    const payload = {
        payable_type: document.getElementById('payable_type').value,
        date: document.getElementById('date').value,
        dv_no: document.getElementById('dv_no').value,
        particulars: document.getElementById('particulars').value,
        object_of_expenditure: document.getElementById('object_of_expenditure').value,
        total_amount: document.getElementById('total_amount').value
    };

    if (!payload.date || !payload.dv_no || !payload.particulars || !payload.object_of_expenditure || !payload.total_amount || !payload.payable_type) {
        alert('Please fill out all fields, including selecting a Payable Type.');
        return;
    }

    try {
        const res = await fetch('/api/expense/add-payable', { // Calls the correct backend route
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await res.json();
        if (result.success) {
            alert(result.message);
            document.getElementById('payable-form').reset();
            document.getElementById('date').value = new Date().toISOString().split('T')[0];
            loadPayableTypes(); // Reload types in case they were managed elsewhere
        } else {
            const message = result.errors ? result.errors.map(e => e.msg).join('\n') : result.message;
            alert(`Error: ${message}`);
        }
    } catch (error) {
        console.error('Failed to add entry:', error);
        alert('An error occurred. Please check the console.');
    }
}