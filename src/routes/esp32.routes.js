const express = require('express');
const ESP32SecureController = require('../controllers/ESP32SecureController');
const ESP32Controller = require('../controllers/ESP32Controller');

const router = express.Router();

// ========== ROUTES SÉCURISÉES (TLS MUTUEL) ==========

// Handshake pour établir la session
router.post('/handshake', ESP32SecureController.handshake);

// Vérification d'accès sécurisée avec HMAC
router.post('/verify-access', 
    ESP32SecureController.verifyHMAC,
    ESP32SecureController.verifyAccessSecure
);

// Heartbeat sécurisé
router.post('/heartbeat',
    ESP32SecureController.verifyHMAC,
    ESP32Controller.heartbeat
);

// ========== ROUTES NON SÉCURISÉES (LEGACY) ==========

router.post('/door-opened', ESP32Controller.doorOpened);
router.post('/door-closed', ESP32Controller.doorClosed);
router.get('/authorized-badges/:esp32_id', ESP32Controller.getAuthorizedBadges);
router.get('/sync-time', ESP32Controller.syncTime);

module.exports = router;