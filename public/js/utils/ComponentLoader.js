import { state } from './State.js';

export class ComponentLoader {
    constructor() {
        this.componentsPath = 'components/';
        this.modalsPath = 'modals/';
        this.currentTab = null;
    }

    async loadComponent(path, containerId) {
        try {
            const response = await fetch(path);
            if (!response.ok) throw new Error(`Erreur chargement: ${path}`);
            
            const html = await response.text();
            const container = document.getElementById(containerId);
            if (container) {
                container.innerHTML = html;
            }
            
            return true;
        } catch (error) {
            console.error('Erreur chargement composant:', error);
            return false;
        }
    }

    async loadHeader() {
        await this.loadComponent(`${this.componentsPath}header.html`, 'header-container');
        
        // Mettre à jour le nom de l'utilisateur
        const userName = document.getElementById('userName');
        if (userName && state.currentUser) {
            userName.textContent = `${state.currentUser.prenom} ${state.currentUser.nom}`;
        }
    }

    async loadNavigation() {
        await this.loadComponent(`${this.componentsPath}navigation.html`, 'nav-container');
        
        // Ajouter les event listeners pour les onglets avec routing
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                const route = e.currentTarget.getAttribute('data-route');
                if (route && window.appRouter) {
                    window.appRouter.navigate(route);
                }
            });
        });
    }

    async loadModals() {
        const modals = [
            'user-modal.html',
            'group-modal.html',
            'badge-modal.html',
            'door-modal.html',
            'access-modal.html',
            'group-members-modal.html'
        ];

        const container = document.getElementById('modals-container');
        let html = '';

        for (const modal of modals) {
            try {
                const response = await fetch(`${this.modalsPath}${modal}`);
                if (response.ok) {
                    html += await response.text();
                }
            } catch (error) {
                console.error(`Erreur chargement modal ${modal}:`, error);
            }
        }

        container.innerHTML = html;
    }

    async loadTab(tabName) {
        // Désactiver tous les onglets
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('active');
        });

        // Activer l'onglet correspondant à la route
        const routeMap = {
            'stats': '/dashboard',
            'doors': '/doors',
            'users': '/users',
            'groups': '/groups',
            'badges': '/badges',
            'access': '/access',
            'logs': '/logs',
            'alerts': '/alerts'
        };

        const route = routeMap[tabName];
        if (route) {
            const activeTab = document.querySelector(`[data-route="${route}"]`);
            if (activeTab) {
                activeTab.classList.add('active');
            }
        }

        // Charger le contenu de l'onglet
        const success = await this.loadComponent(
            `${this.componentsPath}tabs/${tabName}.html`,
            'content-container'
        );

        if (success) {
            this.currentTab = tabName;
            
            // Charger les données du module
            await this.loadTabData(tabName);
        }
    }

    async loadTabData(tabName) {
        // Importer dynamiquement le module JS correspondant
        try {
            const module = await import(`../modules/${tabName}.js`);
            if (module.default && typeof module.default.init === 'function') {
                await module.default.init();
            }
        } catch (error) {
            console.error(`Erreur chargement module ${tabName}:`, error);
        }
    }

    switchTab(tabName) {
        this.loadTab(tabName);
    }
}