const express = require('express');
const AuthController = require('../controllers/AuthController');
const { verifyToken } = require('../middleware/sessionTimeout');

const router = express.Router();

router.post('/login', AuthController.login);
router.post('/logout', verifyToken, AuthController.logout);
router.get('/verify', verifyToken, AuthController.verify);
router.post('/refresh', verifyToken, AuthController.refresh);

module.exports = router;