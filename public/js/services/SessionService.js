import { state } from '../utils/State.js';
import { showNotification } from '../utils/Notifications.js';

export class SessionService {
    constructor() {
        this.checkInterval = null;
        this.CHECK_INTERVAL = 30000; // 30 secondes
    }

    start() {
        this.checkInterval = setInterval(() => {
            this.checkSession();
        }, this.CHECK_INTERVAL);
        
        // Première vérification immédiate
        this.checkSession();
    }

    async checkSession() {
        try {
            const response = await fetch(`${state.API_URL}/auth/verify`, {
                headers: state.getHeaders()
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                if (data.code === 'TIMEOUT' || data.code === 'ADMIN_TIMEOUT') {
                    showNotification('Session expirée par inactivité', 'error');
                    this.handleTimeout();
                } else if (data.code === 'SESSION_EXPIRED') {
                    showNotification('Session expirée', 'error');
                    this.handleTimeout();
                }
            } else if (data.session) {
                this.updateSessionDisplay(data.session);
            }
        } catch (error) {
            console.error('Erreur vérification session:', error);
        }
    }

    updateSessionDisplay(session) {
        const display = document.getElementById('timeoutDisplay');
        const container = document.getElementById('sessionTimeout');
        
        if (!display || !container) return;
        
        if (session.minutes_inactive >= session.timeout_minutes - 5) {
            container.classList.add('timeout-warning');
            display.textContent = `⚠️ Inactivité: ${session.minutes_inactive}/${session.timeout_minutes} min`;
        } else {
            container.classList.remove('timeout-warning');
            display.textContent = `Session active (${session.minutes_inactive} min)`;
        }
    }

    handleTimeout() {
        if (window.app) {
            window.app.logout();
        }
    }

    stop() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }
}