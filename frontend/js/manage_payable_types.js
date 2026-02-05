document.addEventListener('DOMContentLoaded', () => {
    loadPayableTypes();
    document.getElementById('addTypeButton').addEventListener('click', addPayableType);
    // Use event delegation for delete buttons
    document.getElementById('types_table_body').addEventListener('click', handleDeleteClick);
});

async function loadPayableTypes() {
    const tbody = document.getElementById('types_table_body');
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Loading...</td></tr>';
    
    try {
        const res = await fetch('/api/payable-types/list');
        const result = await res.json();
        
        if (!result.success) throw new Error(result.message);
        
        let html = '';
        if (result.data.length === 0) {
            html = '<tr><td colspan="3" style="text-align:center; color:#777;">No categories found. Add one above.</td></tr>';
        } else {
            result.data.forEach(type => {
                html += `
                    <tr>
                        <td>${type.id}</td>
                        <td><strong>${type.name}</strong></td>
                        <td style="text-align:center;">
                            <button class="delete-btn" data-id="${type.id}" style="color:red; border:none; background:none; cursor:pointer;">
                                <i class="fas fa-trash"></i> Delete
                            </button>
                        </td>
                    </tr>
                `;
            });
        }
        tbody.innerHTML = html;
    } catch (error) {
        console.error(error);
        tbody.innerHTML = `<tr><td colspan="3" style="color:red;">Error: ${error.message}</td></tr>`;
    }
}

async function addPayableType() {
    const name = document.getElementById('type_name').value;
    
    if (!name) {
        alert('Please enter a category name.');
        return;
    }

    try {
        const res = await fetch('/api/payable-types/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name })
        });
        const result = await res.json();
        
        if (result.success) {
            alert("Category Added!");
            document.getElementById('type_name').value = ''; // Clear input
            loadPayableTypes(); // Refresh list
        } else {
            alert("Error: " + result.message);
        }
    } catch (error) {
        console.error(error);
        alert('Failed to add category.');
    }
}

async function handleDeleteClick(event) {
    // Check if clicked element is a delete button or icon inside it
    const btn = event.target.closest('.delete-btn');
    if (!btn) return;

    const id = btn.dataset.id;
    if (!confirm('Are you sure you want to delete this category?')) return;

    try {
        const res = await fetch('/api/payable-types/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: id })
        });
        const result = await res.json();
        
        if (result.success) {
            loadPayableTypes(); // Refresh list
        } else {
            alert("Error: " + result.message);
        }
    } catch (error) {
        console.error(error);
        alert('Failed to delete.');
    }
}