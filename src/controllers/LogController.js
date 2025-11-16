const AccessLog = require('../models/AccessLog');
const loggerLog = require('../config/logger');

class LogController {
    
    static async getAllLogs(req, res) {
        try {
            const {
                door_id, badge_id, access_granted,
                start_date, end_date, page = 1, limit = 50
            } = req.query;
            
            const offset = (page - 1) * limit;
            
            const filters = {
                door_id, badge_id, access_granted,
                start_date, end_date, limit, offset
            };
            
            const logs = await AccessLog.findAll(filters);
            const total = await AccessLog.count(filters);
            
            res.json({
                success: true,
                logs,
                pagination: {
                    total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    pages: Math.ceil(total / limit)
                }
            });
        } catch (error) {
            loggerLog.error('Erreur getAllLogs', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Erreur lors de la récupération'
            });
        }
    }
    
    static async getStats(req, res) {
        try {
            const { start_date, end_date } = req.query;
            
            const stats = await AccessLog.getStats({ start_date, end_date });
            
            res.json({
                success: true,
                stats
            });
        } catch (error) {
            loggerLog.error('Erreur getStats', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Erreur lors de la récupération'
            });
        }
    }
}

module.exports = LogController;