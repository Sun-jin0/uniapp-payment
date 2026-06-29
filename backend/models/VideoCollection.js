const pool = require('../config/mysql');

class VideoCollection {
  static async findAll() {
    const [rows] = await pool.query(
      'SELECT * FROM video_collections WHERE is_active = 1 ORDER BY sort ASC, created_at DESC'
    );
    return rows;
  }

  static async findById(id) {
    const [rows] = await pool.query(
      'SELECT * FROM video_collections WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  }

  static async create(data) {
    const { name, description, cover_url, sort = 0, is_active = 1 } = data;
    const [res] = await pool.query(
      'INSERT INTO video_collections (name, description, cover_url, sort, is_active) VALUES (?, ?, ?, ?, ?)',
      [name, description, cover_url, sort, is_active]
    );
    return res.insertId;
  }

  static async update(id, data) {
    const { name, description, cover_url, sort, is_active } = data;
    const fields = [];
    const params = [];
    
    if (name !== undefined) {
      fields.push('name = ?');
      params.push(name);
    }
    if (description !== undefined) {
      fields.push('description = ?');
      params.push(description);
    }
    if (cover_url !== undefined) {
      fields.push('cover_url = ?');
      params.push(cover_url);
    }
    if (sort !== undefined) {
      fields.push('sort = ?');
      params.push(sort);
    }
    if (is_active !== undefined) {
      fields.push('is_active = ?');
      params.push(is_active);
    }
    
    if (fields.length === 0) return;
    
    params.push(id);
    await pool.query(
      `UPDATE video_collections SET ${fields.join(', ')} WHERE id = ?`,
      params
    );
  }

  static async delete(id) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      
      // Delete collection videos
      await connection.query('DELETE FROM collection_videos WHERE collection_id = ?', [id]);
      
      // Update user videos that reference this collection
      await connection.query('UPDATE user_videos SET collection_id = NULL WHERE collection_id = ?', [id]);
      
      // Update redeem codes that reference this collection
      await connection.query('UPDATE redeem_codes SET collection_id = NULL WHERE collection_id = ?', [id]);
      
      // Delete the collection
      await connection.query('DELETE FROM video_collections WHERE id = ?', [id]);
      
      await connection.commit();
    } catch (e) {
      await connection.rollback();
      throw e;
    } finally {
      connection.release();
    }
  }

  static async getCollectionVideos(collectionId) {
    const [rows] = await pool.query(`
      SELECT cv.*, vr.title, vr.vid, vr.cover_url, vr.type, vr.category_id,
             c.name as category_name, p.name as subject_name
      FROM collection_videos cv
      INNER JOIN video_resources vr ON cv.resource_id = vr.id
      LEFT JOIN video_subjects c ON vr.category_id = c.id
      LEFT JOIN video_subjects p ON c.parent_id = p.id
      WHERE cv.collection_id = ?
      ORDER BY cv.sort ASC, cv.created_at DESC
    `, [collectionId]);
    
    return rows;
  }

  static async addVideo(collectionId, resourceId, sort = 0) {
    const [res] = await pool.query(
      'INSERT INTO collection_videos (collection_id, resource_id, sort) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE sort = ?',
      [collectionId, resourceId, sort, sort]
    );
    return res.insertId;
  }

  static async removeVideo(collectionId, resourceId) {
    await pool.query(
      'DELETE FROM collection_videos WHERE collection_id = ? AND resource_id = ?',
      [collectionId, resourceId]
    );
  }

  static async updateVideoSort(collectionId, resourceId, sort) {
    await pool.query(
      'UPDATE collection_videos SET sort = ? WHERE collection_id = ? AND resource_id = ?',
      [sort, collectionId, resourceId]
    );
  }

  static async batchUpdateVideos(collectionId, videoIds) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      
      // Delete existing videos in collection
      await connection.query('DELETE FROM collection_videos WHERE collection_id = ?', [collectionId]);
      
      // Add new videos
      for (let i = 0; i < videoIds.length; i++) {
        await connection.query(
          'INSERT INTO collection_videos (collection_id, resource_id, sort) VALUES (?, ?, ?)',
          [collectionId, videoIds[i], i]
        );
      }
      
      await connection.commit();
      return { success: true };
    } catch (e) {
      await connection.rollback();
      throw e;
    } finally {
      connection.release();
    }
  }

  static async getUserCollections(userId) {
    const [rows] = await pool.query(`
      SELECT DISTINCT vc.*
      FROM video_collections vc
      INNER JOIN user_videos uv ON uv.collection_id = vc.id
      WHERE uv.user_id = ? AND uv.has_access = 1 AND vc.is_active = 1
      ORDER BY vc.sort ASC, vc.created_at DESC
    `, [userId]);
    
    return rows;
  }

  static async getCollectionWithVideos(collectionId) {
    const collection = await this.findById(collectionId);
    if (!collection) return null;
    
    const videos = await this.getCollectionVideos(collectionId);
    collection.videos = videos;
    
    return collection;
  }
}

module.exports = VideoCollection;
