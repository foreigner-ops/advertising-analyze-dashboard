const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const ExcelJS = require('exceljs');
const { initDb, db } = require('./database');
const { processMerchSales, processAdReport, clearData, setProgressTracker } = require('./csv-processor');

const app = express();
const port = 3001;
const uploadDir = path.join(__dirname, 'uploads');

app.use(cors());
app.use(express.json());

fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({ dest: uploadDir });

const cleanupUploadFiles = (files = {}) => {
  Object.values(files).flat().forEach((file) => {
    try {
      fs.rmSync(file.path, { force: true });
    } catch (error) {
      console.warn(`Failed to remove upload "${file.path}":`, error.message);
    }
  });
};

initDb();

// --- Profile Helpers ---
const getActiveProfileId = () => {
  const profile = db.prepare('SELECT id FROM profiles WHERE is_active = 1').get();
  return profile ? profile.id : 1;
};

// --- Progress Tracking ---
let PROGRESS = {
  merch: 0,
  sp: 0,
  sb: 0,
  status: 'idle'
};

setProgressTracker(PROGRESS);

app.get('/progress', (req, res) => {
  res.json(PROGRESS);
});

app.post('/upload', upload.fields([
  { name: 'merch', maxCount: 1 },
  { name: 'sp', maxCount: 1 },
  { name: 'sb', maxCount: 1 }
]), async (req, res) => {
  try {
    const { merch, sp, sb } = req.files || {};
    
    PROGRESS.merch = 0; PROGRESS.sp = 0; PROGRESS.sb = 0;
    PROGRESS.status = 'processing';
    
    // Create new profile for this import batch
    const now = new Date();
    const timestamp = now.getFullYear() + '-' + 
      String(now.getMonth() + 1).padStart(2, '0') + '-' + 
      String(now.getDate()).padStart(2, '0') + ' ' + 
      String(now.getHours()).padStart(2, '0') + ':' + 
      String(now.getMinutes()).padStart(2, '0') + ':' + 
      String(now.getSeconds()).padStart(2, '0');
    const profileName = `Report ${timestamp}`;

    let profileId;
    db.transaction(() => {
      // Deactivate current active profile
      db.prepare('UPDATE profiles SET is_active = 0').run();
      // Create and activate new profile
      const result = db.prepare('INSERT INTO profiles (name, is_active) VALUES (?, 1)').run(profileName);
      profileId = result.lastInsertRowid;
    })();

    if (merch) await processMerchSales(merch[0].path, profileId, merch[0].originalname);
    if (sp) await processAdReport(sp[0].path, 'sp_ads', profileId, sp[0].originalname);
    if (sb) await processAdReport(sb[0].path, 'sb_ads', profileId, sb[0].originalname);


    PROGRESS.status = 'done';
    res.json({ 
      message: 'Data processed successfully',
      profile: {
        id: profileId,
        name: profileName
      }
    });
  } catch (error) {
    console.error(error);
    PROGRESS.status = 'error';
    res.status(500).json({ error: error.message });
  } finally {
    cleanupUploadFiles(req.files);
  }
});

app.post('/clear', async (req, res) => {
  try {
    clearData(getActiveProfileId());
    res.json({ message: 'Database cleared successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/update-status', async (req, res) => {
  const { asin, is_done } = req.body;
  const profileId = getActiveProfileId();
  try {
    db.prepare('INSERT OR REPLACE INTO asin_status (asin, profile_id, is_done) VALUES (?, ?, ?)').run(asin, profileId, is_done ? 1 : 0);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Profile Routes ---
app.get('/api/profiles', (req, res) => {
  try {
    const profiles = db.prepare(`
      SELECT 
        p.*,
        (SELECT COUNT(*) FROM merch_sales WHERE profile_id = p.id) +
        (SELECT COUNT(*) FROM sp_ads WHERE profile_id = p.id) +
        (SELECT COUNT(*) FROM sb_ads WHERE profile_id = p.id) as row_count
      FROM profiles p 
      ORDER BY name ASC
    `).all();
    res.json(profiles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/profiles/save', (req, res) => {
  const { name } = req.body;
  const currentProfileId = getActiveProfileId();
  try {
    // 1. Create new profile
    const result = db.prepare('INSERT INTO profiles (name, is_active) VALUES (?, 0)').run(name);
    const newProfileId = result.lastInsertRowid;

    // 2. Clone data from current active profile in a transaction
    db.transaction(() => {
      db.prepare('INSERT INTO merch_sales (profile_id, date, asin, marketplace, units, returns, revenue, royalties, title, product_type) SELECT ?, date, asin, marketplace, units, returns, revenue, royalties, title, product_type FROM merch_sales WHERE profile_id = ?').run(newProfileId, currentProfileId);
      db.prepare('INSERT INTO sp_ads (profile_id, date, asin, spend, sales, orders, impressions, clicks, portfolio, campaign, ad_group) SELECT ?, date, asin, spend, sales, orders, impressions, clicks, portfolio, campaign, ad_group FROM sp_ads WHERE profile_id = ?').run(newProfileId, currentProfileId);
      db.prepare('INSERT INTO sb_ads (profile_id, date, asin, spend, sales, orders, impressions, clicks, portfolio, campaign, ad_group) SELECT ?, date, asin, spend, sales, orders, impressions, clicks, portfolio, campaign, ad_group FROM sb_ads WHERE profile_id = ?').run(newProfileId, currentProfileId);
      db.prepare('INSERT INTO asin_status (asin, profile_id, is_done) SELECT asin, ?, is_done FROM asin_status WHERE profile_id = ?').run(newProfileId, currentProfileId);
      db.prepare('INSERT INTO campaign_links (campaign_name, link, profile_id) SELECT campaign_name, link, ? FROM campaign_links WHERE profile_id = ?').run(newProfileId, currentProfileId);
    })();

    res.json({ success: true, id: newProfileId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/profiles/:id/activate', (req, res) => {
  const { id } = req.params;
  try {
    db.transaction(() => {
      db.prepare('UPDATE profiles SET is_active = 0').run();
      db.prepare('UPDATE profiles SET is_active = 1 WHERE id = ?').run(id);
    })();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/profiles/:id', (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  try {
    db.prepare('UPDATE profiles SET name = ? WHERE id = ?').run(name, id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/profiles/:id', (req, res) => {
  const { id } = req.params;
  try {
    db.transaction(() => {
      // Check if it's the active one, if so, we might need a fallback
      const row = db.prepare('SELECT is_active FROM profiles WHERE id = ?').get(id);
      const wasActive = row ? row.is_active : 0;
      
      db.prepare('DELETE FROM profiles WHERE id = ?').run(id);
      db.prepare('DELETE FROM merch_sales WHERE profile_id = ?').run(id);
      db.prepare('DELETE FROM sp_ads WHERE profile_id = ?').run(id);
      db.prepare('DELETE FROM sb_ads WHERE profile_id = ?').run(id);
      db.prepare('DELETE FROM asin_status WHERE profile_id = ?').run(id);
      db.prepare('DELETE FROM campaign_links WHERE profile_id = ?').run(id);

      if (wasActive) {
        // Activate another one if possible
        const next = db.prepare('SELECT id FROM profiles LIMIT 1').get();
        if (next) {
          db.prepare('UPDATE profiles SET is_active = 1 WHERE id = ?').run(next.id);
        }
      }
    })();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Filter Helper ---
const buildFilterClause = (filters) => {
  if (!filters || !Array.isArray(filters) || filters.length === 0) return { sql: '', params: [] };
  
  const validFields = [
    'total_units', 'total_returns', 'total_revenue', 'total_royalties', 'total_spend', 'total_ad_sales', 
    'total_ad_orders', 'profit', 'avg_price', 'tacos', 'acos', 'sp_acos', 'sb_acos', 'organic_orders', 
    'sp_orders', 'sp_sales', 'sp_spend', 'sb_orders', 'sb_sales', 'sb_spend', 'product_type'
  ];
  const validOps = ['>', '<', '=', '>=', '<=', '!=', 'LIKE'];
  const validJoiners = ['AND', 'OR'];
  const percentFields = ['acos', 'tacos', 'sp_acos', 'sb_acos'];
  
  const clauses = [];
  const params = [];
  
  filters.forEach((f, index) => {
    if (validFields.includes(f.field) && validOps.includes(f.operator)) {
      const joiner = (index > 0 && validJoiners.includes(f.joiner)) ? f.joiner : 'AND';
      const prefix = index === 0 ? '' : ` ${joiner} `;

      if (f.field === 'product_type') {
        // String filtering
        const op = f.operator === 'LIKE' ? 'LIKE' : f.operator;
        const val = f.operator === 'LIKE' ? `%${f.value}%` : f.value;
        clauses.push(`${prefix}${f.field} ${op} ?`);
        params.push(val);
      } else {
        // Numeric filtering
        let val = parseFloat(f.value);
        if (!isNaN(val)) {
          // Handle percentage fields (e.g. 20 -> 0.2)
          if (percentFields.includes(f.field)) {
            val = val / 100;
          }
          clauses.push(`${prefix}${f.field} ${f.operator} ?`);
          params.push(val);
        }
      }
    }
  });
  
  return {
    sql: clauses.length > 0 ? ` AND (${clauses.join('')})` : '',
    params
  };
};

app.get('/tacos', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const offset = parseInt(req.query.offset) || 0;
  const search = req.query.search || '';
  let filters = [];
  try { if (req.query.filters) filters = JSON.parse(req.query.filters); } catch(e) {}

  const baseQuery = `
    WITH all_asins AS (
      SELECT asin FROM merch_sales WHERE profile_id = ?
      UNION
      SELECT asin FROM sp_ads WHERE profile_id = ? AND asin IS NOT NULL
      UNION
      SELECT asin FROM sb_ads WHERE profile_id = ? AND asin IS NOT NULL
    )
    SELECT m.*, COALESCE(st.is_done, 0) as is_done FROM (
      SELECT 
        a.asin,
        COALESCE(ms.title, 'Unknown Title') as title,
        COALESCE(ms.product_type, 'N/A') as product_type,
        COALESCE(ms.total_units, 0) as total_units,
        COALESCE(ms.total_returns, 0) as total_returns,
        COALESCE(ms.total_revenue, 0) as total_revenue,
        COALESCE(ms.total_royalties, 0) as total_royalties,
        COALESCE(sp.spend, 0) as sp_spend, COALESCE(sp.sales, 0) as sp_sales, COALESCE(sp.orders, 0) as sp_orders,
        COALESCE(sb.spend, 0) as sb_spend, COALESCE(sb.sales, 0) as sb_sales, COALESCE(sb.orders, 0) as sb_orders,
        COALESCE(sp.spend, 0) + COALESCE(sb.spend, 0) as total_spend,
        COALESCE(sp.sales, 0) + COALESCE(sb.sales, 0) as total_ad_sales,
        COALESCE(sp.orders, 0) + COALESCE(sb.orders, 0) as total_ad_orders,
        CAST(COALESCE(ms.total_revenue, 0) AS FLOAT) / NULLIF(COALESCE(ms.total_units, 0), 0) as avg_price,
        CAST(COALESCE(sp.spend, 0) + COALESCE(sb.spend, 0) AS FLOAT) / NULLIF(COALESCE(ms.total_revenue, 0), 0) as tacos,
        CAST(COALESCE(sp.spend, 0) + COALESCE(sb.spend, 0) AS FLOAT) / NULLIF(COALESCE(sp.sales, 0) + COALESCE(sb.sales, 0), 0) as acos,
        CAST(COALESCE(sp.spend, 0) AS FLOAT) / NULLIF(COALESCE(sp.sales, 0), 0) as sp_acos,
        CAST(COALESCE(sb.spend, 0) AS FLOAT) / NULLIF(COALESCE(sb.sales, 0), 0) as sb_acos,
        COALESCE(ms.total_units, 0) - (COALESCE(sp.orders, 0) + COALESCE(sb.orders, 0)) as organic_orders,
        COALESCE(ms.total_royalties, 0) - (COALESCE(sp.spend, 0) + COALESCE(sb.spend, 0)) as profit,
        COALESCE(sp.portfolio, sb.portfolio) as portfolio
      FROM all_asins a
      LEFT JOIN (
        SELECT asin, MAX(title) as title, MAX(product_type) as product_type, SUM(units) as total_units, SUM(returns) as total_returns, SUM(revenue) as total_revenue, SUM(royalties) as total_royalties 
        FROM merch_sales 
        WHERE profile_id = ?
        GROUP BY asin
      ) ms ON a.asin = ms.asin
      LEFT JOIN (
        SELECT asin, SUM(spend) as spend, SUM(sales) as sales, SUM(orders) as orders, MAX(portfolio) as portfolio FROM sp_ads WHERE profile_id = ? AND asin IS NOT NULL GROUP BY asin
      ) sp ON a.asin = sp.asin
      LEFT JOIN (
        SELECT asin, SUM(spend) as spend, SUM(sales) as sales, SUM(orders) as orders, MAX(portfolio) as portfolio FROM sb_ads WHERE profile_id = ? AND asin IS NOT NULL GROUP BY asin
      ) sb ON a.asin = sb.asin
    ) m
    LEFT JOIN asin_status st ON m.asin = st.asin AND st.profile_id = ?
    WHERE (m.asin LIKE ? OR m.title LIKE ?)
  `;

  const { sql: filterSql, params: filterParams } = buildFilterClause(filters);
  const sortField = req.query.sortField || 'total_revenue';
  const sortOrder = req.query.sortOrder || 'DESC';
  
  const validSortFields = ['asin', 'title', 'product_type', 'total_units', 'total_returns', 'total_revenue', 'total_royalties', 'total_spend', 'total_ad_sales', 'total_ad_orders', 'profit', 'avg_price', 'tacos', 'acos', 'sp_acos', 'sb_acos', 'organic_orders'];
  const finalSortField = validSortFields.includes(sortField) ? sortField : 'total_revenue';
  const finalSortOrder = ['ASC', 'DESC'].includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

  const fullQuery = `${baseQuery} ${filterSql} ORDER BY ${finalSortField} ${finalSortOrder} LIMIT ? OFFSET ?`;

  try {
    const profileId = getActiveProfileId();
    const data = db.prepare(fullQuery).all(profileId, profileId, profileId, profileId, profileId, profileId, profileId, `%${search}%`, `%${search}%`, ...filterParams, limit, offset);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/summary', (req, res) => {
  const search = req.query.search || '';
  let filters = [];
  try { if (req.query.filters) filters = JSON.parse(req.query.filters); } catch(e) {}

  const { sql: filterSql, params: filterParams } = buildFilterClause(filters);

  const summaryQuery = `
    WITH all_asins AS (
      SELECT asin FROM merch_sales WHERE profile_id = ?
      UNION
      SELECT asin FROM sp_ads WHERE profile_id = ? AND asin IS NOT NULL
      UNION
      SELECT asin FROM sb_ads WHERE profile_id = ? AND asin IS NOT NULL
    )
    SELECT 
      SUM(total_units) as unts,
      SUM(total_returns) as retrns,
      SUM(total_revenue) as rev,
      SUM(total_royalties) as roy,
      SUM(total_spend) as spnd,
      SUM(total_ad_sales) as ad_sls,
      SUM(total_ad_orders) as ad_ord,
      SUM(MAX(0, organic_orders)) as org_ord,
      SUM(profit) as prf,
      SUM(sp_spend) as sp_spnd,
      SUM(sp_sales) as sp_sls,
      SUM(sp_orders) as sp_ord,
      SUM(sb_spend) as sb_spnd,
      SUM(sb_sales) as sb_sls,
      SUM(sb_orders) as sb_ord
    FROM (
      SELECT * FROM (
        SELECT 
          COALESCE(ms.total_units, 0) as total_units, 
          COALESCE(ms.total_returns, 0) as total_returns, 
          COALESCE(ms.total_revenue, 0) as total_revenue, 
          COALESCE(ms.total_royalties, 0) as total_royalties,
          a.asin, 
          COALESCE(ms.title, 'Unknown Title') as title, 
          COALESCE(ms.product_type, 'N/A') as product_type,
          COALESCE(sp.spend, 0) + COALESCE(sb.spend, 0) as total_spend,
          COALESCE(sp.sales, 0) + COALESCE(sb.sales, 0) as total_ad_sales,
          COALESCE(sp.orders, 0) + COALESCE(sb.orders, 0) as total_ad_orders,
          COALESCE(sp.spend, 0) as sp_spend,
          COALESCE(sp.sales, 0) as sp_sales,
          COALESCE(sp.orders, 0) as sp_orders,
          COALESCE(sb.spend, 0) as sb_spend,
          COALESCE(sb.sales, 0) as sb_sales,
          COALESCE(sb.orders, 0) as sb_orders,
          CAST(COALESCE(ms.total_revenue, 0) AS FLOAT) / NULLIF(COALESCE(ms.total_units, 0), 0) as avg_price,
          CAST(COALESCE(sp.spend, 0) + COALESCE(sb.spend, 0) AS FLOAT) / NULLIF(COALESCE(ms.total_revenue, 0), 0) as tacos,
          CAST(COALESCE(sp.spend, 0) + COALESCE(sb.spend, 0) AS FLOAT) / NULLIF(COALESCE(sp.sales, 0) + COALESCE(sb.sales, 0), 0) as acos,
          CAST(COALESCE(sp.spend, 0) AS FLOAT) / NULLIF(COALESCE(sp.sales, 0), 0) as sp_acos,
          CAST(COALESCE(sb.spend, 0) AS FLOAT) / NULLIF(COALESCE(sb.sales, 0), 0) as sb_acos,
          COALESCE(ms.total_units, 0) - (COALESCE(sp.orders, 0) + COALESCE(sb.orders, 0)) as organic_orders,
          COALESCE(ms.total_royalties, 0) - (COALESCE(sp.spend, 0) + COALESCE(sb.spend, 0)) as profit
        FROM all_asins a
        LEFT JOIN (
          SELECT asin, MAX(title) as title, MAX(product_type) as product_type, SUM(units) as total_units, SUM(returns) as total_returns, SUM(revenue) as total_revenue, SUM(royalties) as total_royalties 
          FROM merch_sales 
          WHERE profile_id = ?
          GROUP BY asin
        ) ms ON a.asin = ms.asin
        LEFT JOIN (
          SELECT asin, SUM(spend) as spend, SUM(sales) as sales, SUM(orders) as orders FROM sp_ads WHERE profile_id = ? AND asin IS NOT NULL GROUP BY asin
        ) sp ON a.asin = sp.asin
        LEFT JOIN (
          SELECT asin, SUM(spend) as spend, SUM(sales) as sales, SUM(orders) as orders FROM sb_ads WHERE profile_id = ? AND asin IS NOT NULL GROUP BY asin
        ) sb ON a.asin = sb.asin
      )
      WHERE (asin LIKE ? OR title LIKE ?)
      ${filterSql}
    )
  `;

  try {
    const profileId = getActiveProfileId();
    const data = db.prepare(summaryQuery).get(profileId, profileId, profileId, profileId, profileId, profileId, `%${search}%`, `%${search}%`, ...filterParams);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper for export data
const getExportRows = (search, filters) => {
  const { sql: filterSql, params: filterParams } = buildFilterClause(filters);

  const query = `
    WITH all_asins AS (
      SELECT asin FROM merch_sales WHERE profile_id = ?
      UNION
      SELECT asin FROM sp_ads WHERE profile_id = ? AND asin IS NOT NULL
      UNION
      SELECT asin FROM sb_ads WHERE profile_id = ? AND asin IS NOT NULL
    )
    SELECT * FROM (
      SELECT 
        a.asin, 
        COALESCE(ms.title, 'Unknown Title') as title, 
        COALESCE(ms.product_type, 'N/A') as product_type,
        COALESCE(ms.total_units, 0) as units, 
        COALESCE(ms.total_returns, 0) as returns, 
        COALESCE(ms.total_revenue, 0) as revenue, 
        COALESCE(ms.total_royalties, 0) as royalties,
        COALESCE(sp.spend, 0) as sp_spnd, COALESCE(sp.sales, 0) as sp_sls, COALESCE(sp.orders, 0) as sp_ord,
        COALESCE(sb.spend, 0) as sb_spnd, COALESCE(sb.sales, 0) as sb_sls, COALESCE(sb.orders, 0) as sb_ord,
        COALESCE(sp.spend, 0) + COALESCE(sb.spend, 0) as total_spend,
        COALESCE(sp.sales, 0) + COALESCE(sb.sales, 0) as total_ad_sales,
        COALESCE(sp.orders, 0) + COALESCE(sb.orders, 0) as total_ad_orders,
        COALESCE(ms.total_units, 0) - (COALESCE(sp.orders, 0) + COALESCE(sb.orders, 0)) as organic_orders,
        CAST(COALESCE(ms.total_revenue, 0) AS FLOAT) / NULLIF(COALESCE(ms.total_units, 0), 0) as avg_price,
        COALESCE(ms.total_royalties, 0) - (COALESCE(sp.spend, 0) + COALESCE(sb.spend, 0)) as profit,
        CAST(COALESCE(sp.spend, 0) + COALESCE(sb.spend, 0) AS FLOAT) / NULLIF(COALESCE(ms.total_revenue, 0), 0) as tacos,
        CAST(COALESCE(sp.spend, 0) + COALESCE(sb.spend, 0) AS FLOAT) / NULLIF(COALESCE(sp.sales, 0) + COALESCE(sb.sales, 0), 0) as acos,
        CAST(COALESCE(sp.spend, 0) AS FLOAT) / NULLIF(COALESCE(sp.sales, 0), 0) as sp_acos,
        CAST(COALESCE(sb.spend, 0) AS FLOAT) / NULLIF(COALESCE(sb.sales, 0), 0) as sb_acos
      FROM all_asins a
      LEFT JOIN (
        SELECT asin, MAX(title) as title, MAX(product_type) as product_type, SUM(units) as total_units, SUM(returns) as total_returns, SUM(revenue) as total_revenue, SUM(royalties) as total_royalties 
        FROM merch_sales 
        WHERE profile_id = ?
        GROUP BY asin
      ) ms ON a.asin = ms.asin
      LEFT JOIN (
        SELECT asin, SUM(spend) as spend, SUM(sales) as sales, SUM(orders) as orders FROM sp_ads WHERE profile_id = ? AND asin IS NOT NULL GROUP BY asin
      ) sp ON a.asin = sp.asin
      LEFT JOIN (
        SELECT asin, SUM(spend) as spend, SUM(sales) as sales, SUM(orders) as orders FROM sb_ads WHERE profile_id = ? AND asin IS NOT NULL GROUP BY asin
      ) sb ON a.asin = sb.asin
    )
    WHERE (asin LIKE ? OR title LIKE ?)
    ${filterSql}
    ORDER BY revenue DESC
  `;

  const profileId = getActiveProfileId();
  const data = db.prepare(query).all(profileId, profileId, profileId, profileId, profileId, profileId, `%${search}%`, `%${search}%`, ...filterParams);
    
  return data.map(row => {
    return {
      ASIN: row.asin,
      Title: row.title,
      "Product Type": row.product_type,
      "Avg. Price": row.avg_price || 0,
      Units: row.units,
      Returns: row.returns,
      Revenue: row.revenue,
      Royalties: row.royalties,
      "Ad Spend": row.total_spend,
      "Ad Sales": row.total_ad_sales,
      "Ad Orders": row.total_ad_orders,
      "Organic Orders": row.organic_orders,
      TACoS: row.tacos || 0,
      ACoS: row.acos || 0,
      Profit: row.profit,
      
      "SP Ads Orders": row.sp_ord,
      "SP Ads Sales": row.sp_sls,
      "SP Ads Spend": row.sp_spnd,
      "SP ACoS": row.sp_acos || 0,
      
      "SB Ads Orders": row.sb_ord,
      "SB Ads Sales": row.sb_sls,
      "SB Ads Spend": row.sb_spnd,
      "SB ACoS": row.sb_acos || 0
    };
  });
};

app.get('/export-raw', (req, res) => {
  const search = req.query.search || '';
  let filters = [];
  try { if (req.query.filters) filters = JSON.parse(req.query.filters); } catch(e) {}
  
  try {
    const exportData = getExportRows(search, filters);
    res.json(exportData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/export', async (req, res) => {
  const search = req.query.search || '';
  const format = req.query.format || 'csv';
  let filters = [];
  try { if (req.query.filters) filters = JSON.parse(req.query.filters); } catch(e) {}
  
  try {
    const exportData = getExportRows(search, filters);

    if (format === 'xlsx') {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Performance');

      const columns = [
        { header: 'ASIN', key: 'ASIN', width: 15 },
        { header: 'Title', key: 'Title', width: 40 },
        { header: 'Product Type', key: 'Product Type', width: 20 },
        { header: 'Avg. Price', key: 'Avg. Price', width: 12 },
        { header: 'Units', key: 'Units', width: 8 },
        { header: 'Returns', key: 'Returns', width: 8 },
        { header: 'Revenue', key: 'Revenue', width: 12 },
        { header: 'Royalties', key: 'Royalties', width: 12 },
        { header: 'Ad Spend', key: 'Ad Spend', width: 12 },
        { header: 'Ad Sales', key: 'Ad Sales', width: 12 },
        { header: 'Ad Orders', key: 'Ad Orders', width: 12 },
        { header: 'Organic Orders', key: 'Organic Orders', width: 15 },
        { header: 'TACoS', key: 'TACoS', width: 10 },
        { header: 'ACoS', key: 'ACoS', width: 10 },
        { header: 'Profit', key: 'Profit', width: 12 },
        { header: 'SP Ads Orders', key: 'SP Ads Orders', width: 15 },
        { header: 'SP Ads Sales', key: 'SP Ads Sales', width: 15 },
        { header: 'SP Ads Spend', key: 'SP Ads Spend', width: 15 },
        { header: 'SP ACoS', key: 'SP ACoS', width: 12 },
        { header: 'SB Ads Orders', key: 'SB Ads Orders', width: 15 },
        { header: 'SB Ads Sales', key: 'SB Ads Sales', width: 15 },
        { header: 'SB Ads Spend', key: 'SB Ads Spend', width: 15 },
        { header: 'SB ACoS', key: 'SB ACoS', width: 12 }
      ];

      sheet.columns = columns;
      exportData.forEach(data => sheet.addRow(data));

      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const currencyCols = ['Avg. Price', 'Revenue', 'Royalties', 'Ad Spend', 'Ad Sales', 'Profit', 'SP Ads Sales', 'SP Ads Spend', 'SB Ads Sales', 'SB Ads Spend'];
        const percentCols = ['TACoS', 'ACoS', 'SP ACoS', 'SB ACoS'];

        columns.forEach((col, idx) => {
          const cell = row.getCell(idx + 1);
          if (currencyCols.includes(col.header)) cell.numFmt = '"$"#,##0.00';
          if (percentCols.includes(col.header)) cell.numFmt = '0.00%';

          if (col.header === 'Profit') {
            const val = cell.value;
            if (val > 0) cell.font = { color: { argb: 'FF16A34A' }, bold: true };
            else if (val < 0) cell.font = { color: { argb: 'FFDC2626' }, bold: true };
          }
          if (col.header === 'TACoS') {
            const val = cell.value;
            if (val > 0.2) cell.font = { color: { argb: 'FFDC2626' }, bold: true };
            else if (val > 0.1) cell.font = { color: { argb: 'FFD97706' }, bold: true };
            else cell.font = { color: { argb: 'FF16A34A' }, bold: true };
          }
        });
      });

      sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
      const buf = await workbook.xlsx.writeBuffer();
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=advertising_export.xlsx');
      res.send(buf);
    } else {
      const ws = XLSX.utils.json_to_sheet(exportData.map(d => {
        const flat = { ...d };
        ['TACoS', 'ACoS', 'SP ACoS', 'SB ACoS'].forEach(key => flat[key] = (flat[key] * 100).toFixed(2) + '%');
        return flat;
      }));
      const csv = XLSX.utils.sheet_to_csv(ws);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=advertising_export.csv');
      res.send(csv);
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/ad-breakdown/:asin', (req, res) => {
  const { asin } = req.params;
  const query = `
    SELECT 
      c.campaign,
      c.ad_group,
      SUM(c.spend) as spend,
      SUM(c.sales) as sales,
      SUM(c.orders) as orders,
      SUM(c.clicks) as clicks,
      cl.link
    FROM (
      SELECT campaign, ad_group, spend, sales, orders, clicks FROM sp_ads WHERE profile_id = ? AND asin = ?
      UNION ALL
      SELECT campaign, ad_group, spend, sales, orders, clicks FROM sb_ads WHERE profile_id = ? AND asin = ?
    ) c
    LEFT JOIN campaign_links cl ON c.campaign = cl.campaign_name AND cl.profile_id = ?
    GROUP BY c.campaign, c.ad_group
    HAVING spend > 0
    ORDER BY spend DESC
  `;
  try {
    const profileId = getActiveProfileId();
    const data = db.prepare(query).all(profileId, asin, profileId, asin, profileId);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/day-by-day/:asin', (req, res) => {
  const { asin } = req.params;
  const query = `
    SELECT 
      m.date,
      SUM(m.units) as units,
      SUM(m.returns) as returns,
      SUM(m.revenue) as revenue,
      SUM(m.royalties) as royalties,
      SUM(COALESCE(sp.spend, 0) + COALESCE(sb.spend, 0)) as spend,
      SUM(COALESCE(sp.sales, 0) + COALESCE(sb.sales, 0)) as ad_sales,
      SUM(COALESCE(sp.orders, 0) + COALESCE(sb.orders, 0)) as ad_orders
    FROM (SELECT asin, date, SUM(units) as units, SUM(returns) as returns, SUM(revenue) as revenue, SUM(royalties) as royalties FROM merch_sales WHERE profile_id = ? AND asin = ? GROUP BY date) m
    LEFT JOIN (SELECT asin, date, SUM(spend) as spend, SUM(sales) as sales, SUM(orders) as orders FROM sp_ads WHERE profile_id = ? AND asin = ? GROUP BY date) sp ON m.date = sp.date
    LEFT JOIN (SELECT asin, date, SUM(spend) as spend, SUM(sales) as sales, SUM(orders) as orders FROM sb_ads WHERE profile_id = ? AND asin = ? GROUP BY date) sb ON m.date = sb.date
    GROUP BY m.date
    ORDER BY m.date ASC
  `;
  try {
    const profileId = getActiveProfileId();
    const data = db.prepare(query).all(profileId, asin, profileId, asin, profileId, asin);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// --- Settings Routes ---
app.get('/api/settings/:key', (req, res) => {
  const { key } = req.params;
  try {
    const setting = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    res.json(setting ? JSON.parse(setting.value) : null);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/settings', (req, res) => {
  const { key, value } = req.body;
  try {
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, JSON.stringify(value));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
