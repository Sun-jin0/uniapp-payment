const pool = require('../config/mysql');

/**
 * 会员系统模型 - 时间卡模式（月卡/季卡/年卡）
 * 一个会员可刷全部题库
 */
class Membership {
  /**
   * 获取所有会员卡类型
   */
  static async getCardTypes() {
    const [rows] = await pool.query(
      `SELECT * FROM membership_card_types WHERE enabled = 1 ORDER BY sort_order ASC`
    );
    return rows;
  }

  /**
   * 获取所有会员卡类型（管理员）
   */
  static async getAllCardTypes() {
    const [rows] = await pool.query(
      `SELECT * FROM membership_card_types ORDER BY sort_order ASC`
    );
    return rows;
  }

  /**
   * 根据ID获取会员卡类型
   */
  static async getCardTypeById(id) {
    const [rows] = await pool.query(
      `SELECT * FROM membership_card_types WHERE id = ?`,
      [id]
    );
    return rows[0] || null;
  }

  /**
   * 根据key获取会员卡类型
   */
  static async getCardTypeByKey(key) {
    const [rows] = await pool.query(
      `SELECT * FROM membership_card_types WHERE card_key = ?`,
      [key]
    );
    return rows[0] || null;
  }

  /**
   * 创建会员卡类型
   */
  static async createCardType(data) {
    const durationDays = data.duration_days === null || data.duration_days === undefined || Number.isNaN(data.duration_days) || data.duration_days === '' ? null : (parseInt(data.duration_days) === 0 ? null : parseInt(data.duration_days));

    const [result] = await pool.query(
      `INSERT INTO membership_card_types (card_key, display_name, price, original_price, duration_days, description, enabled, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.card_key,
        data.display_name,
        data.price || 0,
        data.original_price || 0,
        durationDays,
        data.description || '',
        data.enabled !== undefined ? data.enabled : 1,
        data.sort_order || 0
      ]
    );
    return result.insertId;
  }

  /**
   * 更新会员卡类型
   */
  static async updateCardType(id, data) {
    const fields = [];
    const params = [];

    ['price', 'original_price', 'duration_days', 'display_name', 'description', 'enabled', 'sort_order'].forEach(key => {
      if (data[key] !== undefined) {
        fields.push(`${key} = ?`);
        if (key === 'duration_days') {
          // null/NaN/0 表示永久会员
          const val = data[key];
          params.push(val === null || val === undefined || Number.isNaN(val) || val === '' ? null : (parseInt(val) === 0 ? null : parseInt(val)));
        } else {
          params.push(data[key]);
        }
      }
    });

    if (fields.length === 0) return null;

    params.push(id);
    await pool.query(
      `UPDATE membership_card_types SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    return this.getCardTypeById(id);
  }

  /**
   * 删除会员卡类型
   */
  static async deleteCardType(id) {
    await pool.query(`DELETE FROM membership_card_types WHERE id = ?`, [id]);
    return true;
  }

  /**
   * 获取用户会员状态
   */
  static async getUserMembership(userId) {
    const [rows] = await pool.query(
      `SELECT um.*, mct.display_name as card_name, mct.card_key, mct.duration_days
       FROM user_memberships um
       LEFT JOIN membership_card_types mct ON um.card_type_id = mct.id
       WHERE um.user_id = ?`,
      [userId]
    );

    if (rows.length === 0) return null;

    const membership = rows[0];

    // 检查是否过期（永久会员 expire_at 为 null，不检查）
    if (membership.expire_at !== null && membership.status === 'active') {
      const now = new Date();
      const expireAt = new Date(membership.expire_at);
      if (expireAt < now) {
        await pool.query(
          `UPDATE user_memberships SET status = 'expired', updated_at = NOW() WHERE user_id = ?`,
          [userId]
        );
        membership.status = 'expired';
      }
    }

    return membership;
  }

  /**
   * 检查用户是否是有效会员
   */
  static async isMember(userId) {
    const membership = await this.getUserMembership(userId);
    if (!membership) return false;
    if (membership.status !== 'active') return false;
    // 永久会员：expire_at 为 null
    if (membership.expire_at === null) return true;
    return new Date(membership.expire_at) > new Date();
  }

  /**
   * 检查用户做题权限
   */
  static async checkQuestionAccess(userId) {
    const isMember = await this.isMember(userId);
    if (isMember) {
      return { canAccess: true, reason: 'member', remaining: Infinity };
    }

    // 非会员检查每日免费题数
    const freeLimit = await this.getSetting('free_question_limit');
    const limit = parseInt(freeLimit) || 20;

    const today = new Date().toISOString().slice(0, 10);
    const [rows] = await pool.query(
      `SELECT question_count FROM membership_daily_counts WHERE user_id = ? AND date = ?`,
      [userId, today]
    );

    const count = rows.length > 0 ? rows[0].question_count : 0;
    const remaining = limit - count;

    return {
      canAccess: remaining > 0,
      reason: remaining > 0 ? 'free' : 'limit_exceeded',
      remaining,
      limit,
      used: count
    };
  }

  /**
   * 记录做题次数
   */
  static async recordQuestionView(userId) {
    const today = new Date().toISOString().slice(0, 10);

    const [existing] = await pool.query(
      `SELECT question_count FROM membership_daily_counts WHERE user_id = ? AND date = ?`,
      [userId, today]
    );

    if (existing.length > 0) {
      await pool.query(
        `UPDATE membership_daily_counts SET question_count = question_count + 1, updated_at = NOW() WHERE user_id = ? AND date = ?`,
        [userId, today]
      );
    } else {
      await pool.query(
        `INSERT INTO membership_daily_counts (user_id, date, question_count) VALUES (?, ?, 1)`,
        [userId, today]
      );
    }
  }

  /**
   * 开通/续费会员
   */
  static async activateMembership(userId, cardTypeId, pricePaid) {
    const cardType = await this.getCardTypeById(cardTypeId);
    if (!cardType) throw new Error('会员卡类型不存在');

    const now = new Date();
    const [existing] = await pool.query(
      `SELECT * FROM user_memberships WHERE user_id = ?`,
      [userId]
    );

    const isPermanent = cardType.duration_days === null || cardType.duration_days === 0 || cardType.duration_days === undefined;

    let expireAt = null;
    if (!isPermanent) {
      if (existing.length > 0 && existing[0].status === 'active' && existing[0].expire_at) {
        // 续费：延长现有到期时间
        expireAt = new Date(existing[0].expire_at);
        expireAt = new Date(expireAt.getTime() + cardType.duration_days * 24 * 60 * 60 * 1000);
      } else {
        // 新开通
        expireAt = new Date(now.getTime() + cardType.duration_days * 24 * 60 * 60 * 1000);
      }
    }

    if (existing.length > 0) {
      await pool.query(
        `UPDATE user_memberships 
         SET card_type_id = ?, status = 'active', expire_at = ?, 
             price_paid = ?, total_renewals = total_renewals + 1, 
             total_paid = total_paid + ?, updated_at = NOW() 
         WHERE user_id = ?`,
        [cardTypeId, expireAt, pricePaid, pricePaid, userId]
      );
    } else {
      await pool.query(
        `INSERT INTO user_memberships (user_id, card_type_id, status, expire_at, price_paid, total_renewals, total_paid) 
         VALUES (?, ?, 'active', ?, ?, 1, ?)`,
        [userId, cardTypeId, expireAt, pricePaid, pricePaid]
      );
    }

    return { expireAt, cardType, isPermanent };
  }

  /**
   * 获取折扣信息
   */
  static async getDiscountByCode(code) {
    const [rows] = await pool.query(
      `SELECT * FROM membership_discounts WHERE code = ? AND status = 1`,
      [code]
    );
    return rows[0] || null;
  }

  /**
   * 计算折扣价格
   */
  static async calculateDiscountPrice(code, originalPrice, userId) {
    const discount = await this.getDiscountByCode(code);
    if (!discount) {
      return { valid: false, message: '优惠码不存在或已失效', finalPrice: originalPrice };
    }

    // 检查最低消费
    if (discount.min_amount && originalPrice < discount.min_amount) {
      return { valid: false, message: `最低消费¥${discount.min_amount}`, finalPrice: originalPrice };
    }

    // 检查总使用次数
    if (discount.usage_limit && discount.usage_count >= discount.usage_limit) {
      return { valid: false, message: '优惠码已用完', finalPrice: originalPrice };
    }

    // 检查用户使用次数
    const [userUsage] = await pool.query(
      `SELECT COUNT(*) as count FROM membership_discount_usage WHERE user_id = ? AND discount_id = ?`,
      [userId, discount.id]
    );
    if (userUsage[0].count >= discount.per_user_limit) {
      return { valid: false, message: '您已使用过该优惠码', finalPrice: originalPrice };
    }

    // 检查有效期
    const now = new Date();
    if (discount.start_time && new Date(discount.start_time) > now) {
      return { valid: false, message: '优惠码尚未生效', finalPrice: originalPrice };
    }
    if (discount.end_time && new Date(discount.end_time) < now) {
      return { valid: false, message: '优惠码已过期', finalPrice: originalPrice };
    }

    // 计算折扣
    let discountAmount = 0;
    let finalPrice = originalPrice;

    if (discount.discount_type === 'percentage') {
      discountAmount = originalPrice * (discount.discount_value / 100);
      if (discount.max_discount && discountAmount > discount.max_discount) {
        discountAmount = discount.max_discount;
      }
    } else {
      discountAmount = discount.discount_value;
    }

    finalPrice = Math.max(0, originalPrice - discountAmount);

    return {
      valid: true,
      discountId: discount.id,
      discountName: discount.name,
      discountAmount,
      finalPrice
    };
  }

  /**
   * 获取所有折扣（管理员）
   */
  static async getAllDiscounts() {
    const [rows] = await pool.query(
      `SELECT * FROM membership_discounts ORDER BY created_at DESC`
    );
    return rows;
  }

  /**
   * 创建折扣
   */
  static async createDiscount(data) {
    const [result] = await pool.query(
      `INSERT INTO membership_discounts (code, name, discount_type, discount_value, min_amount, max_discount, usage_limit, per_user_limit, start_time, end_time, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.code, data.name, data.discount_type, data.discount_value, data.min_amount || 0, data.max_discount || null, data.usage_limit || null, data.per_user_limit || 1, data.start_time || null, data.end_time || null, data.status !== undefined ? data.status : 1]
    );
    return result.insertId;
  }

  /**
   * 更新折扣
   */
  static async updateDiscount(id, data) {
    const fields = [];
    const params = [];

    ['code', 'name', 'discount_type', 'discount_value', 'min_amount', 'max_discount', 'usage_limit', 'per_user_limit', 'start_time', 'end_time', 'status'].forEach(key => {
      if (data[key] !== undefined) {
        fields.push(`${key} = ?`);
        params.push(data[key]);
      }
    });

    if (fields.length === 0) return null;

    params.push(id);
    await pool.query(
      `UPDATE membership_discounts SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );
  }

  /**
   * 删除折扣
   */
  static async deleteDiscount(id) {
    await pool.query(`DELETE FROM membership_discounts WHERE id = ?`, [id]);
  }

  /**
   * 记录折扣使用
   */
  static async recordDiscountUsage(userId, discountId, orderId, originalPrice, discountAmount, finalPrice) {
    await pool.query(
      `INSERT INTO membership_discount_usage (user_id, discount_id, order_id, original_price, discount_amount, final_price) VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, discountId, orderId, originalPrice, discountAmount, finalPrice]
    );

    await pool.query(
      `UPDATE membership_discounts SET usage_count = usage_count + 1 WHERE id = ?`,
      [discountId]
    );
  }

  /**
   * 获取折扣使用记录
   */
  static async getDiscountUsage(discountId = null, page = 1, pageSize = 20) {
    let sql = `SELECT du.*, u.username, u.nickname, o.order_no, md.code, md.name 
               FROM membership_discount_usage du 
               LEFT JOIN users u ON du.user_id = u.id 
               LEFT JOIN membership_orders o ON du.order_id = o.id 
               LEFT JOIN membership_discounts md ON du.discount_id = md.id 
               WHERE 1=1`;
    const params = [];

    if (discountId) {
      sql += ` AND du.discount_id = ?`;
      params.push(discountId);
    }

    sql += ` ORDER BY du.used_at DESC LIMIT ? OFFSET ?`;
    params.push(pageSize, (page - 1) * pageSize);

    const [rows] = await pool.query(sql, params);
    return rows;
  }

  /**
   * 获取设置
   */
  static async getSetting(key) {
    const [rows] = await pool.query(
      `SELECT setting_value FROM membership_settings WHERE setting_key = ?`,
      [key]
    );
    return rows.length > 0 ? rows[0].setting_value : null;
  }

  /**
   * 获取所有设置
   */
  static async getAllSettings() {
    const [rows] = await pool.query(`SELECT * FROM membership_settings`);
    return rows;
  }

  /**
   * 更新设置
   */
  static async updateSetting(key, value) {
    await pool.query(
      `UPDATE membership_settings SET setting_value = ?, updated_at = NOW() WHERE setting_key = ?`,
      [value, key]
    );
  }

  /**
   * 获取会员统计
   */
  static async getStats() {
    const [totalMembers] = await pool.query(
      `SELECT COUNT(*) as total FROM user_memberships`
    );
    const [activeMembers] = await pool.query(
      `SELECT COUNT(*) as total FROM user_memberships WHERE status = 'active' AND expire_at > NOW()`
    );
    const [totalOrders] = await pool.query(
      `SELECT COUNT(*) as total FROM membership_orders`
    );
    const [revenue] = await pool.query(
      `SELECT SUM(final_price) as total FROM membership_orders WHERE status IN ('paid', 'active')`
    );

    return {
      totalMembers: totalMembers[0].total,
      activeMembers: activeMembers[0].total,
      totalOrders: totalOrders[0].total,
      totalRevenue: revenue[0].total || 0
    };
  }

  /**
   * 获取所有会员订阅（管理员）
   */
  static async getAllMemberships(page = 1, pageSize = 20) {
    const [rows] = await pool.query(
      `SELECT um.*, u.username, u.nickname, mct.display_name as card_name
       FROM user_memberships um
       LEFT JOIN users u ON um.user_id = u.id
       LEFT JOIN membership_card_types mct ON um.card_type_id = mct.id
       ORDER BY um.created_at DESC
       LIMIT ? OFFSET ?`,
      [pageSize, (page - 1) * pageSize]
    );

    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM user_memberships`
    );

    return { list: rows, total: countResult[0].total, page, pageSize };
  }

  /**
   * 调整会员状态（管理员）
   */
  static async adjustMembership(userId, action, days = 0, expireDate = null) {
    const [existing] = await pool.query(
      `SELECT * FROM user_memberships WHERE user_id = ?`,
      [userId]
    );

    const now = new Date();

    if (action === 'extend') {
      if (existing.length === 0) throw new Error('用户没有会员订阅');
      const newExpire = new Date(existing[0].expire_at);
      newExpire.setTime(newExpire.getTime() + days * 24 * 60 * 60 * 1000);
      await pool.query(
        `UPDATE user_memberships SET expire_at = ?, status = 'active', updated_at = NOW() WHERE user_id = ?`,
        [newExpire, userId]
      );
      return { newExpire };
    } else if (action === 'setExpire') {
      if (!expireDate) throw new Error('到期日期不能为空');
      const newExpire = new Date(expireDate + 'T23:59:59');
      if (existing.length > 0) {
        await pool.query(
          `UPDATE user_memberships SET expire_at = ?, status = 'active', updated_at = NOW() WHERE user_id = ?`,
          [newExpire, userId]
        );
      } else {
        await pool.query(
          `INSERT INTO user_memberships (user_id, status, expire_at, price_paid, total_renewals, total_paid) VALUES (?, 'active', ?, 0, 0, 0)`,
          [userId, newExpire]
        );
      }
      return { newExpire };
    } else if (action === 'cancel') {
      await pool.query(
        `UPDATE user_memberships SET status = 'cancelled', updated_at = NOW() WHERE user_id = ?`,
        [userId]
      );
      return { status: 'cancelled' };
    } else if (action === 'activate') {
      const newExpire = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      if (existing.length > 0) {
        await pool.query(
          `UPDATE user_memberships SET expire_at = ?, status = 'active', updated_at = NOW() WHERE user_id = ?`,
          [newExpire, userId]
        );
      } else {
        await pool.query(
          `INSERT INTO user_memberships (user_id, status, expire_at, price_paid, total_renewals, total_paid) VALUES (?, 'active', ?, 0, 0, 0)`,
          [userId, newExpire]
        );
      }
      return { newExpire };
    }

    throw new Error('无效的操作');
  }

  /**
   * 初始化会员数据表和默认数据
   */
  static async initTables() {
    try {
      // 1. 会员卡类型表
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

      // 2. 用户会员订阅表
      await pool.query(`
        CREATE TABLE IF NOT EXISTS user_memberships (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL UNIQUE COMMENT '用户ID',
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

      // 3. 每日做题统计表
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

      // 4. 会员折扣表
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

      // 5. 折扣使用记录表
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

      // 5.5 全局折扣表（自动适用，无需输入码）
      await pool.query(`
        CREATE TABLE IF NOT EXISTS membership_global_discounts (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100) NOT NULL COMMENT '折扣名称',
          discount_type ENUM('percentage', 'fixed') NOT NULL DEFAULT 'percentage' COMMENT '折扣类型',
          discount_value DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT '折扣值',
          min_amount DECIMAL(10,2) DEFAULT 0 COMMENT '最低消费金额',
          max_discount DECIMAL(10,2) DEFAULT NULL COMMENT '最大优惠金额',
          applicable_cards VARCHAR(255) DEFAULT 'all' COMMENT '适用卡类型(all或逗号分隔的id)',
          start_time DATETIME DEFAULT NULL COMMENT '开始时间',
          end_time DATETIME DEFAULT NULL COMMENT '结束时间',
          priority INT DEFAULT 0 COMMENT '优先级，数字越大越优先',
          stackable TINYINT(1) DEFAULT 0 COMMENT '是否可与折扣码叠加',
          status TINYINT(1) DEFAULT 1 COMMENT '状态',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_status (status),
          INDEX idx_time (start_time, end_time),
          INDEX idx_priority (priority)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='全局折扣表'
      `);

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

      // 7. 会员订单表
      await pool.query(`
        CREATE TABLE IF NOT EXISTS membership_orders (
          id INT AUTO_INCREMENT PRIMARY KEY,
          order_no VARCHAR(32) NOT NULL UNIQUE COMMENT '订单号',
          user_id INT NOT NULL COMMENT '用户ID',
          card_type_id INT NOT NULL COMMENT '会员卡类型ID',
          card_name VARCHAR(50) DEFAULT '' COMMENT '会员卡名称',
          duration_days INT NOT NULL DEFAULT 30 COMMENT '会员时长(天)',
          original_price DECIMAL(10,2) NOT NULL COMMENT '原价',
          discount_code VARCHAR(50) DEFAULT NULL COMMENT '使用的折扣码',
          discount_id INT DEFAULT NULL COMMENT '折扣ID',
          discount_amount DECIMAL(10,2) DEFAULT 0 COMMENT '折扣金额',
          final_price DECIMAL(10,2) NOT NULL COMMENT '实付金额',
          status ENUM('pending', 'paid', 'active', 'refunded', 'cancelled', 'expired') DEFAULT 'pending' COMMENT '订单状态',
          payment_method VARCHAR(20) DEFAULT 'mock' COMMENT '支付方式',
          payment_time DATETIME DEFAULT NULL COMMENT '支付时间',
          payment_transaction_id VARCHAR(64) DEFAULT NULL COMMENT '支付流水号',
          membership_start DATETIME DEFAULT NULL COMMENT '会员开始时间',
          membership_end DATETIME DEFAULT NULL COMMENT '会员结束时间',
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

      // 8. 激活码表（卡密）
      await pool.query(`
        CREATE TABLE IF NOT EXISTS membership_activation_codes (
          id INT AUTO_INCREMENT PRIMARY KEY,
          code VARCHAR(32) NOT NULL UNIQUE COMMENT '激活码',
          card_type_id INT NOT NULL COMMENT '关联会员卡类型ID',
          duration_days INT NOT NULL DEFAULT 30 COMMENT '会员时长(天)',
          max_uses INT DEFAULT 1 COMMENT '最大可兑换次数',
          used_count INT DEFAULT 0 COMMENT '已使用次数',
          status TINYINT(1) DEFAULT 1 COMMENT '状态 1启用 0禁用',
          created_by INT DEFAULT NULL COMMENT '创建者管理员ID',
          remark VARCHAR(255) DEFAULT '' COMMENT '备注',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_code (code),
          INDEX idx_status (status),
          INDEX idx_card_type_id (card_type_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='会员激活码表'
      `);

      // 9. 激活码使用记录表
      await pool.query(`
        CREATE TABLE IF NOT EXISTS membership_activation_code_usage (
          id INT AUTO_INCREMENT PRIMARY KEY,
          code_id INT NOT NULL COMMENT '激活码ID',
          user_id INT NOT NULL COMMENT '用户ID',
          code VARCHAR(32) NOT NULL COMMENT '使用的激活码',
          duration_days INT NOT NULL COMMENT '兑换时长',
          activated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '激活时间',
          INDEX idx_code_id (code_id),
          INDEX idx_user_id (user_id),
          INDEX idx_activated_at (activated_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='激活码使用记录表'
      `);

      // 插入默认会员卡类型
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

      // 插入默认折扣
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

      // 插入默认设置
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

      // 兼容升级：允许 duration_days 和 expire_at 为 NULL（永久会员）
      try {
        await pool.query(`ALTER TABLE membership_card_types MODIFY COLUMN duration_days INT DEFAULT NULL COMMENT '有效期天数（null表示永久）'`);
      } catch (e) {
        // 忽略可能的错误（如已符合或权限问题）
      }
      try {
        await pool.query(`ALTER TABLE user_memberships MODIFY COLUMN expire_at DATETIME DEFAULT NULL COMMENT '到期时间（null表示永久）'`);
      } catch (e) {
        // 忽略可能的错误
      }

      console.log('会员系统数据表初始化完成');
    } catch (error) {
      console.error('会员系统数据表初始化失败:', error.message);
      throw error;
    }
  }

  // ========== 激活码（卡密）管理 ==========

  // 生成随机激活码（7位字母+数字）
  static generateActivationCode(length = 7) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < length; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  // 创建激活码
  static async createActivationCode({ code, cardTypeId, durationDays, maxUses = 1, remark = '', createdBy = null }) {
    // 如果没提供code，自动生成
    let finalCode = code;
    if (!finalCode) {
      let exists = true;
      while (exists) {
        finalCode = this.generateActivationCode(7);
        const [rows] = await pool.query('SELECT COUNT(*) as count FROM membership_activation_codes WHERE code = ?', [finalCode]);
        exists = rows[0].count > 0;
      }
    } else {
      // 检查自定义code是否已存在
      const [rows] = await pool.query('SELECT COUNT(*) as count FROM membership_activation_codes WHERE code = ?', [finalCode]);
      if (rows[0].count > 0) {
        throw new Error('激活码已存在');
      }
    }

    const [result] = await pool.query(
      `INSERT INTO membership_activation_codes (code, card_type_id, duration_days, max_uses, remark, created_by) VALUES (?, ?, ?, ?, ?, ?)`,
      [finalCode, cardTypeId, durationDays, maxUses, remark, createdBy]
    );
    return { id: result.insertId, code: finalCode };
  }

  // 批量创建激活码
  static async batchCreateActivationCodes({ count, cardTypeId, durationDays, maxUses = 1, remark = '', createdBy = null }) {
    const codes = [];
    for (let i = 0; i < count; i++) {
      const result = await this.createActivationCode({ cardTypeId, durationDays, maxUses, remark, createdBy });
      codes.push(result);
    }
    return codes;
  }

  // 获取所有激活码
  static async getAllActivationCodes() {
    const [rows] = await pool.query(
      `SELECT ac.*, ct.display_name as card_name
       FROM membership_activation_codes ac
       LEFT JOIN membership_card_types ct ON ac.card_type_id = ct.id
       ORDER BY ac.created_at DESC`
    );
    return rows;
  }

  // 根据code查询激活码
  static async getActivationCodeByCode(code) {
    const [rows] = await pool.query(
      `SELECT ac.*, ct.display_name as card_name
       FROM membership_activation_codes ac
       LEFT JOIN membership_card_types ct ON ac.card_type_id = ct.id
       WHERE ac.code = ?`,
      [code]
    );
    return rows[0] || null;
  }

  // 使用激活码
  static async useActivationCode(code, userId) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // 查询激活码
      const [codes] = await connection.query(
        `SELECT * FROM membership_activation_codes WHERE code = ? FOR UPDATE`,
        [code]
      );
      const activationCode = codes[0];

      if (!activationCode) {
        throw new Error('激活码不存在');
      }
      if (activationCode.status !== 1) {
        throw new Error('激活码已禁用');
      }
      if (activationCode.used_count >= activationCode.max_uses) {
        throw new Error('激活码已达到使用上限');
      }

      // 检查用户是否已使用过此激活码（如果max_uses>1允许重复使用，但同一用户只能使用一次）
      const [userUsages] = await connection.query(
        `SELECT COUNT(*) as count FROM membership_activation_code_usage WHERE code_id = ? AND user_id = ?`,
        [activationCode.id, userId]
      );
      if (userUsages[0].count > 0) {
        throw new Error('您已经使用过此激活码');
      }

      // 更新激活码使用次数
      await connection.query(
        `UPDATE membership_activation_codes SET used_count = used_count + 1 WHERE id = ?`,
        [activationCode.id]
      );

      // 记录使用
      await connection.query(
        `INSERT INTO membership_activation_code_usage (code_id, user_id, code, duration_days) VALUES (?, ?, ?, ?)`,
        [activationCode.id, userId, activationCode.code, activationCode.duration_days]
      );

      // 给用户开通/延长会员
      const now = new Date();
      const [memberships] = await connection.query(
        `SELECT * FROM user_memberships WHERE user_id = ?`,
        [userId]
      );

      let newExpireAt;
      if (memberships.length > 0 && new Date(memberships[0].expire_at) > now) {
        // 延长现有会员
        newExpireAt = new Date(memberships[0].expire_at);
        newExpireAt.setDate(newExpireAt.getDate() + activationCode.duration_days);
        await connection.query(
          `UPDATE user_memberships SET expire_at = ?, status = 'active', card_type_id = ?, total_renewals = total_renewals + 1 WHERE user_id = ?`,
          [newExpireAt, activationCode.card_type_id, userId]
        );
      } else {
        // 新开通会员
        newExpireAt = new Date();
        newExpireAt.setDate(newExpireAt.getDate() + activationCode.duration_days);
        await connection.query(
          `INSERT INTO user_memberships (user_id, card_type_id, status, expire_at, total_renewals, total_paid) VALUES (?, ?, 'active', ?, 1, 0) ON DUPLICATE KEY UPDATE expire_at = ?, status = 'active', card_type_id = ?`,
          [userId, activationCode.card_type_id, newExpireAt, newExpireAt, activationCode.card_type_id]
        );
      }

      await connection.commit();
      return {
        success: true,
        cardName: activationCode.card_name,
        durationDays: activationCode.duration_days,
        expireAt: newExpireAt
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // 更新激活码
  static async updateActivationCode(id, data) {
    const fields = [];
    const params = [];

    if (data.cardTypeId !== undefined) {
      fields.push('card_type_id = ?');
      params.push(data.cardTypeId);
    }
    if (data.durationDays !== undefined) {
      fields.push('duration_days = ?');
      params.push(data.durationDays);
    }
    if (data.maxUses !== undefined) {
      fields.push('max_uses = ?');
      params.push(data.maxUses);
    }
    if (data.remark !== undefined) {
      fields.push('remark = ?');
      params.push(data.remark);
    }

    if (fields.length === 0) return null;

    params.push(id);
    await pool.query(
      `UPDATE membership_activation_codes SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );
    return true;
  }

  // 更新激活码状态
  static async updateActivationCodeStatus(id, status) {
    await pool.query(
      `UPDATE membership_activation_codes SET status = ? WHERE id = ?`,
      [status, id]
    );
    return true;
  }

  // 删除激活码
  static async deleteActivationCode(id) {
    await pool.query(`DELETE FROM membership_activation_codes WHERE id = ?`, [id]);
    return true;
  }

  // ========== 全局折扣管理 ==========

  static async getAllGlobalDiscounts() {
    const [rows] = await pool.query(
      `SELECT * FROM membership_global_discounts ORDER BY priority DESC, created_at DESC`
    );
    return rows;
  }

  static async getActiveGlobalDiscounts(cardTypeId = null, originalPrice = null) {
    const now = new Date();
    let sql = `SELECT * FROM membership_global_discounts WHERE status = 1`;
    const params = [];

    sql += ` AND (start_time IS NULL OR start_time <= ?) AND (end_time IS NULL OR end_time >= ?)`;
    params.push(now, now);

    if (originalPrice !== null) {
      sql += ` AND (min_amount = 0 OR min_amount <= ?)`;
      params.push(originalPrice);
    }

    const [rows] = await pool.query(sql + ` ORDER BY priority DESC`, params);

    // 过滤适用卡类型
    return rows.filter(d => {
      if (d.applicable_cards === 'all') return true;
      if (!cardTypeId) return true;
      const ids = d.applicable_cards.split(',').map(s => parseInt(s.trim())).filter(Boolean);
      return ids.includes(parseInt(cardTypeId));
    });
  }

  static async getGlobalDiscountById(id) {
    const [rows] = await pool.query(
      `SELECT * FROM membership_global_discounts WHERE id = ?`, [id]
    );
    return rows[0] || null;
  }

  static async createGlobalDiscount(data) {
    const [result] = await pool.query(
      `INSERT INTO membership_global_discounts (name, discount_type, discount_value, min_amount, max_discount, applicable_cards, start_time, end_time, priority, stackable, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.name, data.discount_type, data.discount_value, data.min_amount || 0, data.max_discount || null, data.applicable_cards || 'all', data.start_time || null, data.end_time || null, data.priority || 0, data.stackable !== undefined ? data.stackable : 0, data.status !== undefined ? data.status : 1]
    );
    return result.insertId;
  }

  static async updateGlobalDiscount(id, data) {
    const fields = [];
    const params = [];
    ['name', 'discount_type', 'discount_value', 'min_amount', 'max_discount', 'applicable_cards', 'start_time', 'end_time', 'priority', 'stackable', 'status'].forEach(key => {
      if (data[key] !== undefined) {
        fields.push(`${key} = ?`);
        params.push(data[key]);
      }
    });
    if (fields.length === 0) return null;
    params.push(id);
    await pool.query(
      `UPDATE membership_global_discounts SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );
  }

  static async deleteGlobalDiscount(id) {
    await pool.query(`DELETE FROM membership_global_discounts WHERE id = ?`, [id]);
  }

  /**
   * 计算最佳全局折扣
   * @returns {Object} { valid, discountId, discountName, discountAmount, finalPrice, stackable }
   */
  static async calculateBestGlobalDiscount(cardTypeId, originalPrice) {
    const discounts = await this.getActiveGlobalDiscounts(cardTypeId, originalPrice);
    if (discounts.length === 0) {
      return { valid: false, discountAmount: 0, finalPrice: originalPrice, stackable: false };
    }

    let bestDiscount = null;
    let bestAmount = 0;

    for (const d of discounts) {
      let amount = 0;
      if (d.discount_type === 'percentage') {
        amount = originalPrice * (d.discount_value / 100);
        if (d.max_discount && amount > d.max_discount) amount = d.max_discount;
      } else {
        amount = d.discount_value;
      }
      if (amount > bestAmount) {
        bestAmount = amount;
        bestDiscount = d;
      }
    }

    if (!bestDiscount) {
      return { valid: false, discountAmount: 0, finalPrice: originalPrice, stackable: false };
    }

    const finalPrice = Math.max(0, originalPrice - bestAmount);
    return {
      valid: true,
      discountId: bestDiscount.id,
      discountName: bestDiscount.name,
      discountAmount: bestAmount,
      finalPrice,
      stackable: !!bestDiscount.stackable
    };
  }

  /**
   * 综合计算折扣（全局折扣 + 折扣码）
   * @returns {Object} 包含全局折扣和折扣码的信息
   */
  static async calculateFinalPrice(cardTypeId, originalPrice, discountCode = null, userId = null) {
    // 1. 先计算最佳全局折扣
    const globalResult = await this.calculateBestGlobalDiscount(cardTypeId, originalPrice);

    let finalPrice = originalPrice;
    let globalDiscountAmount = 0;
    let codeDiscountAmount = 0;
    let globalDiscountId = null;
    let codeDiscountId = null;
    let codeDiscountName = null;

    if (globalResult.valid) {
      finalPrice = globalResult.finalPrice;
      globalDiscountAmount = globalResult.discountAmount;
      globalDiscountId = globalResult.discountId;
    }

    // 2. 如果有折扣码
    if (discountCode && userId) {
      const codeResult = await this.calculateDiscountPrice(discountCode, originalPrice, userId);
      if (codeResult.valid) {
        // 检查是否可叠加
        if (globalResult.valid && globalResult.stackable) {
          // 可叠加：在全局折扣后的价格上再应用折扣码，或在原价上分别计算取最优
          // 策略：分别计算后取最低价格
          const stackedPrice = Math.max(0, originalPrice - globalDiscountAmount - codeResult.discountAmount);
          if (stackedPrice < finalPrice) {
            finalPrice = stackedPrice;
            codeDiscountAmount = codeResult.discountAmount;
            codeDiscountId = codeResult.discountId;
            codeDiscountName = codeResult.discountName;
          }
        } else if (!globalResult.valid) {
          // 没有全局折扣，直接用折扣码
          finalPrice = codeResult.finalPrice;
          codeDiscountAmount = codeResult.discountAmount;
          codeDiscountId = codeResult.discountId;
          codeDiscountName = codeResult.discountName;
        } else {
          // 不可叠加，比较哪个更优
          if (codeResult.finalPrice < finalPrice) {
            finalPrice = codeResult.finalPrice;
            globalDiscountAmount = 0;
            globalDiscountId = null;
            codeDiscountAmount = codeResult.discountAmount;
            codeDiscountId = codeResult.discountId;
            codeDiscountName = codeResult.discountName;
          }
        }
      }
    }

    const totalDiscount = globalDiscountAmount + codeDiscountAmount;

    return {
      originalPrice,
      finalPrice,
      globalDiscountAmount,
      globalDiscountId,
      codeDiscountAmount,
      codeDiscountId,
      codeDiscountName,
      totalDiscount,
      discountCode: codeDiscountId ? discountCode : null
    };
  }

  // ===================== 兼容控制器的别名/补充方法 =====================

  /**
   * 管理员获取所有会员卡类型（兼容adminGetCardTypes）
   */
  static async getAdminCardTypes() {
    return this.getAllCardTypes();
  }

  /**
   * 验证折扣码（兼容控制器validateDiscountCode签名）
   */
  static async validateDiscountCode(code, price, cardTypeId, userId) {
    return this.calculateDiscountPrice(code, price, userId);
  }

  /**
   * 获取折扣码列表（兼容adminGetDiscounts）
   */
  static async getDiscountCodes({ cardTypeId } = {}, page = 1, pageSize = 20) {
    let sql = `SELECT * FROM membership_discounts WHERE 1=1`;
    const params = [];
    // 当前表无card_type_id字段，预留过滤逻辑
    sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(pageSize, (page - 1) * pageSize);

    const [rows] = await pool.query(sql, params);

    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM membership_discounts`
    );

    return { list: rows, total: countResult[0].total, page, pageSize };
  }

  /**
   * 创建折扣码（兼容adminCreateDiscount）
   */
  static async createDiscountCode(data) {
    return this.createDiscount(data);
  }

  /**
   * 更新折扣码（兼容adminUpdateDiscount）
   */
  static async updateDiscountCode(id, data) {
    return this.updateDiscount(id, data);
  }

  /**
   * 删除折扣码（兼容adminDeleteDiscount）
   */
  static async deleteDiscountCode(id) {
    return this.deleteDiscount(id);
  }

  /**
   * 获取所有设置（兼容adminGetSettings）
   */
  static async getSettings() {
    return this.getAllSettings();
  }

  /**
   * 获取会员统计（兼容adminGetStats）
   */
  static async getMembershipStats() {
    return this.getStats();
  }

  /**
   * 使用激活码开通会员（兼容activateByCode）
   */
  static async activateByCode(userId, code) {
    const activation = await this.useActivationCode(code, userId);
    return activation;
  }

  /**
   * 调整会员到期时间（兼容adminAdjustMembership）
   */
  static async adjustMembershipEnd(userId, endDate, reason = '') {
    return this.adjustMembership(userId, 'setExpire', 0, endDate);
  }

  /**
   * 获取全局折扣列表（兼容adminGetGlobalDiscounts）
   */
  static async getGlobalDiscounts({} = {}, page = 1, pageSize = 20) {
    const [rows] = await pool.query(
      `SELECT * FROM membership_global_discounts ORDER BY priority DESC, created_at DESC LIMIT ? OFFSET ?`,
      [pageSize, (page - 1) * pageSize]
    );

    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM membership_global_discounts`
    );

    return { list: rows, total: countResult[0].total, page, pageSize };
  }

  /**
   * 获取激活码列表（兼容adminGetActivationCodes）
   */
  static async getActivationCodes({ status } = {}, page = 1, pageSize = 20) {
    let sql = `SELECT ac.*, mct.display_name as card_name 
               FROM membership_activation_codes ac
               LEFT JOIN membership_card_types mct ON ac.card_type_id = mct.id
               WHERE 1=1`;
    const params = [];

    if (status !== undefined && status !== '' && status !== null) {
      sql += ` AND ac.status = ?`;
      params.push(parseInt(status));
    }

    sql += ` ORDER BY ac.created_at DESC LIMIT ? OFFSET ?`;
    params.push(pageSize, (page - 1) * pageSize);

    const [rows] = await pool.query(sql, params);

    let countSql = `SELECT COUNT(*) as total FROM membership_activation_codes WHERE 1=1`;
    const countParams = [];
    if (status !== undefined && status !== '' && status !== null) {
      countSql += ` AND status = ?`;
      countParams.push(parseInt(status));
    }
    const [countResult] = await pool.query(countSql, countParams);

    return { list: rows, total: countResult[0].total, page, pageSize };
  }
}

module.exports = Membership;