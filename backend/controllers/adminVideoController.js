
const VideoSubject = require('../models/VideoSubject');
const VideoResource = require('../models/VideoResource');
const VideoRedeem = require('../models/VideoRedeem');
const VideoCollection = require('../models/VideoCollection');
const Notice = require('../models/Notice');
const pool = require('../config/mysql');
const { encrypt } = require('../utils/videoEncryption');

class AdminVideoController {
  // --- Subjects ---
  static async getSubjects(req, res) {
    try {
      const list = await VideoSubject.getTreeAdmin();
      res.json({ code: 0, data: list });
    } catch (e) {
      res.json({ code: 500, message: e.message });
    }
  }

  static async createSubject(req, res) {
    try {
      const id = await VideoSubject.createSubject(req.body);
      
      // 创建一条系统日志/通知
      await Notice.create({
        title: `系统：创建了新科目 - ${req.body.name}`,
        category: '系统通知',
        content: `管理员于 ${new Date().toLocaleString()} 创建了视频科目：${req.body.name}`,
        noticeType: 'article',
        type: 'notice',
        isActive: 1,
        status: 1
      });

      res.json({ code: 0, data: { id } });
    } catch (e) {
      res.json({ code: 500, message: e.message });
    }
  }

  static async updateSubject(req, res) {
    try {
      await VideoSubject.updateSubject(req.params.id, req.body);
      res.json({ code: 0 });
    } catch (e) {
      res.json({ code: 500, message: e.message });
    }
  }

  static async deleteSubject(req, res) {
    try {
      await VideoSubject.deleteSubject(req.params.id);
      res.json({ code: 0 });
    } catch (e) {
      res.json({ code: 500, message: e.message });
    }
  }

  // --- Categories ---
  static async getCategories(req, res) {
    try {
      const list = await VideoSubject.findAllCategoriesAdmin(req.query.subject_id);
      res.json({ code: 0, data: list });
    } catch (e) {
      res.json({ code: 500, message: e.message });
    }
  }

  static async createCategory(req, res) {
    try {
      const id = await VideoSubject.createCategory(req.body);
      
      // 创建一条系统日志/通知
      await Notice.create({
        title: `系统：创建了新分类 - ${req.body.name}`,
        category: '系统通知',
        content: `管理员于 ${new Date().toLocaleString()} 创建了视频分类：${req.body.name}`,
        noticeType: 'article',
        type: 'notice',
        isActive: 1,
        status: 1
      });

      res.json({ code: 0, data: { id } });
    } catch (e) {
      res.json({ code: 500, message: e.message });
    }
  }

  static async updateCategory(req, res) {
    try {
      await VideoSubject.updateCategory(req.params.id, req.body);
      res.json({ code: 0 });
    } catch (e) {
      res.json({ code: 500, message: e.message });
    }
  }

  static async deleteCategory(req, res) {
    try {
      await VideoSubject.deleteCategory(req.params.id);
      res.json({ code: 0 });
    } catch (e) {
      res.json({ code: 500, message: e.message });
    }
  }

  // --- Resources ---
  static async getResources(req, res) {
    try {
      const list = await VideoResource.find(req.query);
      // Encrypt URLs in list for security
      list.forEach(res => {
        if (res.items) {
          res.items.forEach(item => {
            if (item.url) item.url = encrypt(item.url);
            if (item.bili_link) item.bili_link = encrypt(item.bili_link);
          });
        }
        if (res.bili_link) res.bili_link = encrypt(res.bili_link);
      });
      res.json({ code: 0, data: list });
    } catch (e) {
      res.json({ code: 500, message: e.message });
    }
  }

  static async getResourceDetail(req, res) {
    try {
      const data = await VideoResource.findById(req.params.id);
      if (data) {
        // Encrypt URLs for security
        if (data.items) {
          data.items.forEach(item => {
            if (item.url) item.url = encrypt(item.url);
            if (item.bili_link) item.bili_link = encrypt(item.bili_link);
          });
        }
        if (data.bili_link) data.bili_link = encrypt(data.bili_link);
      }
      res.json({ code: 0, data });
    } catch (e) {
      res.json({ code: 500, message: e.message });
    }
  }

  static async createResource(req, res) {
    try {
      const id = await VideoResource.create(req.body);

      // 创建一条系统日志/通知
      await Notice.create({
        title: `系统：上传了新视频 - ${req.body.title}`,
        category: '系统通知',
        content: `管理员于 ${new Date().toLocaleString()} 上传了视频资源：${req.body.title}`,
        noticeType: 'article',
        type: 'notice',
        isActive: 1,
        status: 1
      });

      res.json({ code: 0, data: { id } });
    } catch (e) {
      res.json({ code: 500, message: e.message });
    }
  }

  static async updateResource(req, res) {
    try {
      await VideoResource.update(req.params.id, req.body);
      res.json({ code: 0 });
    } catch (e) {
      res.json({ code: 500, message: e.message });
    }
  }

  static async deleteResource(req, res) {
    try {
      await VideoResource.delete(req.params.id);
      res.json({ code: 0 });
    } catch (e) {
      res.json({ code: 500, message: e.message });
    }
  }

  // --- Codes ---
  static async generateCodes(req, res) {
    try {
      const { resourceIds, count, expiresAt } = req.body;
      const codes = await VideoRedeem.generateCode(resourceIds, count, expiresAt);
      res.json({ code: 0, data: codes });
    } catch (e) {
      res.json({ code: 500, message: e.message });
    }
  }

  static async getCodes(req, res) {
    try {
      const list = await VideoRedeem.findCodes(req.query);
      res.json({ code: 0, data: list });
    } catch (e) {
      res.json({ code: 500, message: e.message });
    }
  }

  static async deleteCode(req, res) {
    try {
      const { id } = req.params;
      await VideoRedeem.deleteCode(id);
      res.json({ code: 0, message: '删除成功' });
    } catch (e) {
      res.json({ code: 500, message: e.message });
    }
  }

  // --- Feedbacks & Recommendations ---
  static async getFeedbacks(req, res) {
    try {
      const { type, resourceId } = req.query;
      let sql = `
        SELECT f.*, u.nickname, u.avatar, r.title as resource_title 
        FROM video_feedback f
        LEFT JOIN users u ON f.user_id = u.id
        LEFT JOIN video_resources r ON f.resource_id = r.id
        WHERE 1=1
      `;
      const params = [];
      if (type) {
        sql += ' AND f.type = ?';
        params.push(type);
      }
      if (resourceId) {
        sql += ' AND f.resource_id = ?';
        params.push(resourceId);
      }
      sql += ' ORDER BY f.created_at DESC';
      const [rows] = await pool.query(sql, params);
      res.json({ code: 0, data: rows });
    } catch (e) {
      res.json({ code: 500, message: e.message });
    }
  }

  static async getRecommendations(req, res) {
    try {
      const [rows] = await pool.query(`
        SELECT r.*, u.nickname, u.avatar 
        FROM video_recommendations r
        LEFT JOIN users u ON r.user_id = u.id
        ORDER BY r.created_at DESC
      `);
      res.json({ code: 0, data: rows });
    } catch (e) {
      res.json({ code: 500, message: e.message });
    }
  }

  static async handleRecommendation(req, res) {
    try {
      const { id, status } = req.body;
      await pool.query('UPDATE video_recommendations SET status = ? WHERE id = ?', [status, id]);
      res.json({ code: 0 });
    } catch (e) {
      res.json({ code: 500, message: e.message });
    }
  }

  // --- Batch Management ---
  static async batchUpdateResources(req, res) {
    try {
      const { ids, data } = req.body; // ids: [1, 2, 3], data: { category_id: 5, status: 1 }
      if (!ids || !ids.length) return res.json({ code: 400, message: 'IDs required' });

      const fields = [];
      const params = [];
      for (const [key, value] of Object.entries(data)) {
        fields.push(`${key} = ?`);
        params.push(value);
      }

      if (fields.length === 0) return res.json({ code: 400, message: 'No data to update' });

      const sql = `UPDATE video_resources SET ${fields.join(', ')} WHERE id IN (${ids.map(() => '?').join(',')})`;
      await pool.query(sql, [...params, ...ids]);

      res.json({ code: 0 });
    } catch (e) {
      res.json({ code: 500, message: e.message });
    }
  }

  static async batchDeleteResources(req, res) {
    try {
      const { ids } = req.body;
      if (!ids || !ids.length) return res.json({ code: 400, message: 'IDs required' });

      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        
        // Delete user access records for these resources
        await connection.query(`DELETE FROM user_videos WHERE resource_id IN (${ids.map(() => '?').join(',')})`, ids);
        
        // Update redeem codes that include any of these resource IDs
        for (const id of ids) {
          const [codes] = await connection.query('SELECT id, resource_ids FROM redeem_codes WHERE resource_ids LIKE ?', [`%${id}%`]);
          for (const code of codes) {
            const resourceIds = code.resource_ids.split(',').filter(rid => rid && !ids.includes(parseInt(rid)));
            if (resourceIds.length > 0) {
              await connection.query('UPDATE redeem_codes SET resource_ids = ? WHERE id = ?', [resourceIds.join(','), code.id]);
            } else {
              // If no resources left, delete the code
              await connection.query('DELETE FROM redeem_codes WHERE id = ?', [code.id]);
            }
          }
        }
        
        // Delete the resources
        await connection.query(`DELETE FROM video_resources WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
        
        await connection.commit();
        res.json({ code: 0 });
      } catch (e) {
        await connection.rollback();
        throw e;
      } finally {
        connection.release();
      }
    } catch (e) {
      res.json({ code: 500, message: e.message });
    }
  }

  static async batchUpdateBySubject(req, res) {
    try {
      const { subjectId, data } = req.body;
      if (!subjectId) return res.json({ code: 400, message: 'Subject ID required' });

      // Find all categories under this subject
      const [categories] = await pool.query('SELECT id FROM video_subjects WHERE parent_id = ?', [subjectId]);
      const categoryIds = categories.map(c => c.id);

      if (categoryIds.length === 0) return res.json({ code: 0, message: 'No categories found' });

      const fields = [];
      const params = [];
      for (const [key, value] of Object.entries(data)) {
        fields.push(`${key} = ?`);
        params.push(value);
      }

      const sql = `UPDATE video_resources SET ${fields.join(', ')} WHERE category_id IN (${categoryIds.map(() => '?').join(',')})`;
      await pool.query(sql, [...params, ...categoryIds]);

      res.json({ code: 0 });
    } catch (e) {
      res.json({ code: 500, message: e.message });
    }
  }

  static async batchUpdateByCategory(req, res) {
    try {
      const { categoryId, data } = req.body;
      if (!categoryId) return res.json({ code: 400, message: 'Category ID required' });

      const fields = [];
      const params = [];
      for (const [key, value] of Object.entries(data)) {
        fields.push(`${key} = ?`);
        params.push(value);
      }

      if (fields.length === 0) return res.json({ code: 400, message: 'No data to update' });

      const sql = `UPDATE video_resources SET ${fields.join(', ')} WHERE category_id = ?`;
      await pool.query(sql, [...params, categoryId]);

      res.json({ code: 0 });
    } catch (e) {
      res.json({ code: 500, message: e.message });
    }
  }

  // --- Collections ---
  static async getCollections(req, res) {
    try {
      const list = await VideoCollection.findAll();
      res.json({ code: 0, data: list });
    } catch (e) {
      res.json({ code: 500, message: e.message });
    }
  }

  static async getCollectionDetail(req, res) {
    try {
      const collection = await VideoCollection.getCollectionWithVideos(req.params.id);
      if (!collection) return res.json({ code: 404, message: 'Collection not found' });
      res.json({ code: 0, data: collection });
    } catch (e) {
      res.json({ code: 500, message: e.message });
    }
  }

  static async createCollection(req, res) {
    try {
      const id = await VideoCollection.create(req.body);
      
      await Notice.create({
        title: `系统：创建了新合集 - ${req.body.name}`,
        category: '系统通知',
        content: `管理员于 ${new Date().toLocaleString()} 创建了视频合集：${req.body.name}`,
        noticeType: 'article',
        type: 'notice',
        isActive: 1,
        status: 1
      });

      res.json({ code: 0, data: { id } });
    } catch (e) {
      res.json({ code: 500, message: e.message });
    }
  }

  static async updateCollection(req, res) {
    try {
      await VideoCollection.update(req.params.id, req.body);
      res.json({ code: 0 });
    } catch (e) {
      res.json({ code: 500, message: e.message });
    }
  }

  static async deleteCollection(req, res) {
    try {
      await VideoCollection.delete(req.params.id);
      res.json({ code: 0 });
    } catch (e) {
      res.json({ code: 500, message: e.message });
    }
  }

  static async addVideoToCollection(req, res) {
    try {
      const { collectionId, resourceId, sort } = req.body;
      await VideoCollection.addVideo(collectionId, resourceId, sort);
      res.json({ code: 0 });
    } catch (e) {
      res.json({ code: 500, message: e.message });
    }
  }

  static async removeVideoFromCollection(req, res) {
    try {
      const { collectionId, resourceId } = req.body;
      await VideoCollection.removeVideo(collectionId, resourceId);
      res.json({ code: 0 });
    } catch (e) {
      res.json({ code: 500, message: e.message });
    }
  }

  static async updateCollectionVideos(req, res) {
    try {
      const { collectionId, videoIds } = req.body;
      await VideoCollection.batchUpdateVideos(collectionId, videoIds);
      res.json({ code: 0 });
    } catch (e) {
      res.json({ code: 500, message: e.message });
    }
  }

  static async generateCollectionCodes(req, res) {
    try {
      const { collectionId, count, expiresAt } = req.body;
      const codes = await VideoRedeem.generateCode(null, count, expiresAt, collectionId);
      res.json({ code: 0, data: codes });
    } catch (e) {
      res.json({ code: 500, message: e.message });
    }
  }

  // Batch Import Videos
  static async batchImportVideos(req, res) {
    const connection = await pool.getConnection();
    try {
      const { collectionName, subjectId, categoryId, videos, requiresRedemption, isPublic } = req.body;
      
      if (!collectionName || !subjectId || !videos || !Array.isArray(videos) || videos.length === 0) {
        return res.json({ code: 400, message: '参数不完整' });
      }

      await connection.beginTransaction();

      // 1. 创建合集
      const [collectionResult] = await connection.query(
        `INSERT INTO video_collections (name, description, cover_url, sort, is_active, created_at, updated_at) 
         VALUES (?, ?, ?, 0, 1, NOW(), NOW())`,
        [collectionName, `${collectionName} - 批量导入`, '']
      );
      const collectionId = collectionResult.insertId;

      // 2. 创建视频资源 - 使用正确的表结构
      const createdResourceIds = [];
      for (let i = 0; i < videos.length; i++) {
        const video = videos[i];
        // 加密视频URL
        const encryptedUrl = encrypt(video.url);
        
        // 生成vid
        const vid = require('crypto').randomBytes(6).toString('hex');
        
        const [resourceResult] = await connection.query(
          `INSERT INTO video_resources 
           (vid, category_id, title, bili_link, cover_url, description, items_json, type, is_public, requires_redemption) 
           VALUES (?, ?, ?, ?, ?, ?, ?, 'single', ?, ?)`,
          [
            vid,
            categoryId || subjectId, // category_id 存储分类或科目ID
            video.title,
            encryptedUrl, // 使用 bili_link 字段存储视频链接
            '', // cover_url
            '', // description
            null, // items_json (单视频没有子项)
            isPublic ? 1 : 0,
            requiresRedemption ? 1 : 0
          ]
        );
        
        const resourceId = resourceResult.insertId;
        createdResourceIds.push(resourceId);
        
        // 3. 将视频添加到合集
        await connection.query(
          `INSERT INTO collection_videos (collection_id, resource_id, sort, created_at) 
           VALUES (?, ?, ?, NOW())`,
          [collectionId, resourceId, i]
        );
      }

      await connection.commit();

      // 创建系统通知
      await Notice.create({
        title: `系统：批量导入视频集合 - ${collectionName}`,
        category: '系统通知',
        content: `管理员于 ${new Date().toLocaleString()} 批量导入了视频集合：${collectionName}，共 ${videos.length} 个视频`,
        noticeType: 'article',
        type: 'notice',
        isActive: 1,
        status: 1
      });

      res.json({ 
        code: 0, 
        data: { 
          collectionId, 
          resourceCount: createdResourceIds.length 
        } 
      });
    } catch (e) {
      await connection.rollback();
      console.error('批量导入失败:', e);
      res.json({ code: 500, message: e.message });
    } finally {
      connection.release();
    }
  }
}

module.exports = AdminVideoController;
