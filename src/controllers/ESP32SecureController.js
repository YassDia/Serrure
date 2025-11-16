const crypto = require('crypto');
const db = require('../config/database');
const logger = require('../config/logger');

class ESP32SecureController {
    
    /**
     * Handshake sécurisé - Établir une session
     * POST /api/esp32/handshake
     */
    static async handshake(req, res) {
        try {
            const { esp32_id, firmware_version, nonce } = req.body;
            
            // Vérifier le certificat client
            const clientCert = req.socket.getPeerCertificate();
            
            if (!clientCert || Object.keys(clientCert).length === 0) {
                return res.status(401).json({
                    success: false,
                    error: 'Certificat client requis'
                });
            }
            
            // Vérifier que l'ESP32 est enregistré
            const [doors] = await db.execute(
                'SELECT * FROM doors WHERE esp32_id = ?',
                [esp32_id]
            );
            
            if (doors.length === 0) {
                logger.warn('Tentative connexion ESP32 non enregistré', { esp32_id });
                return res.status(403).json({
                    success: false,
                    error: 'ESP32 non autorisé'
                });
            }
            
            // Générer un token de session unique
            const sessionToken = crypto.randomBytes(32).toString('hex');
            
            // Stocker le token en base
            await db.execute(
                'UPDATE doors SET session_key = ?, session_key_updated_at = NOW() WHERE esp32_id = ?',
                [sessionToken, esp32_id]
            );
            
            logger.info('Session ESP32 établie', { esp32_id, firmware_version });
            
            res.json({
                success: true,
                session_token: sessionToken,
                server_time: new Date().toISOString(),
                nonce: crypto.randomBytes(16).toString('hex')
            });
            
        } catch (error) {
            logger.error('Erreur handshake', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Erreur serveur'
            });
        }
    }
    
    /**
     * Vérifier HMAC de la requête
     */
    static verifyHMAC(req, res, next) {
        try {
            const { badge_uid, esp32_id, nonce, session_token, hmac } = req.body;
            
            // Récupérer le session_token depuis la DB
            db.execute(
                'SELECT session_key FROM doors WHERE esp32_id = ?',
                [esp32_id]
            ).then(([doors]) => {
                if (doors.length === 0 || !doors[0].session_key) {
                    return res.status(401).json({
                        success: false,
                        error: 'Session invalide'
                    });
                }
                
                const storedToken = doors[0].session_key;
                
                if (storedToken !== session_token) {
                    logger.warn('Token de session invalide', { esp32_id });
                    return res.status(401).json({
                        success: false,
                        error: 'Token invalide'
                    });
                }
                
                // Calculer HMAC attendu
                const message = badge_uid + esp32_id + nonce + session_token;
                const expectedHmac = crypto
                    .createHmac('sha256', storedToken)
                    .update(message)
                    .digest('hex');
                
                if (hmac !== expectedHmac) {
                    logger.error('HMAC invalide - Possible MITM', { esp32_id });
                    return res.status(403).json({
                        success: false,
                        error: 'Intégrité compromise'
                    });
                }
                
                // HMAC valide, continuer
                req.sessionToken = storedToken;
                next();
                
            }).catch(err => {
                logger.error('Erreur vérification HMAC', { error: err.message });
                res.status(500).json({
                    success: false,
                    error: 'Erreur serveur'
                });
            });
            
        } catch (error) {
            logger.error('Erreur verifyHMAC', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Erreur serveur'
            });
        }
    }
    
    /**
     * Vérification d'accès sécurisée avec HMAC
     * POST /api/esp32/verify-access
     */
    static async verifyAccessSecure(req, res) {
        try {
            const { badge_uid, esp32_id, nonce } = req.body;
            const sessionToken = req.sessionToken;
            
            // Utiliser AccessVerificationService normal
            const AccessVerificationService = require('../services/AccessVerificationService');
            const result = await AccessVerificationService.verifyAccess(badge_uid, esp32_id);
            
            // Enregistrer le log
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
            
            // Analyser avec AlertDetectionService
            const alertService = req.app.get('alertDetectionService');
            await alertService.analyzeAccessAttempt({
                badge_uid,
                door_id: result.door_id,
                access_granted: result.access_granted,
                door_name: result.door_name || 'Inconnu',
                user_name: result.user_name
            });
            
            // Notifier admins
            global.io.to('admin-room').emit('access_attempt', {
                badge_uid,
                user_name: result.user_name,
                esp32_id,
                access_granted: result.access_granted,
                reason: result.reason,
                timestamp: new Date()
            });
            
            // Calculer HMAC pour la réponse
            const responseMessage = nonce + result.access_granted;
            const responseHmac = crypto
                .createHmac('sha256', sessionToken)
                .update(responseMessage)
                .digest('hex');
            
            res.json({
                access_granted: result.access_granted,
                user_name: result.user_name,
                reason: result.reason,
                nonce: nonce,
                hmac: responseHmac,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            logger.error('Erreur verifyAccessSecure', { error: error.message });
            res.status(500).json({
                access_granted: false,
                reason: 'Erreur serveur'
            });
        }
    }
}

module.exports = ESP32SecureController;