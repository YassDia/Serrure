const db = require('../config/database');

class Alert {
    static async create(data) {
        const { type, door_id, badge_uid, message } = data;
        const [result] = await db.execute(
            `INSERT INTO alerts (type, door_id, badge_uid, message) 
             VALUES (?, ?, ?, ?)`,
            [type, door_id, badge_uid, message]
        );
        return result.insertId;
    }

    static async findAll(filters = {}) {
        let query = `SELECT a.*, d.nom as door_name 
                 FROM alerts a 
                 LEFT JOIN doors d ON a.door_id = d.id 
                 WHERE 1=1`;
        const params = [];

        if (filters.is_read !== undefined) {
            query += ' AND a.is_read = ?';
            params.push(filters.is_read === 'true' || filters.is_read === true ? 1 : 0);
        }

        if (filters.type) {
            query += ' AND a.type = ?';
            params.push(filters.type);
        }

        query += ' ORDER BY a.created_at DESC';

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
        let query = 'SELECT COUNT(*) as total FROM alerts WHERE 1=1';
        const params = [];

        if (filters.is_read !== undefined) {
            query += ' AND is_read = ?';
            params.push(filters.is_read === 'true' || filters.is_read === true ? 1 : 0);
        }

        const [rows] = await db.execute(query, params);
        return rows[0].total;
    }

    static async markAsRead(id) {
        const [result] = await db.execute(
            'UPDATE alerts SET is_read = TRUE WHERE id = ?',
            [parseInt(id)]
        );
        return result.affectedRows > 0;
    }

    static async markAllAsRead() {
        const [result] = await db.execute(
            'UPDATE alerts SET is_read = TRUE WHERE is_read = FALSE'
        );
        return result.affectedRows;
    }

    static async delete(id) {
        const [result] = await db.execute('DELETE FROM alerts WHERE id = ?', [parseInt(id)]);
        return result.affectedRows > 0;
    }
}

module.exports = Alert;