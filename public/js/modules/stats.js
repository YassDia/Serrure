import { state } from '../utils/State.js';
import { showNotification } from '../utils/Notifications.js';

class StatsModule {
    async init() {
        await this.loadStats();
    }

    async loadStats() {
        try {
            // Charger les statistiques d'accès
            const response = await fetch(`${state.API_URL}/logs/stats`, {
                headers: state.getHeaders()
            });
            
            if (response.ok) {
                const data = await response.json();
                document.getElementById('totalAccess').textContent = data.stats.total || 0;
                document.getElementById('authorizedAccess').textContent = data.stats.authorized || 0;
                document.getElementById('deniedAccess').textContent = data.stats.denied || 0;
            }
            
            // Charger le nombre de badges actifs
            const badgesResponse = await fetch(`${state.API_URL}/badges?is_active=true`, {
                headers: state.getHeaders()
            });
            
            if (badgesResponse.ok) {
                const badgesData = await badgesResponse.json();
                document.getElementById('activeBadges').textContent = badgesData.badges.length;
            }
        } catch (error) {
            console.error('Erreur loadStats:', error);
            showNotification('Erreur lors du chargement des statistiques', 'error');
        }
    }
}

const statsModule = new StatsModule();
window.statsModule = statsModule;

export default statsModule;