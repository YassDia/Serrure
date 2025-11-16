import { state } from '../utils/State.js';
import { showNotification } from '../utils/Notifications.js';

class AccessModule {
    async init() {
        await this.loadAccessRights();
    }

    async loadAccessRights() {
        try {
            const response = await fetch(`${state.API_URL}/access`, {
                headers: state.getHeaders()
            });
            
            if (response.ok) {
                const data = await response.json();
                this.renderAccessRights(data.accessRights);
            }
        } catch (error) {
            console.error('Erreur loadAccessRights:', error);
            showNotification('Erreur lors du chargement des droits d\'accès', 'error');
        }
    }

    renderAccessRights(accessRights) {
        const tbody = document.querySelector('#accessTable tbody');
        
        if (!accessRights || accessRights.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 40px;">
                        <div class="empty-state">
                            <div class="empty-state-icon">🔑</div>
                            <h3>Aucun droit d'accès</h3>
                            <p>Configurez votre premier droit d'accès</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = '';
        
        accessRights.forEach(access => {
            const jours = access.jours_semaine.split(',').map(j => {
                const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
                return days[parseInt(j) - 1];
            }).join(', ');
            
            const type = access.access_type === 'group' ? 'Groupe' : 'Badge';
            const name = access.access_type === 'group' ? access.group_name : access.user_name;
            const typeBadge = access.access_type === 'group' ? 'badge-info' : 'badge-success';
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <span class="badge ${typeBadge}">${type}</span>
                </td>
                <td><strong>${name}</strong></td>
                <td>${access.door_name}</td>
                <td>${access.heure_debut} - ${access.heure_fin}</td>
                <td>${jours}</td>
                <td>
                    <span class="badge ${access.is_active ? 'badge-success' : 'badge-danger'}">
                        ${access.is_active ? 'Actif' : 'Inactif'}
                    </span>
                </td>
                <td>
                    <button class="btn-danger" onclick="accessModule.deleteAccessRight(${access.id})">
                        Supprimer
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    async deleteAccessRight(id) {
        if (!confirm('Êtes-vous sûr de vouloir supprimer ce droit d\'accès ?')) return;
        
        try {
            const response = await fetch(`${state.API_URL}/access/${id}`, {
                method: 'DELETE',
                headers: state.getHeaders()
            });
            
            if (response.ok) {
                await this.loadAccessRights();
                showNotification('Droit d\'accès supprimé avec succès', 'success');
            }
        } catch (error) {
            console.error('Erreur deleteAccessRight:', error);
            showNotification('Erreur lors de la suppression', 'error');
        }
    }

    async handleSubmit(formData) {
        try {
            const data = Object.fromEntries(formData);
            
            // Récupérer les jours sélectionnés
            const jours = Array.from(document.querySelectorAll('#accessModal input[type="checkbox"]:checked'))
                .map(cb => cb.value)
                .join(',');
            
            data.jours_semaine = jours || '1,2,3,4,5,6,7';
            
            // Convertir les heures au format HH:MM:SS
            if (data.heure_debut) data.heure_debut += ':00';
            if (data.heure_fin) data.heure_fin += ':59';
            
            const response = await fetch(`${state.API_URL}/access`, {
                method: 'POST',
                headers: state.getHeaders(),
                body: JSON.stringify(data)
            });
            
            if (response.ok) {
                await this.loadAccessRights();
                showNotification('Droit d\'accès créé avec succès', 'success');
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

const accessModule = new AccessModule();
window.accessModule = accessModule;

export default accessModule;