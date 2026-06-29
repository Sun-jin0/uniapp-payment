const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'quizmaster',
  multipleStatements: true
};

async function addPanResourcesFields() {
  const connection = await mysql.createConnection(dbConfig);
  
  try {
    console.log('开始为 pan_resources 表添加字段...\n');
    
    // 禁用外键检查
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
    
    // 检查 IsTop 字段是否存在
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'quizmaster' 
      AND TABLE_NAME = 'pan_resources'
    `);
    
    const columnNames = columns.map(col => col.COLUMN_NAME);
    
    // 1. 添加 IsTop 字段（置顶标记，0=否，1=是）
    if (!columnNames.includes('IsTop')) {
      console.log('添加 IsTop 字段...');
      await connection.execute(`
        ALTER TABLE pan_resources
        ADD COLUMN IsTop TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否置顶，0=否，1=是'
      `);
      console.log('✓ IsTop 字段添加成功');
    } else {
      console.log('✓ IsTop 字段已存在，跳过');
    }
    
    // 2. 添加 SortOrder 字段（排序值，越小越靠前）
    if (!columnNames.includes('SortOrder')) {
      console.log('添加 SortOrder 字段...');
      await connection.execute(`
        ALTER TABLE pan_resources
        ADD COLUMN SortOrder INT NOT NULL DEFAULT 0 COMMENT '排序值，越小越靠前'
      `);
      console.log('✓ SortOrder 字段添加成功');
    } else {
      console.log('✓ SortOrder 字段已存在，跳过');
    }
    
    // 3. 创建索引优化查询性能
    console.log('\n创建索引...');
    
    // 获取现有索引
    const [indexes] = await connection.execute(`
      SELECT INDEX_NAME 
      FROM INFORMATION_SCHEMA.STATISTICS 
      WHERE TABLE_SCHEMA = 'quizmaster' 
      AND TABLE_NAME = 'pan_resources'
    `);
    const indexNames = indexes.map(idx => idx.INDEX_NAME);
    
    if (!indexNames.includes('idx_pan_resources_istop')) {
      await connection.execute('CREATE INDEX idx_pan_resources_istop ON pan_resources(IsTop)');
      console.log('✓ idx_pan_resources_istop 索引创建成功');
    } else {
      console.log('✓ idx_pan_resources_istop 索引已存在，跳过');
    }
    
    if (!indexNames.includes('idx_pan_resources_sortorder')) {
      await connection.execute('CREATE INDEX idx_pan_resources_sortorder ON pan_resources(SortOrder)');
      console.log('✓ idx_pan_resources_sortorder 索引创建成功');
    } else {
      console.log('✓ idx_pan_resources_sortorder 索引已存在，跳过');
    }
    
    // 启用外键检查
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
    
    console.log('\n========================================');
    console.log('pan_resources 表字段添加完成！');
    console.log('========================================');
    console.log('已添加以下字段：');
    console.log('1. IsTop - 置顶标记 (TINYINT, DEFAULT 0)');
    console.log('2. SortOrder - 排序值 (INT, DEFAULT 0)');
    console.log('========================================');
    
  } catch (error) {
    console.error('添加字段失败:', error.message);
    console.error(error.stack);
  } finally {
    await connection.end();
  }
}

addPanResourcesFields();
