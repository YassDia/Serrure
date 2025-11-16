const Alert = require('../models/Alert');
const loggerAlert = require('../config/logger');

class AlertController {
    
    static async getAllAlerts(req, res) {
        try {
            const { is_read, type, page = 1, limit = 20 } = req.query;
            const offset = (page - 1) * limit;
            
            const filters = { is_read, type, limit, offset };
            const alerts = await Alert.findAll(filters);
            const total = await Alert.count({ is_read, type });
            
            res.json({
                success: true,
                alerts,
                pagination: {
                    total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    pages: Math.ceil(total / limit)
                }
            });
        } catch (error) {
            loggerAlert.error('Erreur getAllAlerts', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Erreur lors de la récupération'
            });
        }
    }
    
    static async getUnreadCount(req, res) {
        try {
            const count = await Alert.count({ is_read: false });
            
            res.json({
                success: true,
                unreadCount: count
            });
        } catch (error) {
            loggerAlert.error('Erreur getUnreadCount', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Erreur lors du comptage'
            });
        }
    }
    
    static async markAsRead(req, res) {
        try {
            const { id } = req.params;
            
            await Alert.markAsRead(id);
            
            loggerAlert.info('Alerte marquée comme lue', { alertId: id });
            
            res.json({
                success: true,
                message: 'Alerte marquée comme lue'
            });
        } catch (error) {
            loggerAlert.error('Erreur markAsRead', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Erreur lors de la mise à jour'
            });
        }
    }
    
    static async markAllAsRead(req, res) {
        try {
            const count = await Alert.markAllAsRead();
            
            loggerAlert.info('Toutes les alertes marquées comme lues', { count });
            
            res.json({
                success: true,
                message: `${count} alerte(s) marquée(s) comme lue(s)`
            });
        } catch (error) {
            loggerAlert.error('Erreur markAllAsRead', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Erreur lors de la mise à jour'
            });
        }
    }
    
    static async deleteAlert(req, res) {
        try {
            const { id } = req.params;
            
            await Alert.delete(id);
            
            loggerAlert.info('Alerte supprimée', { alertId: id });
            
            res.json({
                success: true,
                message: 'Alerte supprimée'
            });
        } catch (error) {
            loggerAlert.error('Erreur deleteAlert', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Erreur lors de la suppression'
            });
        }
    }
}

module.exports = AlertController;