const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: '139.199.9.132',
  user: 'root',
  password: '4212b46b7c02ee61',
  database: 'quizmaster'
});

async function fixMathContent() {
  console.log('开始修复数学题目内容...\n');
  
  const tables = [
    {
      name: 'math_questions',
      columns: ['QuestionText', 'OriginalAnswerText', 'LinkNames']
    },
    {
      name: 'math_questiondetails',
      columns: ['Context', 'Title']
    },
    {
      name: 'math_knowledgepoints',
      columns: ['KPName', 'KPDescription', 'KPContent']
    }
  ];
  
  const replacements = [
    { from: '$$', to: '$ $', desc: '"$$" 改为 "$ $"' },
    { from: '<', to: '< ', desc: '"<" 改为 "< "' },
    { from: '.$png', to: '.png', desc: '".$png" 改为 ".png"' },
    { from: '$,$$', to: '$,$ $', desc: '"$,$$" 改为 "$,$ $"' },
    { from: '$.$$', to: '$.$ $', desc: '"$.$$" 改为 "$.$ $"' },
    { from: '< span', to: '<span', desc: '"< span" 改为 "<span"' },
    { from: '< /span>', to: '</span>', desc: '"< /span>" 改为 "</span>"' },
    { from: '< br>', to: '<br>', desc: '"< br>" 改为 "<br>"' },
    { from: '< b>', to: '<b>', desc: '"< b>" 改为 "<b>"' },
    { from: '< /b>', to: '</b>', desc: '"< /b>" 改为 "</b>"' }
  ];
  
  try {
    let totalUpdated = 0;
    
    for (const table of tables) {
      console.log(`\n处理表: ${table.name}`);
      console.log('='.repeat(50));
      
      try {
        const [tableCheck] = await pool.query(`
          SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES 
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
        `, [table.name]);
        
        if (tableCheck.length === 0) {
          console.log(`表 ${table.name} 不存在，跳过`);
          continue;
        }
      } catch (err) {
        console.log(`检查表 ${table.name} 失败: ${err.message}`);
        continue;
      }
      
      const [existingColumns] = await pool.query(`
        SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
      `, [table.name]);
      
      const columnSet = new Set(existingColumns.map(col => col.COLUMN_NAME));
      
      for (const column of table.columns) {
        if (!columnSet.has(column)) {
          console.log(`  列 ${column} 不存在，跳过`);
          continue;
        }
        
        console.log(`\n处理列: ${column}`);
        
        for (const rule of replacements) {
          try {
            const [countResult] = await pool.query(`
              SELECT COUNT(*) as count FROM ${table.name} 
              WHERE ${column} LIKE ?
            `, [`%${rule.from}%`]);
            
            if (countResult[0].count > 0) {
              const [result] = await pool.query(`
                UPDATE ${table.name} 
                SET ${column} = REPLACE(${column}, ?, ?)
                WHERE ${column} LIKE ?
              `, [rule.from, rule.to, `%${rule.from}%`]);
              
              console.log(`  ${rule.desc}: 更新了 ${result.affectedRows} 条记录`);
              totalUpdated += result.affectedRows;
            } else {
              console.log(`  ${rule.desc}: 无需更新`);
            }
          } catch (err) {
            console.log(`  ${rule.desc}: 更新失败 - ${err.message}`);
          }
        }
      }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log(`\n完成！总共更新了 ${totalUpdated} 条记录`);
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('修复失败:', error);
    await pool.end();
    process.exit(1);
  }
}

fixMathContent();
