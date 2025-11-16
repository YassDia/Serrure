const express = require('express');
const LogController = require('../controllers/LogController');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

router.use(verifyToken);

router.get('/', LogController.getAllLogs);
router.get('/stats', LogController.getStats);

module.exports = router;