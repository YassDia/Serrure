const Group = require('../models/Group');
const User = require('../models/User');
const logger = require('../config/logger');

class GroupController {
    
    // GET /api/groups - Récupérer tous les groupes
    static async getAllGroups(req, res) {
        try {
            const { is_active, search, page = 1, limit = 10 } = req.query;
            const offset = (page - 1) * limit;
            
            const filters = { is_active, search, limit, offset };
            const groups = await Group.findAll(filters);
            const total = await Group.count({ is_active, search });
            
            res.json({
                success: true,
                groups,
                pagination: {
                    total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    pages: Math.ceil(total / limit)
                }
            });
        } catch (error) {
            logger.error('Erreur getAllGroups', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Erreur lors de la récupération des groupes'
            });
        }
    }
    
    // GET /api/groups/:id - Récupérer un groupe
    static async getGroup(req, res) {
        try {
            const group = await Group.findById(req.params.id);
            
            if (!group) {
                return res.status(404).json({
                    success: false,
                    error: 'Groupe non trouvé'
                });
            }
            
            // Récupérer aussi les membres
            const members = await Group.getMembers(req.params.id);
            
            res.json({
                success: true,
                group: {
                    ...group,
                    members
                }
            });
        } catch (error) {
            logger.error('Erreur getGroup', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Erreur lors de la récupération du groupe'
            });
        }
    }
    
    // POST /api/groups - Créer un groupe
    static async createGroup(req, res) {
        try {
            const { nom, description, couleur } = req.body;
            
            if (!nom) {
                return res.status(400).json({
                    success: false,
                    error: 'Le nom du groupe est requis'
                });
            }
            
            // Vérifier que le nom n'existe pas déjà
            if (await Group.existsByName(nom)) {
                return res.status(400).json({
                    success: false,
                    error: 'Un groupe avec ce nom existe déjà'
                });
            }
            
            const groupId = await Group.create({ nom, description, couleur });
            
            logger.info('Groupe créé', { groupId, nom, createdBy: req.user.id });
            
            global.io.to('admin-room').emit('group_created', { groupId, nom });
            
            res.status(201).json({
                success: true,
                groupId,
                message: 'Groupe créé avec succès'
            });
        } catch (error) {
            logger.error('Erreur createGroup', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Erreur lors de la création du groupe'
            });
        }
    }
    
    // PUT /api/groups/:id - Mettre à jour un groupe
    static async updateGroup(req, res) {
        try {
            const { id } = req.params;
            const { nom, description, couleur, is_active } = req.body;
            
            const group = await Group.findById(id);
            if (!group) {
                return res.status(404).json({
                    success: false,
                    error: 'Groupe non trouvé'
                });
            }
            
            // Vérifier que le nouveau nom n'existe pas déjà
            if (nom && nom !== group.nom && await Group.existsByName(nom)) {
                return res.status(400).json({
                    success: false,
                    error: 'Un groupe avec ce nom existe déjà'
                });
            }
            
            await Group.update(id, { nom, description, couleur, is_active });
            
            logger.info('Groupe mis à jour', { groupId: id, updatedBy: req.user.id });
            
            global.io.to('admin-room').emit('group_updated', { groupId: id });
            
            res.json({
                success: true,
                message: 'Groupe mis à jour avec succès'
            });
        } catch (error) {
            logger.error('Erreur updateGroup', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Erreur lors de la mise à jour du groupe'
            });
        }
    }
    
    // DELETE /api/groups/:id - Supprimer un groupe
    static async deleteGroup(req, res) {
        try {
            const { id } = req.params;
            
            const group = await Group.findById(id);
            if (!group) {
                return res.status(404).json({
                    success: false,
                    error: 'Groupe non trouvé'
                });
            }
            
            await Group.delete(id);
            
            logger.info('Groupe supprimé', { groupId: id, deletedBy: req.user.id });
            
            global.io.to('admin-room').emit('group_deleted', { groupId: id });
            
            res.json({
                success: true,
                message: 'Groupe supprimé avec succès'
            });
        } catch (error) {
            logger.error('Erreur deleteGroup', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Erreur lors de la suppression du groupe'
            });
        }
    }
    
    // ===== GESTION DES MEMBRES =====
    
    // POST /api/groups/:id/members - Ajouter un membre
    static async addMember(req, res) {
        try {
            const { id } = req.params;
            const { user_id } = req.body;
            
            if (!user_id) {
                return res.status(400).json({
                    success: false,
                    error: 'ID utilisateur requis'
                });
            }
            
            // Vérifier que le groupe existe
            const group = await Group.findById(id);
            if (!group) {
                return res.status(404).json({
                    success: false,
                    error: 'Groupe non trouvé'
                });
            }
            
            // Vérifier que l'utilisateur existe
            const user = await User.findById(user_id);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'Utilisateur non trouvé'
                });
            }
            
            // Vérifier qu'il n'est pas déjà membre
            if (await Group.isMember(id, user_id)) {
                return res.status(400).json({
                    success: false,
                    error: 'Cet utilisateur est déjà membre du groupe'
                });
            }
            
            await Group.addMember(id, user_id, req.user.id);
            
            logger.info('Membre ajouté au groupe', { 
                groupId: id, 
                userId: user_id, 
                addedBy: req.user.id 
            });
            
            global.io.to('admin-room').emit('group_member_added', { 
                groupId: id, 
                userId: user_id 
            });
            
            res.json({
                success: true,
                message: 'Membre ajouté au groupe'
            });
        } catch (error) {
            logger.error('Erreur addMember', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Erreur lors de l\'ajout du membre'
            });
        }
    }
    
    // DELETE /api/groups/:id/members/:userId - Retirer un membre
    static async removeMember(req, res) {
        try {
            const { id, userId } = req.params;
            
            const group = await Group.findById(id);
            if (!group) {
                return res.status(404).json({
                    success: false,
                    error: 'Groupe non trouvé'
                });
            }
            
            if (!await Group.isMember(id, userId)) {
                return res.status(400).json({
                    success: false,
                    error: 'Cet utilisateur n\'est pas membre du groupe'
                });
            }
            
            await Group.removeMember(id, userId);
            
            logger.info('Membre retiré du groupe', { 
                groupId: id, 
                userId, 
                removedBy: req.user.id 
            });
            
            global.io.to('admin-room').emit('group_member_removed', { 
                groupId: id, 
                userId 
            });
            
            res.json({
                success: true,
                message: 'Membre retiré du groupe'
            });
        } catch (error) {
            logger.error('Erreur removeMember', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Erreur lors du retrait du membre'
            });
        }
    }
    
    // GET /api/groups/:id/members - Récupérer les membres d'un groupe
    static async getMembers(req, res) {
        try {
            const { id } = req.params;
            
            const group = await Group.findById(id);
            if (!group) {
                return res.status(404).json({
                    success: false,
                    error: 'Groupe non trouvé'
                });
            }
            
            const members = await Group.getMembers(id);
            
            res.json({
                success: true,
                members
            });
        } catch (error) {
            logger.error('Erreur getMembers', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Erreur lors de la récupération des membres'
            });
        }
    }
}

module.exports = GroupController;