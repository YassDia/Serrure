import { state } from '../utils/State.js';

export class AuthService {
    async login(email, password) {
        try {
            const response = await fetch(`${state.API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                state.setToken(data.token);
                return {
                    success: true,
                    token: data.token,
                    user: data.user
                };
            } else {
                return {
                    success: false,
                    error: data.error || 'Erreur de connexion'
                };
            }
        } catch (error) {
            console.error('Erreur login:', error);
            return {
                success: false,
                error: 'Erreur de connexion au serveur'
            };
        }
    }

    async verifyToken() {
        try {
            const response = await fetch(`${state.API_URL}/auth/verify`, {
                headers: state.getHeaders()
            });
            
            if (response.ok) {
                const data = await response.json();
                return {
                    success: true,
                    user: data.user
                };
            } else {
                return { success: false };
            }
        } catch (error) {
            console.error('Erreur verifyToken:', error);
            return { success: false };
        }
    }

    async logout() {
        try {
            await fetch(`${state.API_URL}/auth/logout`, {
                method: 'POST',
                headers: state.getHeaders()
            });
        } catch (error) {
            console.error('Erreur logout:', error);
        } finally {
            state.clear();
        }
    }

    async refreshToken() {
        try {
            const response = await fetch(`${state.API_URL}/auth/refresh`, {
                method: 'POST',
                headers: state.getHeaders()
            });
            
            if (response.ok) {
                const data = await response.json();
                state.setToken(data.token);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Erreur refreshToken:', error);
            return false;
        }
    }
}