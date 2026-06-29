const pool = require('../config/mysql');

async function createMembershipTables() {
  try {
    console.log('开始创建会员系统数据表...\n');

    // 1. 会员卡类型表（月卡/季卡/年卡）
    await pool.query(`
      CREATE TABLE IF NOT EXISTS membership_card_types (
        id INT AUTO_INCREMENT PRIMARY KEY,
        card_key VARCHAR(50) NOT NULL UNIQUE COMMENT '卡类型标识',
        display_name VARCHAR(50) NOT NULL COMMENT '显示名称',
        description VARCHAR(255) DEFAULT '' COMMENT '描述',
        price DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT '当前价格',
        original_price DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT '原价',
        duration_days INT NOT NULL DEFAULT 30 COMMENT '有效期天数',
        enabled TINYINT(1) DEFAULT 1 COMMENT '是否启用',
        sort_order INT DEFAULT 0 COMMENT '排序',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_card_key (card_key),
        INDEX idx_enabled (enabled),
        INDEX idx_sort (sort_order)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='会员卡类型表'
    `);
    console.log('✓ membership_card_types 表创建成功');

    // 2. 用户会员订阅表（全局会员，可刷全部题）
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_memberships (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL UNIQUE COMMENT '用户ID（每人只有一个会员状态）',
        card_type_id INT DEFAULT NULL COMMENT '当前会员卡类型ID',
        status ENUM('active', 'expired', 'cancelled') DEFAULT 'active' COMMENT '状态',
        expire_at DATETIME NOT NULL COMMENT '到期时间',
        price_paid DECIMAL(10,2) DEFAULT 0 COMMENT '最近支付金额',
        total_renewals INT DEFAULT 0 COMMENT '总续费次数',
        total_paid DECIMAL(10,2) DEFAULT 0 COMMENT '总支付金额',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_expire_at (expire_at),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户会员订阅表'
    `);
    console.log('✓ user_memberships 表创建成功');

    // 3. 每日做题统计表（保留）
    await pool.query(`
      CREATE TABLE IF NOT EXISTS membership_daily_counts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL COMMENT '用户ID',
        date DATE NOT NULL COMMENT '日期',
        question_count INT DEFAULT 0 COMMENT '做题数量',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_date (user_id, date),
        INDEX idx_user_id (user_id),
        INDEX idx_date (date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='每日做题统计表'
    `);
    console.log('✓ membership_daily_counts 表创建成功');

    // 4. 会员折扣/优惠表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS membership_discounts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(50) NOT NULL UNIQUE COMMENT '优惠码',
        name VARCHAR(100) NOT NULL COMMENT '优惠名称',
        discount_type ENUM('percentage', 'fixed') NOT NULL DEFAULT 'percentage' COMMENT '折扣类型',
        discount_value DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT '折扣值',
        min_amount DECIMAL(10,2) DEFAULT 0 COMMENT '最低消费金额',
        max_discount DECIMAL(10,2) DEFAULT NULL COMMENT '最大优惠金额',
        usage_limit INT DEFAULT NULL COMMENT '总使用次数限制',
        usage_count INT DEFAULT 0 COMMENT '已使用次数',
        per_user_limit INT DEFAULT 1 COMMENT '每用户限制使用次数',
        start_time DATETIME DEFAULT NULL COMMENT '开始时间',
        end_time DATETIME DEFAULT NULL COMMENT '结束时间',
        status TINYINT(1) DEFAULT 1 COMMENT '状态',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_code (code),
        INDEX idx_status (status),
        INDEX idx_time (start_time, end_time)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='会员折扣表'
    `);
    console.log('✓ membership_discounts 表创建成功');

    // 5. 用户使用优惠记录表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS membership_discount_usage (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL COMMENT '用户ID',
        discount_id INT NOT NULL COMMENT '优惠ID',
        order_id INT DEFAULT NULL COMMENT '关联订单ID',
        original_price DECIMAL(10,2) NOT NULL COMMENT '原价',
        discount_amount DECIMAL(10,2) DEFAULT 0 COMMENT '折扣金额',
        final_price DECIMAL(10,2) NOT NULL COMMENT '实付价',
        used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '使用时间',
        INDEX idx_user_id (user_id),
        INDEX idx_discount_id (discount_id),
        INDEX idx_order_id (order_id),
        INDEX idx_used_at (used_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='折扣使用记录表'
    `);
    console.log('✓ membership_discount_usage 表创建成功');

    // 6. 全局会员设置表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS membership_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        setting_key VARCHAR(100) NOT NULL UNIQUE COMMENT '设置键',
        setting_value TEXT COMMENT '设置值',
        description VARCHAR(255) DEFAULT '' COMMENT '描述',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_setting_key (setting_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='全局会员设置表'
    `);
    console.log('✓ membership_settings 表创建成功');

    // 7. 会员订单表
    await pool.query(`
      CREATE TABLE IF NOT EXISTS membership_orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_no VARCHAR(32) NOT NULL UNIQUE COMMENT '订单号',
        user_id INT NOT NULL COMMENT '用户ID',
        card_type_id INT NOT NULL COMMENT '会员卡类型ID',
        card_name VARCHAR(50) DEFAULT '' COMMENT '会员卡名称',
        duration_days INT NOT NULL DEFAULT 30 COMMENT '会员时长(天)',
        
        -- 价格信息
        original_price DECIMAL(10,2) NOT NULL COMMENT '原价',
        discount_code VARCHAR(50) DEFAULT NULL COMMENT '使用的折扣码',
        discount_id INT DEFAULT NULL COMMENT '折扣ID',
        discount_amount DECIMAL(10,2) DEFAULT 0 COMMENT '折扣金额',
        final_price DECIMAL(10,2) NOT NULL COMMENT '实付金额',
        
        -- 订单状态
        status ENUM('pending', 'paid', 'active', 'refunded', 'cancelled', 'expired') DEFAULT 'pending' COMMENT '订单状态',
        
        -- 支付信息
        payment_method VARCHAR(20) DEFAULT 'mock' COMMENT '支付方式',
        payment_time DATETIME DEFAULT NULL COMMENT '支付时间',
        payment_transaction_id VARCHAR(64) DEFAULT NULL COMMENT '支付流水号',
        
        -- 会员激活信息
        membership_start DATETIME DEFAULT NULL COMMENT '会员开始时间',
        membership_end DATETIME DEFAULT NULL COMMENT '会员结束时间',
        
        -- 其他
        remark TEXT DEFAULT NULL COMMENT '备注',
        admin_remark TEXT DEFAULT NULL COMMENT '管理员备注',
        refund_reason TEXT DEFAULT NULL COMMENT '退款原因',
        refund_time DATETIME DEFAULT NULL COMMENT '退款时间',
        
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_order_no (order_no),
        INDEX idx_user_id (user_id),
        INDEX idx_status (status),
        INDEX idx_payment_time (payment_time),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='会员订单表'
    `);
    console.log('✓ membership_orders 表创建成功');

    // 插入默认会员卡类型数据
    console.log('\n开始插入默认会员卡类型...\n');

    const defaultCardTypes = [
      { card_key: 'monthly', display_name: '月卡', description: '30天会员，畅刷全部题库', price: 9.9, original_price: 29.9, duration_days: 30, enabled: 1, sort_order: 1 },
      { card_key: 'quarterly', display_name: '季卡', description: '90天会员，畅刷全部题库，更划算', price: 19.9, original_price: 89.7, duration_days: 90, enabled: 1, sort_order: 2 },
      { card_key: 'yearly', display_name: '年卡', description: '365天会员，畅刷全部题库，超值优惠', price: 49.9, original_price: 358.8, duration_days: 365, enabled: 1, sort_order: 3 },
    ];

    for (const card of defaultCardTypes) {
      const [existing] = await pool.query(
        `SELECT COUNT(*) as count FROM membership_card_types WHERE card_key = ?`,
        [card.card_key]
      );
      if (existing[0].count === 0) {
        await pool.query(
          `INSERT INTO membership_card_types (card_key, display_name, description, price, original_price, duration_days, enabled, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [card.card_key, card.display_name, card.description, card.price, card.original_price, card.duration_days, card.enabled, card.sort_order]
        );
      }
    }
    console.log('✓ 默认会员卡类型插入成功');

    // 插入默认折扣数据
    console.log('\n开始插入默认折扣数据...\n');

    const defaultDiscounts = [
      { code: 'NEWUSER50', name: '新用户5折', discount_type: 'percentage', discount_value: 50, min_amount: 0, max_discount: null, usage_limit: 1000, per_user_limit: 1, status: 1 },
      { code: 'WELCOME30', name: '欢迎立减30%', discount_type: 'percentage', discount_value: 30, min_amount: 0, max_discount: null, usage_limit: null, per_user_limit: 1, status: 1 },
      { code: 'SAVE5', name: '立减5元', discount_type: 'fixed', discount_value: 5, min_amount: 9.9, max_discount: null, usage_limit: null, per_user_limit: 2, status: 1 },
    ];

    for (const discount of defaultDiscounts) {
      const [existing] = await pool.query(
        `SELECT COUNT(*) as count FROM membership_discounts WHERE code = ?`,
        [discount.code]
      );
      if (existing[0].count === 0) {
        await pool.query(
          `INSERT INTO membership_discounts (code, name, discount_type, discount_value, min_amount, max_discount, usage_limit, per_user_limit, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [discount.code, discount.name, discount.discount_type, discount.discount_value, discount.min_amount, discount.max_discount, discount.usage_limit, discount.per_user_limit, discount.status]
        );
      }
    }
    console.log('✓ 默认折扣数据插入成功');

    // 插入全局设置
    console.log('\n开始插入全局会员设置...\n');

    const defaultSettings = [
      { setting_key: 'free_question_limit', setting_value: '20', description: '免费题目数量限制（每日）' },
      { setting_key: 'membership_banner_text', setting_value: '开通会员，畅刷全部题库', description: '会员中心横幅文字' },
      { setting_key: 'membership_tips', setting_value: '["畅刷全部题库，不受每日限制","会员专属错题本与收藏功能","学习进度云端同步，换设备不丢失"]', description: '会员权益提示' },
      { setting_key: 'trial_days', setting_value: '0', description: '新用户试用天数' },
      { setting_key: 'renewal_discount', setting_value: '10', description: '续费优惠百分比' },
    ];

    for (const setting of defaultSettings) {
      const [existing] = await pool.query(
        `SELECT COUNT(*) as count FROM membership_settings WHERE setting_key = ?`,
        [setting.setting_key]
      );
      if (existing[0].count === 0) {
        await pool.query(
          `INSERT INTO membership_settings (setting_key, setting_value, description) VALUES (?, ?, ?)`,
          [setting.setting_key, setting.setting_value, setting.description]
        );
      }
    }
    console.log('✓ 全局会员设置插入成功');

    console.log('\n========================================');
    console.log('所有会员系统数据表创建完成！');
    console.log('会员卡类型：月卡(30天¥9.9)、季卡(90天¥19.9)、年卡(365天¥49.9)');
    console.log('========================================\n');

    process.exit(0);
  } catch (error) {
    console.error('创建表失败:', error);
    process.exit(1);
  }
}

createMembershipTables();