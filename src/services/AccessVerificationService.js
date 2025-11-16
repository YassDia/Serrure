const db = require('../config/database');
const Badge = require('../models/Badge');
const logger = require('../config/logger');

class AccessVerificationService {
    
    /**
     * Vérifier si un badge a accès à une porte (version étendue avec groupes)
     * @param {string} badge_uid - UID du badge
     * @param {string} esp32_id - ID de l'ESP32 (porte)
     * @param {string} encryption_key - Clé de chiffrement (optionnel)
     * @returns {Object} - Résultat de la vérification
     */
    static async verifyAccess(badge_uid, esp32_id, encryption_key = null) {
        const result = {
            access_granted: false,
            user_name: null,
            reason: 'Badge inconnu',
            badge_id: null,
            door_id: null,
            access_type: null
        };
        
        try {
            // 1. Récupérer toutes les permissions depuis la vue étendue
            const [accessData] = await db.execute(
                `SELECT * FROM v_access_verification_extended 
                 WHERE badge_uid = ? AND esp32_id = ?`,
                [badge_uid, esp32_id]
            );
            
            if (accessData.length === 0) {
                result.reason = 'Badge non enregistré pour cette porte';
                return result;
            }
            
            // Prendre la première permission valide trouvée
            const access = accessData[0];
            result.user_name = access.user_name;
            result.badge_id = await this.getBadgeId(badge_uid);
            result.door_id = access.door_id;
            result.access_type = access.access_type;
            
            // 2. Vérifier la clé de chiffrement si fournie
            if (encryption_key && access.encryption_key !== encryption_key) {
                result.reason = 'Clé de sécurité invalide - Tentative de clonage détectée';
                logger.warn('Tentative avec clé invalide', { badge_uid, esp32_id });
                return result;
            }
            
            // 3. Vérifications de statut
            if (!access.badge_active) {
                result.reason = 'Badge désactivé';
                return result;
            }
            
            if (!access.user_active) {
                result.reason = 'Utilisateur désactivé';
                return result;
            }
            
            if (!access.door_active) {
                result.reason = 'Porte désactivée';
                return result;
            }
            
            if (!access.access_active) {
                result.reason = 'Autorisation désactivée';
                return result;
            }
            
            // 4. Vérifier l'expiration du badge
            if (access.date_expiration && new Date(access.date_expiration) < new Date()) {
                result.reason = 'Badge expiré';
                return result;
            }
            
            // 5. Vérifier la période de validité
            const currentDate = new Date();
            const dateDebut = new Date(access.date_debut);
            const dateFin = access.date_fin ? new Date(access.date_fin) : null;
            
            if (currentDate < dateDebut) {
                result.reason = 'Accès pas encore actif';
                return result;
            }
            
            if (dateFin && currentDate > dateFin) {
                result.reason = 'Période d\'accès expirée';
                return result;
            }
            
            // 6. Vérifier le jour de la semaine
            const currentDay = currentDate.getDay() === 0 ? 7 : currentDate.getDay();
            const allowedDays = access.jours_semaine.split(',').map(d => parseInt(d));
            
            if (!allowedDays.includes(currentDay)) {
                result.reason = 'Jour non autorisé';
                return result;
            }
            
            // 7. Vérifier l'heure
            const currentTime = currentDate.toTimeString().split(' ')[0];
            
            if (currentTime < access.heure_debut || currentTime > access.heure_fin) {
                result.reason = 'Hors plage horaire autorisée';
                return result;
            }
            
            // Toutes les vérifications sont passées !
            result.access_granted = true;
            
            // Créer un message détaillé selon le type d'accès
            switch(access.access_type) {
                case 'individual_badge':
                    result.reason = 'Accès autorisé (badge individuel)';
                    break;
                case 'user_group':
                    result.reason = `Accès autorisé (groupe: ${access.user_group_name})`;
                    break;
                case 'badge_group':
                    result.reason = `Accès autorisé (groupe badges: ${access.badge_group_name})`;
                    break;
                case 'door_group':
                    result.reason = `Accès autorisé (groupe portes: ${access.door_group_name})`;
                    break;
                default:
                    result.reason = 'Accès autorisé';
            }
            
            logger.info('Accès autorisé', { 
                badge_uid, 
                esp32_id, 
                user_name: access.user_name,
                access_type: access.access_type
            });
            
            return result;
            
        } catch (error) {
            logger.error('Erreur lors de la vérification d\'accès', { 
                error: error.message,
                badge_uid,
                esp32_id
            });
            
            result.reason = 'Erreur serveur lors de la vérification';
            return result;
        }
    }
    
    /**
     * Récupérer l'ID du badge depuis son UID
     */
    static async getBadgeId(badge_uid) {
        const badge = await Badge.findByUid(badge_uid);
        return badge ? badge.id : null;
    }
    
    /**
     * Vérifier si un badge existe et est valide
     */
    static async isBadgeValid(badge_uid) {
        const badge = await Badge.findByUid(badge_uid);
        
        if (!badge) return { valid: false, reason: 'Badge non trouvé' };
        if (!badge.is_active) return { valid: false, reason: 'Badge désactivé' };
        if (!badge.user_active) return { valid: false, reason: 'Utilisateur désactivé' };
        if (badge.date_expiration && new Date(badge.date_expiration) < new Date()) {
            return { valid: false, reason: 'Badge expiré' };
        }
        
        return { valid: true, badge };
    }
    
    /**
     * Récupérer la liste des badges autorisés pour une porte
     * Version étendue incluant tous les types d'accès
     */
    static async getAuthorizedBadges(esp32_id) {
        const [badges] = await db.execute(
            `SELECT DISTINCT
                b.badge_uid,
                b.encryption_key,
                CONCAT(u.prenom, ' ', u.nom) as user_name,
                CASE 
                    WHEN ar.group_id IS NOT NULL THEN 'user_group'
                    WHEN ar.badge_group_id IS NOT NULL THEN 'badge_group'
                    WHEN ar.door_group_id IS NOT NULL THEN 'door_group'
                    WHEN ar.badge_id IS NOT NULL THEN 'individual'
                    ELSE 'unknown'
                END as access_type
             FROM v_access_verification_extended v
             JOIN badges b ON v.badge_uid = b.badge_uid
             JOIN users u ON b.user_id = u.id
             WHERE v.esp32_id = ?
             AND v.badge_active = TRUE
             AND v.user_active = TRUE
             AND v.access_active = TRUE
             AND v.door_active = TRUE`,
            [esp32_id]
        );
        
        return badges;
    }
    
    /**
     * Obtenir les détails d'accès pour un badge et une porte
     */
    static async getAccessDetails(badge_uid, esp32_id) {
        const [details] = await db.execute(
            `SELECT 
                badge_uid,
                user_name,
                door_name,
                access_type,
                user_group_name,
                badge_group_name,
                door_group_name,
                heure_debut,
                heure_fin,
                jours_semaine,
                date_debut,
                date_fin
             FROM v_access_verification_extended
             WHERE badge_uid = ? AND esp32_id = ?
             AND badge_active = TRUE
             AND user_active = TRUE
             AND door_active = TRUE
             AND access_active = TRUE`,
            [badge_uid, esp32_id]
        );
        
        return details;
    }
}

module.exports = AccessVerificationService;