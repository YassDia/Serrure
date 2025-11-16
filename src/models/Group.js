const db = require('../config/database');

class Group {
    static async create(data) {
        const { nom, description, couleur } = data;
        const [result] = await db.execute(
            `INSERT INTO \`groups\` (nom, description, couleur) VALUES (?, ?, ?)`,
            [nom, description, couleur || '#3B82F6']
        );
        return result.insertId;
    }

    static async findAll(filters = {}) {
        let query = `SELECT g.*, 
                     COUNT(DISTINCT ug.user_id) as member_count,
                     COUNT(DISTINCT ar.id) as access_rights_count
                     FROM \`groups\` g
                     LEFT JOIN user_groups ug ON g.id = ug.group_id
                     LEFT JOIN access_rights ar ON g.id = ar.group_id
                     WHERE 1=1`;
        const params = [];

        if (filters.is_active !== undefined) {
            query += ' AND g.is_active = ?';
            params.push(filters.is_active === 'true' || filters.is_active === true ? 1 : 0);
        }

        if (filters.search) {
            query += ' AND (g.nom LIKE ? OR g.description LIKE ?)';
            const searchTerm = `%${filters.search}%`;
            params.push(searchTerm, searchTerm);
        }

        query += ' GROUP BY g.id ORDER BY g.nom ASC';

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

    static async findById(id) {
        const [rows] = await db.execute(
            `SELECT g.*, 
             COUNT(DISTINCT ug.user_id) as member_count,
             COUNT(DISTINCT ar.id) as access_rights_count
             FROM \`groups\` g
             LEFT JOIN user_groups ug ON g.id = ug.group_id
             LEFT JOIN access_rights ar ON g.id = ar.group_id
             WHERE g.id = ?
             GROUP BY g.id`,
            [parseInt(id)]
        );
        return rows[0];
    }

    static async findByName(nom) {
        const [rows] = await db.execute('SELECT * FROM `groups` WHERE nom = ?', [nom]);
        return rows[0];
    }

    static async update(id, data) {
        const fields = [], values = [];
        const allowedFields = ['nom', 'description', 'couleur', 'is_active'];

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
            `UPDATE \`groups\` SET ${fields.join(', ')} WHERE id = ?`,
            values
        );
        return result.affectedRows > 0;
    }

    static async delete(id) {
        const [result] = await db.execute('DELETE FROM `groups` WHERE id = ?', [parseInt(id)]);
        return result.affectedRows > 0;
    }

    static async addMember(group_id, user_id, added_by) {
        const [result] = await db.execute(
            `INSERT INTO user_groups (group_id, user_id, added_by) VALUES (?, ?, ?)`,
            [parseInt(group_id), parseInt(user_id), parseInt(added_by)]
        );
        return result.insertId;
    }

    static async removeMember(group_id, user_id) {
        const [result] = await db.execute(
            'DELETE FROM user_groups WHERE group_id = ? AND user_id = ?',
            [parseInt(group_id), parseInt(user_id)]
        );
        return result.affectedRows > 0;
    }

    static async getMembers(group_id) {
        const [rows] = await db.execute(
            `SELECT u.id, u.nom, u.prenom, u.email, u.telephone, u.is_active,
                    ug.added_at, 
                    CONCAT(adder.prenom, ' ', adder.nom) as added_by_name
             FROM user_groups ug
             JOIN users u ON ug.user_id = u.id
             LEFT JOIN users adder ON ug.added_by = adder.id
             WHERE ug.group_id = ?
             ORDER BY ug.added_at DESC`,
            [parseInt(group_id)]
        );
        return rows;
    }

    static async isMember(group_id, user_id) {
        const [rows] = await db.execute(
            'SELECT id FROM user_groups WHERE group_id = ? AND user_id = ?',
            [parseInt(group_id), parseInt(user_id)]
        );
        return rows.length > 0;
    }

    static async getUserGroups(user_id) {
        const [rows] = await db.execute(
            `SELECT g.*, ug.added_at
             FROM user_groups ug
             JOIN \`groups\` g ON ug.group_id = g.id
             WHERE ug.user_id = ? AND g.is_active = TRUE
             ORDER BY g.nom`,
            [parseInt(user_id)]
        );
        return rows;
    }

    static async count(filters = {}) {
        let query = 'SELECT COUNT(*) as total FROM `groups` WHERE 1=1';
        const params = [];

        if (filters.is_active !== undefined) {
            query += ' AND is_active = ?';
            params.push(filters.is_active === 'true' || filters.is_active === true ? 1 : 0);
        }

        const [rows] = await db.execute(query, params);
        return rows[0].total;
    }

    static async existsByName(nom) {
        const [rows] = await db.execute('SELECT id FROM `groups` WHERE nom = ?', [nom]);
        return rows.length > 0;
    }
}

module.exports = Group;