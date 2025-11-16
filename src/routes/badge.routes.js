const express = require('express');
const BadgeController = require('../controllers/BadgeController');
const { verifyToken } = require('../middleware/sessionTimeout');
const { verifyAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(verifyToken);

router.get('/', verifyAdmin, BadgeController.getAllBadges);
router.get('/:id', verifyAdmin, BadgeController.getBadge);
router.post('/', verifyAdmin, BadgeController.createBadge);
router.put('/:id', verifyAdmin, BadgeController.updateBadge);
router.delete('/:id', verifyAdmin, BadgeController.deleteBadge);
router.post('/:id/regenerate-key', verifyAdmin, BadgeController.regenerateKey);

module.exports = router;