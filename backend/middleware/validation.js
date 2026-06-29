const { body, param, query, validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      code: 1,
      message: '参数错误',
      data: errors.array(),
    });
  }
  next();
};

const loginValidation = [
  body('username').notEmpty().withMessage('用户名不能为空'),
  body('password').notEmpty().withMessage('密码不能为空'),
  validate,
];

const registerValidation = [
  body('username').notEmpty().withMessage('用户名不能为空'),
  body('password').isLength({ min: 6 }).withMessage('密码至少6位'),
  body('studentId').notEmpty().withMessage('学号不能为空'),
  validate,
];

const changePasswordValidation = [
  body('oldPassword').notEmpty().withMessage('旧密码不能为空'),
  body('newPassword').isLength({ min: 6 }).withMessage('新密码至少6位'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.newPassword) {
      throw new Error('两次密码不一致');
    }
    return true;
  }),
  validate,
];

const idValidation = [
  param('id').notEmpty().withMessage('ID不能为空'),
  validate,
];

const generateRedeemCodeValidation = [
  body('subjectId').notEmpty().withMessage('科目ID不能为空'),
  body('count').isInt({ min: 1, max: 100 }).withMessage('数量在1-100之间'),
  body('days').isInt({ min: 1 }).withMessage('天数至少1天'),
  body('maxCount').isInt({ min: 1 }).withMessage('最大使用次数至少1次'),
  validate,
];

const verifyRedeemCodeValidation = [
  body('code').notEmpty().withMessage('兑换码不能为空'),
  validate,
];

const paginationValidation = [
  query('page').optional().isInt({ min: 1 }).withMessage('页码必须大于0'),
  query('size').optional().isInt({ min: 1, max: 1000 }).withMessage('每页数量在1-1000之间'),
  validate,
];

const questionIdValidation = [
  body('questionId').notEmpty().withMessage('题目ID不能为空'),
  validate,
];

module.exports = {
  validate,
  loginValidation,
  registerValidation,
  changePasswordValidation,
  idValidation,
  generateRedeemCodeValidation,
  verifyRedeemCodeValidation,
  paginationValidation,
  questionIdValidation,
};
