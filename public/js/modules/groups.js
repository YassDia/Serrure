import { state } from '../utils/State.js';
import { showNotification } from '../utils/Notifications.js';

class GroupsModule {
    async init() {
        await this.loadGroups();
    }

    async loadGroups() {
        try {
            const response = await fetch(`${state.API_URL}/groups`, {
                headers: state.getHeaders()
            });
            
            if (response.ok) {
                const data = await response.json();
                this.renderGroups(data.groups);
            }
        } catch (error) {
            console.error('Erreur loadGroups:', error);
            showNotification('Erreur lors du chargement des groupes', 'error');
        }
    }

    renderGroups(groups) {
        const tbody = document.querySelector('#groupsTable tbody');
        
        if (!groups || groups.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 40px;">
                        <div class="empty-state">
                            <div class="empty-state-icon">👨‍👩‍👧‍👦</div>
                            <h3>Aucun groupe</h3>
                            <p>Créez votre premier groupe</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = '';
        
        groups.forEach(group => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${group.id}</td>
                <td>
                    <span class="group-color-preview" style="background: ${group.couleur}"></span>
                    <strong>${group.nom}</strong>
                </td>
                <td>${group.description || '-'}</td>
                <td>
                    <span class="member-count">${group.member_count || 0} membres</span>
                </td>
                <td>
                    <span class="badge badge-info">${group.access_rights_count || 0} droits</span>
                </td>
                <td>
                    <span class="badge ${group.is_active ? 'badge-success' : 'badge-danger'}">
                        ${group.is_active ? 'Actif' : 'Inactif'}
                    </span>
                </td>
                <td>
                    <div class="btn-group">
                        <button class="btn-success" onclick="groupsModule.viewMembers(${group.id}, '${group.nom.replace(/'/g, "\\'")}')">
                            👥 Membres
                        </button>
                        <button class="btn-danger" onclick="groupsModule.deleteGroup(${group.id})">
                            Supprimer
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    async viewMembers(groupId, groupName) {
        state.currentGroupId = groupId;
        document.getElementById('groupMemberTitle').textContent = groupName;
        
        try {
            const response = await fetch(`${state.API_URL}/groups/${groupId}/members`, {
                headers: state.getHeaders()
            });
            
            if (response.ok) {
                const data = await response.json();
                this.renderMembers(data.members, groupId);
                window.openModal('groupMembersModal');
            }
        } catch (error) {
            console.error('Erreur viewMembers:', error);
        }
    }

    renderMembers(members, groupId) {
        const tbody = document.querySelector('#groupMembersTable tbody');
        
        if (!members || members.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Aucun membre</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        
        members.forEach(member => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${member.prenom} ${member.nom}</td>
                <td>${member.email}</td>
                <td>${new Date(member.added_at).toLocaleDateString()}</td>
                <td>
                    <button class="btn-danger" onclick="groupsModule.removeMember(${groupId}, ${member.id})">
                        Retirer
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    async removeMember(groupId, userId) {
        if (!confirm('Retirer ce membre du groupe ?')) return;
        
        try {
            const response = await fetch(`${state.API_URL}/groups/${groupId}/members/${userId}`, {
                method: 'DELETE',
                headers: state.getHeaders()
            });
            
            if (response.ok) {
                const groupName = document.getElementById('groupMemberTitle').textContent;
                await this.viewMembers(groupId, groupName);
                await this.loadGroups();
                showNotification('Membre retiré avec succès', 'success');
            }
        } catch (error) {
            console.error('Erreur removeMember:', error);
            showNotification('Erreur lors du retrait', 'error');
        }
    }

    async deleteGroup(id) {
        if (!confirm('Êtes-vous sûr de vouloir supprimer ce groupe ?')) return;
        
        try {
            const response = await fetch(`${state.API_URL}/groups/${id}`, {
                method: 'DELETE',
                headers: state.getHeaders()
            });
            
            if (response.ok) {
                await this.loadGroups();
                showNotification('Groupe supprimé avec succès', 'success');
            }
        } catch (error) {
            console.error('Erreur deleteGroup:', error);
            showNotification('Erreur lors de la suppression', 'error');
        }
    }

    async handleSubmit(formData) {
        try {
            const response = await fetch(`${state.API_URL}/groups`, {
                method: 'POST',
                headers: state.getHeaders(),
                body: JSON.stringify(Object.fromEntries(formData))
            });
            
            if (response.ok) {
                await this.loadGroups();
                showNotification('Groupe créé avec succès', 'success');
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

const groupsModule = new GroupsModule();
window.groupsModule = groupsModule;

export default groupsModule;