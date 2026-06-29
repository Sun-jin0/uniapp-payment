const pool = require('../config/mysql');
const Membership = require('./Membership');

/**
 * 订单模型 - 时间卡模式
 */
class Order {
  /**
   * 生成订单号
   */
  static generateOrderNo() {
    const timestamp = Date.now().toString().slice(-10);
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `VIP${timestamp}${random}`;
  }

  /**
   * 创建订单
   */
  static async createOrder(data) {
    const orderNo = this.generateOrderNo();
    const [result] = await pool.query(
      `INSERT INTO membership_orders (
        order_no, user_id, card_type_id, card_name, duration_days,
        original_price, discount_code, discount_id, discount_amount, final_price,
        status, remark
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [
        orderNo,
        data.userId,
        data.cardTypeId,
        data.cardName,
        data.durationDays,
        data.originalPrice,
        data.discountCode || null,
        data.discountId || null,
        data.discountAmount || 0,
        data.finalPrice,
        data.remark || null
      ]
    );

    // 如果使用了折扣，记录折扣使用
    if (data.discountId && data.discountAmount > 0) {
      await Membership.recordDiscountUsage(
        data.userId, data.discountId, result.insertId,
        data.originalPrice, data.discountAmount, data.finalPrice
      );
    }

    return { orderId: result.insertId, orderNo };
  }

  /**
   * 根据订单号获取订单详情
   */
  static async getOrderByNo(orderNo) {
    const [rows] = await pool.query(
      `SELECT o.*, u.username, u.nickname
       FROM membership_orders o
       LEFT JOIN users u ON o.user_id = u.id
       WHERE o.order_no = ?`,
      [orderNo]
    );
    return rows[0] || null;
  }

  /**
   * 根据ID获取订单详情
   */
  static async getOrderById(orderId) {
    const [rows] = await pool.query(
      `SELECT o.*, u.username, u.nickname
       FROM membership_orders o
       LEFT JOIN users u ON o.user_id = u.id
       WHERE o.id = ?`,
      [orderId]
    );
    return rows[0] || null;
  }

  /**
   * 获取用户订单列表
   */
  static async getUserOrders(userId, status = null, page = 1, pageSize = 20) {
    let sql = `SELECT * FROM membership_orders WHERE user_id = ?`;
    const params = [userId];

    if (status) {
      sql += ` AND status = ?`;
      params.push(status);
    }

    sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(pageSize, (page - 1) * pageSize);

    const [rows] = await pool.query(sql, params);

    // 获取总数
    let countSql = `SELECT COUNT(*) as total FROM membership_orders WHERE user_id = ?`;
    const countParams = [userId];
    if (status) {
      countSql += ` AND status = ?`;
      countParams.push(status);
    }
    const [countResult] = await pool.query(countSql, countParams);

    return { list: rows, total: countResult[0].total, page, pageSize };
  }

  /**
   * 获取所有订单列表（管理员）
   */
  static async getAllOrders(filters = {}, page = 1, pageSize = 20) {
    let sql = `SELECT o.*, u.username, u.nickname
               FROM membership_orders o
               LEFT JOIN users u ON o.user_id = u.id
               WHERE 1=1`;
    const params = [];

    if (filters.status) {
      sql += ` AND o.status = ?`;
      params.push(filters.status);
    }
    if (filters.userId) {
      sql += ` AND o.user_id = ?`;
      params.push(filters.userId);
    }
    if (filters.orderNo) {
      sql += ` AND o.order_no LIKE ?`;
      params.push(`%${filters.orderNo}%`);
    }
    if (filters.startDate) {
      sql += ` AND o.created_at >= ?`;
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      sql += ` AND o.created_at <= ?`;
      params.push(filters.endDate);
    }

    sql += ` ORDER BY o.created_at DESC LIMIT ? OFFSET ?`;
    params.push(pageSize, (page - 1) * pageSize);

    const [rows] = await pool.query(sql, params);

    // 获取总数
    let countSql = `SELECT COUNT(*) as total FROM membership_orders o WHERE 1=1`;
    const countParams = [];
    if (filters.status) {
      countSql += ` AND o.status = ?`;
      countParams.push(filters.status);
    }
    if (filters.userId) {
      countSql += ` AND o.user_id = ?`;
      countParams.push(filters.userId);
    }
    if (filters.orderNo) {
      countSql += ` AND o.order_no LIKE ?`;
      countParams.push(`%${filters.orderNo}%`);
    }
    if (filters.startDate) {
      countSql += ` AND o.created_at >= ?`;
      countParams.push(filters.startDate);
    }
    if (filters.endDate) {
      countSql += ` AND o.created_at <= ?`;
      countParams.push(filters.endDate);
    }
    const [countResult] = await pool.query(countSql, countParams);

    return { list: rows, total: countResult[0].total, page, pageSize };
  }

  /**
   * 更新订单状态
   */
  static async updateOrderStatus(orderId, status, extraData = {}) {
    const fields = ['status = ?'];
    const params = [status];

    if (extraData.paymentTime) {
      fields.push('payment_time = ?');
      params.push(extraData.paymentTime);
    }
    if (extraData.paymentTransactionId) {
      fields.push('payment_transaction_id = ?');
      params.push(extraData.paymentTransactionId);
    }
    if (extraData.paymentMethod) {
      fields.push('payment_method = ?');
      params.push(extraData.paymentMethod);
    }
    if (extraData.membershipStart) {
      fields.push('membership_start = ?');
      params.push(extraData.membershipStart);
    }
    if (extraData.membershipEnd) {
      fields.push('membership_end = ?');
      params.push(extraData.membershipEnd);
    }
    if (extraData.adminRemark) {
      fields.push('admin_remark = ?');
      params.push(extraData.adminRemark);
    }
    if (extraData.refundReason) {
      fields.push('refund_reason = ?');
      params.push(extraData.refundReason);
    }
    if (extraData.refundTime) {
      fields.push('refund_time = ?');
      params.push(extraData.refundTime);
    }

    params.push(orderId);
    await pool.query(
      `UPDATE membership_orders SET ${fields.join(', ')}, updated_at = NOW() WHERE id = ?`,
      params
    );

    return this.getOrderById(orderId);
  }

  /**
   * 支付订单
   * @param {number} orderId 订单ID
   * @param {string} paymentMethod 支付方式
   * @param {Object} extraData 额外支付数据
   */
  static async payOrder(orderId, paymentMethod = 'mock', extraData = {}) {
    const order = await this.getOrderById(orderId);
    if (!order) throw new Error('订单不存在');
    if (order.status !== 'pending') throw new Error('订单状态不正确');

    const now = extraData.paymentTime || new Date();
    const transactionId = extraData.paymentTransactionId || `PAY${Date.now()}${Math.floor(Math.random() * 10000)}`;

    await this.updateOrderStatus(orderId, 'paid', {
      paymentTime: now,
      paymentTransactionId: transactionId,
      paymentMethod
    });

    return { transactionId, paymentTime: now };
  }

  /**
   * 激活会员（支付成功后调用）
   */
  static async activateMembership(orderId) {
    const order = await this.getOrderById(orderId);
    if (!order) throw new Error('订单不存在');
    if (order.status !== 'paid') throw new Error('订单未支付');

    const now = new Date();
    const membershipEnd = new Date(now.getTime() + order.duration_days * 24 * 60 * 60 * 1000);

    await this.updateOrderStatus(orderId, 'active', {
      membershipStart: now,
      membershipEnd
    });

    // 激活用户会员
    await Membership.activateMembership(order.user_id, order.card_type_id, order.final_price);

    return { membershipStart: now, membershipEnd };
  }

  /**
   * 退款
   */
  static async refundOrder(orderId, refundReason) {
    const order = await this.getOrderById(orderId);
    if (!order) throw new Error('订单不存在');
    if (order.status !== 'active' && order.status !== 'paid') throw new Error('订单状态不正确');

    const now = new Date();

    await this.updateOrderStatus(orderId, 'refunded', {
      refundReason,
      refundTime: now
    });

    // 取消用户会员
    if (order.status === 'active') {
      await pool.query(
        `UPDATE user_memberships SET status = 'cancelled', updated_at = NOW() WHERE user_id = ?`,
        [order.user_id]
      );
    }

    return { refundTime: now };
  }

  /**
   * 取消订单
   */
  static async cancelOrder(orderId, reason = null) {
    const order = await this.getOrderById(orderId);
    if (!order) throw new Error('订单不存在');
    if (order.status !== 'pending') throw new Error('只能取消待支付的订单');

    await this.updateOrderStatus(orderId, 'cancelled', { adminRemark: reason });
    return true;
  }

  /**
   * 删除订单
   */
  static async deleteOrder(orderId) {
    const [result] = await pool.query(
      'DELETE FROM membership_orders WHERE id = ?',
      [orderId]
    );
    return result.affectedRows > 0;
  }

  /**
   * 获取订单统计
   */
  static async getOrderStats(startDate = null, endDate = null) {
    let whereClause = 'WHERE 1=1';
    const params = [];

    if (startDate) {
      whereClause += ' AND created_at >= ?';
      params.push(startDate);
    }
    if (endDate) {
      whereClause += ' AND created_at <= ?';
      params.push(endDate);
    }

    const [totalResult] = await pool.query(
      `SELECT COUNT(*) as total FROM membership_orders ${whereClause}`,
      params
    );

    const [statusResult] = await pool.query(
      `SELECT status, COUNT(*) as count FROM membership_orders ${whereClause} GROUP BY status`,
      params
    );

    const [revenueResult] = await pool.query(
      `SELECT SUM(final_price) as total_revenue FROM membership_orders ${whereClause} AND status IN ('paid', 'active')`,
      params
    );

    const [discountResult] = await pool.query(
      `SELECT SUM(discount_amount) as total_discount FROM membership_orders ${whereClause} AND discount_amount > 0`,
      params
    );

    const statusCounts = {};
    statusResult.forEach(s => { statusCounts[s.status] = s.count; });

    return {
      totalOrders: totalResult[0].total,
      statusCounts,
      totalRevenue: revenueResult[0].total_revenue || 0,
      totalDiscount: discountResult[0].total_discount || 0
    };
  }
}

module.exports = Order;