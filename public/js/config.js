// Configuration globale de l'application
const CONFIG = {
    API_URL: 'http://localhost:3000/api',
    WS_URL: 'http://localhost:3000'
};

// État global de l'application
const APP_STATE = {
    token: null,
    socket: null,
    currentUser: null,
    isAuthenticated: false
};

// Getters et setters pour l'état
const AppState = {
    getToken() {
        if (!APP_STATE.token) {
            APP_STATE.token = localStorage.getItem('token');
        }
        return APP_STATE.token;
    },
    
    setToken(token) {
        APP_STATE.token = token;
        if (token) {
            localStorage.setItem('token', token);
        } else {
            localStorage.removeItem('token');
        }
    },
    
    getUser() {
        return APP_STATE.currentUser;
    },
    
    setUser(user) {
        APP_STATE.currentUser = user;
    },
    
    getSocket() {
        return APP_STATE.socket;
    },
    
    setSocket(socket) {
        APP_STATE.socket = socket;
    },
    
    isAuthenticated() {
        return APP_STATE.isAuthenticated;
    },
    
    setAuthenticated(value) {
        APP_STATE.isAuthenticated = value;
    },
    
    clear() {
        APP_STATE.token = null;
        APP_STATE.currentUser = null;
        APP_STATE.isAuthenticated = false;
        localStorage.removeItem('token');
    }
};