const pool = require('../config/mysql');

class PanResource {
  static async create(data) {
    const {
      Title,
      Category = '全部资料',
      QuarkUrl = null,
      BaiduUrl = null,
      Description = '',
      IsNew = false,
      UpdateStatus = '已完结',
      IsTop = 0,
      SortOrder = 0
    } = data;
    const sql = `
      INSERT INTO pan_resources (Title, Category, QuarkUrl, BaiduUrl, Description, IsNew, UpdateStatus, IsTop, SortOrder)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const [result] = await pool.query(sql, [Title, Category, QuarkUrl, BaiduUrl, Description, IsNew, UpdateStatus, IsTop, SortOrder]);
    return result.insertId;
  }

  static async findAll(query = {}) {
    let sql = 'SELECT * FROM pan_resources WHERE 1=1';
    const params = [];
    if (query.Category) {
      sql += ' AND Category = ?';
      params.push(query.Category);
    }
    if (query.Search) {
      sql += ' AND (Title LIKE ? OR Description LIKE ?)';
      params.push(`%${query.Search}%`, `%${query.Search}%`);
    }
    // 置顶优先，然后按排序值、创建时间排序
    sql += ' ORDER BY IsTop DESC, SortOrder ASC, CreatedAt DESC';
    const [rows] = await pool.query(sql, params);
    return rows;
  }

  static async findCategories() {
    const sql = 'SELECT * FROM pan_categories ORDER BY SortOrder ASC, CategoryName ASC';
    const [rows] = await pool.query(sql);
    if (rows.length === 0) {
      // Fallback to distinct categories in resources if table is empty
      const [distinctRows] = await pool.query('SELECT DISTINCT Category FROM pan_resources WHERE Category IS NOT NULL');
      return distinctRows.map(r => r.Category);
    }
    return rows.map(r => r.CategoryName);
  }

  static async findAllCategories() {
    const sql = 'SELECT * FROM pan_categories ORDER BY SortOrder ASC, CategoryName ASC';
    const [rows] = await pool.query(sql);
    return rows;
  }

  static async createCategory(name, sortOrder = 0) {
    const sql = 'INSERT INTO pan_categories (CategoryName, SortOrder) VALUES (?, ?)';
    const [result] = await pool.query(sql, [name, sortOrder]);
    return result.insertId;
  }

  static async updateCategory(id, name, sortOrder) {
    const sql = 'UPDATE pan_categories SET CategoryName = ?, SortOrder = ? WHERE CategoryID = ?';
    const [result] = await pool.query(sql, [name, sortOrder, id]);
    return result.affectedRows > 0;
  }

  static async deleteCategory(id) {
    const sql = 'DELETE FROM pan_categories WHERE CategoryID = ?';
    const [result] = await pool.query(sql, [id]);
    return result.affectedRows > 0;
  }

  static async findByTitle(title) {
    const sql = 'SELECT * FROM pan_resources WHERE Title = ? LIMIT 1';
    const [rows] = await pool.query(sql, [title]);
    return rows[0];
  }

  static async deleteMany() {
    const sql = 'DELETE FROM pan_resources';
    await pool.query(sql);
  }

  static async update(id, data) {
    const fields = [];
    const values = [];
    
    const allowedFields = {
      Title: 'Title',
      Category: 'Category',
      QuarkUrl: 'QuarkUrl',
      BaiduUrl: 'BaiduUrl',
      Description: 'Description',
      IsNew: 'IsNew',
      UpdateStatus: 'UpdateStatus',
      IsTop: 'IsTop',
      SortOrder: 'SortOrder',
      IsPublished: 'IsPublished',
      ArticleID: 'ArticleID'
    };
    
    for (const [key, value] of Object.entries(data)) {
      if (allowedFields[key]) {
        fields.push(`${allowedFields[key]} = ?`);
        values.push(value);
      }
    }
    
    if (fields.length === 0) return false;
    
    const sql = `UPDATE pan_resources SET ${fields.join(', ')} WHERE ResourceID = ?`;
    values.push(id);
    const [result] = await pool.query(sql, values);
    return result.affectedRows > 0;
  }

  // 更新置顶状态
  static async updateTopStatus(id, isTop) {
    const sql = 'UPDATE pan_resources SET IsTop = ? WHERE ResourceID = ?';
    const [result] = await pool.query(sql, [isTop, id]);
    return result.affectedRows > 0;
  }

  // 更新排序值
  static async updateSortOrder(id, sortOrder) {
    const sql = 'UPDATE pan_resources SET SortOrder = ? WHERE ResourceID = ?';
    const [result] = await pool.query(sql, [sortOrder, id]);
    return result.affectedRows > 0;
  }

  static async delete(id) {
    const sql = 'DELETE FROM pan_resources WHERE ResourceID = ?';
    const [result] = await pool.query(sql, [id]);
    return result.affectedRows > 0;
  }

  static async batchUpdateCategory(ids, category) {
    // 网盘资源实际存储在 notices 表中
    const sql = 'UPDATE notices SET category = ? WHERE id IN (?) AND noticeType = "pan_resource"';
    const [result] = await pool.query(sql, [category, ids]);
    return result.affectedRows;
  }

  static async batchUpdateField(ids, field, value) {
    const allowedFields = ['IsTop', 'IsNew', 'SortOrder', 'Category', 'IsPublished', 'ArticleID'];
    if (!allowedFields.includes(field)) {
      throw new Error('不允许更新的字段');
    }
    const sql = `UPDATE pan_resources SET ${field} = ? WHERE ResourceID IN (?)`;
    const [result] = await pool.query(sql, [value, ids]);
    return result.affectedRows;
  }

  static async batchDelete(ids) {
    const sql = 'DELETE FROM pan_resources WHERE ResourceID IN (?)';
    const [result] = await pool.query(sql, [ids]);
    return result.affectedRows;
  }
}

module.exports = PanResource;
