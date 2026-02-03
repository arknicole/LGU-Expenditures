
const isLoggedIn = localStorage.getItem('isLoggedIn');


if (isLoggedIn !== 'true') {
    
  
    const path = window.location.pathname;
    if (!path.endsWith('index.html') && path !== '/') {
        console.error('AUTH-GUARD: Access Denied. Redirecting to login...');
        window.location.href = '/index.html';
    }
}