const db = require('../config/database');

class Badge {
    static async create(data) {
        const { user_id, badge_uid, encryption_key, date_expiration } = data;
        const [result] = await db.execute(
            `INSERT INTO badges (user_id, badge_uid, encryption_key, date_expiration) 
             VALUES (?, ?, ?, ?)`,
            [user_id, badge_uid, encryption_key, date_expiration]
        );
        return result.insertId;
    }

    static async findAll(filters = {}) {
        let query = `SELECT b.*, 
                 CONCAT(u.prenom, ' ', u.nom) as user_name, 
                 u.email as user_email
                 FROM badges b 
                 JOIN users u ON b.user_id = u.id 
                 WHERE 1=1`;
        const params = [];

        if (filters.user_id) {
            query += ' AND b.user_id = ?';
            params.push(parseInt(filters.user_id));
        }

        if (filters.is_active !== undefined) {
            query += ' AND b.is_active = ?';
            params.push(filters.is_active === 'true' || filters.is_active === true ? 1 : 0);
        }

        if (filters.badge_uid) {
            query += ' AND b.badge_uid = ?';
            params.push(filters.badge_uid);
        }

        query += ' ORDER BY b.created_at DESC';

        // UTILISER query() au lieu de execute() pour LIMIT
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
        let query = 'SELECT COUNT(*) as total FROM badges b WHERE 1=1';
        const params = [];

        if (filters.user_id) {
            query += ' AND b.user_id = ?';
            params.push(parseInt(filters.user_id));
        }

        if (filters.is_active !== undefined) {
            query += ' AND b.is_active = ?';
            params.push(filters.is_active === 'true' || filters.is_active === true ? 1 : 0);
        }

        const [rows] = await db.execute(query, params);
        return rows[0].total;
    }

    static async findById(id) {
        const [rows] = await db.execute(
            `SELECT b.*, 
             CONCAT(u.prenom, ' ', u.nom) as user_name, 
             u.email as user_email
             FROM badges b 
             JOIN users u ON b.user_id = u.id 
             WHERE b.id = ?`,
            [parseInt(id)]
        );
        return rows[0];
    }

    static async findByUid(badge_uid) {
        const [rows] = await db.execute(
            `SELECT b.*, 
             CONCAT(u.prenom, ' ', u.nom) as user_name, 
             u.email as user_email, 
             u.is_active as user_active
             FROM badges b 
             JOIN users u ON b.user_id = u.id 
             WHERE b.badge_uid = ?`,
            [badge_uid]
        );
        return rows[0];
    }

    static async findByUserId(user_id) {
        const [rows] = await db.execute(
            'SELECT * FROM badges WHERE user_id = ? ORDER BY created_at DESC',
            [parseInt(user_id)]
        );
        return rows;
    }

    static async update(id, data) {
        const fields = [], values = [];
        const allowedFields = ['date_expiration', 'is_active', 'encryption_key'];

        for (const field of allowedFields) {
            if (data[field] !== undefined) {
                fields.push(`${field} = ?`);
                values.push(data[field]);
            }
        }

        if (fields.length === 0) {
            throw new Error('Aucun champ à mettre à jour');
        }

        values.push(parseInt(id));
        const [result] = await db.execute(
            `UPDATE badges SET ${fields.join(', ')} WHERE id = ?`,
            values
        );
        return result.affectedRows > 0;
    }

    static async delete(id) {
        const [result] = await db.execute('DELETE FROM badges WHERE id = ?', [parseInt(id)]);
        return result.affectedRows > 0;
    }

    static async existsByUid(badge_uid) {
        const [rows] = await db.execute('SELECT id FROM badges WHERE badge_uid = ?', [badge_uid]);
        return rows.length > 0;
    }

    static async findExpired() {
        const [rows] = await db.execute(
            `SELECT b.*, CONCAT(u.prenom, ' ', u.nom) as user_name 
             FROM badges b 
             JOIN users u ON b.user_id = u.id
             WHERE b.date_expiration IS NOT NULL 
             AND b.date_expiration < NOW() 
             AND b.is_active = TRUE`
        );
        return rows;
    }
}

module.exports = Badge;