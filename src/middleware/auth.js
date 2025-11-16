const jwt = require('jsonwebtoken');
const db = require('../config/database');
const logger = require('../config/logger');

const verifyToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Token manquant ou invalide' });
        }

        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        const [sessions] = await db.query(
            'SELECT * FROM sessions WHERE user_id = ? AND token = ? AND expires_at > NOW()',
            [decoded.id, token]
        );

        if (sessions.length === 0) {
            return res.status(401).json({ error: 'Session expirée ou invalide' });
        }

        const [users] = await db.query(
            'SELECT id, nom, prenom, email, role, is_active FROM users WHERE id = ?',
            [decoded.id]
        );

        if (users.length === 0 || !users[0].is_active) {
            return res.status(401).json({ error: 'Utilisateur non trouvé ou désactivé' });
        }

        req.user = users[0];
        req.token = token;
        next();
    } catch (error) {
        logger.error('Erreur vérification token', { error: error.message });
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expiré' });
        }
        
        return res.status(401).json({ error: 'Token invalide' });
    }
};

const verifyAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Accès refusé : privilèges administrateur requis' });
    }
    next();
};

const verifyOwnerOrAdmin = (req, res, next) => {
    const userId = parseInt(req.params.id || req.params.userId);
    
    if (req.user.role === 'admin' || req.user.id === userId) {
        next();
    } else {
        return res.status(403).json({ error: 'Accès refusé : vous ne pouvez accéder qu\'à vos propres ressources' });
    }
};

module.exports = { verifyToken, verifyAdmin, verifyOwnerOrAdmin };