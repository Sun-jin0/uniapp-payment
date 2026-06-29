const mysql = require('mysql2/promise');
const fs = require('fs').promises;

const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '123456',
  database: 'quizmaster',
  multipleStatements: true
};

async function importStructure() {
  const connection = await mysql.createConnection(dbConfig);
  
  try {
    console.log('开始导入计算机题库结构...\n');
    
    // 读取JSON文件
    const jsonData = JSON.parse(await fs.readFile(__dirname + '/../结构/conputer_question_bank.json', 'utf8'));
    
    // 禁用外键检查
    await connection.execute('SET FOREIGN_KEY_CHECKS = 0');
    
    let subjectCount = 0;
    let chapterCount = 0;
    let examGroupCount = 0;
    
    // 遍历科目
    for (const [majorId, majorData] of Object.entries(jsonData)) {
      const { majorName, examCategory, categoryName, chapters } = majorData;
      
      // 1. 插入科目
      try {
        await connection.query(
          `INSERT INTO computer1_subject (major_id, subject_name, subject_code, category_name, exam_category, sort, is_on_shelf) 
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE 
           subject_name = VALUES(subject_name),
           category_name = VALUES(category_name),
           exam_category = VALUES(exam_category)`,
          [majorId, majorName, majorId, categoryName, examCategory || 1, subjectCount, 1]
        );
        console.log(`✓ 科目: ${majorName} (${majorId})`);
        subjectCount++;
      } catch (err) {
        console.error(`✗ 插入科目 ${majorName} 失败:`, err.message);
        continue;
      }
      
      // 遍历章节
      if (chapters) {
        for (const [chapterId, chapterData] of Object.entries(chapters)) {
          const { name, sort, completePeopleNumber, total, examGroups } = chapterData;
          
          // 2. 插入章节
          try {
            await connection.query(
              `INSERT INTO computer1_chapter (chapter_id, major_id, chapter_name, sort, complete_people_number, total) 
               VALUES (?, ?, ?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE 
               chapter_name = VALUES(chapter_name),
               sort = VALUES(sort),
               complete_people_number = VALUES(complete_people_number),
               total = VALUES(total)`,
              [chapterId, majorId, name, sort || 0, completePeopleNumber || 0, total || 0]
            );
            console.log(`  ✓ 章节: ${name} (${chapterId})`);
            chapterCount++;
          } catch (err) {
            console.error(`  ✗ 插入章节 ${name} 失败:`, err.message);
            continue;
          }
          
          // 遍历考点组
          if (examGroups) {
            for (const [examGroupId, examGroupData] of Object.entries(examGroups)) {
              const { name: examGroupName, totalNumber, examSort } = examGroupData;
              
              // 3. 插入考点组（作为知识点标签）
              try {
                await connection.query(
                  `INSERT INTO computer1_knowledge_tag (tag_id, tag_name, chapter_id, exam_group_id, sort) 
                   VALUES (?, ?, ?, ?, ?)
                   ON DUPLICATE KEY UPDATE 
                   tag_name = VALUES(tag_name),
                   sort = VALUES(sort)`,
                  [examGroupId, examGroupName, chapterId, examGroupId, examSort || 0]
                );
                console.log(`    ✓ 考点: ${examGroupName} (${examGroupId}) - ${totalNumber}题`);
                examGroupCount++;
              } catch (err) {
                console.error(`    ✗ 插入考点 ${examGroupName} 失败:`, err.message);
              }
            }
          }
        }
      }
    }
    
    // 启用外键检查
    await connection.execute('SET FOREIGN_KEY_CHECKS = 1');
    
    console.log('\n========================================');
    console.log('导入完成！');
    console.log(`- 科目: ${subjectCount} 个`);
    console.log(`- 章节: ${chapterCount} 个`);
    console.log(`- 考点: ${examGroupCount} 个`);
    console.log('========================================');
    
  } catch (error) {
    console.error('导入失败:', error.message);
  } finally {
    await connection.end();
  }
}

importStructure();
