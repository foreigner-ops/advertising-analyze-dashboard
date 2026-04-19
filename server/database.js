const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, '..', 'analyzer.db'));

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
  // Profiles Table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      is_active INTEGER DEFAULT 0
    )
  `).run();

  // Merch Sales Table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS merch_sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER DEFAULT 1,
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

  // Ensure columns exist (for migration)
  addColumnIfNotExists('merch_sales', 'returns', 'INTEGER');
  addColumnIfNotExists('merch_sales', 'profile_id', 'INTEGER DEFAULT 1');

  // Ad Tables Helper
  const createAdTable = (name) => {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS ${name} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        profile_id INTEGER DEFAULT 1,
        date TEXT,
        asin TEXT,
        spend REAL,
        sales REAL,
        orders INTEGER,
        impressions INTEGER,
        clicks INTEGER,
        portfolio TEXT,
        campaign TEXT,
        ad_group TEXT
      )
    `).run();
    addColumnIfNotExists(name, 'portfolio', 'TEXT');
    addColumnIfNotExists(name, 'campaign', 'TEXT');
    addColumnIfNotExists(name, 'ad_group', 'TEXT');
    addColumnIfNotExists(name, 'profile_id', 'INTEGER DEFAULT 1');
  };

  createAdTable('sp_ads');
  createAdTable('sb_ads');

  // ASIN Metadata Table (for persistent UI state like "Done")
  // Migration for older versions: recreate with composite PK
  const tableCheck = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='asin_status'").get();
  if (tableCheck && !tableCheck.sql.includes('PRIMARY KEY (asin, profile_id)')) {
    console.log('[Migration] Upgrading asin_status table for profile support...');
    db.transaction(() => {
      db.prepare('ALTER TABLE asin_status RENAME TO asin_status_old').run();
      db.prepare(`
        CREATE TABLE asin_status (
          asin TEXT,
          profile_id INTEGER DEFAULT 1,
          is_done INTEGER DEFAULT 0,
          PRIMARY KEY (asin, profile_id)
        )
      `).run();
      db.prepare('INSERT INTO asin_status (asin, profile_id, is_done) SELECT asin, COALESCE(profile_id, 1), is_done FROM asin_status_old').run();
      db.prepare('DROP TABLE asin_status_old').run();
    })();
  } else {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS asin_status (
        asin TEXT,
        profile_id INTEGER DEFAULT 1,
        is_done INTEGER DEFAULT 0,
        PRIMARY KEY (asin, profile_id)
      )
    `).run();
  }

  // Campaign Links Table (to store name -> URL mapping)
  const linksTableCheck = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='campaign_links'").get();
  if (linksTableCheck && !linksTableCheck.sql.includes('PRIMARY KEY (campaign_name, profile_id)')) {
    console.log('[Migration] Upgrading campaign_links table for profile support...');
    db.transaction(() => {
      db.prepare('ALTER TABLE campaign_links RENAME TO campaign_links_old').run();
      db.prepare(`
        CREATE TABLE campaign_links (
          campaign_name TEXT,
          link TEXT,
          profile_id INTEGER DEFAULT 1,
          PRIMARY KEY (campaign_name, profile_id)
        )
      `).run();
      db.prepare('INSERT INTO campaign_links (campaign_name, link, profile_id) SELECT campaign_name, link, COALESCE(profile_id, 1) FROM campaign_links_old').run();
      db.prepare('DROP TABLE campaign_links_old').run();
    })();
  } else {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS campaign_links (
        campaign_name TEXT,
        link TEXT,
        profile_id INTEGER DEFAULT 1,
        PRIMARY KEY (campaign_name, profile_id)
      )
    `).run();
  }

  // Migration: If no profiles exist, create "Default" and set it as active
  const profileCount = db.prepare('SELECT COUNT(*) as count FROM profiles').get().count;
  if (profileCount === 0) {
    db.prepare('INSERT INTO profiles (name, is_active) VALUES (?, ?)').run('Default Profile', 1);
    console.log('[Migration] Created Default Profile.');
  }

  // Settings Table (for global preferences like column config)
  db.prepare(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `).run();

  console.log('Database initialized successfully with profile support.');
}

module.exports = {
  db,
  initDb
};
