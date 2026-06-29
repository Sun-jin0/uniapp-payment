
const pool = require('../config/mysql');
const VideoCollection = require('./VideoCollection');

class VideoRedeem {
  // Generate Code
  static async generateCode(resourceIds, count = 1, expiresAt = null, collectionId = null) {
    const codes = [];
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      
      // Default expires in 1 year
      if (!expiresAt) {
        const d = new Date();
        d.setFullYear(d.getFullYear() + 1);
        expiresAt = d;
      }

      // If resourceIds is an array, join it
      const resourceIdsStr = Array.isArray(resourceIds) ? resourceIds.join(',') : resourceIds;

      // 如果是合集兑换码，获取合集中的第一个视频资源ID
      let defaultResourceId = null;
      if (collectionId) {
        const [collectionVideos] = await connection.query(
          'SELECT resource_id FROM collection_videos WHERE collection_id = ? ORDER BY sort ASC LIMIT 1',
          [collectionId]
        );
        if (collectionVideos.length > 0) {
          defaultResourceId = collectionVideos[0].resource_id;
        }
      }

      for (let i = 0; i < count; i++) {
        const code = Math.random().toString(36).substring(2, 10).toUpperCase();
        // 如果是合集兑换码，使用合集中的第一个资源ID，否则使用传入的 resourceId
        let resourceId;
        if (collectionId) {
          resourceId = defaultResourceId;
        } else {
          resourceId = Array.isArray(resourceIds) ? resourceIds[0] : resourceIds;
        }
        await connection.query(
          'INSERT INTO redeem_codes (code, resource_id, resource_ids, expires_at, collection_id) VALUES (?, ?, ?, ?, ?)', 
          [code, resourceId, resourceIdsStr, expiresAt, collectionId]
        );
        codes.push(code);
      }
      await connection.commit();
      return codes;
    } catch (e) {
      await connection.rollback();
      throw e;
    } finally {
      connection.release();
    }
  }

  // Redeem
  static async redeem(userId, code) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Check code
      const [rows] = await connection.query('SELECT * FROM redeem_codes WHERE code = ? FOR UPDATE', [code]);
      if (rows.length === 0) throw new Error('Invalid code');
      const redeemCode = rows[0];
      
      if (redeemCode.is_used) throw new Error('Code already used');
      
      // Check expiration
      if (redeemCode.expires_at && new Date(redeemCode.expires_at) < new Date()) {
        throw new Error('Code expired');
      }

      // Mark used
      await connection.query('UPDATE redeem_codes SET is_used = 1, used_by = ?, used_at = NOW() WHERE id = ?', [userId, redeemCode.id]);

      const result = { resourceIds: [], collectionId: null };

      // If collection_id exists, grant access to all videos in the collection
      if (redeemCode.collection_id) {
        result.collectionId = redeemCode.collection_id;
        
        // Get all videos in the collection
        const collectionVideos = await VideoCollection.getCollectionVideos(redeemCode.collection_id);
        const collectionResourceIds = collectionVideos.map(v => v.resource_id);
        
        // Grant access to all videos in collection
        for (const resourceId of collectionResourceIds) {
          await connection.query(`
            INSERT INTO user_videos (user_id, resource_id, has_access, access_source, collection_id) 
            VALUES (?, ?, 1, 'collection', ?)
            ON DUPLICATE KEY UPDATE has_access = 1, access_source = 'collection', collection_id = ?
          `, [userId, resourceId, redeemCode.collection_id, redeemCode.collection_id, redeemCode.collection_id]);
        }
        
        result.resourceIds = collectionResourceIds;
      }

      // Grant access to multiple resources
      const resourceIds = (redeemCode.resource_ids || '').split(',').filter(id => id);
      for (const resourceId of resourceIds) {
        await connection.query(`
          INSERT INTO user_videos (user_id, resource_id, has_access, access_source) 
          VALUES (?, ?, 1, 'redemption')
          ON DUPLICATE KEY UPDATE has_access = 1, access_source = 'redemption'
        `, [userId, resourceId]);
      }
      
      // Merge resource IDs
      result.resourceIds = [...new Set([...result.resourceIds, ...resourceIds])];

      await connection.commit();
      return result;
    } catch (e) {
      await connection.rollback();
      throw e;
    } finally {
      connection.release();
    }
  }

  static async findCodes(query = {}) {
    let sql = `
        SELECT rc.*, u.nickname as used_by_name, u.studentId as used_by_student_id, vc.name as collection_name
        FROM redeem_codes rc
        LEFT JOIN users u ON rc.used_by = u.id
        LEFT JOIN video_collections vc ON rc.collection_id = vc.id
        WHERE 1=1
    `;
    const params = [];
    if (query.is_used !== undefined) {
        sql += ' AND rc.is_used = ?';
        params.push(query.is_used);
    }
    if (query.keyword) {
        sql += ' AND rc.code LIKE ?';
        params.push(`%${query.keyword}%`);
    }
    sql += ' ORDER BY rc.created_at DESC';
    const [rows] = await pool.query(sql, params);
    
    // 获取资源标题
    for (const row of rows) {
      if (row.collection_id) {
        row.resource_title = row.collection_name || '合集';
      } else if (row.resource_ids) {
        const resourceIds = row.resource_ids.split(',').filter(id => id);
        if (resourceIds.length === 1) {
          const [resources] = await pool.query('SELECT title FROM video_resources WHERE id = ?', [resourceIds[0]]);
          row.resource_title = resources.length > 0 ? resources[0].title : '未知资源';
        } else if (resourceIds.length > 1) {
          row.resource_title = `多个资源 (${resourceIds.length}个)`;
        } else {
          row.resource_title = '-';
        }
      } else {
        row.resource_title = '-';
      }
    }
    
    return rows;
  }

  static async deleteCode(id) {
    const [result] = await pool.query('DELETE FROM redeem_codes WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      throw new Error('兑换码不存在');
    }
    return true;
  }
}

module.exports = VideoRedeem;
