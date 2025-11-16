const db = require('../config/database');
const bcrypt = require('bcrypt');

class User {
    static async create(data) {
        const { nom, prenom, email, telephone, password, role } = data;
        let password_hash = null;

        if (password && role === 'admin') {
            password_hash = await bcrypt.hash(password, 10);
        }

        const [result] = await db.execute(
            `INSERT INTO users (nom, prenom, email, telephone, password_hash, role) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [nom, prenom, email, telephone, password_hash, role || 'user']
        );
        return result.insertId;
    }

    static async findAll(filters = {}) {
        let query = `SELECT id, nom, prenom, email, telephone, role, is_active, created_at 
                 FROM users WHERE 1=1`;
        const params = [];

        if (filters.role) {
            query += ' AND role = ?';
            params.push(filters.role);
        }

        if (filters.search) {
            query += ' AND (nom LIKE ? OR prenom LIKE ? OR email LIKE ?)';
            const searchTerm = `%${filters.search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        if (filters.is_active !== undefined) {
            query += ' AND is_active = ?';
            params.push(filters.is_active === 'true' || filters.is_active === true ? 1 : 0);
        }

        query += ' ORDER BY nom, prenom';

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
        let query = 'SELECT COUNT(*) as total FROM users WHERE 1=1';
        const params = [];

        if (filters.role) {
            query += ' AND role = ?';
            params.push(filters.role);
        }

        if (filters.is_active !== undefined) {
            query += ' AND is_active = ?';
            params.push(filters.is_active);
        }

        const [rows] = await db.execute(query, params);
        return rows[0].total;
    }

    static async findById(id) {
        const [rows] = await db.execute(
            `SELECT id, nom, prenom, email, telephone, role, is_active, created_at 
             FROM users WHERE id = ?`,
            [parseInt(id)]
        );
        return rows[0];
    }

    static async findByEmail(email) {
        const [rows] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
        return rows[0];
    }

    static async update(id, data) {
        const fields = [], values = [];
        const allowedFields = ['nom', 'prenom', 'telephone', 'is_active'];

        for (const field of allowedFields) {
            if (data[field] !== undefined) {
                fields.push(`${field} = ?`);
                values.push(data[field]);
            }
        }

        if (data.password) {
            const password_hash = await bcrypt.hash(data.password, 10);
            fields.push('password_hash = ?');
            values.push(password_hash);
        }

        if (fields.length === 0) {
            throw new Error('Aucun champ à mettre à jour');
        }

        values.push(parseInt(id));
        const [result] = await db.execute(
            `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
            values
        );
        return result.affectedRows > 0;
    }

    static async delete(id) {
        const [result] = await db.execute('DELETE FROM users WHERE id = ?', [parseInt(id)]);
        return result.affectedRows > 0;
    }

    static async existsByEmail(email) {
        const [rows] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
        return rows.length > 0;
    }

    static async verifyPassword(plainPassword, hashedPassword) {
        return await bcrypt.compare(plainPassword, hashedPassword);
    }
}

module.exports = User;