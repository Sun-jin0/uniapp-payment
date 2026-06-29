const pool = require('../config/mysql');

class VideoSubject {
  // --- Subjects (Level 1, parent_id IS NULL) ---
  static async findAllSubjects() {
    const [rows] = await pool.query('SELECT * FROM video_subjects WHERE parent_id IS NULL AND status = 1 ORDER BY sort ASC');
    return rows;
  }

  static async findAllSubjectsAdmin() {
    const [rows] = await pool.query('SELECT * FROM video_subjects WHERE parent_id IS NULL ORDER BY sort ASC');
    return rows;
  }

  static async createSubject(data) {
    const { name, sort } = data;
    const [res] = await pool.query('INSERT INTO video_subjects (name, sort, parent_id) VALUES (?, ?, NULL)', [name, sort || 0]);
    return res.insertId;
  }

  static async updateSubject(id, data) {
    const { name, sort, status } = data;
    await pool.query('UPDATE video_subjects SET name = ?, sort = ?, status = ? WHERE id = ? AND parent_id IS NULL', [name, sort, status, id]);
  }

  static async deleteSubject(id) {
    // Check if has sub-categories
    const [cats] = await pool.query('SELECT count(*) as count FROM video_subjects WHERE parent_id = ?', [id]);
    if (cats[0].count > 0) throw new Error('Cannot delete subject with categories');
    await pool.query('DELETE FROM video_subjects WHERE id = ? AND parent_id IS NULL', [id]);
  }

  // --- Categories (Level 2, parent_id IS NOT NULL) ---
  static async findCategoriesBySubject(parentId) {
    const [rows] = await pool.query('SELECT * FROM video_subjects WHERE parent_id = ? AND status = 1 ORDER BY sort ASC', [parentId]);
    return rows;
  }
  
  static async findAllCategoriesAdmin(parentId) {
    let sql = 'SELECT * FROM video_subjects WHERE parent_id IS NOT NULL';
    const params = [];
    if (parentId) {
        sql += ' AND parent_id = ?';
        params.push(parentId);
    }
    sql += ' ORDER BY sort ASC';
    const [rows] = await pool.query(sql, params);
    return rows;
  }

  static async createCategory(data) {
    const { parent_id, name, sort } = data;
    const [res] = await pool.query('INSERT INTO video_subjects (parent_id, name, sort) VALUES (?, ?, ?)', [parent_id, name, sort || 0]);
    return res.insertId;
  }

  static async updateCategory(id, data) {
    const { name, sort, status, parent_id } = data;
    await pool.query('UPDATE video_subjects SET name = ?, sort = ?, status = ?, parent_id = ? WHERE id = ? AND parent_id IS NOT NULL', [name, sort, status, parent_id, id]);
  }

  static async deleteCategory(id) {
    // Check if has resources
    const [res] = await pool.query('SELECT count(*) as count FROM video_resources WHERE category_id = ?', [id]);
    if (res[0].count > 0) throw new Error('Cannot delete category with resources');
    await pool.query('DELETE FROM video_subjects WHERE id = ? AND parent_id IS NOT NULL', [id]);
  }

  // Helper to get full tree
  static async getTree() {
    const subjects = await this.findAllSubjects();
    for (let sub of subjects) {
      sub.categories = await this.findCategoriesBySubject(sub.id);
    }
    return subjects;
  }

  static async getTreeAdmin() {
    const subjects = await this.findAllSubjectsAdmin();
    for (let sub of subjects) {
      sub.categories = await this.findAllCategoriesAdmin(sub.id);
    }
    return subjects;
  }
}

module.exports = VideoSubject;
