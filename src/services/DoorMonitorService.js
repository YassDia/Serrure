const Door = require('../models/Door');
const db = require('../config/database');
const logger = require('../config/logger');

class DoorMonitorService {
    constructor(io) {
        this.io = io;
        this.checkInterval = null;
        this.OFFLINE_TIMEOUT = 2; // minutes
    }

    /**
     * Démarrer le monitoring des portes
     */
    start() {
        logger.info('Démarrage du service de monitoring des portes');

        // Vérifier toutes les minutes
        this.checkInterval = setInterval(() => {
            this.checkOfflineDoors();
        }, 60000); // 60 secondes

        // Première vérification immédiate
        this.checkOfflineDoors();
    }

    /**
     * Arrêter le monitoring
     */
    stop() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
            logger.info('Arrêt du service de monitoring des portes');
        }
    }

    // Dans la classe DoorMonitorService

    setAlertService(alertService) {
        this.alertService = alertService;
    }

    async checkOfflineDoors() {
        try {
            const offlineDoors = await Door.findOfflineDoors(this.OFFLINE_TIMEOUT);

            for (const door of offlineDoors) {
                await Door.updateOnlineStatus(door.esp32_id, false);

                if (this.alertService) {
                    await this.alertService.createDoorOfflineAlert(door);
                }

                logger.warn('Porte hors ligne', {
                    door_id: door.id,
                    door_name: door.nom
                });
            }
        } catch (error) {
            logger.error('Erreur vérification portes', { error: error.message });
        }
    }

    async recordHeartbeat(esp32_id, data = {}) {
        try {
            const door = await Door.findByEsp32Id(esp32_id);
            if (!door) return false;

            const wasOffline = !door.is_online;

            await Door.updateOnlineStatus(
                esp32_id,
                true,
                data.ip_address,
                data.firmware_version
            );

            if (wasOffline && this.alertService) {
                await this.alertService.createDoorOnlineAlert(door);
            }

            return true;
        } catch (error) {
            logger.error('Erreur heartbeat', { error: error.message });
            return false;
        }
    }

    /**
     * Créer une alerte de porte hors ligne
     */
    async createOfflineAlert(door) {
        try {
            await db.execute(
                `INSERT INTO alerts (type, door_id, message) 
                 VALUES ('door_offline', ?, ?)`,
                [
                    door.id,
                    `La porte "${door.nom}" (${door.esp32_id}) est hors ligne depuis ${door.last_heartbeat || 'longtemps'}`
                ]
            );
        } catch (error) {
            logger.error('Erreur lors de la création d\'alerte offline', { error: error.message });
        }
    }

    /**
     * Créer une alerte de porte en ligne
     */
    async createOnlineAlert(door) {
        try {
            await db.execute(
                `INSERT INTO alerts (type, door_id, message) 
                 VALUES ('door_online', ?, ?)`,
                [
                    door.id,
                    `La porte "${door.nom}" (${door.esp32_id}) est de nouveau en ligne`
                ]
            );
        } catch (error) {
            logger.error('Erreur lors de la création d\'alerte online', { error: error.message });
        }
    }

    /**
     * Obtenir les statistiques de disponibilité
     */
    async getAvailabilityStats(doorId, days = 7) {
        try {
            const [stats] = await db.execute(
                `SELECT 
                    DATE(timestamp) as date,
                    SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END) as online_count,
                    SUM(CASE WHEN status = 'offline' THEN 1 ELSE 0 END) as offline_count
                 FROM door_status_history
                 WHERE door_id = ? 
                 AND timestamp >= DATE_SUB(NOW(), INTERVAL ? DAY)
                 GROUP BY DATE(timestamp)
                 ORDER BY date DESC`,
                [doorId, days]
            );

            return stats;
        } catch (error) {
            logger.error('Erreur lors de la récupération des stats', { error: error.message });
            return [];
        }
    }

    /**
     * Obtenir le temps de disponibilité d'une porte
     */
    async getUptimePercentage(doorId, days = 30) {
        try {
            const [result] = await db.execute(
                `SELECT 
                    COUNT(*) as total_checks,
                    SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END) as online_checks
                 FROM door_status_history
                 WHERE door_id = ? 
                 AND timestamp >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
                [doorId, days]
            );

            if (result[0].total_checks === 0) return 0;

            return (result[0].online_checks / result[0].total_checks) * 100;
        } catch (error) {
            logger.error('Erreur lors du calcul d\'uptime', { error: error.message });
            return 0;
        }
    }
}

module.exports = DoorMonitorService;