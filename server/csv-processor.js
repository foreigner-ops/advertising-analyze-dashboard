const fs = require('fs');
const csv = require('csv-parser');
const { db } = require('./database');
const { normalizeDate, normalizeAsin } = require('./utils');

let PROGRESS_TRACKER = null;

function setProgressTracker(tracker) {
  PROGRESS_TRACKER = tracker;
}

/**
 * Robust ASIN Hunter:
 * Scans all values in a row to find a valid Amazon ASIN (10 chars, starts with B0)
 * Useful when reports don't have standard "ASIN" headers.
 */
function huntAsin(row) {
  const values = Object.values(row);
  for (const val of values) {
    if (typeof val === 'string') {
      const match = val.trim().match(/^B0[A-Z0-9]{8}$/);
      if (match) return match[0];
    }
  }
  return null;
}

// --- Fuzzy Header Helper ---
function getMap(row, keywords, blacklist = []) {
  const headers = Object.keys(row);
  
  // 1. Try Exact Match first
  for (const key of keywords) {
    const found = headers.find(h => h.toLowerCase().trim() === key.toLowerCase().trim());
    if (found) return found;
  }

  // 2. Try Includes (excluding blacklisted terms)
  for (const key of keywords) {
    const found = headers.find(h => {
      const lowerH = h.toLowerCase();
      if (blacklist.some(b => lowerH.includes(b.toLowerCase()))) return false;
      return lowerH.includes(key.toLowerCase());
    });
    if (found) return found;
  }
  return null;
}

const MAPPINGS = {
  merch: {
    date: ['Date', 'Datum'],
    asin: ['ASIN', 'Ad ASIN'],
    marketplace: ['Marketplace', 'Marktplatz'],
    units: ['Units', 'Units Sold', 'Orders', 'Ordres', 'Ordered', 'Ordered Units', 'Quantity', 'Qty', 'Unit', 'Sold', 'Total Units', 'Anzahl', 'Stück', 'Einheiten', 'Ventes'],
    returns: ['Returns', 'Returned', 'Remissions', 'Refunds', 'Refund', 'Ret', 'Retoure', 'Remboursements'],
    revenue: ['Revenue', 'Sales', 'Umsatz', 'Verkäufe', 'Total Sales', 'Ventas'],
    royalties: ['Royalty', 'Royalties', 'Profit', 'Verdienst', 'Estimated Royalty', 'Redevance'],
    title: ['Title', 'Titel'],
    product_type: ['Product Type', 'Produkttyp']
  },
  ads: {
    date: ['Date', 'Datum'],
    asin: ['ASIN', 'Advertised ASIN', 'Ad ASIN', 'Attributed ASIN', 'Product ASIN', 'Purchased ASIN'],
    spend: ['Spend', 'Cost', 'Kosten'],
    sales: ['Sales', 'Revenue', 'Umsatz'],
    orders: ['Orders', 'Ordres', 'Purchases'],
    impressions: ['Impressions', 'Einblendungen'],
    clicks: ['Clicks', 'Klicks'],
    portfolio: ['Portfolio']
  }
};

async function processMerchSales(filePath) {
  const insert = db.prepare(`
    INSERT INTO merch_sales (date, asin, marketplace, units, returns, revenue, royalties, title, product_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction((rows) => {
    for (const row of rows) {
      insert.run(
        row.date, row.asin, row.marketplace, row.units, row.returns, 
        row.revenue, row.royalties, row.title, row.product_type
      );
    }
  });

  return new Promise((resolve, reject) => {
    const rows = [];
    let count = 0;
    let mappedHeaders = null;

    // Detect separator and handle BOM
    const rawContent = fs.readFileSync(filePath, 'utf8');
    const content = rawContent.replace(/^\ufeff/, ''); // Strip BOM
    const firstLine = content.split('\n')[0];
    
    let separator = ',';
    if (firstLine.includes('\t')) separator = '\t';
    else if (firstLine.includes(';')) separator = ';';
    
    console.log(`[Processor] File: ${filePath.split('/').pop()} | Detected Separator: ${JSON.stringify(separator)}`);

    fs.createReadStream(filePath)
      .pipe(csv({ separator }))
      .on('data', (data) => {
        // Strip BOM from keys if csv-parser didn't
        const cleanData = {};
        for (let key in data) {
          cleanData[key.replace(/^\ufeff/, '').trim()] = data[key];
        }

        const m = MAPPINGS.merch;
        
        if (!mappedHeaders) {
          mappedHeaders = {};
          mappedHeaders.date = getMap(cleanData, m.date);
          mappedHeaders.asin = getMap(cleanData, m.asin);
          mappedHeaders.marketplace = getMap(cleanData, m.marketplace);
          mappedHeaders.units = getMap(cleanData, m.units);
          mappedHeaders.returns = getMap(cleanData, m.returns);
          mappedHeaders.revenue = getMap(cleanData, m.revenue, ['acos', 'cost', 'spend']); // Avoid ACoS
          mappedHeaders.royalties = getMap(cleanData, m.royalties);
          mappedHeaders.title = getMap(cleanData, m.title);
          mappedHeaders.product_type = getMap(cleanData, m.product_type);
          
          console.log('[Merch] Final Header Map:', mappedHeaders);
          if (!mappedHeaders.units) {
            console.log('[Merch] WARNING: Units column not found! Available headers:', Object.keys(cleanData));
          }
        }

        const parseNum = (val, isInt = false) => {
          if (!val) return 0;
          // Remove thousands separators (dots if comma exists elsewhere, or dots followed by 3 digits)
          let clean = val.trim();
          if (clean.includes(',') && clean.includes('.')) {
            clean = clean.replace(/\./g, '').replace(',', '.');
          } else if (clean.includes(',')) {
            clean = clean.replace(',', '.');
          }
          const num = parseFloat(clean.replace(/[^0-9.-]+/g, ""));
          return isInt ? Math.round(num || 0) : (num || 0);
        };

        rows.push({
          date: normalizeDate(cleanData[mappedHeaders.date]),
          asin: normalizeAsin(cleanData[mappedHeaders.asin] || huntAsin(cleanData)),
          marketplace: cleanData[mappedHeaders.marketplace],
          units: parseNum(cleanData[mappedHeaders.units], true),
          returns: parseNum(cleanData[mappedHeaders.returns], true),
          revenue: parseNum(cleanData[mappedHeaders.revenue]),
          royalties: parseNum(cleanData[mappedHeaders.royalties]),
          title: cleanData[mappedHeaders.title],
          product_type: cleanData[mappedHeaders.product_type]
        });
        
        count++;
        if (PROGRESS_TRACKER) PROGRESS_TRACKER.merch = count;

        if (rows.length >= 1000) {
          transaction(rows.splice(0, rows.length));
        }
      })
      .on('end', () => {
        if (rows.length > 0) transaction(rows);
        resolve();
      })
      .on('error', reject);
  });
}

async function processAdReport(filePath, tableName) {
  const insert = db.prepare(`
    INSERT INTO ${tableName} (date, asin, spend, sales, orders, impressions, clicks, portfolio)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const type = tableName.split('_')[0]; // 'sp', 'sb'

  const transaction = db.transaction((rows) => {
    for (const row of rows) {
      insert.run(
        row.date, row.asin, row.spend, row.sales, row.orders, 
        row.impressions, row.clicks, row.portfolio
      );
    }
  });

  return new Promise((resolve, reject) => {
    const rows = [];
    let count = 0;
    let mappedHeaders = null;

    // Detect separator and handle BOM
    const rawContent = fs.readFileSync(filePath, 'utf8');
    const content = rawContent.replace(/^\ufeff/, ''); // Strip BOM
    const firstLine = content.split('\n')[0];
    
    let separator = ',';
    if (firstLine.includes('\t')) separator = '\t';
    else if (firstLine.includes(';')) separator = ';';

    fs.createReadStream(filePath)
      .pipe(csv({ separator }))
      .on('data', (data) => {
        // Strip BOM from keys
        const cleanData = {};
        for (let key in data) {
          cleanData[key.replace(/^\ufeff/, '').trim()] = data[key];
        }

        const m = MAPPINGS.ads;
        
        if (!mappedHeaders) {
          mappedHeaders = {};
          mappedHeaders.date = getMap(cleanData, m.date);
          mappedHeaders.asin = getMap(cleanData, m.asin);
          mappedHeaders.spend = getMap(cleanData, m.spend);
          mappedHeaders.sales = getMap(cleanData, m.sales, ['acos', 'cost', 'spend', 'rate']); // Avoid ACoS
          mappedHeaders.orders = getMap(cleanData, m.orders);
          mappedHeaders.impressions = getMap(cleanData, m.impressions);
          mappedHeaders.clicks = getMap(cleanData, m.clicks);
          mappedHeaders.portfolio = getMap(cleanData, m.portfolio);
          
          console.log(`[Ads:${tableName}] Final Header Map:`, mappedHeaders);
          if (!mappedHeaders.asin) {
            console.log(`[Ads:${tableName}] WARNING: ASIN column not found! Available headers:`, Object.keys(cleanData));
          }
        }

        const parseNum = (val, isInt = false) => {
          if (!val) return 0;
          let clean = val.trim();
          if (clean.includes(',') && clean.includes('.')) {
            clean = clean.replace(/\./g, '').replace(',', '.');
          } else if (clean.includes(',')) {
            clean = clean.replace(',', '.');
          }
          const num = parseFloat(clean.replace(/[^0-9.-]+/g, ""));
          return isInt ? Math.round(num || 0) : (num || 0);
        };

        const asin = normalizeAsin(cleanData[mappedHeaders.asin]) || huntAsin(cleanData);
        if (!asin) return;

        rows.push({
          date: normalizeDate(cleanData[mappedHeaders.date]),
          asin: asin,
          spend: parseNum(cleanData[mappedHeaders.spend]),
          sales: parseNum(cleanData[mappedHeaders.sales]),
          orders: parseNum(cleanData[mappedHeaders.orders], true),
          impressions: parseNum(cleanData[mappedHeaders.impressions], true),
          clicks: parseNum(cleanData[mappedHeaders.clicks], true),
          portfolio: cleanData[mappedHeaders.portfolio] || ''
        });

        count++;
        if (PROGRESS_TRACKER) PROGRESS_TRACKER[type] = count;

        if (rows.length >= 1000) {
          transaction(rows.splice(0, rows.length));
        }
      })
      .on('end', () => {
        if (rows.length > 0) transaction(rows);
        resolve();
      })
      .on('error', reject);
  });
}

function clearData() {
  db.prepare('DELETE FROM merch_sales').run();
  db.prepare('DELETE FROM sp_ads').run();
  db.prepare('DELETE FROM sb_ads').run();
}

module.exports = {
  processMerchSales,
  processAdReport,
  clearData,
  setProgressTracker
};
