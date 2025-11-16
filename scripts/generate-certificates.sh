#!/bin/bash
# Script de génération des certificats pour authentification mutuelle TLS
# À placer dans : /scripts/generate-certificates.sh

echo "🔐 Génération des certificats pour authentification mutuelle TLS"
echo "================================================================"

# Créer le dossier certs s'il n'existe pas
mkdir -p certs

# 1. Générer la clé privée de l'autorité de certification (CA)
echo "1️⃣ Génération de la clé CA..."
openssl genrsa -out certs/ca-key.pem 4096

# 2. Générer le certificat auto-signé de la CA (valide 10 ans)
echo "2️⃣ Génération du certificat CA..."
openssl req -new -x509 -days 3650 -key certs/ca-key.pem -out certs/ca-cert.pem \
  -subj "//C=FR/ST=IDF/L=Paris/O=AccessControl/OU=Security/CN=AccessControl-CA"

# 3. Générer la clé privée du serveur
echo "3️⃣ Génération de la clé serveur..."
openssl genrsa -out certs/server-key.pem 2048

# 4. Créer une demande de signature de certificat (CSR) pour le serveur
echo "4️⃣ Génération du CSR serveur..."
openssl req -new -key certs/server-key.pem -out certs/server-csr.pem \
  -subj "//C=FR/ST=IDF/L=Paris/O=AccessControl/OU=Server/CN=localhost"

# 5. Signer le certificat serveur avec la CA
echo "5️⃣ Signature du certificat serveur..."
openssl x509 -req -days 3650 -in certs/server-csr.pem \
  -CA certs/ca-cert.pem -CAkey certs/ca-key.pem -CAcreateserial \
  -out certs/server-cert.pem

# 6. Générer la clé privée du client ESP32
echo "6️⃣ Génération de la clé client ESP32..."
openssl genrsa -out certs/esp32-key.pem 2048

# 7. Créer le CSR pour l'ESP32
echo "7️⃣ Génération du CSR ESP32..."
openssl req -new -key certs/esp32-key.pem -out certs/esp32-csr.pem \
  -subj "//C=FR/ST=IDF/L=Paris/O=AccessControl/OU=ESP32/CN=ESP32_DOOR_001"

# 8. Signer le certificat ESP32 avec la CA
echo "8️⃣ Signature du certificat ESP32..."
openssl x509 -req -days 3650 -in certs/esp32-csr.pem \
  -CA certs/ca-cert.pem -CAkey certs/ca-key.pem -CAcreateserial \
  -out certs/esp32-cert.pem

# 9. Convertir les certificats au format C pour l'ESP32
echo "9️⃣ Conversion des certificats pour ESP32..."

# Fonction pour convertir un fichier en tableau C
convert_to_c_array() {
  local input_file=$1
  local output_file=$2
  local var_name=$3
  
  echo "const char ${var_name}[] PROGMEM = R\"CERT(" > "$output_file"
  cat "$input_file" >> "$output_file"
  echo ")CERT\";" >> "$output_file"
}

convert_to_c_array "certs/ca-cert.pem" "certs/ca_cert.h" "ca_cert"
convert_to_c_array "certs/esp32-cert.pem" "certs/client_cert.h" "client_cert"
convert_to_c_array "certs/esp32-key.pem" "certs/client_key.h" "client_key"

# 10. Nettoyage des fichiers temporaires
echo "🧹 Nettoyage..."
rm -f certs/*-csr.pem certs/*.srl

# 11. Définir les permissions
chmod 600 certs/*-key.pem
chmod 644 certs/*-cert.pem

echo ""
echo "✅ Certificats générés avec succès !"
echo "=================================================="
echo "📁 Fichiers créés dans le dossier certs/ :"
echo ""
echo "  Serveur Node.js:"
echo "  ├── ca-cert.pem       (Certificat CA)"
echo "  ├── server-key.pem    (Clé privée serveur)"
echo "  └── server-cert.pem   (Certificat serveur)"
echo ""
echo "  ESP32:"
echo "  ├── ca_cert.h         (CA à copier dans ESP32)"
echo "  ├── client_cert.h     (Certificat client)"
echo "  └── client_key.h      (Clé privée client)"
echo ""
echo "📝 Prochaines étapes:"
echo "  1. Copier les fichiers .h dans votre projet ESP32"
echo "  2. Configurer le serveur Node.js pour utiliser les certificats"
echo "  3. Redémarrer le serveur et l'ESP32"
echo ""
echo "⚠️  IMPORTANT: Ne jamais commiter les clés privées (.pem) sur Git!"
echo "=================================================="