const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const { initDb, db } = require('./database');
const { processMerchSales, processAdReport, clearData, setProgressTracker } = require('./csv-processor');

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

const upload = multer({ dest: 'uploads/' });

initDb();

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
    const { merch, sp, sb } = req.files;
    
    PROGRESS.merch = 0; PROGRESS.sp = 0; PROGRESS.sb = 0;
    PROGRESS.status = 'processing';
    
    clearData();

    if (merch) await processMerchSales(merch[0].path);
    if (sp) await processAdReport(sp[0].path, 'sp_ads');
    if (sb) await processAdReport(sb[0].path, 'sb_ads');

    PROGRESS.status = 'done';
    Object.values(req.files).flat().forEach(f => fs.unlinkSync(f.path));
    res.json({ message: 'Data processed successfully' });
  } catch (error) {
    console.error(error);
    PROGRESS.status = 'error';
    res.status(500).json({ error: error.message });
  }
});

app.get('/tacos', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const offset = parseInt(req.query.offset) || 0;
  const search = req.query.search || '';

  const query = `
    SELECT 
      m.asin,
      MAX(m.title) as title,
      SUM(m.units) as total_units,
      SUM(m.returns) as total_returns,
      SUM(m.revenue) as total_revenue,
      SUM(m.royalties) as total_royalties,
      
      -- Ad Type Breakdowns
      COALESCE(sp.spend, 0) as sp_spend, COALESCE(sp.sales, 0) as sp_sales, COALESCE(sp.orders, 0) as sp_orders,
      COALESCE(sb.spend, 0) as sb_spend, COALESCE(sb.sales, 0) as sb_sales, COALESCE(sb.orders, 0) as sb_orders,
      
      -- Unified Ad Metrics
      (COALESCE(sp.spend, 0) + COALESCE(sb.spend, 0)) as total_spend,
      (COALESCE(sp.sales, 0) + COALESCE(sb.sales, 0)) as total_ad_sales,
      (COALESCE(sp.orders, 0) + COALESCE(sb.orders, 0)) as total_ad_orders,
      
      MAX(COALESCE(sp.portfolio, sb.portfolio)) as portfolio
      
    FROM merch_sales m
    LEFT JOIN (SELECT asin, date, SUM(spend) as spend, SUM(sales) as sales, SUM(orders) as orders, MAX(portfolio) as portfolio FROM sp_ads GROUP BY asin, date) sp ON m.asin = sp.asin AND m.date = sp.date
    LEFT JOIN (SELECT asin, date, SUM(spend) as spend, SUM(sales) as sales, SUM(orders) as orders, MAX(portfolio) as portfolio FROM sb_ads GROUP BY asin, date) sb ON m.asin = sb.asin AND m.date = sb.date
    
    WHERE m.asin LIKE ? OR m.title LIKE ?
    GROUP BY m.asin
    ORDER BY total_revenue DESC
    LIMIT ? OFFSET ?
  `;

  try {
    const data = db.prepare(query).all(`%${search}%`, `%${search}%`, limit, offset);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/export', (req, res) => {
  const search = req.query.search || '';
  const format = req.query.format || 'csv';
  const query = `
    SELECT 
      m.asin, MAX(m.title) as title, MAX(COALESCE(sp.portfolio, sb.portfolio)) as portfolio,
      SUM(m.units) as units, SUM(m.returns) as returns, SUM(m.revenue) as revenue, SUM(m.royalties) as royalties,
      (COALESCE(sp.spend, 0) + COALESCE(sb.spend, 0)) as total_spend,
      (COALESCE(sp.sales, 0) + COALESCE(sb.sales, 0)) as total_ad_sales,
      (COALESCE(sp.orders, 0) + COALESCE(sb.orders, 0)) as total_ad_orders
    FROM merch_sales m
    LEFT JOIN (SELECT asin, date, SUM(spend) as spend, SUM(sales) as sales, SUM(orders) as orders, MAX(portfolio) as portfolio FROM sp_ads GROUP BY asin, date) sp ON m.asin = sp.asin AND m.date = sp.date
    LEFT JOIN (SELECT asin, date, SUM(spend) as spend, SUM(sales) as sales, SUM(orders) as orders, MAX(portfolio) as portfolio FROM sb_ads GROUP BY asin, date) sb ON m.asin = sb.asin AND m.date = sb.date
    WHERE m.asin LIKE ? OR m.title LIKE ?
    GROUP BY m.asin
    ORDER BY revenue DESC
  `;

  try {
    const data = db.prepare(query).all(`%${search}%`, `%${search}%`);
    
    const exportData = data.map(row => {
      const tacos = row.revenue > 0 ? (row.total_spend / row.revenue) : 0;
      const acos = row.total_ad_sales > 0 ? (row.total_spend / row.total_ad_sales) : 0;
      return {
        ASIN: row.asin,
        Title: row.title,
        Portfolio: row.portfolio || '-',
        Units: row.units,
        Returns: row.returns,
        Revenue: row.revenue,
        Royalties: row.royalties,
        "Ad Spend": row.total_spend,
        "Ad Sales": row.total_ad_sales,
        "Ad Orders": row.total_ad_orders,
        TACoS: (tacos * 100).toFixed(2) + '%',
        ACoS: (acos * 100).toFixed(2) + '%',
        Profit: (row.royalties - row.total_spend).toFixed(2)
      };
    });

    if (format === 'xlsx') {
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Performance");
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=shaggy_export.xlsx');
      res.send(buf);
    } else {
      const ws = XLSX.utils.json_to_sheet(exportData);
      const csv = XLSX.utils.sheet_to_csv(ws);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=shaggy_export.csv');
      res.send(csv);
    }
  } catch (error) {
    console.error(error);
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
      (COALESCE(sp.spend, 0) + COALESCE(sb.spend, 0)) as spend,
      (COALESCE(sp.sales, 0) + COALESCE(sb.sales, 0)) as ad_sales,
      (COALESCE(sp.orders, 0) + COALESCE(sb.orders, 0)) as ad_orders
    FROM merch_sales m
    LEFT JOIN (SELECT asin, date, SUM(spend) as spend, SUM(sales) as sales, SUM(orders) as orders FROM sp_ads GROUP BY asin, date) sp ON m.asin = sp.asin AND m.date = sp.date
    LEFT JOIN (SELECT asin, date, SUM(spend) as spend, SUM(sales) as sales, SUM(orders) as orders FROM sb_ads GROUP BY asin, date) sb ON m.asin = sb.asin AND m.date = sb.date
    WHERE m.asin = ?
    GROUP BY m.date
    ORDER BY m.date ASC
  `;
  try {
    const data = db.prepare(query).all(asin);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
