const fs = require('fs');
const path = require('path');

module.exports = {
    key: fs.readFileSync(path.join(__dirname, '../../certs/server-key.pem')),
    cert: fs.readFileSync(path.join(__dirname, '../../certs/server-cert.pem')),
    ca: fs.readFileSync(path.join(__dirname, '../../certs/ca-cert.pem')),
    requestCert: true,          
    rejectUnauthorized: true   
};