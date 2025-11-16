#include <Wire.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Adafruit_PN532.h>
#include <mbedtls/sha256.h>

// Certificats TLS (générés par generate-certificates.sh)
#include "certs/ca_cert.h"
#include "certs/client_cert.h"
#include "certs/client_key.h"

// ========== CONFIGURATION WIFI ==========
const char* WIFI_SSID = "Yasmine";            // ⚠️ À MODIFIER
const char* WIFI_PASSWORD = "07496301";  // ⚠️ À MODIFIER

// ========== CONFIGURATION SERVEUR ==========
// ⚠️ IMPORTANT: Remplacer par l'adresse IP de votre PC (pas localhost!)
// Exemple: "https://192.168.1.10:3443"
const char* SERVER_URL = "https://10.133.35.149:3443";  // ⚠️ À MODIFIER
const char* ESP32_ID = "ESP32_DOOR_001";
const char* FIRMWARE_VERSION = "3.0.0";

// ========== CONFIGURATION HARDWARE ==========
// I2C pour PN532  
#define PN532_SDA   18
#define PN532_SCL   19

// Contrôle
#define RELAY_PIN   10
#define LED_GREEN   2
#define LED_RED     3
#define BUZZER_PIN  4

// ========== TIMING ==========
#define DOOR_UNLOCK_TIME    5000
#define HEARTBEAT_INTERVAL  60000
#define SCAN_COOLDOWN       2000
#define MAX_RETRY           3

// ========== INITIALISATION ==========
Adafruit_PN532 nfc(PN532_SDA, PN532_SCL);
WiFiClientSecure secureClient;
HTTPClient https;

// Variables globales
unsigned long lastHeartbeat = 0;
unsigned long lastScanTime = 0;
String lastBadgeUID = "";
String sessionToken = "";

// =============================================================================
// SÉCURITÉ: GÉNÉRATION DE NONCE (ANTI-REPLAY)
// =============================================================================

String generateNonce() {
    String nonce = String(millis()) + "_" + String(random(100000, 999999));
    return nonce;
}

// =============================================================================
// SÉCURITÉ: HMAC-SHA256 POUR INTÉGRITÉ DES MESSAGES
// =============================================================================

String calculateHMAC(String message, String key) {
    unsigned char hmac[32];
    mbedtls_md_context_t ctx;
    mbedtls_md_type_t md_type = MBEDTLS_MD_SHA256;
    
    mbedtls_md_init(&ctx);
    mbedtls_md_setup(&ctx, mbedtls_md_info_from_type(md_type), 1);
    mbedtls_md_hmac_starts(&ctx, (const unsigned char*)key.c_str(), key.length());
    mbedtls_md_hmac_update(&ctx, (const unsigned char*)message.c_str(), message.length());
    mbedtls_md_hmac_finish(&ctx, hmac);
    mbedtls_md_free(&ctx);
    
    // Convertir en hexadécimal
    String hmacStr = "";
    for (int i = 0; i < 32; i++) {
        char hex[3];
        sprintf(hex, "%02x", hmac[i]);
        hmacStr += hex;
    }
    return hmacStr;
}

// =============================================================================
// SETUP
// =============================================================================

void setup() {
    Serial.begin(115200);
    delay(1000);
    
    Serial.println("\n========================================");
    Serial.println("   SYSTÈME SÉCURISÉ - TLS MUTUEL");
    Serial.println("========================================\n");
    
    // Configuration des broches
    pinMode(RELAY_PIN, OUTPUT);
    pinMode(LED_GREEN, OUTPUT);
    pinMode(LED_RED, OUTPUT);
    pinMode(BUZZER_PIN, OUTPUT);
    
    lockDoor();
    digitalWrite(LED_GREEN, LOW);
    digitalWrite(LED_RED, LOW);
    digitalWrite(BUZZER_PIN, LOW);
    
    // I2C et PN532
    Wire.begin(PN532_SDA, PN532_SCL);
    nfc.begin();
    
    uint32_t versiondata = nfc.getFirmwareVersion();
    if (!versiondata) {
        Serial.println("ERREUR: Lecteur PN532 non détecté!");
        blinkError();
        while (1) delay(100);
    }
    
    Serial.println("✅ PN532 détecté");
    nfc.SAMConfig();
    
    // Configuration TLS
    configureTLS();
    
    // Connexion WiFi
    connectWiFi();
    
    // Négociation de session sécurisée
    negotiateSecureSession();
    
    // Signal de démarrage
    beep(2, 100);
    blinkLED(LED_GREEN, 3, 200);
    
    Serial.println("\n✅ Système sécurisé prêt\n");
}

// =============================================================================
// CONFIGURATION TLS MUTUEL - ✅ CORRIGÉ
// =============================================================================

void configureTLS() {
    Serial.println("⚙️ Configuration TLS mutuel...");
    
    // Charger le certificat CA (pour vérifier le serveur)
    secureClient.setCACert(ca_cert);
    
    // Charger le certificat client (pour que le serveur nous authentifie)
    secureClient.setCertificate(client_cert);
    
    // Charger la clé privée client
    secureClient.setPrivateKey(client_key);
    
    // ✅ CORRECTION: Ne pas appeler setInsecure()
    // La vérification stricte est activée par défaut avec setCACert()
    
    Serial.println("✅ TLS configuré avec authentification mutuelle");
}

// =============================================================================
// NÉGOCIATION DE SESSION SÉCURISÉE
// =============================================================================

void negotiateSecureSession() {
    Serial.println("🔐 Négociation de session sécurisée...");
    
    https.begin(secureClient, String(SERVER_URL) + "/api/esp32/handshake");
    https.addHeader("Content-Type", "application/json");
    https.setTimeout(10000);
    
    StaticJsonDocument<256> doc;
    doc["esp32_id"] = ESP32_ID;
    doc["firmware_version"] = FIRMWARE_VERSION;
    doc["nonce"] = generateNonce();
    
    String jsonString;
    serializeJson(doc, jsonString);
    
    int httpCode = https.POST(jsonString);
    
    if (httpCode == 200) {
        String response = https.getString();
        StaticJsonDocument<512> responseDoc;
        deserializeJson(responseDoc, response);
        
        sessionToken = responseDoc["session_token"].as<String>();
        
        Serial.println("✅ Session établie");
        Serial.print("   Token: ");
        Serial.println(sessionToken.substring(0, 16) + "...");
    } else {
        Serial.print("❌ Échec négociation session. Code HTTP: ");
        Serial.println(httpCode);
        if (httpCode > 0) {
            Serial.println("   Réponse: " + https.getString());
        }
    }
    
    https.end();
}

// =============================================================================
// BOUCLE PRINCIPALE
// =============================================================================

void loop() {
    // Vérifier WiFi
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("⚠️ WiFi déconnecté - Reconnexion...");
        connectWiFi();
    }
    
    // Heartbeat
    if (millis() - lastHeartbeat > HEARTBEAT_INTERVAL) {
        sendHeartbeat();
        lastHeartbeat = millis();
    }
    
    // Détection badge
    uint8_t uid[] = { 0, 0, 0, 0, 0, 0, 0 };
    uint8_t uidLength;
    
    if (nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLength, 100)) {
        
        if (millis() - lastScanTime < SCAN_COOLDOWN) {
            delay(100);
            return;
        }
        
        lastScanTime = millis();
        
        String badgeUID = "";
        for (uint8_t i = 0; i < uidLength; i++) {
            if (uid[i] < 0x10) badgeUID += "0";
            badgeUID += String(uid[i], HEX);
        }
        badgeUID.toUpperCase();
        
        Serial.println("\n🎫 Badge détecté: " + badgeUID);
        
        beep(1, 50);
        blinkLED(LED_GREEN, 1, 100);
        
        if (verifyAccessSecure(badgeUID)) {
            handleAccessGranted(badgeUID);
        } else {
            handleAccessDenied(badgeUID);
        }
        
        lastBadgeUID = badgeUID;
    }
    
    delay(100);
}

// =============================================================================
// VÉRIFICATION SÉCURISÉE (TLS + HMAC + NONCE)
// =============================================================================

bool verifyAccessSecure(String badgeUID) {
    Serial.println("🔍 Vérification sécurisée...");
    
    for (int retry = 0; retry < MAX_RETRY; retry++) {
        
        https.begin(secureClient, String(SERVER_URL) + "/api/esp32/verify-access");
        https.addHeader("Content-Type", "application/json");
        
        // Générer un nonce unique
        String nonce = generateNonce();
        
        // Créer le message
        StaticJsonDocument<512> doc;
        doc["badge_uid"] = badgeUID;
        doc["esp32_id"] = ESP32_ID;
        doc["nonce"] = nonce;
        doc["session_token"] = sessionToken;
        doc["timestamp"] = millis();
        
        // Calculer HMAC pour intégrité
        String message = badgeUID + ESP32_ID + nonce + sessionToken;
        String hmac = calculateHMAC(message, sessionToken);
        doc["hmac"] = hmac;
        
        String jsonString;
        serializeJson(doc, jsonString);
        
        Serial.println("   → Envoi requête signée...");
        
        int httpCode = https.POST(jsonString);
        
        if (httpCode == 200) {
            String response = https.getString();
            
            StaticJsonDocument<512> responseDoc;
            DeserializationError error = deserializeJson(responseDoc, response);
            
            if (!error) {
                // Vérifier HMAC de la réponse
                String responseHmac = responseDoc["hmac"];
                String responseMessage = responseDoc["nonce"].as<String>() + 
                                        String(responseDoc["access_granted"].as<bool>());
                String expectedHmac = calculateHMAC(responseMessage, sessionToken);
                
                if (responseHmac != expectedHmac) {
                    Serial.println("❌ HMAC invalide - Possible MITM!");
                    https.end();
                    return false;
                }
                
                bool accessGranted = responseDoc["access_granted"];
                String userName = responseDoc["user_name"] | "Inconnu";
                String reason = responseDoc["reason"] | "";
                
                Serial.println("   ✅ Réponse vérifiée");
                Serial.println("   👤 Utilisateur: " + userName);
                Serial.println("   📊 Statut: " + String(accessGranted ? "AUTORISÉ" : "REFUSÉ"));
                Serial.println("   💬 Raison: " + reason);
                
                https.end();
                return accessGranted;
            }
        } else if (httpCode == 401) {
            Serial.println("   ⚠️ Session expirée - Renégociation...");
            https.end();
            negotiateSecureSession();
            return false;
        } else {
            Serial.print("   ❌ Erreur HTTP: ");
            Serial.println(httpCode);
            if (httpCode > 0) {
                Serial.println("   Réponse: " + https.getString());
            }
        }
        
        https.end();
        
        if (retry < MAX_RETRY - 1) {
            Serial.println("   🔄 Nouvelle tentative...");
            delay(500);
        }
    }
    
    Serial.println("❌ Échec après " + String(MAX_RETRY) + " tentatives");
    return false;
}

// =============================================================================
// HEARTBEAT SÉCURISÉ
// =============================================================================

void sendHeartbeat() {
    https.begin(secureClient, String(SERVER_URL) + "/api/esp32/heartbeat");
    https.addHeader("Content-Type", "application/json");
    
    String nonce = generateNonce();
    
    StaticJsonDocument<512> doc;
    doc["esp32_id"] = ESP32_ID;
    doc["ip_address"] = WiFi.localIP().toString();
    doc["firmware_version"] = FIRMWARE_VERSION;
    doc["status"] = "online";
    doc["rssi"] = WiFi.RSSI();
    doc["nonce"] = nonce;
    doc["session_token"] = sessionToken;
    
    String message = ESP32_ID + nonce + sessionToken;
    doc["hmac"] = calculateHMAC(message, sessionToken);
    
    String jsonString;
    serializeJson(doc, jsonString);
    
    int httpCode = https.POST(jsonString);
    
    if (httpCode == 200) {
        Serial.println("💓 Heartbeat envoyé");
    } else if (httpCode == 401) {
        Serial.println("⚠️ Session expirée");
        negotiateSecureSession();
    } else {
        Serial.print("❌ Heartbeat échoué. Code: ");
        Serial.println(httpCode);
    }
    
    https.end();
}

// =============================================================================
// GESTION ACCÈS
// =============================================================================

void handleAccessGranted(String badgeUID) {
    Serial.println("\n✅ ===== ACCÈS AUTORISÉ =====\n");
    
    digitalWrite(LED_GREEN, HIGH);
    beep(2, 100);
    
    unlockDoor();
    
    delay(DOOR_UNLOCK_TIME);
    
    lockDoor();
    
    digitalWrite(LED_GREEN, LOW);
}

void handleAccessDenied(String badgeUID) {
    Serial.println("\n❌ ===== ACCÈS REFUSÉ =====\n");
    
    digitalWrite(LED_RED, HIGH);
    beep(3, 200);
    
    delay(2000);
    
    digitalWrite(LED_RED, LOW);
}

// =============================================================================
// CONTRÔLE SERRURE
// =============================================================================

void unlockDoor() {
    Serial.println("🔓 Déverrouillage...");
    digitalWrite(RELAY_PIN, HIGH);
}

void lockDoor() {
    digitalWrite(RELAY_PIN, LOW);
}

// =============================================================================
// UTILITAIRES
// =============================================================================

void connectWiFi() {
    Serial.print("📡 Connexion WiFi: ");
    Serial.println(WIFI_SSID);
    
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 30) {
        delay(500);
        Serial.print(".");
        attempts++;
        digitalWrite(LED_RED, !digitalRead(LED_RED));
    }
    
    digitalWrite(LED_RED, LOW);
    
    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("\n✅ WiFi connecté");
        Serial.print("   IP: ");
        Serial.println(WiFi.localIP());
        Serial.print("   Signal: ");
        Serial.print(WiFi.RSSI());
        Serial.println(" dBm");
    } else {
        Serial.println("\n❌ Échec WiFi");
    }
}

void beep(int times, int duration) {
    for (int i = 0; i < times; i++) {
        digitalWrite(BUZZER_PIN, HIGH);
        delay(duration);
        digitalWrite(BUZZER_PIN, LOW);
        if (i < times - 1) delay(duration);
    }
}

void blinkLED(int pin, int times, int duration) {
    for (int i = 0; i < times; i++) {
        digitalWrite(pin, HIGH);
        delay(duration);
        digitalWrite(pin, LOW);
        if (i < times - 1) delay(duration);
    }
}

void blinkError() {
    for (int i = 0; i < 5; i++) {
        digitalWrite(LED_RED, HIGH);
        beep(1, 100);
        delay(100);
        digitalWrite(LED_RED, LOW);
        delay(100);
    }
}
