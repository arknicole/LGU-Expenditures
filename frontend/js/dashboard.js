document.addEventListener('DOMContentLoaded', () => {
    const logoutBtn = document.getElementById('logoutButton');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
          
            window.location.href = '/index.html';
        });
    }
});