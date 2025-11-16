import { state } from '../utils/State.js';
import { showNotification } from '../utils/Notifications.js';

class LogsModule {
    async init() {
        await this.loadLogs();
    }

    async loadLogs() {
        try {
            const response = await fetch(`${state.API_URL}/logs?limit=100`, {
                headers: state.getHeaders()
            });
            
            if (response.ok) {
                const data = await response.json();
                this.renderLogs(data.logs);
            }
        } catch (error) {
            console.error('Erreur loadLogs:', error);
            showNotification('Erreur lors du chargement des logs', 'error');
        }
    }

    renderLogs(logs) {
        const tbody = document.querySelector('#logsTable tbody');
        
        if (!logs || logs.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 40px;">
                        <div class="empty-state">
                            <div class="empty-state-icon">📜</div>
                            <h3>Aucun log</h3>
                            <p>Les tentatives d'accès apparaîtront ici</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = '';
        
        logs.forEach(log => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${new Date(log.access_datetime).toLocaleString()}</td>
                <td><strong>${log.user_name || 'Inconnu'}</strong></td>
                <td><code>${log.badge_uid}</code></td>
                <td>${log.door_name}</td>
                <td>
                    <span class="badge ${log.access_granted ? 'badge-success' : 'badge-danger'}">
                        ${log.access_granted ? 'Autorisé' : 'Refusé'}
                    </span>
                </td>
                <td>${log.reason}</td>
            `;
            tbody.appendChild(row);
        });
    }
}

const logsModule = new LogsModule();
window.logsModule = logsModule;

export default logsModule;