import { state } from '../utils/State.js';
import { showNotification } from '../utils/Notifications.js';

class UsersModule {
    async init() {
        await this.loadUsers();
    }

    async loadUsers() {
        try {
            const response = await fetch(`${state.API_URL}/users`, {
                headers: state.getHeaders()
            });
            
            if (response.ok) {
                const data = await response.json();
                this.renderUsers(data.users);
            }
        } catch (error) {
            console.error('Erreur loadUsers:', error);
            showNotification('Erreur lors du chargement des utilisateurs', 'error');
        }
    }

    renderUsers(users) {
        const tbody = document.querySelector('#usersTable tbody');
        
        if (!users || users.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 40px;">
                        <div class="empty-state">
                            <div class="empty-state-icon">👥</div>
                            <h3>Aucun utilisateur</h3>
                            <p>Ajoutez votre premier utilisateur</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = '';
        
        users.forEach(user => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${user.id}</td>
                <td><strong>${user.prenom} ${user.nom}</strong></td>
                <td>${user.email}</td>
                <td>${user.telephone || '-'}</td>
                <td>
                    <span class="badge ${user.role === 'admin' ? 'badge-warning' : 'badge-info'}">
                        ${user.role}
                    </span>
                </td>
                <td>
                    <span class="badge ${user.is_active ? 'badge-success' : 'badge-danger'}">
                        ${user.is_active ? 'Actif' : 'Inactif'}
                    </span>
                </td>
                <td>
                    <button class="btn-danger" onclick="usersModule.deleteUser(${user.id})">
                        Supprimer
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    async deleteUser(id) {
        if (!confirm('Êtes-vous sûr de vouloir supprimer cet utilisateur ?')) return;
        
        try {
            const response = await fetch(`${state.API_URL}/users/${id}`, {
                method: 'DELETE',
                headers: state.getHeaders()
            });
            
            if (response.ok) {
                await this.loadUsers();
                showNotification('Utilisateur supprimé avec succès', 'success');
            }
        } catch (error) {
            console.error('Erreur deleteUser:', error);
            showNotification('Erreur lors de la suppression', 'error');
        }
    }

    async handleSubmit(formData) {
        try {
            const response = await fetch(`${state.API_URL}/users`, {
                method: 'POST',
                headers: state.getHeaders(),
                body: JSON.stringify(Object.fromEntries(formData))
            });
            
            if (response.ok) {
                await this.loadUsers();
                showNotification('Utilisateur créé avec succès', 'success');
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

const usersModule = new UsersModule();
window.usersModule = usersModule;

export default usersModule;