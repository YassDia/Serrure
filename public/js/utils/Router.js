export class Router {
    constructor(componentLoader) {
        this.componentLoader = componentLoader;
        this.routes = {
            '/': 'stats',
            '/dashboard': 'stats',
            '/doors': 'doors',
            '/users': 'users',
            '/groups': 'groups',
            '/badges': 'badges',
            '/access': 'access',
            '/logs': 'logs',
            '/alerts': 'alerts'
        };
        
        this.init();
    }

    init() {
        // Gérer les clics sur les liens
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-route]')) {
                e.preventDefault();
                const route = e.target.getAttribute('data-route');
                this.navigate(route);
            }
        });

        // Gérer le bouton retour du navigateur
        window.addEventListener('popstate', () => {
            this.loadCurrentRoute();
        });

        // Charger la route initiale
        this.loadCurrentRoute();
    }

    navigate(path) {
        // Mettre à jour l'URL sans recharger la page
        window.history.pushState({}, '', path);
        
        // Charger le contenu correspondant
        this.loadCurrentRoute();
    }

    loadCurrentRoute() {
        const path = window.location.pathname;
        const tabName = this.routes[path] || this.routes['/'];
        
        if (this.componentLoader) {
            this.componentLoader.loadTab(tabName);
        }
    }

    getCurrentTab() {
        const path = window.location.pathname;
        return this.routes[path] || 'stats';
    }
}

// Fonction helper pour la navigation
window.navigateTo = (path) => {
    if (window.appRouter) {
        window.appRouter.navigate(path);
    }
};