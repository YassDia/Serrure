import { state } from '../utils/State.js';
import { showNotification } from '../utils/Notifications.js';

export class WebSocketService {
    constructor() {
        this.socket = null;
    }

    connect(token) {
        this.socket = io(state.WS_URL);
        state.socket = this.socket;
        
        this.socket.on('connect', () => {
            console.log('WebSocket connecté');
            this.socket.emit('authenticate', token);
        });
        
        this.socket.on('authenticated', (data) => {
            if (data.success) {
                console.log('WebSocket authentifié');
            }
        });
        
        // Événements métier
        this.socket.on('access_attempt', (data) => {
            this.handleAccessAttempt(data);
        });
        
        this.socket.on('security_alert', (data) => {
            showNotification(`Alerte de sécurité: ${data.type}`, 'error');
            if (window.alertsModule) {
                window.alertsModule.loadAlerts();
            }
        });
        
        this.socket.on('door_offline', (data) => {
            showNotification(`Porte hors ligne: ${data.door_name}`, 'error');
            if (window.doorsModule) {
                window.doorsModule.loadDoors();
            }
        });
        
        this.socket.on('door_online', (data) => {
            showNotification(`Porte reconnectée: ${data.door_name}`, 'success');
            if (window.doorsModule) {
                window.doorsModule.loadDoors();
            }
        });
        
        this.socket.on('group_created', () => {
            if (window.groupsModule) {
                window.groupsModule.loadGroups();
            }
        });
        
        this.socket.on('badge_created', () => {
            if (window.badgesModule) {
                window.badgesModule.loadBadges();
            }
        });
        
        this.socket.on('disconnect', () => {
            console.log('WebSocket déconnecté');
        });
    }

    handleAccessAttempt(data) {
        // Ajouter au log temps réel
        this.addRealtimeLog(data);
        
        // Rafraîchir les stats
        if (window.statsModule) {
            window.statsModule.loadStats();
        }
    }

    addRealtimeLog(data) {
        const container = document.getElementById('realtimeLogs');
        if (!container) return;
        
        const logDiv = document.createElement('div');
        logDiv.className = `log-entry ${data.access_granted ? 'success' : 'danger'}`;
        logDiv.innerHTML = `
            <div class="log-time">${new Date(data.timestamp).toLocaleString()}</div>
            <div class="log-info">
                <strong>${data.user_name || 'Badge inconnu'}</strong> - 
                ${data.access_granted ? 'Accès autorisé' : 'Accès refusé'}
                <br>Badge: <code>${data.badge_uid}</code> | Raison: ${data.reason}
            </div>
        `;
        
        container.insertBefore(logDiv, container.firstChild);
        
        // Garder seulement les 10 derniers logs
        while (container.children.length > 10) {
            container.removeChild(container.lastChild);
        }
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            state.socket = null;
        }
    }
}