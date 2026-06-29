const Card = require('../models/Card');
const UserCard = require('../models/UserCard');
const UserDrawCount = require('../models/UserDrawCount');
const UserPity = require('../models/UserPity');
const { successResponse, errorResponse } = require('../utils/response');
const pool = require('../config/mysql');

// 分层奖池配置
const TIER_CONFIG = {
  legendary: {  // 传说 - 最稀有
    baseProbability: 0.005,  // 0.5%
    pityThreshold: 199,      // 199抽保底
    pityBoostStart: 150,     // 150抽开始提升概率
    name: '传说'
  },
  epic: {       // 史诗
    baseProbability: 0.02,   // 2%
    pityThreshold: 80,       // 80抽保底
    pityBoostStart: 60,      // 60抽开始提升概率
    name: '史诗'
  },
  rare: {       // 稀有
    baseProbability: 0.08,   // 8%
    pityThreshold: 30,       // 30抽保底
    pityBoostStart: 20,      // 20抽开始提升概率
    name: '稀有'
  },
  common: {     // 普通
    baseProbability: 0.25,   // 25%
    pityThreshold: 0,        // 无保底
    pityBoostStart: 0,
    name: '普通'
  },
  consolation: { // 安慰奖
    baseProbability: 0.645,  // 64.5%
    pityThreshold: 0,
    pityBoostStart: 0,
    name: '安慰奖'
  }
};

// 包装响应函数
const success = (res, data, message) => {
  res.json(successResponse(data, message));
};

const error = (res, message, statusCode = 500) => {
  res.status(statusCode).json(errorResponse(message, statusCode === 500 ? 1 : statusCode));
};

// 获取所有卡片（只返回奖励卡牌，用于抽卡）
exports.getAllCards = async (req, res) => {
  try {
    const cards = await Card.findAll({
      where: { is_active: true, is_reward: true },
      attributes: ['id', 'name', 'description', 'image_url', 'rarity', 'probability', 'owner_count']
    });

    return success(res, cards);
  } catch (err) {
    console.error('获取卡片列表失败:', err);
    return error(res, '获取卡片列表失败', 500);
  }
};

// 获取奖池（公开接口，不需要登录，只显示奖励卡牌）
exports.getPool = async (req, res) => {
  try {
    const cards = await Card.findAll({
      where: { is_active: true, is_reward: true },
      attributes: ['id', 'name', 'description', 'image_url', 'rarity', 'probability', 'owner_count']
    });

    // 按概率从高到低排序
    const sortedCards = cards.sort((a, b) => b.probability - a.probability);

    return success(res, sortedCards);
  } catch (err) {
    console.error('获取奖池失败:', err);
    return error(res, '获取奖池失败', 500);
  }
};

// 获取我的卡片
exports.getMyCards = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // 获取用户的卡片及数量统计
    const [rows] = await pool.query(
      `SELECT 
        c.id, c.name, c.description, c.image_url, c.rarity,
        COUNT(uc.id) as count
       FROM cards c
       JOIN user_cards uc ON c.id = uc.card_id
       WHERE uc.user_id = ?
       GROUP BY c.id
       ORDER BY count DESC, c.id ASC`,
      [userId]
    );
    
    return success(res, rows);
  } catch (err) {
    console.error('获取我的卡片失败:', err);
    return error(res, '获取我的卡片失败', 500);
  }
};

// 检查今日是否已抽取
exports.checkTodayDraw = async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];
    
    const todayRecord = await UserCard.findOne({
      where: {
        user_id: userId,
        draw_date: today
      }
    });
    
    if (todayRecord) {
      return success(res, {
        hasDrawn: true,
        card: {
          id: todayRecord.card_id,
          name: todayRecord.name,
          description: todayRecord.description,
          image_url: todayRecord.image_url,
          rarity: todayRecord.rarity
        }
      });
    }
    
    return success(res, { hasDrawn: false });
  } catch (err) {
    console.error('检查今日抽取状态失败:', err);
    return error(res, '检查今日抽取状态失败', 500);
  }
};

// 计算带保底的伪随机概率
function calculatePityProbability(tier, pityCount) {
  const config = TIER_CONFIG[tier];
  if (!config) return 0;
  
  // 硬保底
  if (config.pityThreshold > 0 && pityCount >= config.pityThreshold) {
    return 1.0; // 必出
  }
  
  let probability = config.baseProbability;
  
  // 软保底 - 概率递增
  if (config.pityBoostStart > 0 && pityCount > config.pityBoostStart) {
    const boostFactor = (pityCount - config.pityBoostStart) * 0.01; // 每次增加1%
    probability = Math.min(probability + boostFactor, 1.0);
  }
  
  return probability;
}

// 分层抽卡算法 - 层级概率固定，层级内随机
async function drawWithTiers(cards, pityCount, isFirstDraw) {
  // 按层级分组
  const tierGroups = {
    legendary: cards.filter(c => c.tier === 'legendary'),
    epic: cards.filter(c => c.tier === 'epic'),
    rare: cards.filter(c => c.tier === 'rare'),
    common: cards.filter(c => c.tier === 'common'),
    consolation: cards.filter(c => c.tier === 'consolation')
  };
  
  // 定义各层级的固定概率
  const tierProbabilities = {
    legendary: 0.005,  // 0.5%
    epic: 0.02,        // 2%
    rare: 0.08,        // 8%
    common: 0.25,      // 25%
    consolation: 0.645 // 64.5%
  };
  
  // 保底机制：150抽后逐渐提升传说概率
  if (pityCount >= 150) {
    const boost = (pityCount - 150) * 0.001; // 每次增加0.1%
    tierProbabilities.legendary = Math.min(0.005 + boost, 0.5); // 最高50%
  }
  
  // 硬保底：199抽必出传说
  if (pityCount >= 199 && tierGroups.legendary.length > 0) {
    console.log('硬保底触发，返回传说');
    const randomIndex = Math.floor(Math.random() * tierGroups.legendary.length);
    return tierGroups.legendary[randomIndex];
  }
  
  // 只考虑实际存在的层级
  const availableTiers = {};
  let totalProbability = 0;
  
  for (const [tier, tierCards] of Object.entries(tierGroups)) {
    if (tierCards.length > 0 && tierProbabilities[tier]) {
      availableTiers[tier] = tierProbabilities[tier];
      totalProbability += tierProbabilities[tier];
    }
  }
  
  // 归一化概率
  for (const tier in availableTiers) {
    availableTiers[tier] /= totalProbability;
  }
  
  // 根据层级概率抽取
  const random = Math.random();
  let cumulativeProbability = 0;
  let selectedTier = null;
  
  for (const [tier, prob] of Object.entries(availableTiers)) {
    cumulativeProbability += prob;
    if (random <= cumulativeProbability) {
      selectedTier = tier;
      break;
    }
  }
  
  // 从选中层级中随机选一张卡（等概率）
  if (selectedTier && tierGroups[selectedTier] && tierGroups[selectedTier].length > 0) {
    const tierCards = tierGroups[selectedTier];
    const randomIndex = Math.floor(Math.random() * tierCards.length);
    return tierCards[randomIndex];
  }
  
  // 默认返回安慰奖
  if (tierGroups.consolation.length > 0) {
    const randomIndex = Math.floor(Math.random() * tierGroups.consolation.length);
    return tierGroups.consolation[randomIndex];
  }
  
  return cards[0];
}

// 抽取卡片
exports.drawCard = async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];
    
    // 检查是否有剩余次数
    const hasRemaining = await UserDrawCount.hasRemaining(userId);
    if (!hasRemaining) {
      return error(res, '剩余次数不足，请先获取次数', 400);
    }
    
    // 获取所有启用的卡片
    const cards = await Card.findAll({ where: { is_active: true } });
    
    if (cards.length === 0) {
      return error(res, '暂无可用卡片', 400);
    }
    
    // 获取用户保底记录
    const pityRecord = await UserPity.getOrCreate(userId);
    const pityCount = pityRecord.pity_counter;
    
    // 检查是否是今日首抽
    const hasFirstDraw = await UserPity.checkDailyFirstDraw(userId);
    const isFirstDraw = !hasFirstDraw; // 如果还没抽过，就是首抽
    
    // 执行分层抽卡
    const selectedCard = await drawWithTiers(cards, pityCount, isFirstDraw);
    
    // 扣除次数
    await UserDrawCount.decrement(userId);
    
    // 更新卡片统计数据
    await Card.incrementDrawCount(selectedCard.id);
    
    // 判断是否为奖励卡牌
    const isReward = selectedCard.is_reward === 1 || selectedCard.is_reward === true;
    const tier = selectedCard.tier || 'common';
    
    let userCardCount = 0;
    let isPity = false;
    
    // 保底逻辑处理
    if (tier === 'legendary') {
      // 抽到传说，重置保底
      await UserPity.resetPity(userId);
      isPity = pityCount >= TIER_CONFIG.legendary.pityThreshold;
    } else {
      // 未抽到传说，增加保底计数
      await UserPity.incrementPity(userId);
    }
    
    // 标记今日已首抽
    if (isFirstDraw) {
      await UserPity.markDailyFirstDraw(userId);
    }
    
    // 只有奖励卡牌才加入用户卡池
    if (isReward) {
      // 创建抽取记录
      await UserCard.create({
        user_id: userId,
        card_id: selectedCard.id,
        draw_date: today
      });
      
      // 计算获得数量
      userCardCount = await UserCard.getCountByUserIdAndCardId(userId, selectedCard.id);
    }
    
    return success(res, {
      id: selectedCard.id,
      name: selectedCard.name,
      description: selectedCard.description,
      image_url: selectedCard.image_url,
      rarity: selectedCard.rarity,
      tier: tier,
      tierName: TIER_CONFIG[tier]?.name || '普通',
      is_reward: isReward,
      is_pity: isPity,          // 是否触发保底
      pity_count: pityCount,    // 当前保底计数
      is_first_draw: isFirstDraw,
      count: userCardCount,
      probability: selectedCard.probability
    });
  } catch (err) {
    console.error('抽卡失败:', err);
    return error(res, '抽卡失败，请重试', 500);
  }
};

// 管理员：创建卡片
exports.createCard = async (req, res) => {
  try {
    const { name, description, image_url, rarity, probability, sort_order } = req.body;
    
    const card = await Card.create({
      name,
      description,
      image_url,
      rarity: rarity || 'common',
      probability: probability || 0.25,
      sort_order: sort_order || 0,
      is_active: true,
      draw_count: 0,
      owner_count: 0
    });
    
    return success(res, card, '创建成功');
  } catch (err) {
    console.error('创建卡片失败:', err);
    return error(res, '创建卡片失败', 500);
  }
};

// 管理员：更新卡片
exports.updateCard = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, image_url, rarity, probability, sort_order, is_active } = req.body;
    
    const card = await Card.findByPk(id);
    if (!card) {
      return error(res, '卡片不存在', 404);
    }
    
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (image_url !== undefined) updateData.image_url = image_url;
    if (rarity !== undefined) updateData.rarity = rarity;
    if (probability !== undefined) updateData.probability = probability;
    if (sort_order !== undefined) updateData.sort_order = sort_order;
    if (is_active !== undefined) updateData.is_active = is_active;
    
    await Card.update(updateData, { where: { id } });
    
    return success(res, { ...card, ...updateData }, '更新成功');
  } catch (err) {
    console.error('更新卡片失败:', err);
    return error(res, '更新卡片失败', 500);
  }
};

// 管理员：删除卡片
exports.deleteCard = async (req, res) => {
  try {
    const { id } = req.params;
    
    const card = await Card.findByPk(id);
    if (!card) {
      return error(res, '卡片不存在', 404);
    }
    
    // 软删除，将卡片设为禁用
    await Card.update({ is_active: false }, { where: { id } });
    
    return success(res, null, '删除成功');
  } catch (err) {
    console.error('删除卡片失败:', err);
    return error(res, '删除卡片失败', 500);
  }
};

// 管理员：获取所有卡片（包括安慰奖和奖励卡）
exports.getAllCardsAdmin = async (req, res) => {
  try {
    const cards = await Card.findAll({
      where: {},
      order: [['sort_order', 'ASC'], ['id', 'ASC']]
    });
    
    return success(res, cards);
  } catch (err) {
    console.error('获取卡片列表失败:', err);
    return error(res, '获取卡片列表失败', 500);
  }
};

// 管理员：获取卡片统计
exports.getCardStats = async (req, res) => {
  try {
    const cards = await Card.findAll({ where: {} });
    
    const stats = cards.map(card => ({
      id: card.id,
      name: card.name,
      rarity: card.rarity,
      draw_count: card.draw_count,
      owner_count: card.owner_count,
      probability: card.probability,
      is_active: card.is_active
    }));
    
    return success(res, stats);
  } catch (err) {
    console.error('获取卡片统计失败:', err);
    return error(res, '获取卡片统计失败', 500);
  }
};

// 获取用户抽卡统计
exports.getUserStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const stats = await UserCard.getUserStats(userId);
    return success(res, stats);
  } catch (err) {
    console.error('获取用户统计失败:', err);
    return error(res, '获取用户统计失败', 500);
  }
};

// 获取用户抽卡历史
exports.getDrawHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 30;
    const history = await UserCard.getDrawHistory(userId, limit);
    return success(res, history);
  } catch (err) {
    console.error('获取抽卡历史失败:', err);
    return error(res, '获取抽卡历史失败', 500);
  }
};

// 获取用户剩余抽卡次数
exports.getRemainingDraws = async (req, res) => {
  try {
    const userId = req.user.id;
    const drawCount = await UserDrawCount.getByUserId(userId);
    return success(res, {
      remaining: drawCount ? drawCount.remaining_draws : 0,
      total: drawCount ? drawCount.total_draws : 0
    });
  } catch (err) {
    console.error('获取剩余次数失败:', err);
    return error(res, '获取剩余次数失败', 500);
  }
};

// 增加抽卡次数（点击按钮或观看广告）
exports.addDrawCount = async (req, res) => {
  try {
    const userId = req.user.id;
    const { source } = req.body;
    
    console.log('addDrawCount接收到的参数:', { source, body: req.body });
    
    // 无论是通过广告还是其他方式获取，都增加1次
    const incrementCount = 1;
    const message = '次数+1';
    
    console.log('增加次数:', incrementCount, '消息:', message);
    
    await UserDrawCount.increment(userId, incrementCount);
    const drawCount = await UserDrawCount.getByUserId(userId);
    return success(res, {
      remaining: drawCount.remaining_draws,
      total: drawCount.total_draws,
      message: message
    });
  } catch (err) {
    console.error('增加次数失败:', err);
    return error(res, '增加次数失败', 500);
  }
};
