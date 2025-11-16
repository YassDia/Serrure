const db = require('../config/database');
const logger = require('../config/logger');

class Door {
    static async create(data) {
        const { nom, description, localisation, esp32_id, esp32_ip } = data;
        const [result] = await db.execute(
            `INSERT INTO doors (nom, description, localisation, esp32_id, esp32_ip) 
             VALUES (?, ?, ?, ?, ?)`,
            [nom, description, localisation, esp32_id, esp32_ip]
        );
        return result.insertId;
    }
    
    static async findAll(filters = {}) {
        let query = 'SELECT * FROM doors WHERE 1=1';
        const params = [];
        
        if (filters.is_active !== undefined) { 
            query += ' AND is_active = ?'; 
            params.push(filters.is_active); 
        }
        
        if (filters.is_online !== undefined) { 
            query += ' AND is_online = ?'; 
            params.push(filters.is_online); 
        }
        
        if (filters.search) { 
            query += ' AND (nom LIKE ? OR localisation LIKE ?)'; 
            params.push(`%${filters.search}%`, `%${filters.search}%`); 
        }
        
        query += ' ORDER BY nom ASC';
        const [rows] = await db.execute(query, params);
        return rows;
    }
    
    static async findById(id) {
        const [rows] = await db.execute('SELECT * FROM doors WHERE id = ?', [id]);
        return rows[0];
    }
    
    static async findByEsp32Id(esp32_id) {
        const [rows] = await db.execute('SELECT * FROM doors WHERE esp32_id = ?', [esp32_id]);
        return rows[0];
    }
    
    static async update(id, data) {
        const fields = [], values = [];
        const allowedFields = ['nom', 'description', 'localisation', 'esp32_ip', 'is_active', 'firmware_version'];
        
        for (const field of allowedFields) {
            if (data[field] !== undefined) { 
                fields.push(`${field} = ?`); 
                values.push(data[field]); 
            }
        }
        
        if (fields.length === 0) {
            throw new Error('Aucun champ à mettre à jour');
        }
        
        values.push(id);
        const [result] = await db.execute(
            `UPDATE doors SET ${fields.join(', ')} WHERE id = ?`, 
            values
        );
        return result.affectedRows > 0;
    }
    
    static async delete(id) {
        const [result] = await db.execute('DELETE FROM doors WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }
    
    static async updateOnlineStatus(esp32_id, isOnline, ip_address = null, firmware_version = null) {
        const updates = ['is_online = ?', 'last_heartbeat = NOW()'];
        const params = [isOnline];
        
        if (ip_address) { 
            updates.push('esp32_ip = ?'); 
            params.push(ip_address); 
        }
        
        if (firmware_version) {
            updates.push('firmware_version = ?');
            params.push(firmware_version);
        }
        
        params.push(esp32_id);
        
        const [result] = await db.execute(
            `UPDATE doors SET ${updates.join(', ')} WHERE esp32_id = ?`, 
            params
        );
        
        // Enregistrer dans l'historique
        const door = await this.findByEsp32Id(esp32_id);
        if (door) {
            await db.execute(
                `INSERT INTO door_status_history (door_id, status, ip_address, firmware_version) 
                 VALUES (?, ?, ?, ?)`,
                [door.id, isOnline ? 'online' : 'offline', ip_address, firmware_version]
            );
        }
        
        return result.affectedRows > 0;
    }
    
    static async findOfflineDoors(minutes = 5) {
        const [rows] = await db.execute(
            `SELECT * FROM doors 
             WHERE is_online = TRUE 
             AND (last_heartbeat IS NULL OR last_heartbeat < DATE_SUB(NOW(), INTERVAL ? MINUTE))`,
            [minutes]
        );
        return rows;
    }
    
    static async getStats() {
        const [total] = await db.execute('SELECT COUNT(*) as count FROM doors');
        const [online] = await db.execute('SELECT COUNT(*) as count FROM doors WHERE is_online = TRUE');
        const [active] = await db.execute('SELECT COUNT(*) as count FROM doors WHERE is_active = TRUE');
        
        return {
            total: total[0].count,
            online: online[0].count,
            offline: total[0].count - online[0].count,
            active: active[0].count,
            inactive: total[0].count - active[0].count
        };
    }
    
    static async getStatusHistory(doorId, limit = 50) {
        const [rows] = await db.execute(
            `SELECT * FROM door_status_history 
             WHERE door_id = ? 
             ORDER BY timestamp DESC 
             LIMIT ?`,
            [doorId, limit]
        );
        return rows;
    }
}

module.exports = Door;