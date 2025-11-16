const db = require('../config/database');

class DoorGroup {
    static async create(data) {
        const { nom, description, couleur } = data;
        const [result] = await db.execute(
            `INSERT INTO door_groups (nom, description, couleur) VALUES (?, ?, ?)`,
            [nom, description, couleur || '#6366F1']
        );
        return result.insertId;
    }

    static async findAll(filters = {}) {
        let query = `SELECT dg.*, 
                     COUNT(DISTINCT dgm.door_id) as door_count,
                     COUNT(DISTINCT ar.id) as access_rights_count
                     FROM door_groups dg
                     LEFT JOIN door_group_members dgm ON dg.id = dgm.door_group_id
                     LEFT JOIN access_rights ar ON dg.id = ar.door_group_id
                     WHERE 1=1`;
        const params = [];

        if (filters.is_active !== undefined) {
            query += ' AND dg.is_active = ?';
            params.push(filters.is_active === 'true' || filters.is_active === true ? 1 : 0);
        }

        if (filters.search) {
            query += ' AND (dg.nom LIKE ? OR dg.description LIKE ?)';
            const searchTerm = `%${filters.search}%`;
            params.push(searchTerm, searchTerm);
        }

        query += ' GROUP BY dg.id ORDER BY dg.nom ASC';

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
            `SELECT dg.*, 
             COUNT(DISTINCT dgm.door_id) as door_count,
             COUNT(DISTINCT ar.id) as access_rights_count
             FROM door_groups dg
             LEFT JOIN door_group_members dgm ON dg.id = dgm.door_group_id
             LEFT JOIN access_rights ar ON dg.id = ar.door_group_id
             WHERE dg.id = ?
             GROUP BY dg.id`,
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
            `UPDATE door_groups SET ${fields.join(', ')} WHERE id = ?`,
            values
        );
        return result.affectedRows > 0;
    }

    static async delete(id) {
        const [result] = await db.execute('DELETE FROM door_groups WHERE id = ?', [parseInt(id)]);
        return result.affectedRows > 0;
    }

    static async addDoor(group_id, door_id, added_by) {
        const [result] = await db.execute(
            `INSERT INTO door_group_members (door_group_id, door_id, added_by) VALUES (?, ?, ?)`,
            [parseInt(group_id), parseInt(door_id), parseInt(added_by)]
        );
        return result.insertId;
    }

    static async removeDoor(group_id, door_id) {
        const [result] = await db.execute(
            'DELETE FROM door_group_members WHERE door_group_id = ? AND door_id = ?',
            [parseInt(group_id), parseInt(door_id)]
        );
        return result.affectedRows > 0;
    }

    static async getDoors(group_id) {
        const [rows] = await db.execute(
            `SELECT d.*, dgm.added_at, 
                    CONCAT(adder.prenom, ' ', adder.nom) as added_by_name
             FROM door_group_members dgm
             JOIN doors d ON dgm.door_id = d.id
             LEFT JOIN users adder ON dgm.added_by = adder.id
             WHERE dgm.door_group_id = ?
             ORDER BY d.nom`,
            [parseInt(group_id)]
        );
        return rows;
    }

    static async isDoorMember(group_id, door_id) {
        const [rows] = await db.execute(
            'SELECT id FROM door_group_members WHERE door_group_id = ? AND door_id = ?',
            [parseInt(group_id), parseInt(door_id)]
        );
        return rows.length > 0;
    }

    static async existsByName(nom) {
        const [rows] = await db.execute('SELECT id FROM door_groups WHERE nom = ?', [nom]);
        return rows.length > 0;
    }

    static async count(filters = {}) {
        let query = 'SELECT COUNT(*) as total FROM door_groups WHERE 1=1';
        const params = [];

        if (filters.is_active !== undefined) {
            query += ' AND is_active = ?';
            params.push(filters.is_active === 'true' || filters.is_active === true ? 1 : 0);
        }

        const [rows] = await db.execute(query, params);
        return rows[0].total;
    }
}

module.exports = DoorGroup;