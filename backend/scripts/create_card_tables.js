const pool = require('../config/mysql');

async function createCardTables() {
  try {
    // 创建 cards 表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cards (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL COMMENT '卡片名称',
        description TEXT COMMENT '卡片描述',
        image_url VARCHAR(500) NOT NULL COMMENT '卡片图片URL',
        rarity ENUM('common', 'rare', 'epic', 'legendary') DEFAULT 'common' COMMENT '稀有度',
        probability DECIMAL(5,4) NOT NULL COMMENT '抽取概率(0-1之间)',
        owner_count INT DEFAULT 0 COMMENT '拥有此卡的人数',
        draw_count INT DEFAULT 0 COMMENT '被抽取次数',
        sort_order INT DEFAULT 0 COMMENT '排序顺序',
        is_active BOOLEAN DEFAULT TRUE COMMENT '是否启用',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_rarity (rarity),
        INDEX idx_active (is_active),
        INDEX idx_sort (sort_order)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='祈福卡片表'
    `);
    console.log('✓ cards 表创建成功');

    // 创建 user_cards 表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_cards (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT NOT NULL COMMENT '用户ID',
        card_id BIGINT NOT NULL COMMENT '卡片ID',
        draw_date DATE NOT NULL COMMENT '抽取日期',
        draw_time DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '抽取时间',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uk_user_card (user_id, card_id),
        INDEX idx_user_draw_date (user_id, draw_date),
        INDEX idx_card_id (card_id),
        FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户卡片记录表'
    `);
    console.log('✓ user_cards 表创建成功');

    console.log('\n所有表创建完成！');
    process.exit(0);
  } catch (error) {
    console.error('创建表失败:', error);
    process.exit(1);
  }
}

createCardTables();
