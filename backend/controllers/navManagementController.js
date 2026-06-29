const pool = require('../config/mysql');
const { successResponse, errorResponse } = require('../utils/response');

// Subject Management
const getNavSubjects = async (req, res) => {
  try {
    // 尝试添加 is_public 字段（如果不存在）
    try {
      await pool.query('ALTER TABLE nav_subjects ADD COLUMN is_public TINYINT DEFAULT 1');
    } catch (e) {
      // 字段已存在，忽略错误
    }
    
    const [rows] = await pool.query('SELECT * FROM nav_subjects ORDER BY sort ASC, id ASC');
    res.json(successResponse(rows));
  } catch (error) {
    console.error('getNavSubjects error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const createNavSubject = async (req, res) => {
  try {
    const { name, subject_code, description, page_path, sort, exam_type_id = 1, icon, text_icon, color, category_type, is_public = 1 } = req.body;
    
    // 尝试添加 is_public 字段（如果不存在）
    try {
      await pool.query('ALTER TABLE nav_subjects ADD COLUMN is_public TINYINT DEFAULT 1');
    } catch (e) {
      // 字段已存在，忽略错误
    }
    
    const [result] = await pool.query(
      'INSERT INTO nav_subjects (name, subject_code, description, page_path, sort, exam_type_id, icon, text_icon, color, category_type, is_public, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)',
      [name, subject_code, description, page_path, sort || 0, exam_type_id, icon || 'books', text_icon, color || '#ffffff', category_type || 'public', is_public]
    );
    
    // 如果是公共题库，同时在 public_categories 中创建一级分类
    if (is_public && subject_code) {
      try {
        // 检查是否已存在
        const [existing] = await pool.query('SELECT id FROM public_categories WHERE subject = ? AND level = 1', [subject_code]);
        if (existing.length === 0) {
          await pool.query(
            'INSERT INTO public_categories (name, subject, level, sort) VALUES (?, ?, 1, ?)',
            [name, subject_code, sort || 0]
          );
        }
      } catch (e) {
        console.error('创建 public_categories 分类失败:', e);
      }
    }
    
    res.json(successResponse({ id: result.insertId }));
  } catch (error) {
    console.error('createNavSubject error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const updateNavSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, subject_code, description, page_path, sort, status, exam_type_id, icon, text_icon, color, category_type, is_public } = req.body;
    
    // 先获取旧的 subject_code
    const [oldSubjects] = await pool.query('SELECT subject_code FROM nav_subjects WHERE id = ?', [id]);
    const oldSubjectCode = oldSubjects.length > 0 ? oldSubjects[0].subject_code : null;
    
    await pool.query(
      'UPDATE nav_subjects SET name = ?, subject_code = ?, description = ?, page_path = ?, sort = ?, status = ?, exam_type_id = ?, icon = ?, text_icon = ?, color = ?, category_type = ? WHERE id = ?',
      [name, subject_code, description, page_path, sort, status, exam_type_id, icon, text_icon, color, category_type, id]
    );
    
    // 同步更新 public_categories 中的一级分类
    if (is_public && subject_code) {
      try {
        // 如果 subject_code 改变了，需要更新
        if (oldSubjectCode && oldSubjectCode !== subject_code) {
          // 更新旧的分类的 subject
          await pool.query('UPDATE public_categories SET subject = ? WHERE subject = ? AND level = 1', [subject_code, oldSubjectCode]);
        }
        
        // 检查是否已存在该 subject 的一级分类
        const [existing] = await pool.query('SELECT id FROM public_categories WHERE subject = ? AND level = 1', [subject_code]);
        if (existing.length > 0) {
          // 更新现有分类
          await pool.query('UPDATE public_categories SET name = ?, sort = ? WHERE id = ?', [name, sort || 0, existing[0].id]);
        } else {
          // 创建新分类
          await pool.query(
            'INSERT INTO public_categories (name, subject, level, sort) VALUES (?, ?, 1, ?)',
            [name, subject_code, sort || 0]
          );
        }
      } catch (e) {
        console.error('同步更新 public_categories 失败:', e);
      }
    }
    
    res.json(successResponse({}));
  } catch (error) {
    console.error('updateNavSubject error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const deleteNavSubject = async (req, res) => {
  try {
    const { id } = req.params;
    // Transaction to delete subject and its categories
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query('DELETE FROM nav_categories WHERE subject_id = ?', [id]);
      await connection.query('DELETE FROM nav_subjects WHERE id = ?', [id]);
      await connection.commit();
      res.json(successResponse({}));
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('deleteNavSubject error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// Category Management
const getNavCategories = async (req, res) => {
  try {
    const subjectId = req.query.subjectId || req.query.subject_id;
    if (!subjectId) {
      return res.json(successResponse([]));
    }

    // 尝试添加 is_public 字段（如果不存在）
    try {
      await pool.query('ALTER TABLE nav_subjects ADD COLUMN is_public TINYINT DEFAULT 1');
    } catch (e) {
      // 字段已存在，忽略错误
    }

    // 1. 先检查科目是否存在以及是否有 subject_code 和 is_public
    const [subjects] = await pool.query('SELECT id, subject_code, is_public FROM nav_subjects WHERE id = ?', [subjectId]);
    if (subjects.length === 0) {
      return res.json(successResponse([]));
    }

    const subject = subjects[0];
    let categories = [];

    // 2. 如果科目有 subject_code，从 public_categories 获取二级类目（公共题库分类）
    if (subject.subject_code) {
      const [publicCats] = await pool.query(
        'SELECT id, name, "" as description, "" as page_path, sort, COALESCE(is_public, 1) as is_public FROM public_categories WHERE subject = ? AND level = 2 ORDER BY sort ASC, id ASC',
        [subject.subject_code]
      );
      console.log('公共题库分类:', subject.subject_code, publicCats);
      const formattedPublicCats = publicCats.map(cat => ({
        ...cat,
        id: `public_${cat.id}`,
        source: 'public'
      }));
      categories = [...categories, ...formattedPublicCats];
    }

    // 3. 从 nav_categories 获取子项（非公共题库分类）
    const [navCats] = await pool.query(
      'SELECT id, name, description, page_path, sort, status FROM nav_categories WHERE subject_id = ? AND (status = 1 OR status IS NULL) ORDER BY sort ASC, id ASC',
      [subjectId]
    );
    console.log('非公共题库分类原始数据:', subjectId, navCats);
    const formattedNavCats = navCats.map(cat => ({
      ...cat,
      is_public: 0,  // nav_categories 表中的分类一定是非公共题库
      source: 'nav'
    }));
    console.log('非公共题库分类格式化后:', subjectId, formattedNavCats);
    categories = [...categories, ...formattedNavCats];

    // 4. 按 sort 统一排序，公共和非公共混排
    categories.sort((a, b) => {
      // 先按 sort 排序
      if ((a.sort || 0) !== (b.sort || 0)) {
        return (a.sort || 0) - (b.sort || 0);
      }
      // sort 相同时，公共的排在前面
      if (a.is_public !== b.is_public) {
        return a.is_public ? -1 : 1;
      }
      return 0;
    });
    
    console.log('最终返回的分类:', subjectId, categories);
    res.json(successResponse(categories));
  } catch (error) {
    console.error('getNavCategories error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const createNavCategory = async (req, res) => {
  try {
    const { subject_id, name, description, page_path, sort } = req.body;
    const [result] = await pool.query(
      'INSERT INTO nav_categories (subject_id, name, description, page_path, sort, status) VALUES (?, ?, ?, ?, ?, 1)',
      [subject_id, name, description, page_path, sort || 0]
    );
    res.json(successResponse({ id: result.insertId }));
  } catch (error) {
    console.error('createNavCategory error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const updateNavCategory = async (req, res) => {
  try {
    let { id } = req.params;
    const { name, description, page_path, sort, status, subject_id } = req.body;
    
    // 兼容可能带有的前缀（虽然 nav_categories 通常不带）
    if (typeof id === 'string' && id.startsWith('nav_')) {
      id = id.replace('nav_', '');
    }
    
    console.log('Updating nav category, id:', id, 'subject_id:', subject_id);
    // 确保 status 不会因为前端未传而变为 NULL
    const finalStatus = (status === undefined || status === null) ? 1 : status;
    await pool.query(
      'UPDATE nav_categories SET name = ?, description = ?, page_path = ?, sort = ?, status = ?, subject_id = ? WHERE id = ?',
      [name, description, page_path, sort, finalStatus, subject_id, id]
    );
    res.json(successResponse({}));
  } catch (error) {
    console.error('updateNavCategory error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const deleteNavCategory = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM nav_categories WHERE id = ?', [id]);
    res.json(successResponse({}));
  } catch (error) {
    console.error('deleteNavCategory error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// Public Category Management (Allow editing names and sorting of public categories)
const createPublicCategory = async (req, res) => {
  try {
    const { name, level, parentId, subject, sort } = req.body;
    const [result] = await pool.query(
      'INSERT INTO public_categories (name, level, parentId, subject, sort) VALUES (?, ?, ?, ?, ?)',
      [name, level || 1, parentId || 0, subject, sort || 0]
    );
    res.json(successResponse({ id: result.insertId }));
  } catch (error) {
    console.error('createPublicCategory error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const updatePublicCategory = async (req, res) => {
  const connection = await pool.getConnection();
  try {
    let { id } = req.params;
    const { name, sort, subject_id } = req.body;
    
    // Handle prefixed ID
    if (typeof id === 'string' && id.startsWith('public_')) {
      id = id.replace('public_', '');
    }
    
    // 如果传了 subject_id，我们需要获取对应的 subject_code
    let subjectCode = null;
    if (subject_id) {
      console.log('Updating public category, subject_id:', subject_id);
      const [subjects] = await connection.query('SELECT subject_code FROM nav_subjects WHERE id = ?', [subject_id]);
      if (subjects.length > 0) {
        subjectCode = subjects[0].subject_code;
        console.log('Found subject_code:', subjectCode);
      } else {
        console.log('No subject found for id:', subject_id);
      }
    }

    await connection.beginTransaction();

    if (subjectCode) {
      console.log('Executing UPDATE public_categories with subjectCode:', subjectCode);
      await connection.query(
        'UPDATE public_categories SET name = ?, sort = ?, subject = ? WHERE id = ?',
        [name, sort, subjectCode, id]
      );
      
      // 同时更新该分类下的子分类（三级分类）的科目
      console.log('Executing UPDATE public_categories (level 3) with subjectCode:', subjectCode, 'for parentId:', id);
      await connection.query(
        'UPDATE public_categories SET subject = ? WHERE parentId = ? AND level = 3',
        [subjectCode, id]
      );
      
      // 同时更新该分类下的书籍科目
      console.log('Executing UPDATE public_books with subjectCode:', subjectCode, 'for category_id:', id);
      await connection.query(
        'UPDATE public_books SET subject = ? WHERE second_category_id = ?',
        [subjectCode, id]
      );
    } else {
      console.log('Executing UPDATE public_categories without subjectCode');
      await connection.query(
        'UPDATE public_categories SET name = ?, sort = ? WHERE id = ?',
        [name, sort, id]
      );
    }

    await connection.commit();
    res.json(successResponse({}));
  } catch (error) {
    await connection.rollback();
    console.error('updatePublicCategory error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  } finally {
    connection.release();
  }
};

const deletePublicCategory = async (req, res) => {
  try {
    let { id } = req.params;
    
    // Handle prefixed ID
    if (typeof id === 'string' && id.startsWith('public_')) {
      id = id.replace('public_', '');
    }
    
    // Note: Deleting a public category might have cascade effects if books are linked.
    // In this simple implementation, we just delete it.
    await pool.query('DELETE FROM public_categories WHERE id = ?', [id]);
    res.json(successResponse({}));
  } catch (error) {
    console.error('deletePublicCategory error:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

module.exports = {
  getNavSubjects,
  createNavSubject,
  updateNavSubject,
  deleteNavSubject,
  getNavCategories,
  createNavCategory,
  updateNavCategory,
  deleteNavCategory,
  createPublicCategory,
  updatePublicCategory,
  deletePublicCategory
};
