const mysql = require('mysql2');
const logger = require('./logger');

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'access_control_system',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    timezone: '+00:00'
});

const promisePool = pool.promise();

// Test de connexion initial
pool.getConnection((err, connection) => {
    if (err) {
        logger.error('Erreur MySQL', { error: err.message, code: err.code });
        return;
    }
    logger.info('MySQL connecté', { host: process.env.DB_HOST });
    connection.release();
});

// Gestion des erreurs du pool
pool.on('error', (err) => {
    logger.error('Erreur MySQL Pool', { error: err.message });
});

/**
 * Wrapper sécurisé pour execute - mysql2 gère automatiquement la conversion
 */
async function execute(sql, params) {
    try {
        // Si pas de params ou tableau vide, appeler sans paramètres
        if (!params || (Array.isArray(params) && params.length === 0)) {
            return await promisePool.execute(sql);
        }
        
        // mysql2 gère automatiquement la conversion des types
        return await promisePool.execute(sql, params);
    } catch (err) {
        logger.error('DB execute error', {
            message: err.message,
            code: err.code,
            query: sql,
            params: params
        });
        throw err;
    }
}

/**
 * Wrapper sécurisé pour query
 */
async function query(sql, params) {
    try {
        if (!params || (Array.isArray(params) && params.length === 0)) {
            return await promisePool.query(sql);
        }
        return await promisePool.query(sql, params);
    } catch (err) {
        logger.error('DB query error', {
            message: err.message,
            code: err.code,
            query: sql,
            params: params
        });
        throw err;
    }
}

/**
 * Teste la connexion à la base de données
 */
async function testConnection() {
    try {
        const [rows] = await promisePool.query('SELECT 1 AS test');
        return rows.length > 0 && rows[0].test === 1;
    } catch (error) {
        logger.error('Test de connexion échoué', { error: error.message });
        return false;
    }
}

/**
 * Ferme proprement toutes les connexions du pool
 */
async function close() {
    return new Promise((resolve, reject) => {
        pool.end((err) => {
            if (err) {
                logger.error('Erreur lors de la fermeture du pool', { error: err.message });
                reject(err);
            } else {
                logger.info('Pool MySQL fermé proprement');
                resolve();
            }
        });
    });
}

module.exports = {
    query,
    execute,
    getConnection: () => promisePool.getConnection(),
    pool: promisePool,
    testConnection,
    close
};