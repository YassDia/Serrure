export const state = {
    token: null,
    currentUser: null,
    socket: null,
    currentGroupId: null,
    
    // Configuration API - MAINTENANT EN HTTP
    API_URL: 'http://localhost:3000/api',
    WS_URL: 'http://localhost:3000',
    
    // Getters
    getToken() {
        if (!this.token) {
            this.token = localStorage.getItem('token');
        }
        return this.token;
    },
    
    setToken(token) {
        this.token = token;
        if (token) {
            localStorage.setItem('token', token);
        } else {
            localStorage.removeItem('token');
        }
    },
    
    getHeaders() {
        return {
            'Authorization': `Bearer ${this.getToken()}`,
            'Content-Type': 'application/json'
        };
    },
    
    clear() {
        this.token = null;
        this.currentUser = null;
        this.socket = null;
        this.currentGroupId = null;
        localStorage.removeItem('token');
    }
};