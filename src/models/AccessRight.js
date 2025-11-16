const db = require('../config/database');

class AccessRight {

    static async create(data) {
        const { 
            badge_id, 
            badge_group_id,
            group_id, 
            door_id,
            door_group_id,
            heure_debut, 
            heure_fin, 
            jours_semaine, 
            date_debut, 
            date_fin 
        } = data;
        
        const [result] = await db.execute(
            `INSERT INTO access_rights (
                badge_id, badge_group_id, group_id, door_id, door_group_id,
                heure_debut, heure_fin, jours_semaine, date_debut, date_fin
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                badge_id || null,
                badge_group_id || null,
                group_id || null,
                door_id || null,
                door_group_id || null,
                heure_debut || '00:00:00', 
                heure_fin || '23:59:59', 
                jours_semaine || '1,2,3,4,5,6,7', 
                date_debut || null, 
                date_fin || null
            ]
        );
        return result.insertId;
    }
    
    static async findAll(filters = {}) {
        let query = `SELECT ar.*, 
                     b.badge_uid, 
                     CONCAT(u.prenom, ' ', u.nom) as user_name,
                     g.nom as group_name,
                     g.couleur as group_color,
                     bg.nom as badge_group_name,
                     bg.couleur as badge_group_color,
                     d.nom as door_name, 
                     d.esp32_id,
                     dg.nom as door_group_name,
                     dg.couleur as door_group_color,
                     CASE 
                        WHEN ar.group_id IS NOT NULL THEN 'user_group'
                        WHEN ar.badge_group_id IS NOT NULL THEN 'badge_group'
                        WHEN ar.door_group_id IS NOT NULL THEN 'door_group'
                        WHEN ar.badge_id IS NOT NULL THEN 'individual'
                        ELSE 'unknown'
                     END as access_type
                     FROM access_rights ar 
                     LEFT JOIN badges b ON ar.badge_id = b.id
                     LEFT JOIN users u ON b.user_id = u.id 
                     LEFT JOIN \`groups\` g ON ar.group_id = g.id
                     LEFT JOIN badge_groups bg ON ar.badge_group_id = bg.id
                     LEFT JOIN doors d ON ar.door_id = d.id
                     LEFT JOIN door_groups dg ON ar.door_group_id = dg.id
                     WHERE 1=1`;
        const params = [];
        
        if (filters.badge_id) { 
            query += ' AND ar.badge_id = ?'; 
            params.push(parseInt(filters.badge_id)); 
        }
        
        if (filters.badge_group_id) { 
            query += ' AND ar.badge_group_id = ?'; 
            params.push(parseInt(filters.badge_group_id)); 
        }
        
        if (filters.group_id) { 
            query += ' AND ar.group_id = ?'; 
            params.push(parseInt(filters.group_id)); 
        }
        
        if (filters.door_id) { 
            query += ' AND ar.door_id = ?'; 
            params.push(parseInt(filters.door_id)); 
        }
        
        if (filters.door_group_id) { 
            query += ' AND ar.door_group_id = ?'; 
            params.push(parseInt(filters.door_group_id)); 
        }
        
        if (filters.is_active !== undefined) { 
            query += ' AND ar.is_active = ?'; 
            params.push(filters.is_active === 'true' || filters.is_active === true ? 1 : 0); 
        }
        
        query += ' ORDER BY ar.created_at DESC';
        
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
            `SELECT ar.*, 
             b.badge_uid,
             CONCAT(u.prenom, ' ', u.nom) as user_name,
             g.nom as group_name,
             bg.nom as badge_group_name,
             d.nom as door_name,
             dg.nom as door_group_name,
             CASE 
                WHEN ar.group_id IS NOT NULL THEN 'user_group'
                WHEN ar.badge_group_id IS NOT NULL THEN 'badge_group'
                WHEN ar.door_group_id IS NOT NULL THEN 'door_group'
                WHEN ar.badge_id IS NOT NULL THEN 'individual'
                ELSE 'unknown'
             END as access_type
             FROM access_rights ar 
             LEFT JOIN badges b ON ar.badge_id = b.id
             LEFT JOIN users u ON b.user_id = u.id
             LEFT JOIN \`groups\` g ON ar.group_id = g.id
             LEFT JOIN badge_groups bg ON ar.badge_group_id = bg.id
             LEFT JOIN doors d ON ar.door_id = d.id
             LEFT JOIN door_groups dg ON ar.door_group_id = dg.id
             WHERE ar.id = ?`, 
            [parseInt(id)]
        );
        return rows[0];
    }
    
    static async findByBadgeAndDoor(badge_id, door_id) {
        const [rows] = await db.execute(
            'SELECT * FROM access_rights WHERE badge_id = ? AND door_id = ?', 
            [parseInt(badge_id), parseInt(door_id)]
        );
        return rows[0];
    }
    
    static async findByGroupAndDoor(group_id, door_id) {
        const [rows] = await db.execute(
            'SELECT * FROM access_rights WHERE group_id = ? AND door_id = ?', 
            [parseInt(group_id), parseInt(door_id)]
        );
        return rows[0];
    }
    
    static async update(id, data) {
        const fields = [], values = [];
        const allowedFields = ['heure_debut', 'heure_fin', 'jours_semaine', 'date_debut', 'date_fin', 'is_active'];
        
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
            `UPDATE access_rights SET ${fields.join(', ')} WHERE id = ?`, 
            values
        );
        return result.affectedRows > 0;
    }
    
    static async delete(id) {
        const [result] = await db.execute('DELETE FROM access_rights WHERE id = ?', [parseInt(id)]);
        return result.affectedRows > 0;
    }
    
    static async count(filters = {}) {
        let query = 'SELECT COUNT(*) as total FROM access_rights WHERE 1=1';
        const params = [];
        
        if (filters.badge_id) {
            query += ' AND badge_id = ?';
            params.push(parseInt(filters.badge_id));
        }
        
        if (filters.group_id) {
            query += ' AND group_id = ?';
            params.push(parseInt(filters.group_id));
        }
        
        if (filters.door_id) {
            query += ' AND door_id = ?';
            params.push(parseInt(filters.door_id));
        }
        
        if (filters.is_active !== undefined) {
            query += ' AND is_active = ?';
            params.push(filters.is_active === 'true' || filters.is_active === true ? 1 : 0);
        }
        
        const [rows] = await db.execute(query, params);
        return rows[0].total;
    }
    
    static async findByUserId(user_id) {
        const [rows] = await db.execute(
            `SELECT DISTINCT ar.*, 
                    d.nom as door_name,
                    d.esp32_id,
                    dg.nom as door_group_name,
                    CASE 
                        WHEN ar.group_id IS NOT NULL THEN CONCAT('Groupe: ', g.nom)
                        WHEN ar.badge_group_id IS NOT NULL THEN CONCAT('Groupe badges: ', bg.nom)
                        ELSE 'Badge personnel'
                    END as access_source
             FROM access_rights ar
             LEFT JOIN doors d ON ar.door_id = d.id
             LEFT JOIN door_groups dg ON ar.door_group_id = dg.id
             LEFT JOIN \`groups\` g ON ar.group_id = g.id
             LEFT JOIN badge_groups bg ON ar.badge_group_id = bg.id
             LEFT JOIN badges b ON ar.badge_id = b.id
             WHERE (
                b.user_id = ? 
                OR ar.group_id IN (SELECT group_id FROM user_groups WHERE user_id = ?)
                OR ar.badge_group_id IN (
                    SELECT bgm.badge_group_id 
                    FROM badge_group_members bgm 
                    JOIN badges b2 ON bgm.badge_id = b2.id 
                    WHERE b2.user_id = ?
                )
             )
             AND ar.is_active = TRUE
             ORDER BY d.nom, ar.created_at DESC`,
            [parseInt(user_id), parseInt(user_id), parseInt(user_id)]
        );
        return rows;
    }
}

module.exports = AccessRight;