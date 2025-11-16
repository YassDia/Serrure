const jwt = require('jsonwebtoken');
const User = require('../models/User');
const db = require('../config/database');
const logger = require('../config/logger');

class AuthController {
    
    static async login(req, res) {
        try {
            const { email, password } = req.body;
            
            if (!email || !password) {
                return res.status(400).json({
                    success: false,
                    error: 'Email et mot de passe requis'
                });
            }
            
            const user = await User.findByEmail(email);
            console.log('Requête reçue :', req.body);
            console.log('Utilisateur trouvé :', user);
            
            if (!user || !user.is_active) {
                logger.warn('Tentative de connexion échouée', { email });
                return res.status(401).json({
                    success: false,
                    error: 'Email ou mot de passe incorrect'
                });
            }
            
            if (!user.password_hash) {
                return res.status(401).json({
                    success: false,
                    error: 'Cet utilisateur ne peut pas se connecter'
                });
            }
            
            const isPasswordValid = await User.verifyPassword(password, user.password_hash);
            
            if (!isPasswordValid) {
                logger.warn('Mot de passe incorrect', { email });
                return res.status(401).json({
                    success: false,
                    error: 'Email ou mot de passe incorrect'
                });
            }
            
            // Génération du token JWT
            const token = jwt.sign(
                { id: user.id, email: user.email, role: user.role },
                process.env.JWT_SECRET,
                { expiresIn: process.env.JWT_EXPIRE || '24h' }
            );
            
            // Enregistrement de la session
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 24);
            
            await db.execute(
                'INSERT INTO sessions (user_id, token, ip_address, user_agent, expires_at) VALUES (?, ?, ?, ?, ?)',
                [user.id, token, req.ip, req.get('user-agent'), expiresAt]
            );
            
            logger.info('Connexion réussie', { userId: user.id, email: user.email });
            
            res.json({
                success: true,
                token,
                user: {
                    id: user.id,
                    nom: user.nom,
                    prenom: user.prenom,
                    email: user.email,
                    role: user.role
                }
            });
            
        } catch (error) {
            logger.error('Erreur login', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Erreur lors de la connexion'
            });
        }
    }
    
    static async logout(req, res) {
        try {
            await db.execute('DELETE FROM sessions WHERE token = ?', [req.token]);
            
            logger.info('Déconnexion', { userId: req.user.id });
            
            res.json({
                success: true,
                message: 'Déconnexion réussie'
            });
        } catch (error) {
            logger.error('Erreur logout', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Erreur lors de la déconnexion'
            });
        }
    }
    
    static async verify(req, res) {
        res.json({
            valid: true,
            user: req.user
        });
    }
    
    static async refresh(req, res) {
        try {
            const newToken = jwt.sign(
                { id: req.user.id, email: req.user.email, role: req.user.role },
                process.env.JWT_SECRET,
                { expiresIn: process.env.JWT_EXPIRE || '24h' }
            );
            
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 24);
            
            await db.execute(
                'UPDATE sessions SET token = ?, expires_at = ? WHERE token = ?',
                [newToken, expiresAt, req.token]
            );
            
            res.json({
                success: true,
                token: newToken
            });
        } catch (error) {
            logger.error('Erreur refresh', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Erreur lors du rafraîchissement'
            });
        }
    }
}

module.exports = AuthController;