const pool = require('../config/mysql');

class VideoProgress {
  // 获取用户的视频播放进度
  static async getProgress(userId, resourceId, itemIndex = 0) {
    const [rows] = await pool.query(
      'SELECT * FROM video_progress WHERE user_id = ? AND resource_id = ? AND item_index = ?',
      [userId, resourceId, itemIndex]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  // 获取资源的所有播放进度
  static async getProgressByResource(userId, resourceId) {
    const [rows] = await pool.query(
      'SELECT item_index, progress_seconds, duration_seconds, progress_percent, is_completed, last_played_at FROM video_progress WHERE user_id = ? AND resource_id = ?',
      [userId, resourceId]
    );
    return rows;
  }

  // 更新播放进度
  static async updateProgress(userId, resourceId, itemIndex, progressData) {
    const { progressSeconds, durationSeconds, progressPercent, isCompleted } = progressData;
    
    // 检查是否已存在记录
    const [existing] = await pool.query(
      'SELECT id FROM video_progress WHERE user_id = ? AND resource_id = ? AND item_index = ?',
      [userId, resourceId, itemIndex]
    );

    if (existing.length > 0) {
      // 更新记录
      await pool.query(
        `UPDATE video_progress 
         SET progress_seconds = ?, 
             duration_seconds = ?, 
             progress_percent = ?, 
             is_completed = ?,
             last_played_at = CURRENT_TIMESTAMP
         WHERE user_id = ? AND resource_id = ? AND item_index = ?`,
        [progressSeconds, durationSeconds, progressPercent, isCompleted ? 1 : 0, userId, resourceId, itemIndex]
      );
    } else {
      // 插入新记录
      await pool.query(
        `INSERT INTO video_progress 
         (user_id, resource_id, item_index, progress_seconds, duration_seconds, progress_percent, is_completed) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, resourceId, itemIndex, progressSeconds, durationSeconds, progressPercent, isCompleted ? 1 : 0]
      );
    }

    return { success: true };
  }

  // 标记为已完成
  static async markAsCompleted(userId, resourceId, itemIndex) {
    return this.updateProgress(userId, resourceId, itemIndex, {
      progressSeconds: 0,
      durationSeconds: 0,
      progressPercent: 100,
      isCompleted: true
    });
  }

  // 获取用户的学习统计
  static async getUserStats(userId) {
    const [rows] = await pool.query(
      `SELECT 
        COUNT(*) as total_watched,
        SUM(CASE WHEN is_completed = 1 THEN 1 ELSE 0 END) as total_completed,
        SUM(progress_seconds) as total_time_seconds
       FROM video_progress 
       WHERE user_id = ?`,
      [userId]
    );
    return rows[0];
  }
}

module.exports = VideoProgress;
