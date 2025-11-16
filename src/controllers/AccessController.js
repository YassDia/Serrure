const AccessRight = require('../models/AccessRight');
const Group = require('../models/Group');
const Badge = require('../models/Badge');
const Door = require('../models/Door');
const BadgeGroup = require('../models/BadgeGroup');
const DoorGroup = require('../models/DoorGroup');
const db = require('../config/database');
const logger = require('../config/logger');

class AccessController {
    
    static async getAllAccessRights(req, res) {
        try {
            const { 
                badge_id, 
                badge_group_id,
                door_id, 
                door_group_id,
                group_id, 
                is_active 
            } = req.query;
            
            const filters = { 
                badge_id, 
                badge_group_id,
                door_id, 
                door_group_id,
                group_id, 
                is_active 
            };
            const rights = await AccessRight.findAll(filters);
            
            res.json({
                success: true,
                accessRights: rights
            });
        } catch (error) {
            logger.error('Erreur getAllAccessRights', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Erreur lors de la récupération'
            });
        }
    }
    
    static async getAccessRight(req, res) {
        try {
            const right = await AccessRight.findById(req.params.id);
            
            if (!right) {
                return res.status(404).json({
                    success: false,
                    error: 'Droit d\'accès non trouvé'
                });
            }
            
            res.json({
                success: true,
                accessRight: right
            });
        } catch (error) {
            logger.error('Erreur getAccessRight', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Erreur lors de la récupération'
            });
        }
    }
    
    static async createAccessRight(req, res) {
        try {
            const {
                badge_id,
                badge_group_id,
                group_id,
                door_id,
                door_group_id,
                heure_debut,
                heure_fin,
                jours_semaine,
                date_debut,
                date_fin
            } = req.body;
            
            // Validation: Au moins un "sujet" (badge, badge_group, ou group)
            const subjectCount = [badge_id, badge_group_id, group_id].filter(x => x).length;
            if (subjectCount === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Au moins un badge_id, badge_group_id ou group_id requis'
                });
            }
            
            if (subjectCount > 1) {
                return res.status(400).json({
                    success: false,
                    error: 'Un seul type de sujet autorisé (badge OU groupe de badges OU groupe d\'utilisateurs)'
                });
            }
            
            // Validation: Au moins une "cible" (door ou door_group)
            const targetCount = [door_id, door_group_id].filter(x => x).length;
            if (targetCount === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Au moins un door_id ou door_group_id requis'
                });
            }
            
            if (targetCount > 1) {
                return res.status(400).json({
                    success: false,
                    error: 'Une seule cible autorisée (porte OU groupe de portes)'
                });
            }
            
            // Vérifier que les entités existent
            if (badge_id) {
                const badge = await Badge.findById(badge_id);
                if (!badge) {
                    return res.status(404).json({
                        success: false,
                        error: 'Badge non trouvé'
                    });
                }
                
                // Vérifier que le badge n'est pas dans un groupe
                const [inGroup] = await db.execute(
                    'SELECT id FROM badge_group_members WHERE badge_id = ?',
                    [badge_id]
                );
                
                if (inGroup.length > 0) {
                    return res.status(400).json({
                        success: false,
                        error: 'Ce badge fait partie d\'un groupe. Les droits doivent être gérés au niveau du groupe.'
                    });
                }
            }
            
            if (badge_group_id) {
                const badgeGroup = await BadgeGroup.findById(badge_group_id);
                if (!badgeGroup) {
                    return res.status(404).json({
                        success: false,
                        error: 'Groupe de badges non trouvé'
                    });
                }
            }
            
            if (group_id) {
                const group = await Group.findById(group_id);
                if (!group) {
                    return res.status(404).json({
                        success: false,
                        error: 'Groupe d\'utilisateurs non trouvé'
                    });
                }
            }
            
            if (door_id) {
                const door = await Door.findById(door_id);
                if (!door) {
                    return res.status(404).json({
                        success: false,
                        error: 'Porte non trouvée'
                    });
                }
            }
            
            if (door_group_id) {
                const doorGroup = await DoorGroup.findById(door_group_id);
                if (!doorGroup) {
                    return res.status(404).json({
                        success: false,
                        error: 'Groupe de portes non trouvé'
                    });
                }
            }
            
            // Vérifier les doublons
            const [existing] = await db.execute(
                `SELECT id FROM access_rights 
                 WHERE (badge_id = ? OR (badge_id IS NULL AND ? IS NULL))
                 AND (badge_group_id = ? OR (badge_group_id IS NULL AND ? IS NULL))
                 AND (group_id = ? OR (group_id IS NULL AND ? IS NULL))
                 AND (door_id = ? OR (door_id IS NULL AND ? IS NULL))
                 AND (door_group_id = ? OR (door_group_id IS NULL AND ? IS NULL))`,
                [
                    badge_id, badge_id,
                    badge_group_id, badge_group_id,
                    group_id, group_id,
                    door_id, door_id,
                    door_group_id, door_group_id
                ]
            );
            
            if (existing.length > 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Un droit d\'accès identique existe déjà'
                });
            }
            
            const accessRightId = await AccessRight.create({
                badge_id,
                badge_group_id,
                group_id,
                door_id,
                door_group_id,
                heure_debut,
                heure_fin,
                jours_semaine,
                date_debut,
                date_fin
            });
            
            logger.info('Droit d\'accès créé', {
                accessRightId, 
                badge_id,
                badge_group_id,
                group_id, 
                door_id,
                door_group_id,
                createdBy: req.user.id
            });
            
            global.io.emit('access_right_updated', { 
                doorId: door_id || door_group_id,
                action: 'created',
                type: badge_id ? 'badge' : badge_group_id ? 'badge_group' : 'group'
            });
            
            res.status(201).json({
                success: true,
                accessRightId,
                message: 'Droit d\'accès créé'
            });
        } catch (error) {
            logger.error('Erreur createAccessRight', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Erreur lors de la création'
            });
        }
    }
    
    static async updateAccessRight(req, res) {
        try {
            const { id } = req.params;
            const {
                heure_debut, heure_fin, jours_semaine,
                date_debut, date_fin, is_active
            } = req.body;
            
            const right = await AccessRight.findById(id);
            if (!right) {
                return res.status(404).json({
                    success: false,
                    error: 'Droit d\'accès non trouvé'
                });
            }
            
            await AccessRight.update(id, {
                heure_debut, heure_fin, jours_semaine,
                date_debut, date_fin, is_active
            });
            
            logger.info('Droit d\'accès mis à jour', { accessRightId: id, updatedBy: req.user.id });
            
            global.io.emit('access_right_updated', { 
                doorId: right.door_id || right.door_group_id,
                action: 'updated'
            });
            
            res.json({
                success: true,
                message: 'Droit d\'accès mis à jour'
            });
        } catch (error) {
            logger.error('Erreur updateAccessRight', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Erreur lors de la mise à jour'
            });
        }
    }
    
    static async deleteAccessRight(req, res) {
        try {
            const { id } = req.params;
            
            const right = await AccessRight.findById(id);
            if (!right) {
                return res.status(404).json({
                    success: false,
                    error: 'Droit d\'accès non trouvé'
                });
            }
            
            await AccessRight.delete(id);
            
            logger.info('Droit d\'accès supprimé', { accessRightId: id, deletedBy: req.user.id });
            
            global.io.emit('access_right_updated', { 
                doorId: right.door_id || right.door_group_id,
                action: 'deleted'
            });
            
            res.json({
                success: true,
                message: 'Droit d\'accès supprimé'
            });
        } catch (error) {
            logger.error('Erreur deleteAccessRight', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Erreur lors de la suppression'
            });
        }
    }
}

module.exports = AccessController;