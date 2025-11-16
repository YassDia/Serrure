-- phpMyAdmin SQL Dump
-- version 5.1.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1:3306
-- Generation Time: Nov 15, 2025 at 03:06 PM
-- Server version: 8.0.27
-- PHP Version: 7.4.26

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `access_control_system`
--

DELIMITER $$
--
-- Procedures
--
DROP PROCEDURE IF EXISTS `archive_old_alerts`$$
CREATE DEFINER=`root`@`localhost` PROCEDURE `archive_old_alerts` ()  BEGIN
    INSERT INTO alerts_archive (id, type, door_id, badge_uid, message, severity, metadata, is_read, created_at)
    SELECT id, type, door_id, badge_uid, message, severity, metadata, is_read, created_at
    FROM alerts
    WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY);
    
    DELETE FROM alerts
    WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY);
    
    SELECT CONCAT('Archivage terminé: ', ROW_COUNT(), ' alertes archivées') AS result;
END$$

--
-- Functions
--
DROP FUNCTION IF EXISTS `calculate_badge_risk_score`$$
CREATE DEFINER=`root`@`localhost` FUNCTION `calculate_badge_risk_score` (`p_badge_uid` VARCHAR(50)) RETURNS DECIMAL(5,2) READS SQL DATA
    DETERMINISTIC
BEGIN
    DECLARE risk_score DECIMAL(5,2) DEFAULT 0.0;
    DECLARE spam_count INT;
    DECLARE failed_count INT;
    DECLARE cloning_count INT;
    
    SELECT 
        SUM(CASE WHEN type = 'spam_attempts' THEN 1 ELSE 0 END),
        SUM(CASE WHEN type = 'consecutive_failures' THEN 1 ELSE 0 END),
        SUM(CASE WHEN type IN ('impossible_location', 'cloning_attempt') THEN 1 ELSE 0 END)
    INTO spam_count, failed_count, cloning_count
    FROM alerts
    WHERE badge_uid = p_badge_uid
    AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR);
    
    SET risk_score = (
        (IFNULL(spam_count, 0) * 15) +
        (IFNULL(failed_count, 0) * 10) +
        (IFNULL(cloning_count, 0) * 50)
    );
    
    IF risk_score > 100 THEN
        SET risk_score = 100.0;
    END IF;
    
    RETURN risk_score;
END$$

DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `access_logs`
--

DROP TABLE IF EXISTS `access_logs`;
CREATE TABLE IF NOT EXISTS `access_logs` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `badge_id` int DEFAULT NULL COMMENT 'Badge utilisé (NULL si badge inconnu)',
  `door_id` int NOT NULL COMMENT 'Porte sollicitée',
  `badge_uid` varchar(50) NOT NULL COMMENT 'UID du badge présenté',
  `user_name` varchar(200) DEFAULT NULL COMMENT 'Nom de l''utilisateur (cache)',
  `access_granted` tinyint(1) NOT NULL COMMENT 'Accès autorisé (TRUE) ou refusé (FALSE)',
  `reason` varchar(255) DEFAULT NULL COMMENT 'Raison de l''autorisation ou du refus',
  `access_datetime` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Date et heure de la tentative',
  `door_opened` tinyint(1) DEFAULT '0' COMMENT 'Porte effectivement ouverte',
  `door_closed_at` timestamp NULL DEFAULT NULL COMMENT 'Heure de fermeture de la porte',
  PRIMARY KEY (`id`),
  KEY `idx_datetime` (`access_datetime`),
  KEY `idx_badge` (`badge_id`),
  KEY `idx_door` (`door_id`),
  KEY `idx_granted` (`access_granted`),
  KEY `idx_datetime_granted` (`access_datetime`,`access_granted`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COMMENT='Logs de toutes les tentatives d''accès';

-- --------------------------------------------------------

--
-- Table structure for table `access_rights`
--

DROP TABLE IF EXISTS `access_rights`;
CREATE TABLE IF NOT EXISTS `access_rights` (
  `id` int NOT NULL AUTO_INCREMENT,
  `badge_id` int DEFAULT NULL COMMENT 'Badge autorisé (NULL si accès par groupe)',
  `badge_group_id` int DEFAULT NULL COMMENT 'Groupe de badges autorisé',
  `group_id` int DEFAULT NULL COMMENT 'Groupe autorisé (prioritaire sur badge_id)',
  `door_id` int NOT NULL COMMENT 'Porte accessible',
  `door_group_id` int DEFAULT NULL COMMENT 'Groupe de portes autorisé',
  `heure_debut` time DEFAULT '00:00:00' COMMENT 'Heure de début d''accès',
  `heure_fin` time DEFAULT '23:59:59' COMMENT 'Heure de fin d''accès',
  `jours_semaine` varchar(50) DEFAULT '1,2,3,4,5,6,7' COMMENT 'Jours autorisés (1=Lun, 7=Dim)',
  `date_debut` date DEFAULT (curdate()) COMMENT 'Date de début de validité',
  `date_fin` date DEFAULT NULL COMMENT 'Date de fin de validité (NULL = illimité)',
  `is_active` tinyint(1) DEFAULT '1' COMMENT 'Droit actif ou désactivé',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `door_id` (`door_id`),
  KEY `idx_badge_door` (`badge_id`,`door_id`),
  KEY `idx_group` (`group_id`),
  KEY `idx_active` (`is_active`),
  KEY `idx_door_group` (`door_group_id`),
  KEY `idx_badge_group` (`badge_group_id`)
) ENGINE=MyISAM AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb3;

--
-- Dumping data for table `access_rights`
--

INSERT INTO `access_rights` (`id`, `badge_id`, `badge_group_id`, `group_id`, `door_id`, `door_group_id`, `heure_debut`, `heure_fin`, `jours_semaine`, `date_debut`, `date_fin`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 1, NULL, NULL, 1, NULL, '00:00:00', '23:59:59', '1,2,3,4,5,6,7', '2025-10-30', NULL, 1, '2025-10-30 08:14:54', '2025-10-30 08:14:54');

-- --------------------------------------------------------

--
-- Table structure for table `alerts`
--

DROP TABLE IF EXISTS `alerts`;
CREATE TABLE IF NOT EXISTS `alerts` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `type` enum('unauthorized_access','expired_badge','unknown_badge','door_offline','door_online','system_error','spam_attempts','impossible_location','consecutive_failures','invalid_encryption_key','cloning_attempt') NOT NULL,
  `door_id` int DEFAULT NULL COMMENT 'Porte concernée (si applicable)',
  `badge_uid` varchar(50) DEFAULT NULL COMMENT 'Badge concerné (si applicable)',
  `message` text NOT NULL COMMENT 'Message détaillé de l''alerte',
  `severity` enum('info','low','medium','high','critical') DEFAULT 'medium',
  `metadata` json DEFAULT NULL,
  `is_read` tinyint(1) DEFAULT '0' COMMENT 'Alerte lue par un admin',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `door_id` (`door_id`),
  KEY `idx_created` (`created_at`),
  KEY `idx_read` (`is_read`),
  KEY `idx_type` (`type`),
  KEY `idx_alerts_severity` (`severity`),
  KEY `idx_alerts_created_read` (`created_at`,`is_read`),
  KEY `idx_alerts_type_severity` (`type`,`severity`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COMMENT='Alertes de sécurité et incidents';

--
-- Triggers `alerts`
--
DROP TRIGGER IF EXISTS `trigger_disable_high_risk_badge`;
DELIMITER $$
CREATE TRIGGER `trigger_disable_high_risk_badge` AFTER INSERT ON `alerts` FOR EACH ROW BEGIN
    DECLARE badge_risk DECIMAL(5,2);
    DECLARE badge_id_var INT;
    
    IF NEW.badge_uid IS NOT NULL AND NEW.severity = 'critical' THEN
        SET badge_risk = calculate_badge_risk_score(NEW.badge_uid);
        
        IF badge_risk >= 80.0 THEN
            SELECT id INTO badge_id_var 
            FROM badges 
            WHERE badge_uid = NEW.badge_uid 
            LIMIT 1;
            
            IF badge_id_var IS NOT NULL THEN
                UPDATE badges 
                SET is_active = FALSE 
                WHERE id = badge_id_var;
                
                INSERT INTO alerts (type, badge_uid, message, severity)
                VALUES (
                    'system_error',
                    NEW.badge_uid,
                    CONCAT('Badge ', NEW.badge_uid, ' désactivé automatiquement (score de risque: ', badge_risk, ')'),
                    'critical'
                );
            END IF;
        END IF;
    END IF;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `alerts_archive`
--

DROP TABLE IF EXISTS `alerts_archive`;
CREATE TABLE IF NOT EXISTS `alerts_archive` (
  `id` bigint NOT NULL,
  `type` varchar(50) NOT NULL,
  `door_id` int DEFAULT NULL,
  `badge_uid` varchar(50) DEFAULT NULL,
  `message` text NOT NULL,
  `severity` enum('info','low','medium','high','critical') DEFAULT 'medium',
  `metadata` json DEFAULT NULL,
  `is_read` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `archived_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_archived_date` (`archived_at`),
  KEY `idx_archived_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

-- --------------------------------------------------------

--
-- Table structure for table `badges`
--

DROP TABLE IF EXISTS `badges`;
CREATE TABLE IF NOT EXISTS `badges` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL COMMENT 'Utilisateur propriétaire du badge',
  `badge_uid` varchar(50) NOT NULL COMMENT 'UID unique du badge (format HEX)',
  `encryption_key` varchar(255) NOT NULL COMMENT 'Clé SHA-256 anti-clonage',
  `is_active` tinyint(1) DEFAULT '1' COMMENT 'Badge actif ou désactivé',
  `date_activation` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Date de création',
  `date_expiration` timestamp NULL DEFAULT NULL COMMENT 'Date d''expiration (NULL = pas d''expiration)',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `badge_uid` (`badge_uid`),
  KEY `idx_badge_uid` (`badge_uid`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_active` (`is_active`),
  KEY `idx_expiration` (`date_expiration`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb3 COMMENT='Badges RFID/NFC avec clé de sécurité';

--
-- Dumping data for table `badges`
--

INSERT INTO `badges` (`id`, `user_id`, `badge_uid`, `encryption_key`, `is_active`, `date_activation`, `date_expiration`, `created_at`, `updated_at`) VALUES
(1, 2, 'A1B2C3D4', '', 1, '2025-10-30 08:14:53', '2026-10-30 08:14:53', '2025-10-30 08:14:53', '2025-11-08 23:33:02'),
(3, 4, 'A1B2C3D6', 'c56c662c07db0a345ea370986b74d7bbabffdd12c62a2930cc5f6c4f58ad94bd', 1, '2025-11-09 15:59:59', '0000-00-00 00:00:00', '2025-11-09 15:59:59', '2025-11-09 15:59:59');

-- --------------------------------------------------------

--
-- Table structure for table `badge_groups`
--

DROP TABLE IF EXISTS `badge_groups`;
CREATE TABLE IF NOT EXISTS `badge_groups` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nom` varchar(100) NOT NULL COMMENT 'Nom du groupe de badges',
  `description` text COMMENT 'Description',
  `couleur` varchar(7) DEFAULT '#8B5CF6' COMMENT 'Couleur (hex)',
  `is_active` tinyint(1) DEFAULT '1' COMMENT 'Groupe actif',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_nom` (`nom`),
  KEY `idx_active` (`is_active`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb3 COMMENT='Groupes de badges';

--
-- Dumping data for table `badge_groups`
--

INSERT INTO `badge_groups` (`id`, `nom`, `description`, `couleur`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 'Badges Premium', 'Badges avec accès étendu', '#F59E0B', 1, '2025-11-06 23:18:54', '2025-11-06 23:18:54'),
(2, 'Badges Temporaires', 'Badges visiteurs temporaires', '#8B5CF6', 1, '2025-11-06 23:18:54', '2025-11-06 23:18:54');

-- --------------------------------------------------------

--
-- Table structure for table `badge_group_members`
--

DROP TABLE IF EXISTS `badge_group_members`;
CREATE TABLE IF NOT EXISTS `badge_group_members` (
  `id` int NOT NULL AUTO_INCREMENT,
  `badge_group_id` int NOT NULL COMMENT 'ID du groupe de badges',
  `badge_id` int NOT NULL COMMENT 'ID du badge',
  `added_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `added_by` int DEFAULT NULL COMMENT 'Admin qui a ajouté',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_badge_group` (`badge_group_id`,`badge_id`),
  KEY `idx_badge_group` (`badge_group_id`),
  KEY `idx_badge` (`badge_id`),
  KEY `added_by` (`added_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COMMENT='Badges membres des groupes';

--
-- Triggers `badge_group_members`
--
DROP TRIGGER IF EXISTS `prevent_badge_group_if_individual_rights`;
DELIMITER $$
CREATE TRIGGER `prevent_badge_group_if_individual_rights` BEFORE INSERT ON `badge_group_members` FOR EACH ROW BEGIN
    DECLARE has_individual_rights INT;
    
    SELECT COUNT(*) INTO has_individual_rights
    FROM access_rights
    WHERE badge_id = NEW.badge_id
    AND is_active = TRUE;
    
    IF has_individual_rights > 0 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Ce badge possède déjà des droits individuels et ne peut pas être ajouté à un groupe';
    END IF;
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `doors`
--

DROP TABLE IF EXISTS `doors`;
CREATE TABLE IF NOT EXISTS `doors` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nom` varchar(100) NOT NULL COMMENT 'Nom de la porte (ex: Bureau Principal)',
  `description` text COMMENT 'Description détaillée',
  `localisation` varchar(200) DEFAULT NULL COMMENT 'Emplacement physique (ex: Bâtiment A - Étage 2)',
  `esp32_id` varchar(50) NOT NULL COMMENT 'Identifiant unique ESP32 (ex: ESP32_DOOR_001)',
  `esp32_ip` varchar(45) DEFAULT NULL COMMENT 'Adresse IP de l''ESP32 (IPv4 ou IPv6)',
  `is_active` tinyint(1) DEFAULT '1' COMMENT 'Porte active ou désactivée',
  `is_online` tinyint(1) DEFAULT '0' COMMENT 'ESP32 connecté au serveur',
  `last_heartbeat` timestamp NULL DEFAULT NULL COMMENT 'Dernier signal de vie reçu',
  `firmware_version` varchar(20) DEFAULT NULL COMMENT 'Version du firmware ESP32',
  `session_key` varchar(64) DEFAULT NULL,
  `session_key_updated_at` timestamp NULL DEFAULT NULL,
  `tls_certificate_fingerprint` varchar(64) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `esp32_id` (`esp32_id`),
  KEY `idx_esp32_id` (`esp32_id`),
  KEY `idx_online` (`is_online`),
  KEY `idx_active` (`is_active`),
  KEY `idx_last_heartbeat` (`last_heartbeat`),
  KEY `idx_doors_session_key` (`esp32_id`,`session_key`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb3 COMMENT='Portes connectées (ESP32C3 + PN532 + Serrure)';

--
-- Dumping data for table `doors`
--

INSERT INTO `doors` (`id`, `nom`, `description`, `localisation`, `esp32_id`, `esp32_ip`, `is_active`, `is_online`, `last_heartbeat`, `firmware_version`, `session_key`, `session_key_updated_at`, `tls_certificate_fingerprint`, `created_at`, `updated_at`) VALUES
(1, 'Bureau Principal', 'Porte d\'entrée du bureau principal', 'Bâtiment A - RDC', 'ESP32_DOOR_001', NULL, 1, 0, NULL, NULL, NULL, NULL, NULL, '2025-10-30 08:14:54', '2025-10-30 08:14:54');

-- --------------------------------------------------------

--
-- Table structure for table `door_groups`
--

DROP TABLE IF EXISTS `door_groups`;
CREATE TABLE IF NOT EXISTS `door_groups` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nom` varchar(100) NOT NULL COMMENT 'Nom du groupe (ex: Bâtiment A)',
  `description` text COMMENT 'Description du groupe',
  `couleur` varchar(7) DEFAULT '#6366F1' COMMENT 'Couleur du groupe (hex)',
  `is_active` tinyint(1) DEFAULT '1' COMMENT 'Groupe actif',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_nom` (`nom`),
  KEY `idx_active` (`is_active`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb3 COMMENT='Groupes de portes (bâtiments)';

--
-- Dumping data for table `door_groups`
--

INSERT INTO `door_groups` (`id`, `nom`, `description`, `couleur`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 'Bâtiment A', 'Toutes les portes du bâtiment A', '#EF4444', 1, '2025-11-06 23:18:54', '2025-11-06 23:18:54'),
(2, 'Bâtiment B', 'Toutes les portes du bâtiment B', '#3B82F6', 1, '2025-11-06 23:18:54', '2025-11-06 23:18:54'),
(3, 'Portes Extérieures', 'Toutes les entrées extérieures', '#10B981', 1, '2025-11-06 23:18:54', '2025-11-06 23:18:54');

-- --------------------------------------------------------

--
-- Table structure for table `door_group_members`
--

DROP TABLE IF EXISTS `door_group_members`;
CREATE TABLE IF NOT EXISTS `door_group_members` (
  `id` int NOT NULL AUTO_INCREMENT,
  `door_group_id` int NOT NULL COMMENT 'ID du groupe',
  `door_id` int NOT NULL COMMENT 'ID de la porte',
  `added_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `added_by` int DEFAULT NULL COMMENT 'Admin qui a ajouté',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_door_group` (`door_group_id`,`door_id`),
  KEY `idx_door_group` (`door_group_id`),
  KEY `idx_door` (`door_id`),
  KEY `added_by` (`added_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COMMENT='Portes membres des groupes';

-- --------------------------------------------------------

--
-- Table structure for table `door_status_history`
--

DROP TABLE IF EXISTS `door_status_history`;
CREATE TABLE IF NOT EXISTS `door_status_history` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `door_id` int NOT NULL COMMENT 'Porte concernée',
  `status` enum('online','offline') NOT NULL COMMENT 'Statut de connexion',
  `ip_address` varchar(45) DEFAULT NULL COMMENT 'Adresse IP lors du heartbeat',
  `firmware_version` varchar(20) DEFAULT NULL COMMENT 'Version firmware',
  `timestamp` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_door_id` (`door_id`),
  KEY `idx_timestamp` (`timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COMMENT='Historique de disponibilité des portes';

-- --------------------------------------------------------

--
-- Table structure for table `groups`
--

DROP TABLE IF EXISTS `groups`;
CREATE TABLE IF NOT EXISTS `groups` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nom` varchar(100) NOT NULL COMMENT 'Nom du groupe',
  `description` text COMMENT 'Description du groupe',
  `couleur` varchar(7) DEFAULT '#3B82F6' COMMENT 'Couleur du groupe (hex)',
  `is_active` tinyint(1) DEFAULT '1' COMMENT 'Groupe actif',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_nom` (`nom`),
  KEY `idx_active` (`is_active`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb3 COMMENT='Groupes d''utilisateurs';

--
-- Dumping data for table `groups`
--

INSERT INTO `groups` (`id`, `nom`, `description`, `couleur`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 'Administrateurs', 'Personnel administratif avec accès complet', '#EF4444', 1, '2025-11-01 23:50:50', '2025-11-01 23:50:50'),
(2, 'Employés Bureau', 'Employés de bureau - accès standard', '#3B82F6', 1, '2025-11-01 23:50:50', '2025-11-01 23:50:50'),
(3, 'Techniciens', 'Personnel technique', '#F59E0B', 1, '2025-11-01 23:50:50', '2025-11-01 23:50:50'),
(4, 'Visiteurs', 'Accès limité pour visiteurs', '#10B981', 1, '2025-11-01 23:50:50', '2025-11-01 23:50:50');

-- --------------------------------------------------------

--
-- Table structure for table `sessions`
--

DROP TABLE IF EXISTS `sessions`;
CREATE TABLE IF NOT EXISTS `sessions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL COMMENT 'Utilisateur connecté',
  `token` varchar(200) NOT NULL COMMENT 'Token JWT',
  `ip_address` varchar(45) DEFAULT NULL COMMENT 'Adresse IP de connexion',
  `user_agent` text COMMENT 'Navigateur / User Agent',
  `expires_at` timestamp NOT NULL COMMENT 'Date d''expiration du token',
  `last_activity` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Dernière activité',
  `auto_logout_minutes` int DEFAULT '30' COMMENT 'Timeout d''inactivité en minutes',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `token` (`token`),
  KEY `idx_token` (`token`),
  KEY `idx_expires` (`expires_at`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_last_activity` (`last_activity`)
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb3 COMMENT='Sessions JWT des administrateurs';

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
CREATE TABLE IF NOT EXISTS `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nom` varchar(100) NOT NULL COMMENT 'Nom de famille',
  `prenom` varchar(100) NOT NULL COMMENT 'Prénom',
  `email` varchar(150) NOT NULL COMMENT 'Email unique (login pour admins)',
  `telephone` varchar(20) DEFAULT NULL COMMENT 'Numéro de téléphone',
  `password_hash` varchar(255) DEFAULT NULL COMMENT 'Hash bcrypt du mot de passe (uniquement pour admins)',
  `role` enum('admin','user') DEFAULT 'user' COMMENT 'Rôle : admin ou user',
  `is_active` tinyint(1) DEFAULT '1' COMMENT 'Compte actif ou désactivé',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_email` (`email`),
  KEY `idx_role` (`role`),
  KEY `idx_active` (`is_active`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb3 COMMENT='Utilisateurs et administrateurs du système';

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `nom`, `prenom`, `email`, `telephone`, `password_hash`, `role`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 'Admin', 'Système', 'admin@system.com', NULL, '$2a$12$MTQaRaG4bkeIdocKGD3JcO6emDUslE6.HgHhu0NIy7YYD/pGPlLgy', 'admin', 1, '2025-10-30 08:14:53', '2025-11-02 20:51:31'),
(2, 'Dupont', 'Jean', 'jean.dupont@email.com', '+33612345678', NULL, 'user', 1, '2025-10-30 08:14:53', '2025-10-30 08:14:53'),
(4, 'Nianzou', 'Emmanuel', 'test@example.com', '0789738588', NULL, 'user', 1, '2025-11-03 07:14:01', '2025-11-03 07:14:01');

-- --------------------------------------------------------

--
-- Table structure for table `user_groups`
--

DROP TABLE IF EXISTS `user_groups`;
CREATE TABLE IF NOT EXISTS `user_groups` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL COMMENT 'Utilisateur',
  `group_id` int NOT NULL COMMENT 'Groupe',
  `added_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `added_by` int DEFAULT NULL COMMENT 'Admin qui a ajouté',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_group` (`user_id`,`group_id`),
  KEY `idx_user` (`user_id`),
  KEY `idx_group` (`group_id`),
  KEY `fk_ug_added_by` (`added_by`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb3 COMMENT='Membres des groupes';

-- --------------------------------------------------------

--
-- Stand-in structure for view `v_access_verification`
-- (See below for the actual view)
--
DROP VIEW IF EXISTS `v_access_verification`;
CREATE TABLE IF NOT EXISTS `v_access_verification` (
`access_active` tinyint(1)
,`access_right_id` int
,`badge_active` tinyint(1)
,`badge_uid` varchar(50)
,`date_debut` date
,`date_expiration` timestamp
,`date_fin` date
,`door_active` tinyint(1)
,`door_id` int
,`door_name` varchar(100)
,`encryption_key` varchar(255)
,`esp32_id` varchar(50)
,`group_name` varchar(100)
,`heure_debut` time
,`heure_fin` time
,`jours_semaine` varchar(50)
,`user_active` tinyint(1)
,`user_id` int
,`user_name` varchar(201)
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `v_access_verification_extended`
-- (See below for the actual view)
--
DROP VIEW IF EXISTS `v_access_verification_extended`;
CREATE TABLE IF NOT EXISTS `v_access_verification_extended` (
`access_active` tinyint(1)
,`access_right_id` int
,`access_type` varchar(16)
,`badge_active` tinyint(1)
,`badge_group_name` varchar(100)
,`badge_id` int
,`badge_uid` varchar(50)
,`date_debut` date
,`date_expiration` timestamp
,`date_fin` date
,`door_active` tinyint(1)
,`door_group_name` varchar(100)
,`door_id` int
,`door_name` varchar(100)
,`encryption_key` varchar(255)
,`esp32_id` varchar(50)
,`heure_debut` time
,`heure_fin` time
,`jours_semaine` varchar(50)
,`user_active` tinyint(1)
,`user_group_name` varchar(100)
,`user_id` int
,`user_name` varchar(201)
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `v_alert_statistics`
-- (See below for the actual view)
--
DROP VIEW IF EXISTS `v_alert_statistics`;
CREATE TABLE IF NOT EXISTS `v_alert_statistics` (
`alert_count` bigint
,`alert_date` date
,`read_count` decimal(23,0)
,`severity` enum('info','low','medium','high','critical')
,`type` enum('unauthorized_access','expired_badge','unknown_badge','door_offline','door_online','system_error','spam_attempts','impossible_location','consecutive_failures','invalid_encryption_key','cloning_attempt')
,`unread_count` decimal(23,0)
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `v_critical_unread_alerts`
-- (See below for the actual view)
--
DROP VIEW IF EXISTS `v_critical_unread_alerts`;
CREATE TABLE IF NOT EXISTS `v_critical_unread_alerts` (
`badge_uid` varchar(50)
,`created_at` timestamp
,`door_id` int
,`door_name` varchar(100)
,`id` bigint
,`is_read` tinyint(1)
,`localisation` varchar(200)
,`message` text
,`metadata` json
,`minutes_ago` bigint
,`severity` enum('info','low','medium','high','critical')
,`type` enum('unauthorized_access','expired_badge','unknown_badge','door_offline','door_online','system_error','spam_attempts','impossible_location','consecutive_failures','invalid_encryption_key','cloning_attempt')
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `v_high_risk_badges`
-- (See below for the actual view)
--
DROP VIEW IF EXISTS `v_high_risk_badges`;
CREATE TABLE IF NOT EXISTS `v_high_risk_badges` (
`alert_count_24h` bigint
,`badge_uid` varchar(50)
,`email` varchar(150)
,`id` int
,`risk_score` decimal(5,2)
,`user_name` varchar(201)
);

-- --------------------------------------------------------

--
-- Structure for view `v_access_verification`
--
DROP TABLE IF EXISTS `v_access_verification`;

DROP VIEW IF EXISTS `v_access_verification`;
CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_access_verification`  AS SELECT DISTINCT `b`.`badge_uid` AS `badge_uid`, `b`.`encryption_key` AS `encryption_key`, `b`.`is_active` AS `badge_active`, `b`.`date_expiration` AS `date_expiration`, `u`.`id` AS `user_id`, concat(`u`.`prenom`,' ',`u`.`nom`) AS `user_name`, `u`.`is_active` AS `user_active`, `d`.`id` AS `door_id`, `d`.`nom` AS `door_name`, `d`.`esp32_id` AS `esp32_id`, `d`.`is_active` AS `door_active`, `ar`.`id` AS `access_right_id`, `ar`.`heure_debut` AS `heure_debut`, `ar`.`heure_fin` AS `heure_fin`, `ar`.`jours_semaine` AS `jours_semaine`, `ar`.`date_debut` AS `date_debut`, `ar`.`date_fin` AS `date_fin`, `ar`.`is_active` AS `access_active`, (case when (`ar`.`group_id` is not null) then `g`.`nom` else NULL end) AS `group_name` FROM ((((`badges` `b` join `users` `u` on((`b`.`user_id` = `u`.`id`))) join `doors` `d` on((`d`.`is_active` = true))) left join `access_rights` `ar` on((((`ar`.`badge_id` = `b`.`id`) and (`ar`.`badge_id` is not null)) or (`ar`.`group_id` in (select `ug`.`group_id` from `user_groups` `ug` where (`ug`.`user_id` = `u`.`id`)) and (`ar`.`group_id` is not null))))) left join `groups` `g` on((`ar`.`group_id` = `g`.`id`))) WHERE ((`b`.`is_active` = true) AND (`u`.`is_active` = true) AND (`d`.`is_active` = true) AND ((`ar`.`is_active` = true) OR (`ar`.`is_active` is null))) ;

-- --------------------------------------------------------

--
-- Structure for view `v_access_verification_extended`
--
DROP TABLE IF EXISTS `v_access_verification_extended`;

DROP VIEW IF EXISTS `v_access_verification_extended`;
CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_access_verification_extended`  AS SELECT DISTINCT `b`.`badge_uid` AS `badge_uid`, `b`.`encryption_key` AS `encryption_key`, `b`.`is_active` AS `badge_active`, `b`.`date_expiration` AS `date_expiration`, `b`.`id` AS `badge_id`, `u`.`id` AS `user_id`, concat(`u`.`prenom`,' ',`u`.`nom`) AS `user_name`, `u`.`is_active` AS `user_active`, `d`.`id` AS `door_id`, `d`.`nom` AS `door_name`, `d`.`esp32_id` AS `esp32_id`, `d`.`is_active` AS `door_active`, `ar`.`id` AS `access_right_id`, `ar`.`heure_debut` AS `heure_debut`, `ar`.`heure_fin` AS `heure_fin`, `ar`.`jours_semaine` AS `jours_semaine`, `ar`.`date_debut` AS `date_debut`, `ar`.`date_fin` AS `date_fin`, `ar`.`is_active` AS `access_active`, (case when (`ar`.`group_id` is not null) then 'user_group' when (`ar`.`badge_group_id` is not null) then 'badge_group' when (`ar`.`door_group_id` is not null) then 'door_group' when (`ar`.`badge_id` is not null) then 'individual_badge' else 'unknown' end) AS `access_type`, `g`.`nom` AS `user_group_name`, `bg`.`nom` AS `badge_group_name`, `dg`.`nom` AS `door_group_name` FROM ((((((`badges` `b` join `users` `u` on((`b`.`user_id` = `u`.`id`))) join `doors` `d` on((`d`.`is_active` = true))) left join `access_rights` `ar` on((((`ar`.`badge_id` = `b`.`id`) and (`ar`.`door_id` = `d`.`id`)) or (`ar`.`group_id` in (select `ug`.`group_id` from `user_groups` `ug` where (`ug`.`user_id` = `u`.`id`)) and (`ar`.`door_id` = `d`.`id`)) or (`ar`.`badge_group_id` in (select `bgm`.`badge_group_id` from `badge_group_members` `bgm` where (`bgm`.`badge_id` = `b`.`id`)) and (`ar`.`door_id` = `d`.`id`)) or ((`ar`.`badge_id` = `b`.`id`) and `ar`.`door_group_id` in (select `dgm`.`door_group_id` from `door_group_members` `dgm` where (`dgm`.`door_id` = `d`.`id`))) or (`ar`.`group_id` in (select `ug`.`group_id` from `user_groups` `ug` where (`ug`.`user_id` = `u`.`id`)) and `ar`.`door_group_id` in (select `dgm`.`door_group_id` from `door_group_members` `dgm` where (`dgm`.`door_id` = `d`.`id`))) or (`ar`.`badge_group_id` in (select `bgm`.`badge_group_id` from `badge_group_members` `bgm` where (`bgm`.`badge_id` = `b`.`id`)) and `ar`.`door_group_id` in (select `dgm`.`door_group_id` from `door_group_members` `dgm` where (`dgm`.`door_id` = `d`.`id`)))))) left join `groups` `g` on((`ar`.`group_id` = `g`.`id`))) left join `badge_groups` `bg` on((`ar`.`badge_group_id` = `bg`.`id`))) left join `door_groups` `dg` on((`ar`.`door_group_id` = `dg`.`id`))) WHERE ((`b`.`is_active` = true) AND (`u`.`is_active` = true) AND (`d`.`is_active` = true) AND ((`ar`.`is_active` = true) OR (`ar`.`is_active` is null))) ;

-- --------------------------------------------------------

--
-- Structure for view `v_alert_statistics`
--
DROP TABLE IF EXISTS `v_alert_statistics`;

DROP VIEW IF EXISTS `v_alert_statistics`;
CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_alert_statistics`  AS SELECT cast(`alerts`.`created_at` as date) AS `alert_date`, `alerts`.`type` AS `type`, `alerts`.`severity` AS `severity`, count(0) AS `alert_count`, sum((case when (`alerts`.`is_read` = true) then 1 else 0 end)) AS `read_count`, sum((case when (`alerts`.`is_read` = false) then 1 else 0 end)) AS `unread_count` FROM `alerts` WHERE (`alerts`.`created_at` >= (now() - interval 30 day)) GROUP BY cast(`alerts`.`created_at` as date), `alerts`.`type`, `alerts`.`severity` ORDER BY `alert_date` DESC, `alert_count` DESC ;

-- --------------------------------------------------------

--
-- Structure for view `v_critical_unread_alerts`
--
DROP TABLE IF EXISTS `v_critical_unread_alerts`;

DROP VIEW IF EXISTS `v_critical_unread_alerts`;
CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_critical_unread_alerts`  AS SELECT `a`.`id` AS `id`, `a`.`type` AS `type`, `a`.`door_id` AS `door_id`, `a`.`badge_uid` AS `badge_uid`, `a`.`message` AS `message`, `a`.`severity` AS `severity`, `a`.`metadata` AS `metadata`, `a`.`is_read` AS `is_read`, `a`.`created_at` AS `created_at`, `d`.`nom` AS `door_name`, `d`.`localisation` AS `localisation`, timestampdiff(MINUTE,`a`.`created_at`,now()) AS `minutes_ago` FROM (`alerts` `a` left join `doors` `d` on((`a`.`door_id` = `d`.`id`))) WHERE ((`a`.`is_read` = false) AND (`a`.`severity` in ('critical','high'))) ORDER BY (case `a`.`severity` when 'critical' then 1 when 'high' then 2 end) ASC, `a`.`created_at` DESC ;

-- --------------------------------------------------------

--
-- Structure for view `v_high_risk_badges`
--
DROP TABLE IF EXISTS `v_high_risk_badges`;

DROP VIEW IF EXISTS `v_high_risk_badges`;
CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `v_high_risk_badges`  AS SELECT `b`.`id` AS `id`, `b`.`badge_uid` AS `badge_uid`, concat(`u`.`prenom`,' ',`u`.`nom`) AS `user_name`, `u`.`email` AS `email`, `calculate_badge_risk_score`(`b`.`badge_uid`) AS `risk_score`, count(distinct `a`.`id`) AS `alert_count_24h` FROM ((`badges` `b` join `users` `u` on((`b`.`user_id` = `u`.`id`))) left join `alerts` `a` on(((`a`.`badge_uid` = `b`.`badge_uid`) and (`a`.`created_at` >= (now() - interval 24 hour))))) WHERE (`b`.`is_active` = true) GROUP BY `b`.`id`, `b`.`badge_uid`, `u`.`prenom`, `u`.`nom`, `u`.`email` HAVING (`risk_score` >= 30.0) ORDER BY `risk_score` DESC ;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `access_logs`
--
ALTER TABLE `access_logs`
  ADD CONSTRAINT `access_logs_ibfk_1` FOREIGN KEY (`badge_id`) REFERENCES `badges` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `access_logs_ibfk_2` FOREIGN KEY (`door_id`) REFERENCES `doors` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `alerts`
--
ALTER TABLE `alerts`
  ADD CONSTRAINT `alerts_ibfk_1` FOREIGN KEY (`door_id`) REFERENCES `doors` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `badges`
--
ALTER TABLE `badges`
  ADD CONSTRAINT `badges_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `badge_group_members`
--
ALTER TABLE `badge_group_members`
  ADD CONSTRAINT `badge_group_members_ibfk_1` FOREIGN KEY (`badge_group_id`) REFERENCES `badge_groups` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `badge_group_members_ibfk_2` FOREIGN KEY (`badge_id`) REFERENCES `badges` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `badge_group_members_ibfk_3` FOREIGN KEY (`added_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `door_group_members`
--
ALTER TABLE `door_group_members`
  ADD CONSTRAINT `door_group_members_ibfk_1` FOREIGN KEY (`door_group_id`) REFERENCES `door_groups` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `door_group_members_ibfk_2` FOREIGN KEY (`door_id`) REFERENCES `doors` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `door_group_members_ibfk_3` FOREIGN KEY (`added_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `door_status_history`
--
ALTER TABLE `door_status_history`
  ADD CONSTRAINT `door_status_history_ibfk_1` FOREIGN KEY (`door_id`) REFERENCES `doors` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `sessions`
--
ALTER TABLE `sessions`
  ADD CONSTRAINT `sessions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `user_groups`
--
ALTER TABLE `user_groups`
  ADD CONSTRAINT `fk_ug_added_by` FOREIGN KEY (`added_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `fk_ug_group` FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `fk_ug_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

DELIMITER $$
--
-- Events
--
DROP EVENT IF EXISTS `event_archive_alerts`$$
CREATE DEFINER=`root`@`localhost` EVENT `event_archive_alerts` ON SCHEDULE EVERY 1 WEEK STARTS '2025-11-19 03:00:00' ON COMPLETION NOT PRESERVE ENABLE DO CALL archive_old_alerts()$$

DELIMITER ;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
