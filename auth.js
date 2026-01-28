/**
 * Centralized Authentication Utility for Vault
 * Handles JWT token management and API authentication
 */

const VaultAuth = (function () {
    const API_BASE_URL = 'http://localhost:8089';
    const TOKEN_KEY = 'jwt_token';
    const USER_KEY = 'user_data';

    // Get stored JWT token
    function getToken() {
        return localStorage.getItem(TOKEN_KEY);
    }

    // Store JWT token
    function setToken(token) {
        localStorage.setItem(TOKEN_KEY, token);
    }

    // Remove JWT token
    function clearToken() {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
    }

    // Get user data
    function getUserData() {
        const data = localStorage.getItem(USER_KEY);
        return data ? JSON.parse(data) : null;
    }

    // Store user data
    function setUserData(userData) {
        localStorage.setItem(USER_KEY, JSON.stringify(userData));
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
                dataType: 'json'
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
    async function logout() {
        try {
            const token = getToken();
            if (token) {
                await $.ajax({
                    url: API_BASE_URL + '/auth/logout',
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + token },
                    dataType: 'json'
                });
            }
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            clearToken();
            window.location.href = 'index.html';
        }
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
                dataType: 'json'
            });

            if (response.status === 'success' && response.data && response.data.authenticated) {
                setUserData({
                    username: response.data.username,
                    role: response.data.role
                });
                return response.data;
            }
            return { authenticated: false };
        } catch (error) {
            console.error('Session check error:', error);
            clearToken();
            return { authenticated: false };
        }
    }

    // Make authenticated API call
    async function apiCall(options) {
        const token = getToken();
        if (!token) {
            throw new Error('Not authenticated');
        }

        const defaultOptions = {
            headers: { 'Authorization': 'Bearer ' + token },
            dataType: 'json'
        };

        return $.ajax($.extend(true, {}, defaultOptions, options));
    }

    // Require authentication (redirect if not authenticated)
    async function requireAuth(requiredRole = null) {
        const session = await checkSession();

        if (!session.authenticated) {
            alert('Please login first');
            window.location.href = 'index.html';
            return false;
        }

        if (requiredRole && session.role !== requiredRole) {
            alert(`Access denied. ${requiredRole} role required.`);
            window.location.href = 'index.html';
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
