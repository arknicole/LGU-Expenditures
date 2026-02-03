document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('error-message');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault(); 
            
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;

            try {
                const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                const data = await res.json();

                if (data.success) {
                    // --- THIS IS THE FIX ---
                    // Save a flag in LocalStorage to prove we are logged in
                    localStorage.setItem('isLoggedIn', 'true'); 
                    localStorage.setItem('username', username);
                    // -----------------------

                    window.location.href = '/dashboard.html';
                } else {
                    if (errorMessage) {
                        errorMessage.textContent = data.message || 'Login failed';
                        errorMessage.style.color = 'red';
                    } else {
                        alert(data.message);
                    }
                }
            } catch (error) {
                console.error('Login error:', error);
                if (errorMessage) errorMessage.textContent = 'An error occurred. Please try again.';
            }
        });
    }
});