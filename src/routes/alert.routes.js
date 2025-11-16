const express = require('express');
const AlertController = require('../controllers/AlertController');
const { verifyToken } = require('../middleware/sessionTimeout');
const { verifyAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(verifyToken, verifyAdmin);

router.get('/', AlertController.getAllAlerts);
router.get('/unread-count', AlertController.getUnreadCount);
router.patch('/:id/read', AlertController.markAsRead);
router.patch('/read-all', AlertController.markAllAsRead);
router.delete('/:id', AlertController.deleteAlert);

module.exports = router;