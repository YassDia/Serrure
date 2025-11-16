import { state } from '../utils/State.js';
import { showNotification } from '../utils/Notifications.js';

class BadgesModule {
    async init() {
        await this.loadBadges();
    }

    async loadBadges() {
        try {
            const response = await fetch(`${state.API_URL}/badges`, {
                headers: state.getHeaders()
            });
            
            if (response.ok) {
                const data = await response.json();
                this.renderBadges(data.badges);
            }
        } catch (error) {
            console.error('Erreur loadBadges:', error);
            showNotification('Erreur lors du chargement des badges', 'error');
        }
    }

    renderBadges(badges) {
        const tbody = document.querySelector('#badgesTable tbody');
        
        if (!badges || badges.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 40px;">
                        <div class="empty-state">
                            <div class="empty-state-icon">🎫</div>
                            <h3>Aucun badge</h3>
                            <p>Ajoutez votre premier badge</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = '';
        
        badges.forEach(badge => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${badge.id}</td>
                <td><code>${badge.badge_uid}</code></td>
                <td><strong>${badge.user_name}</strong></td>
                <td>
                    <span class="badge ${badge.is_active ? 'badge-success' : 'badge-danger'}">
                        ${badge.is_active ? 'Actif' : 'Inactif'}
                    </span>
                </td>
                <td>${badge.date_expiration ? new Date(badge.date_expiration).toLocaleDateString() : 'Aucune'}</td>
                <td>
                    <button class="btn-danger" onclick="badgesModule.deleteBadge(${badge.id})">
                        Supprimer
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    async deleteBadge(id) {
        if (!confirm('Êtes-vous sûr de vouloir supprimer ce badge ?')) return;
        
        try {
            const response = await fetch(`${state.API_URL}/badges/${id}`, {
                method: 'DELETE',
                headers: state.getHeaders()
            });
            
            if (response.ok) {
                await this.loadBadges();
                showNotification('Badge supprimé avec succès', 'success');
            }
        } catch (error) {
            console.error('Erreur deleteBadge:', error);
            showNotification('Erreur lors de la suppression', 'error');
        }
    }

    async handleSubmit(formData) {
        try {
            const response = await fetch(`${state.API_URL}/badges`, {
                method: 'POST',
                headers: state.getHeaders(),
                body: JSON.stringify(Object.fromEntries(formData))
            });
            
            if (response.ok) {
                const result = await response.json();
                await this.loadBadges();
                alert(`Badge créé avec succès!\n\nClé de chiffrement: ${result.encryptionKey}\n\n⚠️ Notez cette clé, elle ne sera plus affichée!`);
                return true;
            } else {
                const error = await response.json();
                throw new Error(error.error || 'Erreur création');
            }
        } catch (error) {
            console.error('Erreur handleSubmit:', error);
            showNotification(error.message, 'error');
            return false;
        }
    }
}

const badgesModule = new BadgesModule();
window.badgesModule = badgesModule;

export default badgesModule;