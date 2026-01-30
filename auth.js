/**
 * Centralized Authentication Utility for Vault
 * Handles JWT token management and API authentication
 */

const VaultAuth = (function () {
    let API_BASE_URL;
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        API_BASE_URL = 'http://localhost:8080/api';
    } else {
        API_BASE_URL = 'https://spring.visad.co.uk/api';
    }
    const TOKEN_KEY = 'jwt_token';
    const USER_KEY = 'user_data';

    // Get stored JWT token
    function getToken() {
        return sessionStorage.getItem(TOKEN_KEY);
    }

    // Store JWT token
    function setToken(token) {
        sessionStorage.setItem(TOKEN_KEY, token);
    }

    // Remove JWT token
    function clearToken() {
        sessionStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(USER_KEY);
    }

    // Get user data
    function getUserData() {
        const data = sessionStorage.getItem(USER_KEY);
        return data ? JSON.parse(data) : null;
    }

    // Store user data
    function setUserData(userData) {
        sessionStorage.setItem(USER_KEY, JSON.stringify(userData));
    }

    // Check if user is authenticated
    function isAuthenticated() {
        return !!getToken();
    }

    // Login function
    async function login(username, password) {
        try {
            const response = await $.ajax({
                url: API_BASE_URL + '/auth/login',
                method: 'POST',
                contentType: 'application/json',
                data: JSON.stringify({ username, password }),
                dataType: 'json',
                xhrFields: { withCredentials: true }
            });

            if (response.status === 'success' && response.data && response.data.token) {
                setToken(response.data.token);
                setUserData({
                    username: response.data.username,
                    role: response.data.role
                });
                return { success: true, data: response.data };
            }
            return { success: false, message: response.message || 'Login failed' };
        } catch (error) {
            console.error('Login error:', error);
            return {
                success: false,
                message: error.responseJSON?.message || 'Login failed. Please try again.'
            };
        }
    }

    // Logout function
    function logout() {
        const token = getToken();
        if (token) {
            // Attempt to notify server but don't wait for it (prevent UI lag)
            $.ajax({
                url: API_BASE_URL + '/auth/logout',
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + token },
                timeout: 1000 // Timeout just in case
            }).fail(err => console.error('Background logout failed', err));
        }
        clearToken();
        // Redirect immediately to main page (which shows login form)
        window.location.href = 'index.html';
    }

    // Check session validity
    async function checkSession() {
        const token = getToken();
        if (!token) {
            return { authenticated: false };
        }

        try {
            const response = await $.ajax({
                url: API_BASE_URL + '/auth/check-session',
                method: 'GET',
                headers: { 'Authorization': 'Bearer ' + token },
                dataType: 'json',
                xhrFields: { withCredentials: true }
            });

            // Handle both 'authenticated' and 'loggedin' fields from backend
            const isAuth = response.status === 'success' && response.data && (response.data.authenticated || response.data.loggedin);

            if (isAuth) {
                setUserData({
                    username: response.data.username,
                    role: response.data.role
                });
                // Normalize response to include authenticated property
                return { ...response.data, authenticated: true };
            }
            return { authenticated: false };
        } catch (error) {
            console.error('Session check error:', error);
            clearToken();
            return { authenticated: false };
        }
    }

    // Make authenticated API call
    function apiCall(options) {
        const token = getToken();
        if (!token) {
            // Return a rejected Deferred to be compatible with .fail()
            // Simulating a jqXHR-like error structure
            return $.Deferred().reject({ status: 401, statusText: 'Unauthorized' }, 'error', 'Not authenticated');
        }

        const defaultOptions = {
            headers: { 'Authorization': 'Bearer ' + token },
            dataType: 'json'
        };

        return $.ajax($.extend(true, {}, defaultOptions, options));
    }

    // Require authentication (redirect if not authenticated)
    async function requireAuth(requiredRole = null) {
        // If we are already on login page, don't redirect loop
        if (window.location.pathname.endsWith('login.html')) {
            return;
        }

        const session = await checkSession();

        if (!session.authenticated) {
            // Optional: Store return URL to redirect back after login
            // sessionStorage.setItem('returnUrl', window.location.href);
            window.location.href = 'login.html';
            return false;
        }

        if (requiredRole && session.role !== requiredRole) {
            alert(`Access denied. ${requiredRole} role required.`);
            window.location.href = 'login.html';
            return false;
        }

        return session;
    }

    // Public API
    return {
        API_BASE_URL,
        getToken,
        setToken,
        clearToken,
        getUserData,
        setUserData,
        isAuthenticated,
        login,
        logout,
        checkSession,
        apiCall,
        requireAuth
    };
})();

// Make available globally
window.VaultAuth = VaultAuth;
