document.addEventListener("DOMContentLoaded", () => {
    // 1. Apply Layout Classes
    document.body.classList.add('dashboard-body');

    // 2. Define the Sidebar HTML
    const sidebarHTML = `
        <div class="sidebar-header">
            <i class="fas fa-landmark" style="margin-right: 10px;"></i> LGU SYSTEM
        </div>
        <ul class="sidebar-menu">
            <li><a href="/dashboard.html" class="sidebar-link ${isActive('/dashboard.html')}"><i class="fas fa-tachometer-alt"></i> Dashboard</a></li>
            
            <li class="menu-label">TRANSACTIONS</li>
            <li><a href="/allotment.html" class="sidebar-link ${isActive('/allotment.html')}"><i class="fas fa-money-check-alt"></i> Add Budget</a></li>
            <li><a href="/expense_entry.html" class="sidebar-link ${isActive('/expense_entry.html')}"><i class="fas fa-file-invoice-dollar"></i> Add Expense Voucher</a></li>
            <li><a href="/payable_entry.html" class="sidebar-link ${isActive('/payable_entry.html')}"><i class="fas fa-file-invoice"></i> Add Accounts Payable</a></li>

            <li class="menu-label">REPORTS</li>
            <li><a href="/report_record_of_expenditures.html" class="sidebar-link ${isActive('/report_record_of_expenditures.html')}"><i class="fas fa-book"></i> Record of Expenses</a></li>
            <li><a href="/report_summary_appropriations.html" class="sidebar-link ${isActive('/report_summary_appropriations.html')}"><i class="fas fa-chart-pie"></i> Summary of Approp.</a></li>
            <li><a href="/report_accounts_payable.html" class="sidebar-link ${isActive('/report_accounts_payable.html')}"><i class="fas fa-hand-holding-usd"></i> Accounts Payable</a></li>
            <li><a href="/report_records_of_cheques.html" class="sidebar-link ${isActive('/report_records_of_cheques.html')}"><i class="fas fa-money-check"></i> Records of Checks</a></li>

            <li class="menu-label">MANAGEMENT</li>
            <li><a href="/category.html" class="sidebar-link ${isActive('/category.html')}"><i class="fas fa-tags"></i> Manage Categories</a></li>
            <li><a href="/office_manage.html" class="sidebar-link ${isActive('/office_manage.html')}"><i class="fas fa-building"></i> Manage Offices</a></li>
            <li><a href="/manage_payable_types.html" class="sidebar-link ${isActive('/manage_payable_types.html')}"><i class="fas fa-list"></i> Payable Types</a></li>

            <li class="menu-label">SYSTEM</li>
            <li><a href="#" onclick="logout()" class="sidebar-link"><i class="fas fa-sign-out-alt"></i> Logout</a></li>
        </ul>
    `;

    /// 3. Define the Top Header HTML (With VISIBLE BUTTON)
    const headerHTML = `
        <div class="header-title">MUNICIPALITY OF TUBLAY, BENGUET</div>
        
        <div style="display: flex; align-items: center; gap: 20px;">
            <a href="/dashboard.html" style="
                background-color: #003366; 
                color: white; 
                text-decoration: none; 
                padding: 8px 15px; 
                border-radius: 5px; 
                display: flex; 
                align-items: center; 
                font-size: 0.9rem; 
                font-weight: 500;
                transition: background 0.3s;
            " onmouseover="this.style.backgroundColor='#004080'" onmouseout="this.style.backgroundColor='#003366'">
                <i class="fas fa-home" style="margin-right: 8px;"></i> Back to Dashboard
            </a>

            <div class="user-profile" style="border-left: 1px solid #ccc; padding-left: 20px;">
                <span>Admin User</span>
                <i class="fas fa-user-circle fa-2x" style="margin-left: 10px; color: #555;"></i>
            </div>
        </div>
    `;
    // 4. Inject Structure
    const sidebar = document.createElement('aside');
    sidebar.className = 'sidebar';
    sidebar.innerHTML = sidebarHTML;

    const main = document.createElement('main');
    main.className = 'main-content';

    const header = document.createElement('header');
    header.className = 'top-header';
    header.innerHTML = headerHTML;

    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'content-wrapper';
    
    // Move all current children of body into contentWrapper
    while (document.body.firstChild) {
        contentWrapper.appendChild(document.body.firstChild);
    }

    // Assemble the new layout
    main.appendChild(header);
    main.appendChild(contentWrapper);

    document.body.appendChild(sidebar);
    document.body.appendChild(main);
});

// Helper to highlight the active menu item
function isActive(path) {
    return window.location.pathname.includes(path) ? 'active' : '';
}

function logout() {
    if(confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('username');
        window.location.href = '/index.html';
    }
}