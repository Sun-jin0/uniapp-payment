const pool = require('../config/mysql');
const VideoCollection = require('./VideoCollection');

class UserVideo {
  // Get User's Videos (Redeemed or Favorite)
  static async getUserVideos(userId, type = 'redeemed') {
    if (type === 'redeemed') {
      // Get collections first
      const [collections] = await pool.query(`
        SELECT DISTINCT vc.id, vc.name, vc.description, vc.cover_url, vc.sort,
               MIN(uv.created_at) as access_time, COUNT(DISTINCT cv.resource_id) as video_count
        FROM video_collections vc
        JOIN user_videos uv ON vc.id = uv.collection_id
        LEFT JOIN collection_videos cv ON vc.id = cv.collection_id
        WHERE uv.user_id = ? AND uv.has_access = 1 AND vc.is_active = 1
        GROUP BY vc.id
        ORDER BY vc.sort ASC, access_time DESC
      `, [userId]);

      // Get individual videos (not in any collection)
      const [individualVideos] = await pool.query(`
        SELECT DISTINCT r.*, uv.created_at as access_time
        FROM video_resources r
        JOIN user_videos uv ON r.id = uv.resource_id
        WHERE uv.user_id = ? AND uv.has_access = 1 AND r.status = 1
        AND (uv.collection_id IS NULL OR uv.collection_id = 0)
        ORDER BY uv.created_at DESC
      `, [userId]);

      return {
        type: 'grouped',
        collections: collections.map(c => ({
          ...c,
          itemType: 'collection'
        })),
        individualVideos: individualVideos.map(v => ({
          ...v,
          itemType: 'video'
        }))
      };
    } else { // favorite
      const sql = `
        SELECT r.*, uv.created_at as favorite_time
        FROM video_resources r
        JOIN user_videos uv ON r.id = uv.resource_id
        WHERE uv.user_id = ? AND uv.is_favorite = 1 AND r.status = 1
        ORDER BY uv.created_at DESC
      `;
      const [rows] = await pool.query(sql, [userId]);
      return { type: 'list', data: rows };
    }
  }

  // Check access
  static async hasAccess(userId, resourceId) {
    // Check direct access
    const [rows] = await pool.query(
      'SELECT id FROM user_videos WHERE user_id = ? AND resource_id = ? AND has_access = 1', 
      [userId, resourceId]
    );
    if (rows.length > 0) return true;

    // Check access through collections
    const [collectionRows] = await pool.query(`
      SELECT DISTINCT cv.collection_id
      FROM collection_videos cv
      INNER JOIN user_videos uv ON uv.collection_id = cv.collection_id
      WHERE uv.user_id = ? AND cv.resource_id = ? AND uv.has_access = 1
    `, [userId, resourceId]);

    return collectionRows.length > 0;
  }

  // Get collection access info
  static async getCollectionAccessInfo(userId, resourceId) {
    const [rows] = await pool.query(`
      SELECT cv.collection_id, vc.name as collection_name
      FROM collection_videos cv
      INNER JOIN user_videos uv ON uv.collection_id = cv.collection_id
      INNER JOIN video_collections vc ON vc.id = cv.collection_id
      WHERE uv.user_id = ? AND cv.resource_id = ? AND uv.has_access = 1
    `, [userId, resourceId]);

    return rows.length > 0 ? rows[0] : null;
  }

  // Favorite
  static async toggleFavorite(userId, resourceId) {
    const [rows] = await pool.query('SELECT id, is_favorite FROM user_videos WHERE user_id = ? AND resource_id = ?', [userId, resourceId]);
    if (rows.length > 0) {
      const newStatus = rows[0].is_favorite ? 0 : 1;
      await pool.query('UPDATE user_videos SET is_favorite = ? WHERE id = ?', [newStatus, rows[0].id]);
      return newStatus === 1;
    } else {
      await pool.query('INSERT INTO user_videos (user_id, resource_id, is_favorite) VALUES (?, ?, 1)', [userId, resourceId]);
      return true;
    }
  }

  static async isFavorite(userId, resourceId) {
    const [rows] = await pool.query('SELECT id FROM user_videos WHERE user_id = ? AND resource_id = ? AND is_favorite = 1', [userId, resourceId]);
    return rows.length > 0;
  }

  // Update user access when collection is updated
  static async updateCollectionAccess(collectionId) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Get all users who have access to this collection
      const [userRows] = await connection.query(`
        SELECT DISTINCT user_id FROM user_videos 
        WHERE collection_id = ? AND has_access = 1
      `, [collectionId]);

      // Get all videos in the collection
      const collectionVideos = await VideoCollection.getCollectionVideos(collectionId);
      const resourceIds = collectionVideos.map(v => v.resource_id);

      // Grant access to all videos in the collection for each user
      for (const userRow of userRows) {
        for (const resourceId of resourceIds) {
          await connection.query(`
            INSERT INTO user_videos (user_id, resource_id, has_access, access_source, collection_id) 
            VALUES (?, ?, 1, 'collection', ?)
            ON DUPLICATE KEY UPDATE has_access = 1, access_source = 'collection', collection_id = ?
          `, [userRow.user_id, resourceId, collectionId, collectionId]);
        }
      }

      await connection.commit();
      return { updatedUsers: userRows.length, updatedVideos: resourceIds.length };
    } catch (e) {
      await connection.rollback();
      throw e;
    } finally {
      connection.release();
    }
  }
}

module.exports = UserVideo;
