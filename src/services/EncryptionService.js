const crypto = require('crypto');

class EncryptionService {
    
    /**
     * Génère une clé de chiffrement unique pour un badge
     * @param {string} badgeUid - UID du badge RFID
     * @returns {string} Clé SHA-256
     */
    static generateBadgeKey(badgeUid) {
        const masterKey = process.env.MASTER_ENCRYPTION_KEY;
        const timestamp = Date.now();
        const random = crypto.randomBytes(16).toString('hex');
        
        // Création d'un hash unique combinant plusieurs facteurs
        return crypto
            .createHash('sha256')
            .update(`${masterKey}:${badgeUid}:${timestamp}:${random}`)
            .digest('hex');
    }
    
    /**
     * Vérifie la validité d'une clé de chiffrement
     * @param {string} providedKey - Clé fournie
     * @param {string} storedKey - Clé stockée en base
     * @returns {boolean}
     */
    static verifyKey(providedKey, storedKey) {
        return providedKey === storedKey;
    }
    
    /**
     * Hash un mot de passe avec bcrypt
     * @param {string} password - Mot de passe en clair
     * @returns {Promise<string>} Hash bcrypt
     */
    static async hashPassword(password) {
        const bcrypt = require('bcrypt');
        return await bcrypt.hash(password, 10);
    }
    
    /**
     * Vérifie un mot de passe
     * @param {string} plainPassword - Mot de passe en clair
     * @param {string} hashedPassword - Hash stocké
     * @returns {Promise<boolean>}
     */
    static async verifyPassword(plainPassword, hashedPassword) {
        const bcrypt = require('bcrypt');
        return await bcrypt.compare(plainPassword, hashedPassword);
    }
    
    /**
     * Génère un token aléatoire sécurisé
     * @param {number} length - Longueur en bytes
     * @returns {string} Token hexadécimal
     */
    static generateRandomToken(length = 32) {
        return crypto.randomBytes(length).toString('hex');
    }
    
    /**
     * Chiffre des données sensibles (AES-256)
     * @param {string} data - Données à chiffrer
     * @param {string} key - Clé de chiffrement
     * @returns {string} Données chiffrées (base64)
     */
    static encrypt(data, key = process.env.MASTER_ENCRYPTION_KEY) {
        const iv = crypto.randomBytes(16);
        const keyHash = crypto.createHash('sha256').update(key).digest();
        const cipher = crypto.createCipheriv('aes-256-cbc', keyHash, iv);
        
        let encrypted = cipher.update(data, 'utf8', 'base64');
        encrypted += cipher.final('base64');
        
        // Retourne IV + données chiffrées
        return iv.toString('base64') + ':' + encrypted;
    }
    
    /**
     * Déchiffre des données (AES-256)
     * @param {string} encryptedData - Données chiffrées
     * @param {string} key - Clé de chiffrement
     * @returns {string} Données en clair
     */
    static decrypt(encryptedData, key = process.env.MASTER_ENCRYPTION_KEY) {
        const parts = encryptedData.split(':');
        const iv = Buffer.from(parts[0], 'base64');
        const encrypted = parts[1];
        
        const keyHash = crypto.createHash('sha256').update(key).digest();
        const decipher = crypto.createDecipheriv('aes-256-cbc', keyHash, iv);
        
        let decrypted = decipher.update(encrypted, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    }
}

module.exports = EncryptionService;