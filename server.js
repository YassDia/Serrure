require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');
const https = require('https');
const socketIO = require('socket.io');
const rateLimit = require('express-rate-limit');
const path = require('path');
const logger = require('./src/config/logger');
const db = require('./src/config/database');
const DoorMonitorService = require('./src/services/DoorMonitorService');
const { startSessionCleanup } = require('./src/middleware/sessionTimeout');
const AlertDetectionService = require('./src/services/AlertDetectionService');

// Import SSL uniquement pour HTTPS
const fs = require('fs');
const sslOptions = {
    key: fs.readFileSync(path.join(__dirname, 'certs/server-key.pem')),
    cert: fs.readFileSync(path.join(__dirname, 'certs/server-cert.pem')),
    ca: fs.readFileSync(path.join(__dirname, 'certs/ca-cert.pem')),
    requestCert: true,
    rejectUnauthorized: true  // TLS mutuel strict pour ESP32
};

// Import du router principal
const routes = require('./src/routes');

// ==================== APPLICATION EXPRESS ====================
const app = express();

// ==================== MIDDLEWARES ====================

// Sécurité
app.use(helmet({
    contentSecurityPolicy: false
}));

app.use(cors({
    origin: process.env.ALLOWED_ORIGINS.split(','),
    credentials: true
}));

// Limitation du taux de requêtes
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    message: 'Trop de requêtes depuis cette IP',
    standardHeaders: true,
    legacyHeaders: false
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false
});

app.use('/api/auth', authLimiter);
app.use('/api/users', limiter);
app.use('/api/badges', limiter);
app.use('/api/doors', limiter);
app.use('/api/access', limiter);
app.use('/api/logs', limiter);
app.use('/api/alerts', limiter);

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Fichiers statiques
app.use(express.static('public'));

// Middleware de logging
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('user-agent')
    });
    next();
});

// ==================== CRÉATION DES SERVEURS ====================

// Serveur HTTP pour le dashboard
const httpServer = http.createServer(app);

// Serveur HTTPS pour les ESP32
const httpsServer = https.createServer(sslOptions, app);

// ==================== WEBSOCKET (sur HTTP) ====================

const io = socketIO(httpServer, {
    cors: {
        origin: process.env.ALLOWED_ORIGINS.split(','),
        methods: ['GET', 'POST'],
        credentials: true
    }
});

global.io = io;

// Configuration WebSocket
io.on('connection', (socket) => {
    logger.info('Client WebSocket connecté', { socketId: socket.id });
    
    socket.on('authenticate', (token) => {
        const jwt = require('jsonwebtoken');
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.userId = decoded.id;
            socket.userRole = decoded.role;
            
            if (decoded.role === 'admin') {
                socket.join('admin-room');
                logger.info('Admin connecté via WebSocket', { userId: decoded.id });
            }
            
            socket.emit('authenticated', { success: true, role: decoded.role });
        } catch (error) {
            socket.emit('authenticated', { success: false, error: 'Token invalide' });
            logger.warn('Authentification WebSocket échouée', { error: error.message });
        }
    });
    
    socket.on('disconnect', () => {
        logger.info('Client WebSocket déconnecté', { socketId: socket.id });
    });
    
    socket.on('error', (error) => {
        logger.error('Erreur WebSocket', { error: error.message });
    });
});

// ==================== SERVICES ====================

const alertService = new AlertDetectionService(io);
app.set('alertDetectionService', alertService);

const doorMonitor = new DoorMonitorService(io);
doorMonitor.setAlertService(alertService);
app.set('doorMonitor', doorMonitor);

// ==================== ROUTES ====================

// Routes API
app.use('/api', routes);

// Health check
app.get('/api/health', async (req, res) => {
    const dbStatus = await db.testConnection();
    
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: dbStatus ? 'connected' : 'disconnected',
        version: '1.0.0',
        environment: process.env.NODE_ENV,
        server: req.secure ? 'HTTPS (ESP32)' : 'HTTP (Dashboard)'
    });
});

// ==================== ROUTES SPA ====================

const spaRoutes = [
    '/',
    '/dashboard',
    '/doors',
    '/users',
    '/groups',
    '/badges',
    '/access',
    '/logs',
    '/alerts'
];

spaRoutes.forEach(route => {
    app.get(route, (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });
});

// ==================== GESTION D'ERREURS ====================

// Gestion 404
app.use((req, res) => {
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({
            success: false,
            error: 'Route non trouvée',
            path: req.path
        });
    }
    
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Gestionnaire d'erreurs global
app.use((err, req, res, next) => {
    logger.error('Erreur serveur', {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method
    });
    
    res.status(err.status || 500).json({
        success: false,
        error: process.env.NODE_ENV === 'development'
            ? err.message
            : 'Erreur interne du serveur'
    });
});

// ==================== DÉMARRAGE DES SERVEURS ====================

const HTTP_PORT = process.env.PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;

// Démarrer serveur HTTP (Dashboard)
httpServer.listen(HTTP_PORT, async () => {
    console.log('\n========================================');
    console.log('DASHBOARD HTTP (Interface Web)');
    console.log('========================================');
    console.log(`URL: http://localhost:${HTTP_PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
    console.log(`Démarrage: ${new Date().toLocaleString()}`);
    console.log('========================================\n');
    
    logger.info('Serveur HTTP démarré', {
        port: HTTP_PORT,
        environment: process.env.NODE_ENV,
        nodeVersion: process.version
    });
    
    const dbConnected = await db.testConnection();
    if (dbConnected) {
        logger.info('Base de données connectée');
        console.log('Base de données: Connectée');
    } else {
        logger.error('Erreur de connexion à la base de données');
        console.error('Base de données: Erreur de connexion');
    }
    
    doorMonitor.start();
    logger.info('Service de monitoring des portes démarré');
    console.log('Monitoring des portes: Actif\n');
});

// Démarrer serveur HTTPS (ESP32)
httpsServer.listen(HTTPS_PORT, () => {
    console.log('========================================');
    console.log('ESP32 HTTPS (TLS Mutuel)');
    console.log('========================================');
    console.log(`URL: https://localhost:${HTTPS_PORT}`);
    console.log('Authentification mutuelle: OUI');
    console.log('Certificats requis: OUI');
    console.log('========================================\n');
    
    logger.info('Serveur HTTPS démarré', {
        port: HTTPS_PORT,
        tlsMutual: true
    });
});

startSessionCleanup();

// ==================== ARRÊT PROPRE ====================

const gracefulShutdown = async (signal) => {
    logger.info(`${signal} reçu, fermeture des serveurs...`);
    console.log(`\n${signal} reçu, arrêt en cours...`);
    
    doorMonitor.stop();
    
    httpServer.close(() => {
        logger.info('Serveur HTTP fermé');
        console.log('Serveur HTTP fermé');
    });
    
    httpsServer.close(() => {
        logger.info('Serveur HTTPS fermé');
        console.log('Serveur HTTPS fermé');
    });
    
    setTimeout(async () => {
        try {
            await db.close();
            logger.info('Connexion base de données fermée');
            console.log('Base de données fermée');
        } catch (error) {
            logger.error('Erreur fermeture DB', { error: error.message });
        }
        
        console.log('Au revoir!\n');
        process.exit(0);
    }, 1000);
    
    setTimeout(() => {
        logger.error('Arrêt forcé après timeout');
        console.error('Arrêt forcé après timeout');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (error) => {
    logger.error('Erreur non capturée', {
        error: error.message,
        stack: error.stack
    });
    console.error('Erreur non capturée:', error);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Promise rejetée non gérée', {
        reason: reason,
        promise: promise
    });
    console.error('Promise rejetée:', reason);
});

module.exports = { app, httpServer, httpsServer, io };