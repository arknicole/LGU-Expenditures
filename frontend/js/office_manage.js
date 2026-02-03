let allOffices = []; 

document.addEventListener('DOMContentLoaded', () => {
    loadOffices();

    document.getElementById('office-form').addEventListener('submit', handleFormSubmit);
    document.getElementById('cancel-button').addEventListener('click', resetForm);
    document.getElementById('offices-list').addEventListener('click', handleTableClick);
    document.getElementById('search-input').addEventListener('input', handleSearch);
});

// --- 1. FETCH & RENDER ---
async function loadOffices() {
    const tbody = document.getElementById('offices-list');
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">Loading...</td></tr>';

    try {
        const res = await fetch('/api/office/list');
        const result = await res.json();

        if (!result.success) throw new Error(result.message);

        allOffices = result.offices; 
        renderTable(allOffices);
    } catch (error) {
        console.error(error);
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:red;">Error loading offices.</td></tr>';
    }
}

function renderTable(offices) {
    const tbody = document.getElementById('offices-list');
    
    if (offices.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">No offices found.</td></tr>';
        return;
    }

    tbody.innerHTML = offices.map(office => `
        <tr>
            <td>${office.sector}</td>
            <td><strong>${office.office_name}</strong></td>
            <td style="text-align:center;">
                <button class="edit-btn" data-id="${office.id}" style="background-color:#ffc107; color:black; padding:5px 10px; font-size:0.8em;">Edit</button>
                <button class="delete-btn" data-id="${office.id}" style="background-color:#dc3545; padding:5px 10px; font-size:0.8em;">Delete</button>
            </td>
        </tr>
    `).join('');
}

// --- 2. SEARCH ---
function handleSearch(e) {
    const term = e.target.value.toLowerCase();
    const filtered = allOffices.filter(office => {
        return (office.office_name && office.office_name.toLowerCase().includes(term)) ||
               (office.sector && office.sector.toLowerCase().includes(term));
    });
    renderTable(filtered);
}

// --- 3. ADD / UPDATE ---
async function handleFormSubmit(e) {
    e.preventDefault();

    const id = document.getElementById('edit-office-id').value;
    const isEdit = id !== '';

    const payload = {
        sector: document.getElementById('sector').value,
        office_name: document.getElementById('office_name').value
    };

    const url = isEdit ? `/api/office/update/${id}` : '/api/office/add';
    const method = isEdit ? 'PUT' : 'POST';

    try {
        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await res.json();

        alert(result.message);

        if (result.success) {
            resetForm();
            loadOffices();
        }
    } catch (error) {
        alert('An error occurred.');
    }
}

// --- 4. TABLE ACTIONS (Edit/Delete) ---
function handleTableClick(e) {
    const btn = e.target;
    const id = btn.dataset.id;

    if (btn.classList.contains('delete-btn')) {
        if (confirm('Are you sure you want to delete this office?')) {
            deleteOffice(id);
        }
    } else if (btn.classList.contains('edit-btn')) {
        startEdit(id);
    }
}

async function deleteOffice(id) {
    try {
        const res = await fetch(`/api/office/delete/${id}`, { method: 'DELETE' });
        const result = await res.json();
        
        if (result.success) {
            alert(result.message);
            loadOffices();
        } else {
            alert(result.message); // Show error if connected to existing records
        }
    } catch (error) {
        alert('Failed to delete.');
    }
}

// --- 5. EDIT MODE HELPERS ---
function startEdit(id) {
    const office = allOffices.find(o => o.id == id);
    if (!office) return;

    document.getElementById('edit-office-id').value = office.id;
    document.getElementById('sector').value = office.sector;
    document.getElementById('office_name').value = office.office_name;

    document.getElementById('form-title').textContent = 'Edit Office';
    document.getElementById('submit-button').textContent = 'Update Office';
    document.getElementById('submit-button').classList.replace('button-primary', 'button-warning');
    document.getElementById('cancel-button').style.display = 'inline-block';
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetForm() {
    document.getElementById('office-form').reset();
    document.getElementById('edit-office-id').value = '';
    
    document.getElementById('form-title').textContent = 'Add New Office';
    document.getElementById('submit-button').textContent = 'Add Office';
    document.getElementById('submit-button').classList.replace('button-warning', 'button-primary');
    document.getElementById('cancel-button').style.display = 'none';
    
    document.getElementById('search-input').value = '';
    renderTable(allOffices);
}