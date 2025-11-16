const express = require('express');
const GroupController = require('../controllers/GroupController');
const { verifyToken } = require('../middleware/sessionTimeout');
const { verifyAdmin } = require('../middleware/auth');

const router = express.Router();

// Toutes les routes nécessitent une authentification admin
router.use(verifyToken, verifyAdmin);

// Gestion des groupes
router.get('/', GroupController.getAllGroups);
router.get('/:id', GroupController.getGroup);
router.post('/', GroupController.createGroup);
router.put('/:id', GroupController.updateGroup);
router.delete('/:id', GroupController.deleteGroup);

// Gestion des membres
router.get('/:id/members', GroupController.getMembers);
router.post('/:id/members', GroupController.addMember);
router.delete('/:id/members/:userId', GroupController.removeMember);

module.exports = router;