const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: '139.199.9.132',
  user: 'root',
  password: '4212b46b7c02ee61',
  database: 'quizmaster'
});

async function fixImagePrefix() {
  console.log('开始修复 $image → image ...\n');

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

        // 替换 $image → image
        try {
          const [countResult] = await pool.query(`
            SELECT COUNT(*) as count FROM ${table.name} 
            WHERE ${column} LIKE '%$image%'
          `);

          if (countResult[0].count > 0) {
            const [result] = await pool.query(`
              UPDATE ${table.name} 
              SET ${column} = REPLACE(${column}, '$image', 'image')
              WHERE ${column} LIKE '%$image%'
            `);

            console.log(`  $image → image: 更新了 ${result.affectedRows} 条记录`);
            totalUpdated += result.affectedRows;
          } else {
            console.log(`  $image → image: 无需更新`);
          }
        } catch (err) {
          console.log(`  $image → image: 更新失败 - ${err.message}`);
        }

        // 替换 $.png → .png (如果存在)
        try {
          const [countResult] = await pool.query(`
            SELECT COUNT(*) as count FROM ${table.name} 
            WHERE ${column} LIKE '%.$png%'
          `);

          if (countResult[0].count > 0) {
            const [result] = await pool.query(`
              UPDATE ${table.name} 
              SET ${column} = REPLACE(${column}, '.$png', '.png')
              WHERE ${column} LIKE '%.$png%'
            `);

            console.log(`  .$png → .png: 更新了 ${result.affectedRows} 条记录`);
            totalUpdated += result.affectedRows;
          } else {
            console.log(`  .$png → .png: 无需更新`);
          }
        } catch (err) {
          console.log(`  .$png → .png: 更新失败 - ${err.message}`);
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

fixImagePrefix();