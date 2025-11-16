import { state } from '../utils/State.js';
import { showNotification } from '../utils/Notifications.js';

class DoorsModule {
    async init() {
        await this.loadDoors();
    }

    async loadDoors() {
        try {
            const response = await fetch(`${state.API_URL}/doors`, {
                headers: state.getHeaders()
            });
            
            if (response.ok) {
                const data = await response.json();
                this.renderDoors(data.doors);
            } else {
                throw new Error('Erreur chargement portes');
            }
        } catch (error) {
            console.error('Erreur loadDoors:', error);
            showNotification('Erreur lors du chargement des portes', 'error');
        }
    }

    renderDoors(doors) {
        const tbody = document.querySelector('#doorsTable tbody');
        
        if (!doors || doors.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 40px;">
                        <div class="empty-state">
                            <div class="empty-state-icon">🚪</div>
                            <h3>Aucune porte</h3>
                            <p>Ajoutez votre première porte</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = '';
        
        doors.forEach(door => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${door.id}</td>
                <td><strong>${door.nom}</strong></td>
                <td>${door.localisation || '-'}</td>
                <td><code>${door.esp32_id}</code></td>
                <td>${door.esp32_ip || '-'}</td>
                <td>
                    <span class="badge ${door.is_online ? 'badge-success' : 'badge-danger'}">
                        ${door.is_online ? '🟢 En ligne' : '🔴 Hors ligne'}
                    </span>
                </td>
                <td>
                    <span class="badge ${door.is_active ? 'badge-success' : 'badge-danger'}">
                        ${door.is_active ? 'Actif' : 'Inactif'}
                    </span>
                </td>
                <td>
                    <button class="btn-danger" onclick="doorsModule.deleteDoor(${door.id})">
                        Supprimer
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    async deleteDoor(id) {
        if (!confirm('Êtes-vous sûr de vouloir supprimer cette porte ?')) return;
        
        try {
            const response = await fetch(`${state.API_URL}/doors/${id}`, {
                method: 'DELETE',
                headers: state.getHeaders()
            });
            
            if (response.ok) {
                await this.loadDoors();
                showNotification('Porte supprimée avec succès', 'success');
            } else {
                throw new Error('Erreur suppression');
            }
        } catch (error) {
            console.error('Erreur deleteDoor:', error);
            showNotification('Erreur lors de la suppression', 'error');
        }
    }

    async handleSubmit(formData) {
        try {
            const response = await fetch(`${state.API_URL}/doors`, {
                method: 'POST',
                headers: state.getHeaders(),
                body: JSON.stringify(Object.fromEntries(formData))
            });
            
            if (response.ok) {
                await this.loadDoors();
                showNotification('Porte créée avec succès', 'success');
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

// Créer instance et exporter
const doorsModule = new DoorsModule();
window.doorsModule = doorsModule;

export default doorsModule;