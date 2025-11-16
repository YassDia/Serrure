const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const badgeRoutes = require('./badge.routes');
const doorRoutes = require('./door.routes');
const accessRoutes = require('./access.routes');
const logRoutes = require('./log.routes');
const alertRoutes = require('./alert.routes');
const esp32Routes = require('./esp32.routes');
const groupRoutes = require('./group.routes');

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/badges', badgeRoutes);
router.use('/doors', doorRoutes);
router.use('/pieces', doorRoutes);
router.use('/access', accessRoutes);
router.use('/logs', logRoutes);
router.use('/alerts', alertRoutes);
router.use('/esp32', esp32Routes);
router.use('/groups', groupRoutes);

module.exports = router;