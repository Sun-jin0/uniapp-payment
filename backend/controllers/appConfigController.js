const AppConfig = require('../models/AppConfig');

exports.getPublicConfig = async (req, res) => {
  try {
    const config = await AppConfig.getCountdownConfig();
    res.json({
      code: 0,
      data: config
    });
  } catch (error) {
    console.error('Get public config error:', error);
    res.status(500).json({
      code: 1,
      message: '获取配置失败'
    });
  }
};

exports.getAdminConfigs = async (req, res) => {
  try {
    const configs = await AppConfig.findAll();
    res.json({
      code: 0,
      data: configs
    });
  } catch (error) {
    console.error('Get admin configs error:', error);
    res.status(500).json({
      code: 1,
      message: '获取配置列表失败'
    });
  }
};

exports.updateConfig = async (req, res) => {
  try {
    const { key, value, description } = req.body;
    if (!key) {
      return res.status(400).json({
        code: 1,
        message: '配置键名不能为空'
      });
    }
    
    const config = await AppConfig.update(key, value, description);
    res.json({
      code: 0,
      data: config,
      message: '更新成功'
    });
  } catch (error) {
    console.error('Update config error:', error);
    res.status(500).json({
      code: 1,
      message: '更新配置失败'
    });
  }
};
