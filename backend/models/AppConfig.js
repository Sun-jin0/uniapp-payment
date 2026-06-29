const pool = require('../config/mysql');

class AppConfig {
  static async findByKey(key) {
    const [rows] = await pool.query('SELECT * FROM app_configs WHERE config_key = ?', [key]);
    return rows[0];
  }

  static async findAll() {
    const [rows] = await pool.query('SELECT * FROM app_configs');
    return rows;
  }

  static async update(key, value, description) {
    const [rows] = await pool.query('SELECT id FROM app_configs WHERE config_key = ?', [key]);
    if (rows.length > 0) {
      await pool.query(
        'UPDATE app_configs SET config_value = ?, description = ? WHERE config_key = ?',
        [value, description, key]
      );
    } else {
      await pool.query(
        'INSERT INTO app_configs (config_key, config_value, description) VALUES (?, ?, ?)',
        [key, value, description]
      );
    }
    return this.findByKey(key);
  }
  
  // Helper to get all countdown related configs
  static async getCountdownConfig() {
    const [rows] = await pool.query("SELECT * FROM app_configs WHERE config_key LIKE 'countdown_%'");
    const config = {};
    rows.forEach(row => {
      config[row.config_key] = row.config_value;
    });
    return config;
  }
}

module.exports = AppConfig;
