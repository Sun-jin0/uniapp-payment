const mysql = require('mysql2/promise');
const fs = require('fs').promises;

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'quizmaster',
  multipleStatements: true
};

async function importMedStructure() {
  const connection = await mysql.createConnection(dbConfig);
  
  try {
    console.log('========================================');
    console.log('开始导入西医题库结构数据...');
    console.log('========================================\n');
    
    // ========== 1. 导入课程数据 ==========
    console.log('【1/3】导入课程数据...\n');
    
    try {
      const coursesData = JSON.parse(await fs.readFile(__dirname + '/../结构/med_courses.json', 'utf8'));
      const courses = coursesData.list || [];
      let successCount = 0;
      
      for (const course of courses) {
        try {
          await connection.query(
            `INSERT INTO med_courses (course_id, name, sort, status) 
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE 
             name = VALUES(name),
             sort = VALUES(sort)`,
            [
              course.courseId,
              course.courseName,
              course.sort || 0,
              course.isUnlocked === 0 ? 1 : 0
            ]
          );
          console.log(`  ✓ 课程: ${course.courseName} (${course.courseId}) - ${course.totalQuestionCount}题`);
          successCount++;
        } catch (err) {
          console.error(`  ✗ 导入课程 ${course.courseName} 失败:`, err.message);
        }
      }
      console.log(`\n  课程导入完成: ${successCount}/${courses.length} 个\n`);
    } catch (err) {
      console.error('  读取课程文件失败:', err.message);
    }
    
    // ========== 2. 导入题目标签 ==========
    console.log('【2/3】导入题目标签...\n');
    
    try {
      const tags = JSON.parse(await fs.readFile(__dirname + '/../结构/med_question_tags.json', 'utf8'));
      let successCount = 0;
      
      for (const tag of tags) {
        try {
          await connection.query(
            `INSERT INTO med_question_tags (name, code, status) 
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE 
             name = VALUES(name)`,
            [
              tag.tagName,
              tag.tagCode,
              tag.isTag === 0 ? 1 : 0
            ]
          );
          console.log(`  ✓ 标签: ${tag.tagName} (代码: ${tag.tagCode})`);
          successCount++;
        } catch (err) {
          console.error(`  ✗ 导入标签 ${tag.tagName} 失败:`, err.message);
        }
      }
      console.log(`\n  标签导入完成: ${successCount}/${tags.length} 个\n`);
    } catch (err) {
      console.error('  读取标签文件失败:', err.message);
    }
    
    // ========== 3. 导入题目类型 ==========
    console.log('【3/3】导入题目类型...\n');
    
    try {
      // 删除旧表并重新创建
      await connection.query(`DROP TABLE IF EXISTS med_question_types`);
      await connection.query(`
        CREATE TABLE med_question_types (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(20) NOT NULL UNIQUE,
          sort INT DEFAULT 0,
          status TINYINT DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      
      const types = JSON.parse(await fs.readFile(__dirname + '/../结构/med_question_types.json', 'utf8'));
      let successCount = 0;
      let sort = 0;
      
      for (const typeName of types) {
        if (typeName === '全部') continue;
        
        try {
          await connection.query(
            `INSERT INTO med_question_types (name, sort, status) 
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE 
             sort = VALUES(sort)`,
            [typeName, sort++, 1]
          );
          console.log(`  ✓ 题型: ${typeName}`);
          successCount++;
        } catch (err) {
          console.error(`  ✗ 导入题型 ${typeName} 失败:`, err.message);
        }
      }
      console.log(`\n  题型导入完成: ${successCount} 个\n`);
    } catch (err) {
      console.error('  读取题型文件失败:', err.message);
    }
    
    console.log('========================================');
    console.log('西医题库结构数据导入完成！');
    console.log('========================================');
    
  } catch (error) {
    console.error('导入失败:', error.message);
  } finally {
    await connection.end();
  }
}

importMedStructure();
