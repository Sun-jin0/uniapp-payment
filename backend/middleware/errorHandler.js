const { errorResponse } = require('../utils/response');

const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(val => val.message);
    return res.status(400).json(errorResponse(messages.join(', ')));
  }

  if (err.name === 'CastError') {
    return res.status(400).json(errorResponse('无效的ID格式'));
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(409).json(errorResponse(`${field}已存在`));
  }

  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json(errorResponse('无效的Token'));
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json(errorResponse('Token已过期'));
  }

  res.status(500).json(errorResponse('服务器内部错误'));
};

const notFound = (req, res, next) => {
  res.status(404).json(errorResponse('路由不存在'));
};

module.exports = {
  errorHandler,
  notFound,
};
