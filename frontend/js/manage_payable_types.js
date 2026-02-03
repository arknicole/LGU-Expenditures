document.addEventListener('DOMContentLoaded', () => {
    loadPayableTypes();
    document.getElementById('addTypeButton').addEventListener('click', addPayableType);
    document.getElementById('types_table_body').addEventListener('click', handleDeleteClick);
});

async function loadPayableTypes() {
    const tbody = document.getElementById('types_table_body');
    tbody.innerHTML = '<tr><td colspan="3">Loading...</td></tr>';
    try {
        const res = await fetch('/api/payable-types/list');
        const result = await res.json();
        if (!result.success) {
            throw new Error(result.message);
        }
        let html = '';
        result.types.forEach(type => {
            html += `
                <tr>
                    <td>${type.fund_group}</td>
                    <td>${type.type_name}</td>
                    <td><button class="delete-btn" data-id="${type.id}">Delete</button></td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="3">Error loading types: ${error.message}</td></tr>`;
    }
}

async function addPayableType() {
    const fundGroup = document.getElementById('fund_group').value;
    const typeName = document.getElementById('type_name').value;
    if (!fundGroup || !typeName) {
        alert('Please provide both a Fund Group and a Type Name.');
        return;
    }

    try {
        const res = await fetch('/api/payable-types/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fund_group: fundGroup, type_name: typeName })
        });
        const result = await res.json();
        alert(result.message);
        if (result.success) {
            loadPayableTypes(); // Refresh the list
            document.getElementById('add-type-form').reset();
        }
    } catch (error) {
        alert('An error occurred.');
    }
}

async function handleDeleteClick(event) {
    if (!event.target.matches('button.delete-btn')) return;

    const typeId = event.target.dataset.id;
    if (!confirm('Are you sure you want to delete this type?')) return;

    try {
        // THIS IS THE FIX: The URL now includes '/delete/' to match the backend
        const res = await fetch(`/api/payable-types/delete/${typeId}`, { method: 'DELETE' });
        const result = await res.json();
        alert(result.message);
        if (result.success) {
            loadPayableTypes(); // Refresh the list
        }
    } catch (error) {
        alert('An error occurred.');
    }
}