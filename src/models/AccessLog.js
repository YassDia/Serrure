const db = require('../config/database');

class AccessLog {
    static async create(data) {
        const { badge_id, door_id, badge_uid, user_name, access_granted, reason } = data;
        const [result] = await db.execute(
            `INSERT INTO access_logs (badge_id, door_id, badge_uid, user_name, access_granted, reason) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [badge_id, door_id, badge_uid, user_name, access_granted, reason]
        );
        return result.insertId;
    }

    static async findAll(filters = {}) {
        let query = `SELECT al.*, 
                 d.nom as door_name, 
                 d.localisation 
                 FROM access_logs al 
                 LEFT JOIN doors d ON al.door_id = d.id 
                 WHERE 1=1`;
        const params = [];

        if (filters.door_id) {
            query += ' AND al.door_id = ?';
            params.push(parseInt(filters.door_id));
        }

        if (filters.badge_id) {
            query += ' AND al.badge_id = ?';
            params.push(parseInt(filters.badge_id));
        }

        if (filters.access_granted !== undefined) {
            query += ' AND al.access_granted = ?';
            params.push(filters.access_granted === 'true' || filters.access_granted === true ? 1 : 0);
        }

        if (filters.start_date) {
            query += ' AND al.access_datetime >= ?';
            params.push(filters.start_date);
        }

        if (filters.end_date) {
            query += ' AND al.access_datetime <= ?';
            params.push(filters.end_date);
        }

        query += ' ORDER BY al.access_datetime DESC';

        // UTILISER query() pour LIMIT
        if (filters.limit) {
            query += ` LIMIT ${parseInt(filters.limit)}`;
            if (filters.offset) {
                query += ` OFFSET ${parseInt(filters.offset)}`;
            }
        }

        const [rows] = await db.query(query, params);
        return rows;
    }

    static async count(filters = {}) {
        let query = 'SELECT COUNT(*) as total FROM access_logs WHERE 1=1';
        const params = [];

        if (filters.door_id) {
            query += ' AND door_id = ?';
            params.push(parseInt(filters.door_id));
        }

        if (filters.access_granted !== undefined) {
            query += ' AND access_granted = ?';
            params.push(filters.access_granted);
        }

        if (filters.start_date) {
            query += ' AND access_datetime >= ?';
            params.push(filters.start_date);
        }

        if (filters.end_date) {
            query += ' AND access_datetime <= ?';
            params.push(filters.end_date);
        }

        const [rows] = await db.execute(query, params);
        return rows[0].total;
    }

    static async getStats(filters = {}) {
        let dateFilter = '';
        const params = [];

        if (filters.start_date && filters.end_date) {
            dateFilter = 'WHERE access_datetime BETWEEN ? AND ?';
            params.push(filters.start_date, filters.end_date);
        }

        const [total] = await db.execute(
            `SELECT COUNT(*) as total FROM access_logs ${dateFilter}`,
            params
        );

        const [accessStats] = await db.execute(
            `SELECT 
                SUM(CASE WHEN access_granted = TRUE THEN 1 ELSE 0 END) as authorized,
                SUM(CASE WHEN access_granted = FALSE THEN 1 ELSE 0 END) as denied
             FROM access_logs ${dateFilter}`,
            params
        );

        return {
            total: total[0].total,
            authorized: accessStats[0].authorized || 0,
            denied: accessStats[0].denied || 0
        };
    }

    static async updateDoorOpened(badge_uid, esp32_id) {
        const [result] = await db.execute(
            `UPDATE access_logs 
             SET door_opened = TRUE 
             WHERE badge_uid = ? 
             AND door_id = (SELECT id FROM doors WHERE esp32_id = ?) 
             ORDER BY access_datetime DESC 
             LIMIT 1`,
            [badge_uid, esp32_id]
        );
        return result.affectedRows > 0;
    }

    static async updateDoorClosed(badge_uid, esp32_id) {
        const [result] = await db.execute(
            `UPDATE access_logs 
             SET door_closed_at = NOW() 
             WHERE badge_uid = ? 
             AND door_id = (SELECT id FROM doors WHERE esp32_id = ?) 
             AND door_opened = TRUE 
             AND door_closed_at IS NULL
             ORDER BY access_datetime DESC 
             LIMIT 1`,
            [badge_uid, esp32_id]
        );
        return result.affectedRows > 0;
    }
}

module.exports = AccessLog;