import { AuthService } from './services/AuthService.js';
import { WebSocketService } from './services/WebSocketService.js';
import { SessionService } from './services/SessionService.js';
import { ComponentLoader } from './utils/ComponentLoader.js';
import { Router } from './utils/Router.js';
import { state } from './utils/State.js';
import modalManager from './utils/ModalManager.js';

class App {
    constructor() {
        this.authService = new AuthService();
        this.wsService = new WebSocketService();
        this.sessionService = new SessionService();
        this.componentLoader = new ComponentLoader();
        this.router = null;
        
        this.init();
    }

    async init() {
        // Vérifier si l'utilisateur est déjà connecté
        const token = localStorage.getItem('token');
        
        if (token) {
            state.token = token;
            await this.verifyToken();
        }

        // Gestionnaires d'événements
        this.setupEventListeners();
    }

    setupEventListeners() {
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        
        const email = document.getElementById('email').value.trim().toLowerCase();
        const password = document.getElementById('password').value;
        
        const result = await this.authService.login(email, password);
        
        if (result.success) {
            state.token = result.token;
            state.currentUser = result.user;
            await this.showDashboard();
        } else {
            this.showAlert('loginAlert', result.error, 'error');
        }
    }

    async verifyToken() {
        const result = await this.authService.verifyToken();
        
        if (result.success) {
            state.currentUser = result.user;
            await this.showDashboard();
        } else {
            this.logout();
        }
    }

    async showDashboard() {
        document.getElementById('loginPage').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';

        // Charger les composants
        await this.componentLoader.loadHeader();
        await this.componentLoader.loadNavigation();
        await this.componentLoader.loadModals();
        
        // Le ModalManager est déjà initialisé via l'import
        console.log('ModalManager importé:', modalManager);
        
        // Initialiser le router
        this.router = new Router(this.componentLoader);
        window.appRouter = this.router;

        // Initialiser WebSocket
        this.wsService.connect(state.token);

        // Démarrer le monitoring de session
        this.sessionService.start();
    }

    logout() {
        this.authService.logout();
        this.wsService.disconnect();
        this.sessionService.stop();
        
        // Réinitialiser l'URL
        window.history.pushState({}, '', '/');
        
        document.getElementById('dashboard').style.display = 'none';
        document.getElementById('loginPage').style.display = 'block';
    }

    showAlert(elementId, message, type) {
        const alert = document.getElementById(elementId);
        alert.className = `alert alert-${type}`;
        alert.textContent = message;
        alert.style.display = 'block';
        
        setTimeout(() => {
            alert.style.display = 'none';
        }, 5000);
    }
}

// Initialiser l'application
window.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});

// Exporter pour utilisation globale
window.logout = () => window.app.logout();