const db = require('../config/database');
const logger = require('../config/logger');

class AlertDetectionService {
    constructor(io) {
        this.io = io;
        this.recentAttempts = new Map();
        this.userLocations = new Map();
        
        // SEUILS DE DÉTECTION
        this.SPAM_THRESHOLD = 5;              // 5 tentatives
        this.SPAM_WINDOW = 60000;             // 1 minute
        this.CLONING_WINDOW = 15000;          // 15 secondes (seuil de clonage)
        this.FAILED_ATTEMPTS_ALERT = 3;       // 3 échecs consécutifs
    }

    /**
     * ===================================================================
     * ANALYSER UNE TENTATIVE D'ACCÈS
     * Point d'entrée principal - appelé après chaque scan
     * ===================================================================
     */
    async analyzeAccessAttempt(logData) {
        const {
            badge_uid,
            door_id,
            access_granted,
            door_name,
            user_name
        } = logData;

        try {
            await this.detectSpamAttempts(badge_uid, door_id, access_granted, user_name, door_name);

            if (access_granted) {
                await this.detectCloningAttempt(badge_uid, door_id, user_name, door_name);
            }

            if (!access_granted) {
                await this.detectConsecutiveFailures(badge_uid, door_id, user_name, door_name);
            }

            this.cleanupCache();

        } catch (error) {
            logger.error('Erreur analyse tentative', { error: error.message });
        }
    }

    /**
     * ===================================================================
     * RÈGLE 1: DÉTECTION DE SPAM
     * Déclenchée si : 5+ tentatives sur la même porte en < 1 minute
     * ===================================================================
     */
    async detectSpamAttempts(badge_uid, door_id, access_granted, user_name, door_name) {
        const key = `${badge_uid}:${door_id}`;
        const now = Date.now();

        if (!this.recentAttempts.has(key)) {
            this.recentAttempts.set(key, []);
        }

        const attempts = this.recentAttempts.get(key);
        attempts.push({ timestamp: now, granted: access_granted });

        const recentAttempts = attempts.filter(
            a => now - a.timestamp < this.SPAM_WINDOW
        );

        this.recentAttempts.set(key, recentAttempts);

        // Vérifier le seuil
        if (recentAttempts.length >= this.SPAM_THRESHOLD) {
            const failedCount = recentAttempts.filter(a => !a.granted).length;
            
            if (failedCount >= 3) {
                await this.createAlert({
                    type: 'spam_attempts',
                    door_id,
                    badge_uid,
                    severity: 'high',
                    message: `⚠️ SPAM DÉTECTÉ: ${user_name || 'Badge inconnu'} a tenté d'accéder à "${door_name}" ${recentAttempts.length} fois en 1 minute (${failedCount} échecs). Possible tentative d'intrusion.`,
                    metadata: {
                        attempts_count: recentAttempts.length,
                        failed_count: failedCount,
                        success_count: recentAttempts.length - failedCount,
                        window: '1 minute',
                        detection_rule: 'SPAM_ATTEMPTS'
                    }
                });

                logger.warn('⚠️ SPAM DÉTECTÉ', {
                    badge_uid,
                    door_id,
                    attempts: recentAttempts.length,
                    failed: failedCount
                });
            }
        }
    }

    /**
     * ===================================================================
     * RÈGLE 2: DÉTECTION DE CLONAGE
     * Déclenchée si : Accès à 2 portes DIFFÉRENTES en < 15 secondes
     * Vérification: Les portes ne sont PAS dans le même groupe
     * ===================================================================
     */
    async detectCloningAttempt(badge_uid, door_id, user_name, door_name) {
        const now = Date.now();

        if (!this.userLocations.has(badge_uid)) {
            // Première localisation
            this.userLocations.set(badge_uid, {
                door_id,
                door_name,
                timestamp: now
            });
            return;
        }

        const lastLocation = this.userLocations.get(badge_uid);

        // Vérifier si c'est une porte différente
        if (lastLocation.door_id !== door_id) {
            const timeDiff = now - lastLocation.timestamp;

            // Si moins de 15 secondes entre 2 portes différentes
            if (timeDiff < this.CLONING_WINDOW) {
                
                const areInSameGroup = await this.areDoorsInSameGroup(lastLocation.door_id, door_id);
                
                if (!areInSameGroup) {
                    await this.createAlert({
                        type: 'cloning_attempt',
                        door_id,
                        badge_uid,
                        severity: 'critical',
                        message: `🚨 CLONAGE DÉTECTÉ: ${user_name} a accédé à "${lastLocation.door_name}" puis à "${door_name}" en ${Math.round(timeDiff / 1000)} secondes. Les portes ne sont PAS dans le même groupe. BADGE POSSIBLEMENT CLONÉ!`,
                        metadata: {
                            door1_id: lastLocation.door_id,
                            door1_name: lastLocation.door_name,
                            door2_id: door_id,
                            door2_name: door_name,
                            time_diff_seconds: Math.round(timeDiff / 1000),
                            same_group: false,
                            detection_rule: 'CLONING_ATTEMPT'
                        }
                    });

                    // Notifier en temps réel
                    this.io.to('admin-room').emit('security_alert', {
                        type: 'cloning_attempt',
                        badge_uid,
                        user_name,
                        severity: 'critical',
                        message: `Possible clonage de badge détecté!`,
                        timestamp: new Date()
                    });

                    logger.error('🚨 CLONAGE DÉTECTÉ', {
                        badge_uid,
                        door1: lastLocation.door_id,
                        door2: door_id,
                        timeDiff: Math.round(timeDiff / 1000) + 's',
                        sameGroup: false
                    });
                } else {
                    logger.debug('Accès rapide à portes du même groupe (normal)', {
                        badge_uid,
                        door1: lastLocation.door_id,
                        door2: door_id,
                        timeDiff: Math.round(timeDiff / 1000) + 's'
                    });
                }
            }
        }

        // Mettre à jour la localisation
        this.userLocations.set(badge_uid, {
            door_id,
            door_name,
            timestamp: now
        });
    }

    /**
     * ===================================================================
     * VÉRIFIER SI DEUX PORTES SONT DANS LE MÊME GROUPE
     * Critère: Partage d'au moins un groupe de portes commun
     * ===================================================================
     */
    async areDoorsInSameGroup(door1_id, door2_id) {
        try {
            const [result] = await db.execute(
                `SELECT COUNT(*) as shared_groups
                 FROM door_group_members dgm1
                 JOIN door_group_members dgm2 
                   ON dgm1.door_group_id = dgm2.door_group_id
                 WHERE dgm1.door_id = ? 
                   AND dgm2.door_id = ?`,
                [parseInt(door1_id), parseInt(door2_id)]
            );

            const sharedGroups = result[0].shared_groups;

            if (sharedGroups > 0) {
                logger.debug('✅ Portes dans le même groupe', {
                    door1: door1_id,
                    door2: door2_id,
                    sharedGroups
                });
                return true;
            }

            logger.debug('❌ Portes dans des groupes différents', {
                door1: door1_id,
                door2: door2_id
            });
            return false;

        } catch (error) {
            logger.error('Erreur vérification groupes', { error: error.message });
            // En cas d'erreur, considérer comme même groupe (éviter fausses alertes)
            return true;
        }
    }

    /**
     * ===================================================================
     * RÈGLE 3: ÉCHECS CONSÉCUTIFS
     * Déclenchée si : 3+ échecs consécutifs sur la même porte
     * ===================================================================
     */
    async detectConsecutiveFailures(badge_uid, door_id, user_name, door_name) {
        try {
            // Récupérer les 10 dernières tentatives sur cette porte
            const [recentLogs] = await db.execute(
                `SELECT access_granted 
                 FROM access_logs 
                 WHERE badge_uid = ? AND door_id = ? 
                 ORDER BY access_datetime DESC 
                 LIMIT 10`,
                [badge_uid, door_id]
            );

            if (recentLogs.length < this.FAILED_ATTEMPTS_ALERT) return;

            // Compter les échecs consécutifs
            let consecutiveFailures = 0;
            for (const log of recentLogs) {
                if (!log.access_granted) {
                    consecutiveFailures++;
                } else {
                    break; // Arrêter au premier succès
                }
            }

            if (consecutiveFailures >= this.FAILED_ATTEMPTS_ALERT) {
                await this.createAlert({
                    type: 'consecutive_failures',
                    door_id,
                    badge_uid,
                    severity: 'medium',
                    message: `⚠️ ÉCHECS RÉPÉTÉS: ${user_name || 'Badge inconnu'} a échoué ${consecutiveFailures} fois consécutives à accéder à "${door_name}". Vérifier les droits d'accès ou badge défectueux.`,
                    metadata: {
                        consecutive_failures: consecutiveFailures,
                        detection_rule: 'CONSECUTIVE_FAILURES'
                    }
                });

                logger.warn('⚠️ ÉCHECS CONSÉCUTIFS', {
                    badge_uid,
                    door_id,
                    failures: consecutiveFailures
                });
            }
        } catch (error) {
            logger.error('Erreur détection échecs', { error: error.message });
        }
    }

    /**
     * ===================================================================
     * RÈGLE 4: ALERTE PORTE HORS LIGNE
     * Déclenchée par DoorMonitorService
     * ===================================================================
     */
    async createDoorOfflineAlert(door) {
        await this.createAlert({
            type: 'door_offline',
            door_id: door.id,
            severity: 'high',
            message: `🔴 PORTE HORS LIGNE: "${door.nom}" (${door.esp32_id}) ne répond plus. Dernière connexion: ${door.last_heartbeat ? new Date(door.last_heartbeat).toLocaleString() : 'Jamais'}. Vérifier la connexion réseau ou l'alimentation.`,
            metadata: {
                esp32_id: door.esp32_id,
                last_heartbeat: door.last_heartbeat,
                ip_address: door.esp32_ip,
                detection_rule: 'DOOR_OFFLINE'
            }
        });

        // Notifier en temps réel
        this.io.to('admin-room').emit('security_alert', {
            type: 'door_offline',
            door_id: door.id,
            door_name: door.nom,
            esp32_id: door.esp32_id,
            severity: 'high',
            timestamp: new Date()
        });

        logger.warn('🔴 PORTE HORS LIGNE', { door_id: door.id, door_name: door.nom });
    }

    /**
     * ===================================================================
     * RÈGLE 5: ALERTE PORTE EN LIGNE
     * Déclenchée par DoorMonitorService
     * ===================================================================
     */
    async createDoorOnlineAlert(door) {
        await this.createAlert({
            type: 'door_online',
            door_id: door.id,
            severity: 'info',
            message: `🟢 PORTE RECONNECTÉE: "${door.nom}" (${door.esp32_id}) est de nouveau en ligne.`,
            metadata: {
                esp32_id: door.esp32_id,
                ip_address: door.esp32_ip,
                detection_rule: 'DOOR_ONLINE'
            }
        });

        // Notifier en temps réel
        this.io.to('admin-room').emit('security_alert', {
            type: 'door_online',
            door_id: door.id,
            door_name: door.nom,
            esp32_id: door.esp32_id,
            severity: 'info',
            timestamp: new Date()
        });

        logger.info('🟢 PORTE EN LIGNE', { door_id: door.id, door_name: door.nom });
    }

    /**
     * ===================================================================
     * RÈGLE 6: CLÉ DE CHIFFREMENT INVALIDE
     * Tentative de clonage de badge
     * ===================================================================
     */
    async createInvalidKeyAlert(badge_uid, door_id, door_name) {
        await this.createAlert({
            type: 'invalid_encryption_key',
            door_id,
            badge_uid,
            severity: 'critical',
            message: `🚨 CLONAGE DÉTECTÉ: Badge ${badge_uid} présenté à "${door_name}" avec une clé de chiffrement invalide. BADGE CLONÉ OU COMPROMIS!`,
            metadata: {
                attack_type: 'badge_cloning',
                detection_rule: 'INVALID_ENCRYPTION_KEY'
            }
        });

        this.io.to('admin-room').emit('security_alert', {
            type: 'invalid_encryption_key',
            badge_uid,
            door_name,
            severity: 'critical',
            timestamp: new Date()
        });

        logger.error('🚨 CLÉ INVALIDE', { badge_uid, door_id });
    }

    /**
     * ===================================================================
     * CRÉER UNE ALERTE DANS LA BASE DE DONNÉES
     * ===================================================================
     */
    async createAlert(alertData) {
        const {
            type,
            door_id,
            badge_uid,
            severity,
            message,
            metadata
        } = alertData;

        try {
            await db.execute(
                `INSERT INTO alerts (type, door_id, badge_uid, message, severity, metadata, is_read) 
                 VALUES (?, ?, ?, ?, ?, ?, FALSE)`,
                [
                    type,
                    door_id || null,
                    badge_uid || null,
                    message,
                    severity || 'medium',
                    metadata ? JSON.stringify(metadata) : null
                ]
            );

            // Notifier les admins en temps réel
            this.io.to('admin-room').emit('new_alert', {
                type,
                message,
                severity,
                door_id,
                badge_uid,
                timestamp: new Date()
            });

            logger.info('✅ Alerte créée', { type, severity });

        } catch (error) {
            logger.error('Erreur création alerte', { error: error.message });
        }
    }

    /**
     * ===================================================================
     * NETTOYAGE PÉRIODIQUE DU CACHE
     * ===================================================================
     */
    cleanupCache() {
        const now = Date.now();
        const CACHE_TTL = 300000; // 5 minutes

        // Nettoyer recentAttempts
        for (const [key, attempts] of this.recentAttempts.entries()) {
            const validAttempts = attempts.filter(
                a => now - a.timestamp < CACHE_TTL
            );
            
            if (validAttempts.length === 0) {
                this.recentAttempts.delete(key);
            } else {
                this.recentAttempts.set(key, validAttempts);
            }
        }

        // Nettoyer userLocations
        for (const [key, location] of this.userLocations.entries()) {
            if (now - location.timestamp > CACHE_TTL) {
                this.userLocations.delete(key);
            }
        }
    }

    /**
     * ===================================================================
     * STATISTIQUES D'ALERTES
     * ===================================================================
     */
    async getAlertStats(days = 7) {
        const [stats] = await db.execute(
            `SELECT 
                type,
                severity,
                COUNT(*) as count,
                SUM(CASE WHEN is_read = FALSE THEN 1 ELSE 0 END) as unread_count
             FROM alerts
             WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
             GROUP BY type, severity
             ORDER BY count DESC`,
            [days]
        );

        return stats;
    }

    /**
     * ===================================================================
     * OBTENIR LES ALERTES NON LUES POUR AFFICHAGE
     * ===================================================================
     */
    async getUnreadAlerts() {
        const [alerts] = await db.execute(
            `SELECT a.*, d.nom as door_name, d.localisation
             FROM alerts a
             LEFT JOIN doors d ON a.door_id = d.id
             WHERE a.is_read = FALSE
             ORDER BY 
                CASE a.severity
                    WHEN 'critical' THEN 1
                    WHEN 'high' THEN 2
                    WHEN 'medium' THEN 3
                    WHEN 'low' THEN 4
                    WHEN 'info' THEN 5
                END,
                a.created_at DESC
             LIMIT 50`
        );

        return alerts;
    }
}

module.exports = AlertDetectionService;