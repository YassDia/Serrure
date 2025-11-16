const AccessVerificationService = require('../services/AccessVerificationService');
const Door = require('../models/Door');
const db = require('../config/database');
const logger = require('../config/logger');

class ESP32Controller {
    
    // POST /api/esp32/verify-access - Vérifier l'accès d'un badge
    static async verifyAccess(req, res) {
        try {
            const { badge_uid, esp32_id, encryption_key } = req.body;
            
            if (!badge_uid || !esp32_id) {
                return res.status(400).json({
                    access_granted: false,
                    reason: 'Données manquantes (badge_uid ou esp32_id)'
                });
            }
            
            // Vérifier l'accès via le service
            const result = await AccessVerificationService.verifyAccess(
                badge_uid,
                esp32_id,
                encryption_key
            );
            
            // Enregistrer le log d'accès
            await db.execute(
                `INSERT INTO access_logs (badge_id, door_id, badge_uid, user_name, access_granted, reason)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    result.badge_id,
                    result.door_id,
                    badge_uid,
                    result.user_name,
                    result.access_granted,
                    result.reason
                ]
            );
            
            // Notifier les administrateurs en temps réel
            global.io.to('admin-room').emit('access_attempt', {
                badge_uid,
                user_name: result.user_name,
                esp32_id,
                access_granted: result.access_granted,
                reason: result.reason,
                timestamp: new Date()
            });
            
            // Si accès refusé avec badge inconnu, créer une alerte
            if (!result.access_granted && !result.user_name) {
                await db.execute(
                    `INSERT INTO alerts (type, door_id, badge_uid, message)
                     VALUES ('unknown_badge', ?, ?, ?)`,
                    [
                        result.door_id,
                        badge_uid,
                        `Badge inconnu détecté: ${badge_uid}`
                    ]
                );
                
                global.io.to('admin-room').emit('security_alert', {
                    type: 'unknown_badge',
                    badge_uid,
                    esp32_id,
                    timestamp: new Date()
                });
            }
            
            // Si clé de chiffrement invalide
            if (!result.access_granted && result.reason.includes('clé')) {
                await db.execute(
                    `INSERT INTO alerts (type, door_id, badge_uid, message)
                     VALUES ('unauthorized_access', ?, ?, ?)`,
                    [
                        result.door_id,
                        badge_uid,
                        `Tentative d'accès avec clé de chiffrement invalide: ${badge_uid}`
                    ]
                );
            }
            
            logger.info('Vérification d\'accès', {
                badge_uid,
                esp32_id,
                access_granted: result.access_granted,
                reason: result.reason
            });
            
            res.json({
                access_granted: result.access_granted,
                user_name: result.user_name,
                reason: result.reason,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            logger.error('Erreur verifyAccess', { error: error.message });
            res.status(500).json({
                access_granted: false,
                reason: 'Erreur serveur lors de la vérification'
            });
        }
    }
    
    // POST /api/esp32/door-opened - Confirmer l'ouverture de la porte
    static async doorOpened(req, res) {
        try {
            const { badge_uid, esp32_id } = req.body;
            
            await db.execute(
                `UPDATE access_logs 
                 SET door_opened = TRUE 
                 WHERE badge_uid = ? 
                 AND door_id = (SELECT id FROM doors WHERE esp32_id = ?)
                 ORDER BY access_datetime DESC 
                 LIMIT 1`,
                [badge_uid, esp32_id]
            );
            
            logger.info('Porte ouverte', { badge_uid, esp32_id });
            
            res.json({ success: true });
        } catch (error) {
            logger.error('Erreur doorOpened', { error: error.message });
            res.status(500).json({ error: 'Erreur serveur' });
        }
    }
    
    // POST /api/esp32/door-closed - Confirmer la fermeture de la porte
    static async doorClosed(req, res) {
        try {
            const { badge_uid, esp32_id } = req.body;
            
            await db.execute(
                `UPDATE access_logs 
                 SET door_closed_at = NOW() 
                 WHERE badge_uid = ? 
                 AND door_id = (SELECT id FROM doors WHERE esp32_id = ?)
                 AND door_opened = TRUE
                 AND door_closed_at IS NULL
                 ORDER BY access_datetime DESC 
                 LIMIT 1`,
                [badge_uid, esp32_id]
            );
            
            logger.info('Porte fermée', { badge_uid, esp32_id });
            
            res.json({ success: true });
        } catch (error) {
            logger.error('Erreur doorClosed', { error: error.message });
            res.status(500).json({ error: 'Erreur serveur' });
        }
    }
    
    // GET /api/esp32/authorized-badges/:esp32_id - Liste des badges autorisés
    static async getAuthorizedBadges(req, res) {
        try {
            const { esp32_id } = req.params;
            
            const badges = await AccessVerificationService.getAuthorizedBadges(esp32_id);
            
            logger.info('Liste des badges récupérée', { 
                esp32_id, 
                count: badges.length 
            });
            
            res.json({
                success: true,
                badges
            });
        } catch (error) {
            logger.error('Erreur getAuthorizedBadges', { error: error.message });
            res.status(500).json({ error: 'Erreur serveur' });
        }
    }
    
    // POST /api/esp32/heartbeat - Heartbeat de l'ESP32
static async heartbeat(req, res) {
        try {
            const { esp32_id, ip_address, firmware_version, status } = req.body;
            
            if (!esp32_id) {
                return res.status(400).json({ 
                    error: 'ESP32 ID requis' 
                });
            }
            
            // Enregistrer le heartbeat via le service de monitoring
            const doorMonitor = req.app.get('doorMonitor');
            const success = await doorMonitor.recordHeartbeat(esp32_id, {
                ip_address,
                firmware_version
            });
            
            if (!success) {
                logger.warn('Heartbeat d\'une porte inconnue', { esp32_id });
            }
            
            res.json({
                success: true,
                server_time: new Date().toISOString()
            });
        } catch (error) {
            logger.error('Erreur heartbeat', { error: error.message });
            res.status(500).json({ error: 'Erreur serveur' });
        }
    }
    
    // GET /api/esp32/sync-time - Synchronisation de l'heure
    static async syncTime(req, res) {
        try {
            const now = new Date();
            
            res.json({
                success: true,
                timestamp: now.toISOString(),
                unix_time: Math.floor(now.getTime() / 1000),
                timezone_offset: now.getTimezoneOffset()
            });
        } catch (error) {
            logger.error('Erreur syncTime', { error: error.message });
            res.status(500).json({ error: 'Erreur serveur' });
        }
    }
}

module.exports = ESP32Controller;