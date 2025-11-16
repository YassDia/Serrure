const express = require('express');
const DoorController = require('../controllers/DoorController');
const { verifyToken } = require('../middleware/sessionTimeout');
const { verifyAdmin } = require('../middleware/auth');

const router = express.Router();

// Toutes les routes nécessitent une authentification
router.use(verifyToken);

// GET /api/doors - Récupérer toutes les portes
router.get('/', DoorController.getAllDoors);

// GET /api/doors/stats - Statistiques des portes
router.get('/stats', verifyAdmin, DoorController.getStats);

// GET /api/doors/:id - Récupérer une porte
router.get('/:id', DoorController.getDoor);

// GET /api/doors/:id/history - Historique de statut
router.get('/:id/history', verifyAdmin, DoorController.getStatusHistory);

// POST /api/doors - Créer une porte (admin)
router.post('/', verifyAdmin, DoorController.createDoor);

// PUT /api/doors/:id - Mettre à jour une porte (admin)
router.put('/:id', verifyAdmin, DoorController.updateDoor);

// DELETE /api/doors/:id - Supprimer une porte (admin)
router.delete('/:id', verifyAdmin, DoorController.deleteDoor);

module.exports = router;