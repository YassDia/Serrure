const db = require('../config/database');

class BadgeGroup {
    static async create(data) {
        const { nom, description, couleur } = data;
        const [result] = await db.execute(
            `INSERT INTO badge_groups (nom, description, couleur) VALUES (?, ?, ?)`,
            [nom, description, couleur || '#8B5CF6']
        );
        return result.insertId;
    }

    static async findAll(filters = {}) {
        let query = `SELECT bg.*, 
                     COUNT(DISTINCT bgm.badge_id) as badge_count,
                     COUNT(DISTINCT ar.id) as access_rights_count
                     FROM badge_groups bg
                     LEFT JOIN badge_group_members bgm ON bg.id = bgm.badge_group_id
                     LEFT JOIN access_rights ar ON bg.id = ar.badge_group_id
                     WHERE 1=1`;
        const params = [];

        if (filters.is_active !== undefined) {
            query += ' AND bg.is_active = ?';
            params.push(filters.is_active === 'true' || filters.is_active === true ? 1 : 0);
        }

        if (filters.search) {
            query += ' AND (bg.nom LIKE ? OR bg.description LIKE ?)';
            const searchTerm = `%${filters.search}%`;
            params.push(searchTerm, searchTerm);
        }

        query += ' GROUP BY bg.id ORDER BY bg.nom ASC';

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
            `SELECT bg.*, 
             COUNT(DISTINCT bgm.badge_id) as badge_count,
             COUNT(DISTINCT ar.id) as access_rights_count
             FROM badge_groups bg
             LEFT JOIN badge_group_members bgm ON bg.id = bgm.badge_group_id
             LEFT JOIN access_rights ar ON bg.id = ar.badge_group_id
             WHERE bg.id = ?
             GROUP BY bg.id`,
            [parseInt(id)]
        );
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
            `UPDATE badge_groups SET ${fields.join(', ')} WHERE id = ?`,
            values
        );
        return result.affectedRows > 0;
    }

    static async delete(id) {
        const [result] = await db.execute('DELETE FROM badge_groups WHERE id = ?', [parseInt(id)]);
        return result.affectedRows > 0;
    }

    static async addBadge(group_id, badge_id, added_by) {
        const [individualRights] = await db.execute(
            'SELECT id FROM access_rights WHERE badge_id = ? AND is_active = TRUE',
            [parseInt(badge_id)]
        );

        if (individualRights.length > 0) {
            throw new Error('Ce badge possède déjà des droits individuels et ne peut pas être ajouté à un groupe');
        }

        const [result] = await db.execute(
            `INSERT INTO badge_group_members (badge_group_id, badge_id, added_by) VALUES (?, ?, ?)`,
            [parseInt(group_id), parseInt(badge_id), parseInt(added_by)]
        );
        return result.insertId;
    }

    static async removeBadge(group_id, badge_id) {
        const [result] = await db.execute(
            'DELETE FROM badge_group_members WHERE badge_group_id = ? AND badge_id = ?',
            [parseInt(group_id), parseInt(badge_id)]
        );
        return result.affectedRows > 0;
    }

    static async getBadges(group_id) {
        const [rows] = await db.execute(
            `SELECT b.*, 
                    CONCAT(u.prenom, ' ', u.nom) as user_name,
                    u.email as user_email,
                    bgm.added_at, 
                    CONCAT(adder.prenom, ' ', adder.nom) as added_by_name
             FROM badge_group_members bgm
             JOIN badges b ON bgm.badge_id = b.id
             JOIN users u ON b.user_id = u.id
             LEFT JOIN users adder ON bgm.added_by = adder.id
             WHERE bgm.badge_group_id = ?
             ORDER BY u.nom, u.prenom`,
            [parseInt(group_id)]
        );
        return rows;
    }

    static async isBadgeMember(group_id, badge_id) {
        const [rows] = await db.execute(
            'SELECT id FROM badge_group_members WHERE badge_group_id = ? AND badge_id = ?',
            [parseInt(group_id), parseInt(badge_id)]
        );
        return rows.length > 0;
    }

    static async existsByName(nom) {
        const [rows] = await db.execute('SELECT id FROM badge_groups WHERE nom = ?', [nom]);
        return rows.length > 0;
    }

    static async count(filters = {}) {
        let query = 'SELECT COUNT(*) as total FROM badge_groups WHERE 1=1';
        const params = [];

        if (filters.is_active !== undefined) {
            query += ' AND is_active = ?';
            params.push(filters.is_active === 'true' || filters.is_active === true ? 1 : 0);
        }

        const [rows] = await db.execute(query, params);
        return rows[0].total;
    }

    static async canHaveIndividualRights(badge_id) {
        const [rows] = await db.execute(
            'SELECT id FROM badge_group_members WHERE badge_id = ?',
            [parseInt(badge_id)]
        );
        return rows.length === 0;
    }
}

module.exports = BadgeGroup;