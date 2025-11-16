import { state } from '../utils/State.js';
import { showNotification } from '../utils/Notifications.js';

class AlertsModule {
    async init() {
        await this.loadAlerts();
    }

    async loadAlerts() {
        try {
            const response = await fetch(`${state.API_URL}/alerts?is_read=false`, {
                headers: state.getHeaders()
            });
            
            if (response.ok) {
                const data = await response.json();
                this.renderAlerts(data.alerts);
            }
        } catch (error) {
            console.error('Erreur loadAlerts:', error);
            showNotification('Erreur lors du chargement des alertes', 'error');
        }
    }

    renderAlerts(alerts) {
        const container = document.getElementById('alertsList');
        
        if (!alerts || alerts.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">✅</div>
                    <h3>Aucune alerte</h3>
                    <p>Tout est en ordre</p>
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        
        alerts.forEach(alert => {
            const alertDiv = document.createElement('div');
            alertDiv.className = 'log-entry danger';
            alertDiv.innerHTML = `
                <div class="log-time">${new Date(alert.created_at).toLocaleString()}</div>
                <div class="log-info">
                    <strong>${alert.type}</strong> - ${alert.message}
                    ${alert.door_name ? `<br>Porte: ${alert.door_name}` : ''}
                </div>
                <button class="btn-success" onclick="alertsModule.markAlertRead(${alert.id})" style="margin-top: 10px;">
                    Marquer comme lu
                </button>
            `;
            container.appendChild(alertDiv);
        });
    }

    async markAlertRead(id) {
        try {
            await fetch(`${state.API_URL}/alerts/${id}/read`, {
                method: 'PATCH',
                headers: state.getHeaders()
            });
            await this.loadAlerts();
        } catch (error) {
            console.error('Erreur markAlertRead:', error);
        }
    }

    async markAllAlertsRead() {
        try {
            await fetch(`${state.API_URL}/alerts/read-all`, {
                method: 'PATCH',
                headers: state.getHeaders()
            });
            await this.loadAlerts();
            showNotification('Toutes les alertes ont été marquées comme lues', 'success');
        } catch (error) {
            console.error('Erreur markAllAlertsRead:', error);
            showNotification('Erreur lors de la mise à jour', 'error');
        }
    }
}

const alertsModule = new AlertsModule();
window.alertsModule = alertsModule;

// Exporter la fonction pour le bouton "Tout marquer comme lu"
window.markAllAlertsRead = () => alertsModule.markAllAlertsRead();

export default alertsModule;