const mysqlPool = require('../config/mysql');
const crypto = require('crypto');

class ImageManagement {
  /**
   * 计算文件MD5哈希
   */
  static calculateHash(filePath) {
    const fs = require('fs');
    const hash = crypto.createHash('md5');
    const data = fs.readFileSync(filePath);
    hash.update(data);
    return hash.digest('hex');
  }

  /**
   * 根据哈希查找图片（包括所有状态）
   */
  static async findByHash(imageHash) {
    const [rows] = await mysqlPool.execute(
      'SELECT * FROM image_management WHERE image_hash = ?',
      [imageHash]
    );
    return rows[0] || null;
  }

  /**
   * 创建图片记录
   */
  static async create(data) {
    const {
      imageName,
      imageType,
      imageSize,
      imageHash,
      ossUrl,
      ossBucket,
      ossObjectKey,
      ossStatus,
      imgbbUrl,
      imgbbDeleteUrl,
      imgbbId,
      imgbbStatus,
      sourceType,
      sourceId,
      userId
    } = data;

    const [result] = await mysqlPool.execute(
      `INSERT INTO image_management 
       (image_name, image_type, image_size, image_hash, 
        oss_url, oss_bucket, oss_object_key, oss_upload_time, oss_status,
        imgbb_url, imgbb_delete_url, imgbb_id, imgbb_upload_time, imgbb_status,
        source_type, source_id, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, NOW(), ?, ?, ?, ?)`,
      [
        imageName, imageType, imageSize, imageHash,
        ossUrl || null, ossBucket || null, ossObjectKey || null, ossStatus || 0,
        imgbbUrl || null, imgbbDeleteUrl || null, imgbbId || null, imgbbStatus || 0,
        sourceType || 'other', sourceId || null, userId || null
      ]
    );

    return result.insertId;
  }

  /**
   * 更新图片记录
   */
  static async update(id, data) {
    const updates = [];
    const values = [];

    const fields = [
      'image_name', 'image_type', 'image_size', 'image_hash',
      'oss_url', 'oss_bucket', 'oss_object_key', 'oss_status',
      'imgbb_url', 'imgbb_delete_url', 'imgbb_id', 'imgbb_status',
      'source_type', 'source_id', 'status', 'remark'
    ];

    fields.forEach(field => {
      if (data[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(data[field]);
      }
    });

    if (updates.length === 0) return false;

    values.push(id);
    const [result] = await mysqlPool.execute(
      `UPDATE image_management SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    return result.affectedRows > 0;
  }

  /**
   * 根据ID查找图片
   */
  static async findById(id) {
    const [rows] = await mysqlPool.execute(
      'SELECT * FROM image_management WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  }

  /**
   * 获取图片列表
   */
  static async getList(params = {}) {
    const {
      page = 1,
      pageSize = 20,
      sourceType,
      status,
      startDate,
      endDate,
      keyword,
      usageStatus
    } = params;

    let whereClause = 'WHERE im.status = 1';
    const values = [];

    if (sourceType) {
      whereClause += ' AND im.source_type = ?';
      values.push(sourceType);
    }

    if (status !== undefined) {
      whereClause += ' AND im.status = ?';
      values.push(status);
    }

    if (startDate) {
      whereClause += ' AND im.created_at >= ?';
      values.push(startDate);
    }

    if (endDate) {
      whereClause += ' AND im.created_at <= ?';
      values.push(endDate);
    }

    if (keyword) {
      whereClause += ' AND (im.image_name LIKE ? OR im.remark LIKE ?)';
      values.push(`%${keyword}%`, `%${keyword}%`);
    }

    // 使用状态筛选
    let havingClause = '';
    if (usageStatus === 'used') {
      havingClause = 'HAVING usage_count > 0';
    } else if (usageStatus === 'unused') {
      havingClause = 'HAVING usage_count = 0';
    }

    // 获取总数
    const countSql = `
      SELECT COUNT(*) as total FROM (
        SELECT im.id 
        FROM image_management im
        LEFT JOIN image_usage_log iul ON im.id = iul.image_id
        ${whereClause}
        GROUP BY im.id
        ${havingClause}
      ) as t
    `;
    const [countResult] = await mysqlPool.execute(countSql, values);
    const total = countResult[0].total;

    // 获取列表（包含使用次数）
    const offset = (page - 1) * pageSize;
    const queryValues = [...values, parseInt(pageSize), parseInt(offset)];
    const [rows] = await mysqlPool.execute(
      `SELECT im.*, COUNT(iul.id) as usage_count 
       FROM image_management im
       LEFT JOIN image_usage_log iul ON im.id = iul.image_id
       ${whereClause}
       GROUP BY im.id
       ${havingClause}
       ORDER BY im.created_at DESC 
       LIMIT ${parseInt(pageSize)} OFFSET ${parseInt(offset)}`
    );

    return {
      list: rows,
      total,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    };
  }

  /**
   * 删除图片（硬删除）
   */
  static async delete(id) {
    // 先删除使用记录
    await mysqlPool.execute(
      'DELETE FROM image_usage_log WHERE image_id = ?',
      [id]
    );
    
    // 再删除图片记录
    const [result] = await mysqlPool.execute(
      'DELETE FROM image_management WHERE id = ?',
      [id]
    );
    return result.affectedRows > 0;
  }

  /**
   * 记录图片使用
   */
  static async recordUsage(imageId, usageType, usageId, usageUrl) {
    const [result] = await mysqlPool.execute(
      `INSERT INTO image_usage_log (image_id, usage_type, usage_id, usage_url)
       VALUES (?, ?, ?, ?)`,
      [imageId, usageType, usageId, usageUrl]
    );
    return result.insertId;
  }

  /**
   * 获取图片使用记录
   */
  static async getUsageLog(imageId) {
    const [rows] = await mysqlPool.execute(
      `SELECT * FROM image_usage_log WHERE image_id = ? ORDER BY created_at DESC`,
      [imageId]
    );
    return rows;
  }

  /**
   * 更新统计
   */
  static async updateStats(statsDate, data) {
    const {
      totalUploads,
      ossSuccess,
      ossFailed,
      imgbbSuccess,
      imgbbFailed,
      totalSize
    } = data;

    // 先尝试更新
    const [updateResult] = await mysqlPool.execute(
      `UPDATE image_storage_stats SET
       total_uploads = total_uploads + ?,
       oss_success = oss_success + ?,
       oss_failed = oss_failed + ?,
       imgbb_success = imgbb_success + ?,
       imgbb_failed = imgbb_failed + ?,
       total_size = total_size + ?
       WHERE stats_date = ?`,
      [totalUploads, ossSuccess, ossFailed, imgbbSuccess, imgbbFailed, totalSize, statsDate]
    );

    // 如果没有更新到记录，则插入
    if (updateResult.affectedRows === 0) {
      await mysqlPool.execute(
        `INSERT INTO image_storage_stats 
         (stats_date, total_uploads, oss_success, oss_failed, 
          imgbb_success, imgbb_failed, total_size)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [statsDate, totalUploads, ossSuccess, ossFailed, imgbbSuccess, imgbbFailed, totalSize]
      );
    }
  }

  /**
   * 获取统计数据
   */
  static async getStats(startDate, endDate) {
    const [rows] = await mysqlPool.execute(
      `SELECT * FROM image_storage_stats 
       WHERE stats_date BETWEEN ? AND ?
       ORDER BY stats_date DESC`,
      [startDate, endDate]
    );
    return rows;
  }

  /**
   * 获取总统计
   */
  static async getTotalStats() {
    const [rows] = await mysqlPool.execute(
      `SELECT 
        COUNT(*) as total_images,
        SUM(CASE WHEN oss_status = 1 THEN 1 ELSE 0 END) as oss_success_count,
        SUM(CASE WHEN imgbb_status = 1 THEN 1 ELSE 0 END) as imgbb_success_count,
        SUM(image_size) as total_size
       FROM image_management WHERE status = 1`
    );
    return rows[0];
  }
}

module.exports = ImageManagement;
