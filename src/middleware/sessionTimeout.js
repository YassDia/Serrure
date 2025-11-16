const jwt = require('jsonwebtoken');
const db = require('../config/database');
const logger = require('../config/logger');

/**
 * Middleware de vérification du token avec gestion du timeout d'inactivité
 */
const verifyTokenWithTimeout = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ 
                error: 'Token manquant ou invalide',
                code: 'NO_TOKEN'
            });
        }

        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Récupérer la session
        const [sessions] = await db.query(
            `SELECT s.*, 
                    TIMESTAMPDIFF(MINUTE, s.last_activity, NOW()) as minutes_inactive
             FROM sessions s 
             WHERE s.user_id = ? 
             AND s.token = ? 
             AND s.expires_at > NOW()`,
            [decoded.id, token]
        );

        if (sessions.length === 0) {
            return res.status(401).json({ 
                error: 'Session expirée ou invalide',
                code: 'SESSION_EXPIRED'
            });
        }

        const session = sessions[0];
        
        // Vérifier le timeout d'inactivité
        const timeoutMinutes = session.auto_logout_minutes || 30; // 30 minutes par défaut
        
        if (session.minutes_inactive > timeoutMinutes) {
            // Session expirée par inactivité - supprimer la session
            await db.execute('DELETE FROM sessions WHERE id = ?', [session.id]);
            
            logger.info('Session expirée par inactivité', {
                userId: decoded.id,
                minutesInactive: session.minutes_inactive,
                timeoutMinutes
            });
            
            return res.status(401).json({ 
                error: 'Session expirée par inactivité',
                code: 'TIMEOUT',
                minutes_inactive: session.minutes_inactive
            });
        }

        // Mettre à jour le last_activity
        await db.execute(
            'UPDATE sessions SET last_activity = NOW() WHERE id = ?',
            [session.id]
        );

        // Récupérer l'utilisateur
        const [users] = await db.query(
            'SELECT id, nom, prenom, email, role, is_active FROM users WHERE id = ?',
            [decoded.id]
        );

        if (users.length === 0 || !users[0].is_active) {
            return res.status(401).json({ 
                error: 'Utilisateur non trouvé ou désactivé',
                code: 'USER_DISABLED'
            });
        }

        req.user = users[0];
        req.token = token;
        req.session = {
            id: session.id,
            minutes_inactive: session.minutes_inactive,
            timeout_minutes: timeoutMinutes,
            last_activity: session.last_activity
        };
        
        next();
    } catch (error) {
        logger.error('Erreur vérification token', { error: error.message });
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                error: 'Token expiré',
                code: 'TOKEN_EXPIRED'
            });
        }
        
        return res.status(401).json({ 
            error: 'Token invalide',
            code: 'INVALID_TOKEN'
        });
    }
};

/**
 * Middleware pour vérifier si l'admin est toujours actif
 */
const checkAdminTimeout = async (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return next();
    }
    
    // Pour les admins, vérifier plus fréquemment
    const timeoutMinutes = 15; // 15 minutes pour les admins
    
    if (req.session && req.session.minutes_inactive > timeoutMinutes) {
        await db.execute('DELETE FROM sessions WHERE id = ?', [req.session.id]);
        
        return res.status(401).json({ 
            error: 'Session administrateur expirée par inactivité',
            code: 'ADMIN_TIMEOUT',
            minutes_inactive: req.session.minutes_inactive
        });
    }
    
    next();
};

/**
 * Tâche planifiée pour nettoyer les sessions expirées
 */
const cleanupExpiredSessions = async () => {
    try {
        const [result] = await db.execute(
            `DELETE FROM sessions 
             WHERE expires_at < NOW() 
             OR (auto_logout_minutes IS NOT NULL 
                 AND last_activity < DATE_SUB(NOW(), INTERVAL auto_logout_minutes MINUTE))`
        );
        
        if (result.affectedRows > 0) {
            logger.info('Sessions expirées nettoyées', { 
                count: result.affectedRows 
            });
        }
    } catch (error) {
        logger.error('Erreur nettoyage sessions', { error: error.message });
    }
};

/**
 * Démarrer le nettoyage automatique des sessions
 */
const startSessionCleanup = () => {
    // Nettoyer toutes les 5 minutes
    const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
    
    setInterval(cleanupExpiredSessions, CLEANUP_INTERVAL);
    
    // Nettoyage immédiat au démarrage
    cleanupExpiredSessions();
    
    logger.info('Service de nettoyage des sessions démarré', {
        intervalMinutes: 5
    });
};

/**
 * Configurer le timeout pour une session spécifique
 */
const setSessionTimeout = async (sessionId, minutes) => {
    try {
        await db.execute(
            'UPDATE sessions SET auto_logout_minutes = ? WHERE id = ?',
            [minutes, sessionId]
        );
        return true;
    } catch (error) {
        logger.error('Erreur configuration timeout', { error: error.message });
        return false;
    }
};

/**
 * Obtenir les informations de session
 */
const getSessionInfo = async (token) => {
    try {
        const [sessions] = await db.query(
            `SELECT id, user_id, last_activity, auto_logout_minutes, expires_at,
                    TIMESTAMPDIFF(MINUTE, last_activity, NOW()) as minutes_inactive
             FROM sessions 
             WHERE token = ?`,
            [token]
        );
        
        return sessions[0] || null;
    } catch (error) {
        logger.error('Erreur récupération session', { error: error.message });
        return null;
    }
};

module.exports = {
    verifyToken: verifyTokenWithTimeout,
    checkAdminTimeout,
    cleanupExpiredSessions,
    startSessionCleanup,
    setSessionTimeout,
    getSessionInfo
};