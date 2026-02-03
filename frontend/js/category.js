let allCategories = []; // Store data locally for easy editing and searching

document.addEventListener('DOMContentLoaded', () => {
    loadCategories();

    // Handle Form Submit (Add or Update)
    document.getElementById('category-form').addEventListener('submit', handleFormSubmit);
    
    // Handle Cancel Edit
    document.getElementById('cancel-button').addEventListener('click', resetForm);

    // Handle Table Actions (Edit/Delete)
    document.getElementById('categories-list').addEventListener('click', handleTableClick);

    // NEW: Handle Search Input
    document.getElementById('search-input').addEventListener('input', handleSearch);
});

// --- SEARCH LOGIC ---
function handleSearch(e) {
    const term = e.target.value.toLowerCase();
    
    const filtered = allCategories.filter(cat => {
        // Check if search term exists in any of the fields
        return (cat.object_of_expenditure && cat.object_of_expenditure.toLowerCase().includes(term)) ||
               (cat.ppa && cat.ppa.toLowerCase().includes(term)) ||
               (cat.sub_ppa && cat.sub_ppa.toLowerCase().includes(term)) ||
               (cat.sub_sub_ppa && cat.sub_sub_ppa.toLowerCase().includes(term));
    });

    renderTable(filtered);
}

// --- 1. FETCH & RENDER ---
async function loadCategories() {
    const tbody = document.getElementById('categories-list');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Loading...</td></tr>';

    try {
        const res = await fetch('/api/category/list');
        const result = await res.json();

        if (!result.success) throw new Error(result.message);

        allCategories = result.categories; // Save for later
        renderTable(allCategories);
    } catch (error) {
        console.error(error);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">Error loading categories.</td></tr>';
    }
}

function renderTable(categories) {
    const tbody = document.getElementById('categories-list');
    
    if (categories.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No categories found.</td></tr>';
        return;
    }

    tbody.innerHTML = categories.map(cat => `
        <tr>
            <td><strong>${cat.object_of_expenditure}</strong></td>
            <td>${cat.ppa}</td>
            <td>${cat.sub_ppa || ''}</td>
            <td>${cat.sub_sub_ppa || ''}</td>
            <td style="text-align:center;">
                <button class="edit-btn" data-id="${cat.id}" style="background-color:#ffc107; color:black; padding:5px 10px; font-size:0.8em;">Edit</button>
                <button class="delete-btn" data-id="${cat.id}" style="background-color:#dc3545; padding:5px 10px; font-size:0.8em;">Delete</button>
            </td>
        </tr>
    `).join('');
}

// --- 2. ADD / UPDATE ---
async function handleFormSubmit(e) {
    e.preventDefault();

    const id = document.getElementById('edit-category-id').value;
    const isEdit = id !== '';

    const payload = {
        object_of_expenditure: document.getElementById('object').value,
        ppa: document.getElementById('ppa').value,
        sub_ppa: document.getElementById('subppa').value,
        sub_sub_ppa: document.getElementById('subsubppa').value
    };

    const url = isEdit ? `/api/category/update/${id}` : '/api/category/add';
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
            loadCategories(); // Refresh list
        }
    } catch (error) {
        alert('An error occurred.');
    }
}

// --- 3. TABLE ACTIONS ---
function handleTableClick(e) {
    const btn = e.target;
    const id = btn.dataset.id;

    if (btn.classList.contains('delete-btn')) {
        if (confirm('Are you sure you want to delete this category?')) {
            deleteCategory(id);
        }
    } else if (btn.classList.contains('edit-btn')) {
        startEdit(id);
    }
}

async function deleteCategory(id) {
    try {
        const res = await fetch(`/api/category/delete/${id}`, { method: 'DELETE' });
        const result = await res.json();
        alert(result.message);
        if (result.success) loadCategories();
    } catch (error) {
        alert('Failed to delete.');
    }
}

// --- 4. EDIT MODE HELPERS ---
function startEdit(id) {
    const category = allCategories.find(c => c.id == id);
    if (!category) return;

    // Populate Form
    document.getElementById('edit-category-id').value = category.id;
    document.getElementById('object').value = category.object_of_expenditure;
    document.getElementById('ppa').value = category.ppa;
    document.getElementById('subppa').value = category.sub_ppa || '';
    document.getElementById('subsubppa').value = category.sub_sub_ppa || '';

    // Change UI state
    document.getElementById('form-title').textContent = 'Edit Category';
    document.getElementById('submit-button').textContent = 'Update Category';
    document.getElementById('submit-button').classList.replace('button-primary', 'button-warning');
    document.getElementById('cancel-button').style.display = 'inline-block';
    
    // Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetForm() {
    document.getElementById('category-form').reset();
    document.getElementById('edit-category-id').value = '';
    
    document.getElementById('form-title').textContent = 'Add New Category';
    document.getElementById('submit-button').textContent = 'Add Category';
    document.getElementById('submit-button').classList.replace('button-warning', 'button-primary');
    document.getElementById('cancel-button').style.display = 'none';
    
    // Clear search box and reset table if needed
    document.getElementById('search-input').value = '';
    renderTable(allCategories);
}