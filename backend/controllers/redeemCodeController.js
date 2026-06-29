const RedeemCode = require('../models/RedeemCode');
const RedeemRecord = require('../models/RedeemRecord');
const { generateMultipleCodes } = require('../utils/codeGenerator');
const { successResponse, errorResponse } = require('../utils/response');

const generateCodes = async (req, res) => {
  try {
    const { subjectId, count, days, maxCount } = req.body;
    
    const codes = generateMultipleCodes(count);
    
    const redeemCodes = await RedeemCode.insertMany(
      codes.map(code => ({
        code,
        subjectId,
        days,
        maxCount,
        usedCount: 0,
        status: 1,
      }))
    );
    
    res.json(successResponse({
      codes: redeemCodes.map(rc => ({
        code: rc.code,
        subjectId: rc.subjectId,
        days: rc.days,
        maxCount: rc.maxCount,
        createdAt: rc.createdAt,
      })),
    }));
  } catch (error) {
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const getRedeemCodes = async (req, res) => {
  try {
    const { keyword, status, page = 1, size = 20 } = req.query;
    const query = {};
    
    if (keyword) {
      query.code = { $regex: keyword, $options: 'i' };
    }
    
    if (status !== undefined) {
      query.status = parseInt(status);
    }
    
    const skip = (page - 1) * size;
    const codes = await RedeemCode.find({
      ...query,
      skip: parseInt(skip),
      limit: parseInt(size)
    });
    
    const total = await RedeemCode.countDocuments(query);
    
    res.json(successResponse({ list: codes, total }));
  } catch (error) {
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const verifyCode = async (req, res) => {
  try {
    const { code } = req.body;
    const userId = req.userId;
    
    const redeemCode = await RedeemCode.findOne({ code, status: 1 });
    if (!redeemCode) {
      return res.status(400).json(errorResponse('兑换码无效'));
    }
    
    if (redeemCode.usedCount >= redeemCode.maxCount) {
      return res.status(400).json(errorResponse('兑换码已达到最大使用次数'));
    }
    
    const existingRecord = await RedeemRecord.findOne({
      userId,
      redeemCodeId: redeemCode._id,
      status: 1,
    });
    
    if (existingRecord) {
      return res.status(400).json(errorResponse('您已使用过此兑换码'));
    }
    
    const expiredDate = new Date();
    expiredDate.setDate(expiredDate.getDate() + redeemCode.days);
    
    await RedeemRecord.create({
      userId,
      redeemCodeId: redeemCode._id,
      subjectId: redeemCode.subjectId,
      redeemDate: new Date(),
      expiredDate,
      status: 1,
    });
    
    await RedeemCode.findByIdAndUpdate(redeemCode._id, {
      $inc: { usedCount: 1 },
    });
    
    res.json(successResponse({
      subjectId: redeemCode.subjectId,
      days: redeemCode.days,
    }));
  } catch (error) {
    res.status(500).json(errorResponse('服务器错误'));
  }
};

module.exports = {
  generateCodes,
  getRedeemCodes,
  verifyCode,
};
