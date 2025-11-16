const Badge = require('../models/Badge');
const crypto = require('crypto');
const loggerBadge = require('../config/logger');

class BadgeController {
    
    // Générer clé de chiffrement unique
    static generateEncryptionKey(badgeUid) {
        const masterKey = process.env.MASTER_ENCRYPTION_KEY;
        const timestamp = Date.now();
        const random = crypto.randomBytes(16).toString('hex');
        
        return crypto
            .createHash('sha256')
            .update(`${masterKey}:${badgeUid}:${timestamp}:${random}`)
            .digest('hex');
    }
    
    static async getAllBadges(req, res) {
        try {
            const { user_id, is_active, page = 1, limit = 10 } = req.query;
            const offset = (page - 1) * limit;
            
            const filters = { user_id, is_active, limit, offset };
            const badges = await Badge.findAll(filters);
            const total = await Badge.count({ user_id, is_active });
            
            res.json({
                success: true,
                badges,
                pagination: {
                    total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    pages: Math.ceil(total / limit)
                }
            });
        } catch (error) {
            loggerBadge.error('Erreur getAllBadges', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Erreur lors de la récupération'
            });
        }
    }
    
    static async getBadge(req, res) {
        try {
            const badge = await Badge.findById(req.params.id);
            
            if (!badge) {
                return res.status(404).json({
                    success: false,
                    error: 'Badge non trouvé'
                });
            }
            
            res.json({
                success: true,
                badge
            });
        } catch (error) {
            loggerBadge.error('Erreur getBadge', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Erreur lors de la récupération'
            });
        }
    }
    
    static async createBadge(req, res) {
        try {
            const { user_id, badge_uid, date_expiration } = req.body;
            
            if (!user_id || !badge_uid) {
                return res.status(400).json({
                    success: false,
                    error: 'user_id et badge_uid requis'
                });
            }
            
            if (await Badge.existsByUid(badge_uid)) {
                return res.status(400).json({
                    success: false,
                    error: 'Ce badge est déjà enregistré'
                });
            }
            
            // CORRECTION: Utiliser BadgeController au lieu de this
            const encryption_key = BadgeController.generateEncryptionKey(badge_uid);
            
            const badgeId = await Badge.create({
                user_id,
                badge_uid,
                encryption_key,
                date_expiration
            });
            
            loggerBadge.info('Badge créé', { badgeId, badge_uid, createdBy: req.user.id });
            
            global.io.to('admin-room').emit('badge_created', { badgeId, badge_uid });
            
            res.status(201).json({
                success: true,
                badgeId,
                encryptionKey: encryption_key,
                message: 'Badge créé avec succès'
            });
        } catch (error) {
            loggerBadge.error('Erreur createBadge', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Erreur lors de la création'
            });
        }
    }
    
    static async updateBadge(req, res) {
        try {
            const { id } = req.params;
            const { date_expiration, is_active } = req.body;
            
            await Badge.update(id, { date_expiration, is_active });
            
            loggerBadge.info('Badge mis à jour', { badgeId: id, updatedBy: req.user.id });
            
            global.io.to('admin-room').emit('badge_updated', { badgeId: id });
            
            res.json({
                success: true,
                message: 'Badge mis à jour'
            });
        } catch (error) {
            loggerBadge.error('Erreur updateBadge', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Erreur lors de la mise à jour'
            });
        }
    }
    
    static async deleteBadge(req, res) {
        try {
            const { id } = req.params;
            
            await Badge.delete(id);
            
            loggerBadge.info('Badge supprimé', { badgeId: id, deletedBy: req.user.id });
            
            global.io.to('admin-room').emit('badge_deleted', { badgeId: id });
            
            res.json({
                success: true,
                message: 'Badge supprimé'
            });
        } catch (error) {
            loggerBadge.error('Erreur deleteBadge', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Erreur lors de la suppression'
            });
        }
    }
    
    static async regenerateKey(req, res) {
        try {
            const { id } = req.params;
            
            const badge = await Badge.findById(id);
            if (!badge) {
                return res.status(404).json({
                    success: false,
                    error: 'Badge non trouvé'
                });
            }
            
            const newKey = BadgeController.generateEncryptionKey(badge.badge_uid);
            
            await Badge.update(id, { encryption_key: newKey });
            
            loggerBadge.info('Clé régénérée', { badgeId: id, regeneratedBy: req.user.id });
            
            res.json({
                success: true,
                encryptionKey: newKey,
                message: 'Clé régénérée'
            });
        } catch (error) {
            loggerBadge.error('Erreur regenerateKey', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Erreur lors de la régénération'
            });
        }
    }
}

module.exports = BadgeController;