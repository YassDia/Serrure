const express = require('express');
const UserController = require('../controllers/UserController');
const { verifyToken, verifyAdmin, verifyOwnerOrAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(verifyToken);

router.get('/', verifyAdmin, UserController.getAllUsers);
router.get('/:id', verifyOwnerOrAdmin, UserController.getUser);
router.post('/', verifyAdmin, UserController.createUser);
router.put('/:id', verifyOwnerOrAdmin, UserController.updateUser);
router.patch('/:id/status', verifyAdmin, UserController.updateStatus);
router.delete('/:id', verifyAdmin, UserController.deleteUser);

module.exports = router;