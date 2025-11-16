const UserModel = require('../models/User');
const loggerUser = require('../config/logger');

class UserController {
    
    static async getAllUsers(req, res) {
        try {
            const { role, search, page = 1, limit = 10 } = req.query;
            const offset = (page - 1) * limit;
            
            const filters = { role, search, limit, offset };
            const users = await UserModel.findAll(filters);
            const total = await UserModel.count({ role, search });
            
            res.json({
                success: true,
                users,
                pagination: {
                    total,
                    page: parseInt(page),
                    limit: parseInt(limit),
                    pages: Math.ceil(total / limit)
                }
            });
        } catch (error) {
            loggerUser.error('Erreur getAllUsers', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Erreur lors de la récupération des utilisateurs'
            });
        }
    }
    
    static async getUser(req, res) {
        try {
            const user = await UserModel.findById(req.params.id);
            
            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'Utilisateur non trouvé'
                });
            }
            
            res.json({
                success: true,
                user
            });
        } catch (error) {
            loggerUser.error('Erreur getUser', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Erreur lors de la récupération'
            });
        }
    }
    
    static async createUser(req, res) {
        try {
            const { nom, prenom, email, telephone, role, password } = req.body;
            
            if (!nom || !prenom || !email) {
                return res.status(400).json({
                    success: false,
                    error: 'Nom, prénom et email requis'
                });
            }
            
            if (await UserModel.existsByEmail(email)) {
                return res.status(400).json({
                    success: false,
                    error: 'Cet email est déjà utilisé'
                });
            }
            
            const userId = await UserModel.create({
                nom, prenom, email, telephone, role, password
            });
            
            loggerUser.info('Utilisateur créé', { userId, email, createdBy: req.user.id });
            
            res.status(201).json({
                success: true,
                userId,
                message: 'Utilisateur créé avec succès'
            });
        } catch (error) {
            loggerUser.error('Erreur createUser', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Erreur lors de la création'
            });
        }
    }
    
    static async updateUser(req, res) {
        try {
            const { id } = req.params;
            const { nom, prenom, telephone, password } = req.body;
            
            const user = await UserModel.findById(id);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    error: 'Utilisateur non trouvé'
                });
            }
            
            await UserModel.update(id, { nom, prenom, telephone, password });
            
            loggerUser.info('Utilisateur mis à jour', { userId: id, updatedBy: req.user.id });
            
            res.json({
                success: true,
                message: 'Utilisateur mis à jour'
            });
        } catch (error) {
            loggerUser.error('Erreur updateUser', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Erreur lors de la mise à jour'
            });
        }
    }
    
    static async updateStatus(req, res) {
        try {
            const { id } = req.params;
            const { is_active } = req.body;
            
            if (typeof is_active !== 'boolean') {
                return res.status(400).json({
                    success: false,
                    error: 'is_active doit être un booléen'
                });
            }
            
            await UserModel.update(id, { is_active });
            
            loggerUser.info('Statut utilisateur modifié', { userId: id, is_active });
            
            res.json({
                success: true,
                message: 'Statut modifié'
            });
        } catch (error) {
            loggerUser.error('Erreur updateStatus', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Erreur lors de la modification'
            });
        }
    }
    
    static async deleteUser(req, res) {
        try {
            const { id } = req.params;
            
            if (parseInt(id) === req.user.id) {
                return res.status(400).json({
                    success: false,
                    error: 'Vous ne pouvez pas supprimer votre propre compte'
                });
            }
            
            await UserModel.delete(id);
            
            loggerUser.info('Utilisateur supprimé', { userId: id, deletedBy: req.user.id });
            
            res.json({
                success: true,
                message: 'Utilisateur supprimé'
            });
        } catch (error) {
            loggerUser.error('Erreur deleteUser', { error: error.message });
            res.status(500).json({
                success: false,
                error: 'Erreur lors de la suppression'
            });
        }
    }
}

module.exports = UserController;