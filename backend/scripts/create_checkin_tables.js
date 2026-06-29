const pool = require('../config/mysql');

async function createCheckinTables() {
  try {
    console.log('开始创建打卡系统数据表...\n');

    // 1. 打卡类别表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS checkin_categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL COMMENT '类别名称',
        description TEXT COMMENT '类别描述',
        icon VARCHAR(255) COMMENT '图标URL',
        cover_image VARCHAR(255) COMMENT '封面图片',
        sort_order INT DEFAULT 0 COMMENT '排序',
        status TINYINT DEFAULT 1 COMMENT '状态: 1-启用, 0-禁用',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_status (status),
        INDEX idx_sort (sort_order)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='打卡类别表'
    `);
    console.log('✓ checkin_categories 表创建成功');

    // 2. 打卡任务表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS checkin_tasks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        category_id INT NOT NULL COMMENT '所属类别ID',
        name VARCHAR(200) NOT NULL COMMENT '任务名称',
        description TEXT COMMENT '任务描述',
        start_time DATETIME COMMENT '开始时间',
        end_time DATETIME COMMENT '结束时间',
        has_learn TINYINT DEFAULT 0 COMMENT '是否有学习资料: 1-是, 0-否',
        sort_order INT DEFAULT 0 COMMENT '排序',
        status TINYINT DEFAULT 1 COMMENT '状态: 1-进行中, 2-已结束, 0-未开始',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_category (category_id),
        INDEX idx_status (status),
        INDEX idx_sort (sort_order),
        FOREIGN KEY (category_id) REFERENCES checkin_categories(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='打卡任务表'
    `);
    console.log('✓ checkin_tasks 表创建成功');

    // 3. 打卡记录表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS checkin_records_new (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL COMMENT '用户ID',
        category_id INT NOT NULL COMMENT '打卡类别ID',
        task_id INT COMMENT '关联任务ID',
        title VARCHAR(200) COMMENT '打卡标题',
        content TEXT COMMENT '打卡内容',
        images JSON COMMENT '图片数组',
        checkin_date DATE NOT NULL COMMENT '打卡日期',
        checkin_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '打卡时间',
        like_count INT DEFAULT 0 COMMENT '点赞数',
        comment_count INT DEFAULT 0 COMMENT '评论数',
        is_public TINYINT DEFAULT 1 COMMENT '是否公开: 1-公开, 0-私密',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user (user_id),
        INDEX idx_category (category_id),
        INDEX idx_task (task_id),
        INDEX idx_date (checkin_date),
        INDEX idx_public (is_public),
        FOREIGN KEY (category_id) REFERENCES checkin_categories(id) ON DELETE CASCADE,
        FOREIGN KEY (task_id) REFERENCES checkin_tasks(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='打卡记录表'
    `);
    console.log('✓ checkin_records_new 表创建成功');

    // 4. 打卡评论表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS checkin_comments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        record_id INT NOT NULL COMMENT '打卡记录ID',
        user_id INT NOT NULL COMMENT '评论用户ID',
        content TEXT NOT NULL COMMENT '评论内容',
        parent_id INT DEFAULT 0 COMMENT '父评论ID, 0表示一级评论',
        like_count INT DEFAULT 0 COMMENT '点赞数',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_record (record_id),
        INDEX idx_user (user_id),
        INDEX idx_parent (parent_id),
        FOREIGN KEY (record_id) REFERENCES checkin_records_new(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='打卡评论表'
    `);
    console.log('✓ checkin_comments 表创建成功');

    // 5. 打卡点赞表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS checkin_likes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        record_id INT NOT NULL COMMENT '打卡记录ID',
        user_id INT NOT NULL COMMENT '点赞用户ID',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_record_user (record_id, user_id),
        INDEX idx_record (record_id),
        INDEX idx_user (user_id),
        FOREIGN KEY (record_id) REFERENCES checkin_records_new(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='打卡点赞表'
    `);
    console.log('✓ checkin_likes 表创建成功');

    // 6. 用户打卡统计表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_checkin_stats (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL COMMENT '用户ID',
        category_id INT NOT NULL COMMENT '打卡类别ID',
        total_checkins INT DEFAULT 0 COMMENT '累计打卡次数',
        consecutive_days INT DEFAULT 0 COMMENT '连续打卡天数',
        last_checkin_date DATE COMMENT '最后打卡日期',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_user_category (user_id, category_id),
        INDEX idx_user (user_id),
        INDEX idx_category (category_id),
        FOREIGN KEY (category_id) REFERENCES checkin_categories(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户打卡统计表'
    `);
    console.log('✓ user_checkin_stats 表创建成功');

    // 7. 类别参与统计表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS checkin_category_stats (
        id INT AUTO_INCREMENT PRIMARY KEY,
        category_id INT NOT NULL COMMENT '打卡类别ID',
        join_count INT DEFAULT 0 COMMENT '参与人数',
        checkin_count INT DEFAULT 0 COMMENT '打卡次数',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_category (category_id),
        FOREIGN KEY (category_id) REFERENCES checkin_categories(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='类别参与统计表'
    `);
    console.log('✓ checkin_category_stats 表创建成功');

    // 插入示例数据
    console.log('\n开始插入示例数据...\n');

    // 插入打卡类别
    const [categoryResult] = await pool.query(`
      INSERT INTO checkin_categories (name, description, icon, sort_order) VALUES 
      ('数据结构基础打卡训练', '数据结构基础知识点打卡学习', 'https://img.icons8.com/ios-filled/50/ffffff/data-configuration.png', 1),
      ('计算机组成原理基础打卡训练', '计算机组成原理知识点打卡学习', 'https://img.icons8.com/ios-filled/50/ffffff/motherboard.png', 2),
      ('操作系统基础打卡训练', '操作系统知识点打卡学习', 'https://img.icons8.com/ios-filled/50/ffffff/operating-system.png', 3)
    `);
    console.log('✓ 打卡类别数据插入成功');

    // 为每个类别创建统计记录
    await pool.query(`
      INSERT INTO checkin_category_stats (category_id, join_count, checkin_count) VALUES 
      (1, 1732, 636),
      (2, 675, 245),
      (3, 57, 89)
    `);
    console.log('✓ 类别统计数据插入成功');

    // 插入打卡任务
    await pool.query(`
      INSERT INTO checkin_tasks (category_id, name, start_time, end_time, has_learn, status) VALUES 
      (1, '第一章--绪论|数据结构-408之路的开端', '2026-01-06 14:20:00', '2027-01-01 00:00:00', 1, 1),
      (1, '第二章---线性表的升级打怪通关攻略', '2026-01-12 00:00:00', '2027-01-01 00:00:00', 1, 1),
      (1, '第三章--栈、队列、数组的重点掌握细节', '2026-01-20 00:00:00', '2027-01-01 00:00:00', 1, 1)
    `);
    console.log('✓ 打卡任务数据插入成功');

    console.log('\n========================================');
    console.log('所有打卡系统数据表创建完成！');
    console.log('========================================\n');
    
    process.exit(0);
  } catch (error) {
    console.error('创建表失败:', error);
    process.exit(1);
  }
}

createCheckinTables();
