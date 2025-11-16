const Door = require('../models/Door');
const logger = require('../config/logger');

class DoorController {
    
    // GET /api/doors - Récupérer toutes les portes
    static async getAllDoors(req, res) {
        try {
            const { is_active, is_online, search } = req.query;
            
            const filters = {};
            if (is_active !== undefined) filters.is_active = is_active === 'true';
            if (is_online !== undefined) filters.is_online = is_online === 'true';
            if (search) filters.search = search;
            
            const doors = await Door.findAll(filters);
            
            res.json({
                success: true,
                doors
            });
        } catch (error) {
            logger.error('Erreur getAllDoors', { error: error.message });
            res.status(500).json({ 
                success: false,
                error: 'Erreur lors de la récupération des portes' 
            });
        }
    }
    
    // GET /api/doors/stats - Récupérer les statistiques
    static async getStats(req, res) {
        try {
            const stats = await Door.getStats();
            
            res.json({
                success: true,
                stats
            });
        } catch (error) {
            logger.error('Erreur getStats', { error: error.message });
            res.status(500).json({ 
                success: false,
                error: 'Erreur lors de la récupération des statistiques' 
            });
        }
    }
    
    // GET /api/doors/:id - Récupérer une porte
    static async getDoor(req, res) {
        try {
            const door = await Door.findById(req.params.id);
            
            if (!door) {
                return res.status(404).json({ 
                    success: false,
                    error: 'Porte non trouvée' 
                });
            }
            
            res.json({
                success: true,
                door
            });
        } catch (error) {
            logger.error('Erreur getDoor', { error: error.message });
            res.status(500).json({ 
                success: false,
                error: 'Erreur lors de la récupération de la porte' 
            });
        }
    }
    
    // GET /api/doors/:id/history - Récupérer l'historique de statut
    static async getStatusHistory(req, res) {
        try {
            const { id } = req.params;
            const { limit = 50 } = req.query;
            
            const history = await Door.getStatusHistory(id, parseInt(limit));
            
            res.json({
                success: true,
                history
            });
        } catch (error) {
            logger.error('Erreur getStatusHistory', { error: error.message });
            res.status(500).json({ 
                success: false,
                error: 'Erreur lors de la récupération de l\'historique' 
            });
        }
    }
    
    // POST /api/doors - Créer une porte
    static async createDoor(req, res) {
        try {
            const { nom, description, localisation, esp32_id, esp32_ip } = req.body;
            
            // Validation
            if (!nom || !esp32_id) {
                return res.status(400).json({ 
                    success: false,
                    error: 'Le nom et l\'ESP32 ID sont requis' 
                });
            }
            
            // Vérifier que l'ESP32 ID n'existe pas déjà
            const existing = await Door.findByEsp32Id(esp32_id);
            if (existing) {
                return res.status(400).json({ 
                    success: false,
                    error: 'Cet ESP32 ID est déjà enregistré' 
                });
            }
            
            const doorId = await Door.create({
                nom,
                description,
                localisation,
                esp32_id,
                esp32_ip
            });
            
            logger.info('Porte créée', { 
                doorId, 
                esp32_id, 
                createdBy: req.user.id 
            });
            
            // Notifier via WebSocket
            global.io.to('admin-room').emit('door_created', {
                doorId,
                nom,
                esp32_id
            });
            
            res.status(201).json({
                success: true,
                doorId,
                message: 'Porte créée avec succès'
            });
        } catch (error) {
            logger.error('Erreur createDoor', { error: error.message });
            res.status(500).json({ 
                success: false,
                error: 'Erreur lors de la création de la porte' 
            });
        }
    }
    
    // PUT /api/doors/:id - Mettre à jour une porte
    static async updateDoor(req, res) {
        try {
            const { id } = req.params;
            const { nom, description, localisation, esp32_ip, is_active } = req.body;
            
            const door = await Door.findById(id);
            if (!door) {
                return res.status(404).json({ 
                    success: false,
                    error: 'Porte non trouvée' 
                });
            }
            
            const updateData = {};
            if (nom !== undefined) updateData.nom = nom;
            if (description !== undefined) updateData.description = description;
            if (localisation !== undefined) updateData.localisation = localisation;
            if (esp32_ip !== undefined) updateData.esp32_ip = esp32_ip;
            if (is_active !== undefined) updateData.is_active = is_active;
            
            await Door.update(id, updateData);
            
            logger.info('Porte mise à jour', { 
                doorId: id, 
                updatedBy: req.user.id 
            });
            
            // Notifier via WebSocket
            global.io.to('admin-room').emit('door_updated', { doorId: id });
            
            res.json({
                success: true,
                message: 'Porte mise à jour avec succès'
            });
        } catch (error) {
            logger.error('Erreur updateDoor', { error: error.message });
            res.status(500).json({ 
                success: false,
                error: 'Erreur lors de la mise à jour de la porte' 
            });
        }
    }
    
    // DELETE /api/doors/:id - Supprimer une porte
    static async deleteDoor(req, res) {
        try {
            const { id } = req.params;
            
            const door = await Door.findById(id);
            if (!door) {
                return res.status(404).json({ 
                    success: false,
                    error: 'Porte non trouvée' 
                });
            }
            
            await Door.delete(id);
            
            logger.info('Porte supprimée', { 
                doorId: id, 
                deletedBy: req.user.id 
            });
            
            // Notifier via WebSocket
            global.io.to('admin-room').emit('door_deleted', { doorId: id });
            
            res.json({
                success: true,
                message: 'Porte supprimée avec succès'
            });
        } catch (error) {
            logger.error('Erreur deleteDoor', { error: error.message });
            res.status(500).json({ 
                success: false,
                error: 'Erreur lors de la suppression de la porte' 
            });
        }
    }
}

module.exports = DoorController;