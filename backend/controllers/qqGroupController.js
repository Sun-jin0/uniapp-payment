const pool = require('../config/mysql');
const { successResponse, errorResponse } = require('../utils/response');

const parseTags = (tags) => {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags;
  try {
    const parsed = JSON.parse(tags);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    if (typeof tags === 'string') {
      return tags.split(',').map(t => t.trim()).filter(t => t);
    }
    return [];
  }
};

// 获取Q群列表（公开）
const getQQGroups = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT * FROM qq_groups 
      WHERE is_active = 1
      ORDER BY is_pinned DESC, sort_order DESC, member_count DESC
    `);
    
    const groups = rows.map(row => ({
      id: row.id,
      name: row.name,
      orgName: row.org_name,
      groupNumber: row.group_number,
      description: row.description,
      tags: parseTags(row.tags),
      memberCount: row.member_count,
      qrCode: row.qr_code,
      isPinned: row.is_pinned === 1,
      sortOrder: row.sort_order,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
    
    res.json(successResponse(groups));
  } catch (error) {
    console.error('获取Q群列表失败:', error);
    res.status(500).json(errorResponse('获取Q群列表失败: ' + error.message));
  }
};

// 获取机构列表（从Q群数据中提取）
const getOrganizations = async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT DISTINCT org_name as name FROM qq_groups 
      WHERE is_active = 1 AND org_name IS NOT NULL AND org_name != ''
      ORDER BY org_name ASC
    `);
    res.json(successResponse(rows));
  } catch (error) {
    console.error('获取机构列表失败:', error);
    res.status(500).json(errorResponse('获取机构列表失败: ' + error.message));
  }
};

// 用户置顶/取消置顶（简化版，直接修改is_pinned字段）
const togglePin = async (req, res) => {
  try {
    const { groupId } = req.body;
    
    if (!groupId) {
      return res.status(400).json(errorResponse('群ID不能为空'));
    }
    
    const [existing] = await pool.query(
      'SELECT is_pinned FROM qq_groups WHERE id = ?',
      [groupId]
    );
    
    if (existing.length === 0) {
      return res.status(404).json(errorResponse('Q群不存在'));
    }
    
    const newPinned = existing[0].is_pinned === 1 ? 0 : 1;
    await pool.query(
      'UPDATE qq_groups SET is_pinned = ? WHERE id = ?',
      [newPinned, groupId]
    );
    
    res.json(successResponse({ 
      isPinned: newPinned === 1, 
      message: newPinned === 1 ? '已置顶' : '已取消置顶' 
    }));
  } catch (error) {
    console.error('置顶操作失败:', error);
    res.status(500).json(errorResponse('置顶操作失败: ' + error.message));
  }
};

// 管理员获取Q群列表
const adminGetQQGroups = async (req, res) => {
  try {
    const { org_name, is_active } = req.query;
    let sql = 'SELECT * FROM qq_groups WHERE 1=1';
    const params = [];
    
    if (org_name) {
      sql += ' AND org_name = ?';
      params.push(org_name);
    }
    
    if (is_active !== undefined) {
      sql += ' AND is_active = ?';
      params.push(is_active === '1' ? 1 : 0);
    }
    
    sql += ' ORDER BY sort_order DESC, id DESC';
    
    const [rows] = await pool.query(sql, params);
    const groups = rows.map(row => ({
      ...row,
      tags: parseTags(row.tags)
    }));
    
    res.json(successResponse(groups));
  } catch (error) {
    console.error('获取Q群列表失败:', error);
    res.status(500).json(errorResponse('获取Q群列表失败: ' + error.message));
  }
};

// 获取单个Q群
const getQQGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query('SELECT * FROM qq_groups WHERE id = ?', [id]);
    
    if (rows.length === 0) {
      return res.status(404).json(errorResponse('Q群不存在'));
    }
    
    const group = {
      ...rows[0],
      tags: rows[0].tags ? JSON.parse(rows[0].tags) : []
    };
    
    res.json(successResponse(group));
  } catch (error) {
    console.error('获取Q群详情失败:', error);
    res.status(500).json(errorResponse('获取Q群详情失败: ' + error.message));
  }
};

// 创建Q群
const createQQGroup = async (req, res) => {
  try {
    const { name, org_name, group_number, description, tags, member_count, qr_code, is_pinned, sort_order, is_active } = req.body;
    
    if (!name || !group_number) {
      return res.status(400).json(errorResponse('群名称和群号不能为空'));
    }
    
    const [result] = await pool.query(
      `INSERT INTO qq_groups (name, org_name, group_number, description, tags, member_count, qr_code, is_pinned, sort_order, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, org_name || '', group_number, description || '', JSON.stringify(tags || []), member_count || 0, qr_code || '', is_pinned || 0, sort_order || 0, is_active !== undefined ? is_active : 1]
    );
    
    res.json(successResponse({ id: result.insertId, message: '创建成功' }));
  } catch (error) {
    console.error('创建Q群失败:', error);
    res.status(500).json(errorResponse('创建Q群失败: ' + error.message));
  }
};

// 更新Q群
const updateQQGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, org_name, group_number, description, tags, member_count, qr_code, is_pinned, sort_order, is_active } = req.body;
    
    const [existing] = await pool.query('SELECT * FROM qq_groups WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json(errorResponse('Q群不存在'));
    }
    
    await pool.query(
      `UPDATE qq_groups SET
        name = ?, org_name = ?, group_number = ?, description = ?, tags = ?,
        member_count = ?, qr_code = ?, is_pinned = ?, sort_order = ?, is_active = ?
       WHERE id = ?`,
      [name, org_name, group_number, description, JSON.stringify(tags || []), member_count, qr_code, is_pinned, sort_order, is_active, id]
    );
    
    res.json(successResponse({ message: '更新成功' }));
  } catch (error) {
    console.error('更新Q群失败:', error);
    res.status(500).json(errorResponse('更新Q群失败: ' + error.message));
  }
};

// 删除Q群
const deleteQQGroup = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM qq_groups WHERE id = ?', [id]);
    res.json(successResponse({ message: '删除成功' }));
  } catch (error) {
    console.error('删除Q群失败:', error);
    res.status(500).json(errorResponse('删除Q群失败: ' + error.message));
  }
};

module.exports = {
  getQQGroups,
  getOrganizations,
  togglePin,
  adminGetQQGroups,
  getQQGroup,
  createQQGroup,
  updateQQGroup,
  deleteQQGroup
};
