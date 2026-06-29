const Essay = require('../models/Essay');
const { successResponse, errorResponse } = require('../utils/response');

const submitEssay = async (req, res) => {
  try {
    const { content, subjectId } = req.body;
    const userId = req.userId;
    
    const score = Math.floor(Math.random() * 30) + 70;
    const feedbacks = [
      '文章结构清晰，论证有力',
      '观点明确，论据充分',
      '语言流畅，表达准确',
      '逻辑清晰，层次分明',
    ];
    const suggestions = [
      '可以增加更多实例来支撑观点',
      '建议加强段落之间的过渡',
      '可以适当增加引文来增强说服力',
      '建议注意语法和标点的使用',
    ];
    
    const essay = await Essay.create({
      userId,
      subjectId,
      content,
      score,
      feedback: feedbacks[Math.floor(Math.random() * feedbacks.length)],
      suggestions: suggestions[Math.floor(Math.random() * suggestions.length)],
    });
    
    res.json(successResponse({
      id: essay._id,
      score: essay.score,
      feedback: essay.feedback,
      suggestions: essay.suggestions,
      createdAt: essay.createdAt,
    }));
  } catch (error) {
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const getEssayRecords = async (req, res) => {
  try {
    const { page = 1, size = 20 } = req.query;
    const userId = req.userId;
    
    const skip = (page - 1) * size;
    const essays = await Essay.find({
      userId,
      skip: parseInt(skip),
      limit: parseInt(size)
    });
    
    const total = await Essay.countDocuments({ userId });
    
    res.json(successResponse({
      list: essays.map(e => ({
        id: e._id,
        score: e.score,
        feedback: e.feedback,
        subjectId: e.subjectId,
        createdAt: e.createdAt,
      })),
      total,
    }));
  } catch (error) {
    res.status(500).json(errorResponse('服务器错误'));
  }
};

module.exports = {
  submitEssay,
  getEssayRecords,
};
