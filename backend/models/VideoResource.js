const pool = require('../config/mysql');
const { decrypt } = require('../utils/videoEncryption');
const crypto = require('crypto');

class VideoResource {
  static async find(query = {}) {
    let sql = `
      SELECT r.*, c.name as category_name, p.name as subject_name
      FROM video_resources r
      LEFT JOIN video_subjects c ON r.category_id = c.id
      LEFT JOIN video_subjects p ON c.parent_id = p.id
      WHERE 1=1
    `;
    const params = [];

    if (query.status !== undefined) {
      sql += ' AND r.status = ?';
      params.push(query.status);
    }
    if (query.is_public !== undefined) {
      sql += ' AND r.is_public = ?';
      params.push(query.is_public);
    }
    if (query.category_id) {
      sql += ' AND r.category_id = ?';
      params.push(query.category_id);
    }
    if (query.subject_id) {
      sql += ' AND c.parent_id = ?';
      params.push(query.subject_id);
    }
    if (query.keyword) {
      sql += ' AND r.title LIKE ?';
      params.push(`%${query.keyword}%`);
    }

    sql += ' ORDER BY r.created_at DESC';

    const [rows] = await pool.query(sql, params);
    return rows.map(row => {
      if (row.items_json) {
        row.items = typeof row.items_json === 'string' ? JSON.parse(row.items_json) : row.items_json;
        // Decrypt URLs from DB
        row.items.forEach(item => {
          if (item.url && item.url.includes(':')) item.url = decrypt(item.url);
          if (item.bili_link && item.bili_link.includes(':')) item.bili_link = decrypt(item.bili_link);
        });
      } else {
        row.items = [];
      }
      if (row.bili_link && row.bili_link.includes(':')) row.bili_link = decrypt(row.bili_link);
      return row;
    });
  }

  static async findById(id) {
    const sql = `
      SELECT r.*, c.name as category_name, p.name as subject_name
      FROM video_resources r
      LEFT JOIN video_subjects c ON r.category_id = c.id
      LEFT JOIN video_subjects p ON c.parent_id = p.id
      WHERE r.id = ?
    `;
    const [rows] = await pool.query(sql, [id]);
    if (rows.length === 0) return null;
    const resource = rows[0];
    
    if (resource.items_json) {
      resource.items = typeof resource.items_json === 'string' ? JSON.parse(resource.items_json) : resource.items_json;
      // Decrypt URLs from DB
      resource.items.forEach(item => {
        if (item.url && item.url.includes(':')) item.url = decrypt(item.url);
        if (item.bili_link && item.bili_link.includes(':')) item.bili_link = decrypt(item.bili_link);
      });
    } else {
      resource.items = [];
    }
    if (resource.bili_link && resource.bili_link.includes(':')) resource.bili_link = decrypt(resource.bili_link);
    
    return resource;
  }

  static async findByVid(vid) {
    const sql = `
      SELECT r.*, c.name as category_name, p.name as subject_name
      FROM video_resources r
      LEFT JOIN video_subjects c ON r.category_id = c.id
      LEFT JOIN video_subjects p ON c.parent_id = p.id
      WHERE r.vid = ?
    `;
    const [rows] = await pool.query(sql, [vid]);
    if (rows.length === 0) return null;
    const resource = rows[0];
    
    if (resource.items_json) {
      resource.items = typeof resource.items_json === 'string' ? JSON.parse(resource.items_json) : resource.items_json;
      // Decrypt URLs from DB
      resource.items.forEach(item => {
        if (item.url && item.url.includes(':')) item.url = decrypt(item.url);
        if (item.bili_link && item.bili_link.includes(':')) item.bili_link = decrypt(item.bili_link);
      });
    } else {
      resource.items = [];
    }
    if (resource.bili_link && resource.bili_link.includes(':')) resource.bili_link = decrypt(resource.bili_link);
    
    return resource;
  }

  static async create(data) {
    const { category_id, title, bili_link, cover_url, description, type, is_public, requires_redemption, items } = data;
    const itemsJson = items ? JSON.stringify(items) : null;
    
    // 生成加密 vid：使用 AES-256-GCM 加密自增ID
    // 这样 vid 是随机的，无法被破解或预测
    const generateEncryptedVid = () => {
      // 生成随机 16 字节 IV
      const iv = crypto.randomBytes(16);
      // 生成随机 32 字节密钥（实际应用中应该使用固定密钥）
      const key = crypto.randomBytes(32);
      // 使用当前时间戳 + 随机数作为明文
      const plaintext = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
      
      // AES-256-GCM 加密
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const authTag = cipher.getAuthTag();
      
      // 组合：authTag(32字符) + iv(32字符) + encrypted(变长)
      // 使用 base64url 编码，使其适合 URL 使用
      const combined = Buffer.from(authTag.toString('hex') + iv.toString('hex') + encrypted, 'hex');
      return combined.toString('base64url').substring(0, 32); // 取前32字符作为 vid
    };
    
    const vid = generateEncryptedVid();
    
    const [res] = await pool.query(
      'INSERT INTO video_resources (vid, category_id, title, bili_link, cover_url, description, items_json, type, is_public, requires_redemption) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [vid, category_id, title, bili_link, cover_url, description, itemsJson, type, is_public, requires_redemption]
    );
    return res.insertId;
  }

  static async update(id, data) {
    const { category_id, title, bili_link, cover_url, description, type, is_public, requires_redemption, status, items } = data;
    const itemsJson = items ? JSON.stringify(items) : null;

    await pool.query(
      'UPDATE video_resources SET category_id=?, title=?, bili_link=?, cover_url=?, description=?, items_json=?, type=?, is_public=?, requires_redemption=?, status=? WHERE id=?',
      [category_id, title, bili_link, cover_url, description, itemsJson, type, is_public, requires_redemption, status, id]
    );
  }

  static async delete(id) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      
      // Delete user access records for this resource
      await connection.query('DELETE FROM user_videos WHERE resource_id = ?', [id]);
      
      // Update redeem codes that include this resource ID
      const [codes] = await connection.query('SELECT id, resource_ids FROM redeem_codes WHERE resource_ids LIKE ?', [`%${id}%`]);
      for (const code of codes) {
        const resourceIds = code.resource_ids.split(',').filter(rid => rid && parseInt(rid) !== parseInt(id));
        if (resourceIds.length > 0) {
          await connection.query('UPDATE redeem_codes SET resource_ids = ? WHERE id = ?', [resourceIds.join(','), code.id]);
        } else {
          // If no resources left, delete the code
          await connection.query('DELETE FROM redeem_codes WHERE id = ?', [code.id]);
        }
      }
      
      // Delete the resource
      await connection.query('DELETE FROM video_resources WHERE id = ?', [id]);
      
      await connection.commit();
    } catch (e) {
      await connection.rollback();
      throw e;
    } finally {
      connection.release();
    }
  }
}

module.exports = VideoResource;
