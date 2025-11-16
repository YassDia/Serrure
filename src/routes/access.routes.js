const express = require('express');
const AccessController = require('../controllers/AccessController');
const { verifyToken } = require('../middleware/sessionTimeout');
const { verifyAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(verifyToken);

router.get('/', verifyAdmin, AccessController.getAllAccessRights);
router.get('/:id', verifyAdmin, AccessController.getAccessRight);
router.post('/', verifyAdmin, AccessController.createAccessRight);
router.put('/:id', verifyAdmin, AccessController.updateAccessRight);
router.delete('/:id', verifyAdmin, AccessController.deleteAccessRight);

module.exports = router;
