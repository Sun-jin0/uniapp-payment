const Feedback = require('../models/Feedback');
const { successResponse, errorResponse } = require('../utils/response');

const submitFeedback = async (req, res) => {
  try {
    const { type, content, contact } = req.body;
    const userId = req.userId;
    
    await Feedback.create({
      userId,
      type,
      content,
      contact,
      status: 1,
    });
    
    res.json(successResponse({}));
  } catch (error) {
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const submitQuestionFeedback = async (req, res) => {
  try {
    const { questionId, type, content } = req.body;
    const userId = req.userId;
    
    await Feedback.create({
      userId,
      questionId,
      type,
      content,
      status: 1,
    });
    
    res.json(successResponse({}));
  } catch (error) {
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const getFeedbacks = async (req, res) => {
  try {
    const { type, status, page = 1, size = 20 } = req.query;
    const query = {};
    
    if (type) query.type = type;
    if (status !== undefined) query.status = parseInt(status);
    
    const skip = (page - 1) * size;
    const feedbacks = await Feedback.find({
      ...query,
      skip: parseInt(skip),
      limit: parseInt(size)
    });
    
    const total = await Feedback.countDocuments(query);
    
    res.json(successResponse({
      list: feedbacks.map(f => ({
        id: f._id,
        type: f.type,
        content: f.content,
        contact: f.contact,
        status: f.status,
        createdAt: f.createdAt,
        userId: f.userId,
        questionId: f.questionId,
      })),
      total,
    }));
  } catch (error) {
    res.status(500).json(errorResponse('服务器错误'));
  }
};

const updateFeedbackStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const feedback = await Feedback.findById(id);
    if (!feedback) {
      return res.status(404).json(errorResponse('反馈不存在'));
    }
    
    await Feedback.updateById(id, { status });
    
    res.json(successResponse({}));
  } catch (error) {
    res.status(500).json(errorResponse('服务器错误'));
  }
};

module.exports = {
  submitFeedback,
  submitQuestionFeedback,
  getFeedbacks,
  updateFeedbackStatus,
};
