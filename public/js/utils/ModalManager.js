import { state } from './State.js';
import { showNotification } from './Notifications.js';

export class ModalManager {
    constructor() {
        this.init();
    }

    init() {
        // Attendre que le DOM soit chargé
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupEventListeners());
        } else {
            this.setupEventListeners();
        }
    }

    setupEventListeners() {
        console.log('ModalManager: Configuration des event listeners');
        
        // Event delegation pour les formulaires dans les modals
        document.addEventListener('submit', async (e) => {
            const form = e.target;
            
            // Vérifier si c'est un formulaire dans un modal
            if (form.tagName === 'FORM' && form.closest('.modal')) {
                e.preventDefault();
                e.stopPropagation();
                
                console.log('Form submit détecté:', form.id);
                await this.handleFormSubmit(form);
            }
        });

        // Fermer modal en cliquant sur le fond
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                const modalId = e.target.id;
                if (modalId) {
                    this.closeModal(modalId);
                }
            }
        });

        // Fermer modal avec Échap
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const activeModal = document.querySelector('.modal.active');
                if (activeModal) {
                    this.closeModal(activeModal.id);
                }
            }
        });
    }

    async handleFormSubmit(form) {
        const formId = form.id;
        const formData = new FormData(form);
        
        console.log('Traitement du formulaire:', formId);
        console.log('Données:', Object.fromEntries(formData));
        
        let module = null;
        let modalId = null;

        // Déterminer le module et modal correspondants
        switch(formId) {
            case 'userForm':
                module = window.usersModule;
                modalId = 'userModal';
                break;
            case 'groupForm':
                module = window.groupsModule;
                modalId = 'groupModal';
                break;
            case 'addMemberForm':
                return await this.handleAddMember(formData);
            case 'badgeForm':
                module = window.badgesModule;
                modalId = 'badgeModal';
                break;
            case 'doorForm':
                module = window.doorsModule;
                modalId = 'doorModal';
                break;
            case 'accessForm':
                module = window.accessModule;
                modalId = 'accessModal';
                break;
            default:
                console.warn('Formulaire non reconnu:', formId);
                return;
        }

        if (module && modalId) {
            try {
                console.log('Appel du module.handleSubmit pour', formId);
                const success = await module.handleSubmit(formData);
                
                if (success) {
                    this.closeModal(modalId);
                    form.reset();
                }
            } catch (error) {
                console.error('Erreur lors du traitement du formulaire:', error);
                showNotification('Erreur lors de la soumission: ' + error.message, 'error');
            }
        } else {
            console.error('Module ou modalId non trouvé pour', formId);
        }
    }

    async handleAddMember(formData) {
        const user_id = formData.get('user_id');
        
        try {
            const response = await fetch(`${state.API_URL}/groups/${state.currentGroupId}/members`, {
                method: 'POST',
                headers: state.getHeaders(),
                body: JSON.stringify({ user_id })
            });
            
            if (response.ok) {
                this.closeModal('addMemberModal');
                const groupName = document.getElementById('groupMemberTitle')?.textContent;
                if (window.groupsModule) {
                    await window.groupsModule.viewMembers(state.currentGroupId, groupName);
                    await window.groupsModule.loadGroups();
                }
                showNotification('Membre ajouté avec succès', 'success');
                return true;
            } else {
                const error = await response.json();
                showNotification(error.error || 'Erreur lors de l\'ajout', 'error');
            }
        } catch (error) {
            console.error('Erreur handleAddMember:', error);
            showNotification('Erreur lors de l\'ajout du membre', 'error');
        }
        return false;
    }

    openModal(modalId) {
        console.log('Ouverture du modal:', modalId);
        const modal = document.getElementById(modalId);
        
        if (!modal) {
            console.error('Modal non trouvé:', modalId);
            return;
        }
        
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // Charger les données nécessaires
        this.loadModalData(modalId);
    }

    closeModal(modalId) {
        console.log('Fermeture du modal:', modalId);
        const modal = document.getElementById(modalId);
        
        if (!modal) {
            console.error('Modal non trouvé:', modalId);
            return;
        }
        
        modal.classList.remove('active');
        document.body.style.overflow = '';
        
        // Réinitialiser le formulaire
        const form = modal.querySelector('form');
        if (form) {
            form.reset();
        }
    }

    async loadModalData(modalId) {
        console.log('Chargement des données pour:', modalId);
        
        switch(modalId) {
            case 'badgeModal':
                await this.loadUsersForSelect('badgeUserId');
                break;
            case 'accessModal':
                await this.loadBadgesForSelect('accessBadgeId');
                await this.loadGroupsForSelect('accessGroupId');
                await this.loadDoorsForSelect('accessDoorId');
                break;
            case 'addMemberModal':
                await this.loadUsersForSelect('memberUserId');
                break;
        }
    }

    async loadUsersForSelect(selectId) {
        try {
            const response = await fetch(`${state.API_URL}/users`, {
                headers: state.getHeaders()
            });
            
            if (response.ok) {
                const data = await response.json();
                const select = document.getElementById(selectId);
                if (select) {
                    select.innerHTML = '<option value="">Sélectionner un utilisateur</option>';
                    data.users.forEach(user => {
                        select.innerHTML += `<option value="${user.id}">${user.prenom} ${user.nom} (${user.email})</option>`;
                    });
                }
            }
        } catch (error) {
            console.error('Erreur loadUsersForSelect:', error);
        }
    }

    async loadBadgesForSelect(selectId) {
        try {
            const response = await fetch(`${state.API_URL}/badges`, {
                headers: state.getHeaders()
            });
            
            if (response.ok) {
                const data = await response.json();
                const select = document.getElementById(selectId);
                if (select) {
                    select.innerHTML = '<option value="">Sélectionner un badge</option>';
                    data.badges.forEach(badge => {
                        select.innerHTML += `<option value="${badge.id}">${badge.user_name} (${badge.badge_uid})</option>`;
                    });
                }
            }
        } catch (error) {
            console.error('Erreur loadBadgesForSelect:', error);
        }
    }

    async loadGroupsForSelect(selectId) {
        try {
            const response = await fetch(`${state.API_URL}/groups`, {
                headers: state.getHeaders()
            });
            
            if (response.ok) {
                const data = await response.json();
                const select = document.getElementById(selectId);
                if (select) {
                    select.innerHTML = '<option value="">Sélectionner un groupe</option>';
                    data.groups.forEach(group => {
                        select.innerHTML += `<option value="${group.id}">${group.nom} (${group.member_count || 0} membres)</option>`;
                    });
                }
            }
        } catch (error) {
            console.error('Erreur loadGroupsForSelect:', error);
        }
    }

    async loadDoorsForSelect(selectId) {
        try {
            const response = await fetch(`${state.API_URL}/doors`, {
                headers: state.getHeaders()
            });
            
            if (response.ok) {
                const data = await response.json();
                const select = document.getElementById(selectId);
                if (select) {
                    select.innerHTML = '<option value="">Sélectionner une porte</option>';
                    data.doors.forEach(door => {
                        select.innerHTML += `<option value="${door.id}">${door.nom} - ${door.localisation || door.esp32_id}</option>`;
                    });
                }
            }
        } catch (error) {
            console.error('Erreur loadDoorsForSelect:', error);
        }
    }
}

// Créer l'instance et exporter
const modalManager = new ModalManager();

// Exporter pour usage global
window.openModal = (id) => modalManager.openModal(id);
window.closeModal = (id) => modalManager.closeModal(id);

// Fonctions utilitaires
window.togglePasswordField = function() {
    const role = document.getElementById('userRole')?.value;
    const passwordGroup = document.getElementById('passwordGroup');
    const passwordInput = passwordGroup?.querySelector('input');
    
    if (role === 'admin') {
        if (passwordGroup) passwordGroup.style.display = 'block';
        if (passwordInput) passwordInput.required = true;
    } else {
        if (passwordGroup) passwordGroup.style.display = 'none';
        if (passwordInput) passwordInput.required = false;
    }
};

window.toggleAccessType = function() {
    const type = document.getElementById('accessType')?.value;
    const badgeGroup = document.getElementById('badgeSelectGroup');
    const groupGroup = document.getElementById('groupSelectGroup');
    const badgeSelect = document.getElementById('accessBadgeId');
    const groupSelect = document.getElementById('accessGroupId');
    
    if (type === 'badge') {
        if (badgeGroup) badgeGroup.style.display = 'block';
        if (groupGroup) groupGroup.style.display = 'none';
        if (badgeSelect) badgeSelect.required = true;
        if (groupSelect) groupSelect.required = false;
    } else if (type === 'group') {
        if (badgeGroup) badgeGroup.style.display = 'none';
        if (groupGroup) groupGroup.style.display = 'block';
        if (badgeSelect) badgeSelect.required = false;
        if (groupSelect) groupSelect.required = true;
    }
};

window.openAddMemberModal = function() {
    modalManager.openModal('addMemberModal');
};

console.log('ModalManager chargé et initialisé');

export default modalManager;