const { body, param, query, validationResult } = require('express-validator');

/**
 * Middleware de validation des données
 */

class Validator {
    
    /**
     * Vérifie les erreurs de validation
     */
    static checkErrors(req, res, next) {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                error: 'Erreur de validation',
                errors: errors.array()
            });
        }
        next();
    }
    
    /**
     * Validation pour la connexion
     */
    static loginValidation() {
        return [
            body('email')
                .isEmail().withMessage('Email invalide')
                .normalizeEmail(),
            body('password')
                .notEmpty().withMessage('Mot de passe requis'),
            this.checkErrors
        ];
    }
    
    /**
     * Validation pour créer un utilisateur
     */
    static createUserValidation() {
        return [
            body('nom')
                .trim()
                .notEmpty().withMessage('Le nom est requis')
                .isLength({ min: 2, max: 100 }).withMessage('Le nom doit contenir entre 2 et 100 caractères'),
            body('prenom')
                .trim()
                .notEmpty().withMessage('Le prénom est requis')
                .isLength({ min: 2, max: 100 }).withMessage('Le prénom doit contenir entre 2 et 100 caractères'),
            body('email')
                .isEmail().withMessage('Email invalide')
                .normalizeEmail(),
            body('telephone')
                .optional()
                .trim()
                .matches(/^[0-9+\s()-]+$/).withMessage('Numéro de téléphone invalide'),
            body('role')
                .isIn(['admin', 'user']).withMessage('Rôle invalide'),
            body('password')
                .optional()
                .isLength({ min: 8 }).withMessage('Le mot de passe doit contenir au moins 8 caractères')
                .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre'),
            this.checkErrors
        ];
    }
    
    /**
     * Validation pour créer un badge
     */
    static createBadgeValidation() {
        return [
            body('user_id')
                .isInt({ min: 1 }).withMessage('ID utilisateur invalide'),
            body('badge_uid')
                .trim()
                .notEmpty().withMessage('UID du badge requis')
                .matches(/^[A-F0-9]+$/i).withMessage('UID doit être en format hexadécimal')
                .isLength({ min: 4, max: 50 }).withMessage('UID invalide'),
            body('date_expiration')
                .optional()
                .isISO8601().withMessage('Date d\'expiration invalide')
                .toDate(),
            this.checkErrors
        ];
    }
    
    /**
     * Validation pour créer une porte
     */
    static createDoorValidation() {
        return [
            body('nom')
                .trim()
                .notEmpty().withMessage('Le nom est requis')
                .isLength({ min: 3, max: 100 }).withMessage('Le nom doit contenir entre 3 et 100 caractères'),
            body('description')
                .optional()
                .trim()
                .isLength({ max: 500 }).withMessage('Description trop longue'),
            body('localisation')
                .optional()
                .trim()
                .isLength({ max: 200 }).withMessage('Localisation trop longue'),
            body('esp32_id')
                .trim()
                .notEmpty().withMessage('L\'ID ESP32 est requis')
                .matches(/^[A-Z0-9_-]+$/i).withMessage('ID ESP32 invalide')
                .isLength({ min: 5, max: 50 }).withMessage('ID ESP32 invalide'),
            body('esp32_ip')
                .optional()
                .isIP().withMessage('Adresse IP invalide'),
            this.checkErrors
        ];
    }
    
    /**
     * Validation pour créer un droit d'accès
     */
    static createAccessRightValidation() {
        return [
            body('badge_id')
                .isInt({ min: 1 }).withMessage('ID badge invalide'),
            body('door_id')
                .isInt({ min: 1 }).withMessage('ID porte invalide'),
            body('heure_debut')
                .optional()
                .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/).withMessage('Heure de début invalide (format HH:MM:SS)'),
            body('heure_fin')
                .optional()
                .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/).withMessage('Heure de fin invalide (format HH:MM:SS)'),
            body('jours_semaine')
                .optional()
                .matches(/^[1-7](,[1-7])*$/).withMessage('Jours de semaine invalides (format: 1,2,3,...)'),
            body('date_debut')
                .optional()
                .isISO8601().withMessage('Date de début invalide')
                .toDate(),
            body('date_fin')
                .optional()
                .isISO8601().withMessage('Date de fin invalide')
                .toDate(),
            this.checkErrors
        ];
    }
    
    /**
     * Validation pour vérifier l'accès (ESP32)
     */
    static verifyAccessValidation() {
        return [
            body('badge_uid')
                .trim()
                .notEmpty().withMessage('UID du badge requis')
                .matches(/^[A-F0-9]+$/i).withMessage('UID invalide'),
            body('esp32_id')
                .trim()
                .notEmpty().withMessage('ID ESP32 requis'),
            body('encryption_key')
                .optional()
                .isLength({ min: 32, max: 255 }).withMessage('Clé de chiffrement invalide'),
            this.checkErrors
        ];
    }
    
    /**
     * Validation pour heartbeat
     */
    static heartbeatValidation() {
        return [
            body('esp32_id')
                .trim()
                .notEmpty().withMessage('ID ESP32 requis'),
            body('ip_address')
                .optional()
                .isIP().withMessage('Adresse IP invalide'),
            body('firmware_version')
                .optional()
                .trim()
                .matches(/^\d+\.\d+\.\d+$/).withMessage('Version firmware invalide (format: 1.0.0)'),
            this.checkErrors
        ];
    }
    
    /**
     * Validation d'un ID en paramètre
     */
    static idParamValidation() {
        return [
            param('id')
                .isInt({ min: 1 }).withMessage('ID invalide'),
            this.checkErrors
        ];
    }
    
    /**
     * Validation de pagination
     */
    static paginationValidation() {
        return [
            query('page')
                .optional()
                .isInt({ min: 1 }).withMessage('Numéro de page invalide')
                .toInt(),
            query('limit')
                .optional()
                .isInt({ min: 1, max: 100 }).withMessage('Limite invalide (1-100)')
                .toInt(),
            this.checkErrors
        ];
    }
}

module.exports = Validator;