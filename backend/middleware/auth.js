const { verifyToken } = require('../utils/jwt');
const { errorResponse } = require('../utils/response');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json(errorResponse('未授权，请先登录'));
    }

    const decoded = verifyToken(token);
    req.userId = decoded.userId;

    const User = require('../models/User');
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(401).json(errorResponse('用户不存在'));
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json(errorResponse('Token无效或已过期'));
  }
};

const adminAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json(errorResponse('未授权，请先登录'));
    }

    const decoded = verifyToken(token);
    req.userId = decoded.userId;

    const User = require('../models/User');
    const user = await User.findById(req.userId);

    if (!user || user.role === 0) {
      return res.status(403).json(errorResponse('权限不足'));
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json(errorResponse('Token无效或已过期'));
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (token) {
      const decoded = verifyToken(token);
      req.userId = decoded.userId;
      
      const User = require('../models/User');
      const user = await User.findById(req.userId);
      if (user) {
        req.user = user;
      }
    }
    next();
  } catch (error) {
    // Ignore error for optional auth
    next();
  }
};

module.exports = {
  auth,
  adminAuth,
  optionalAuth
};
