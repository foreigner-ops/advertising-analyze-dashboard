const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'analyzer.db'));

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

function addColumnIfNotExists(table, column, type) {
  try {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`).run();
  } catch (err) {
    // Column already exists or table doesn't exist yet
  }
}

function initDb() {
  // Merch Sales Table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS merch_sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT,
      asin TEXT,
      marketplace TEXT,
      units INTEGER,
      returns INTEGER,
      revenue REAL,
      royalties REAL,
      title TEXT,
      product_type TEXT
    )
  `).run();

  // Ensure returns column exists (for older DB versions)
  addColumnIfNotExists('merch_sales', 'returns', 'INTEGER');

  // Ad Tables Helper
  const createAdTable = (name) => {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS ${name} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT,
        asin TEXT,
        spend REAL,
        sales REAL,
        orders INTEGER,
        impressions INTEGER,
        clicks INTEGER,
        portfolio TEXT
      )
    `).run();
    addColumnIfNotExists(name, 'portfolio', 'TEXT');
  };

  createAdTable('sp_ads');
  createAdTable('sb_ads');

  // Create indexes for faster queries
  db.prepare('CREATE INDEX IF NOT EXISTS idx_merch_asin_date ON merch_sales(asin, date)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_sp_asin_date ON sp_ads(asin, date)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_sb_asin_date ON sb_ads(asin, date)').run();

  console.log('Database initialized successfully with robust schema.');
}

module.exports = {
  db,
  initDb
};
