const pool = require('../config/mysql');

(async () => {
  try {
    const [cols1] = await pool.query("SHOW COLUMNS FROM checkin_categories LIKE 'start_time'");
    if (cols1.length === 0) {
      await pool.query("ALTER TABLE checkin_categories ADD COLUMN start_time DATETIME DEFAULT NULL AFTER cover_image");
      console.log('Added start_time column');
    } else {
      console.log('start_time column already exists');
    }

    const [cols2] = await pool.query("SHOW COLUMNS FROM checkin_categories LIKE 'end_time'");
    if (cols2.length === 0) {
      await pool.query("ALTER TABLE checkin_categories ADD COLUMN end_time DATETIME DEFAULT NULL AFTER start_time");
      console.log('Added end_time column');
    } else {
      console.log('end_time column already exists');
    }

    const [cols3] = await pool.query("SHOW COLUMNS FROM checkin_categories LIKE 'pre_register_count'");
    if (cols3.length === 0) {
      await pool.query("ALTER TABLE checkin_categories ADD COLUMN pre_register_count INT DEFAULT 0 AFTER end_time");
      console.log('Added pre_register_count column');
    } else {
      console.log('pre_register_count column already exists');
    }

    const [tableCheck] = await pool.query("SHOW TABLES LIKE 'checkin_pre_registers'");
    if (tableCheck.length === 0) {
      await pool.query(`
        CREATE TABLE checkin_pre_registers (
          id INT AUTO_INCREMENT PRIMARY KEY,
          category_id INT NOT NULL,
          user_id INT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY unique_register (category_id, user_id),
          FOREIGN KEY (category_id) REFERENCES checkin_categories(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      console.log('Created checkin_pre_registers table');
    } else {
      console.log('checkin_pre_registers table already exists');
    }

    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
