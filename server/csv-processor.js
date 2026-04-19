const fs = require('fs');
const csv = require('csv-parser');
const XLSX = require('xlsx');
const { db } = require('./database');
const { normalizeDate, normalizeAsin } = require('./utils');

let PROGRESS_TRACKER = null;

function setProgressTracker(tracker) {
  PROGRESS_TRACKER = tracker;
}

function isXlsx(filePath, originalName) {
  if (originalName && originalName.toLowerCase().endsWith('.xlsx')) return true;
  try {
    const buffer = Buffer.alloc(4);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 4, 0);
    fs.closeSync(fd);
    return buffer.toString('hex') === '504b0304'; // PK signature
  } catch (err) {
    return false;
  }
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
      // Look for ASIN anywhere in the string (not anchored to start/end)
      // Useful for finding ASINs embedded in Campaign Names
      const match = val.match(/B0[A-Z0-9]{8}/);
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
    units: ['Units', 'Units Sold', 'Orders', 'Ordres', 'Ordered', 'Ordered Units', 'Quantity', 'Qty', 'Unit', 'Sold', 'Total Units', 'Anzahl', 'Stück', 'Einheiten', 'Ventes', 'Orders Merch', 'Purchased'],
    returns: ['Returns', 'Returned', 'Remissions', 'Refunds', 'Refund', 'Ret', 'Retoure', 'Remboursements'],
    revenue: ['Revenue', 'Sales', 'Umsatz', 'Verkäufe', 'Total Sales', 'Ventas'],
    royalties: ['Royalty', 'Royalties', 'Profit', 'Verdienst', 'Estimated Royalty', 'Redevance'],
    title: ['Title', 'Titel'],
    product_type: ['Product Type', 'Produkttyp', 'Product-Type', 'ProductType', 'Type']
  },
  ads: {
    date: ['Date', 'Datum', 'Day', 'Start Date', 'Startdatum'],
    asin: ['ASIN', 'Advertised ASIN', 'Ad ASIN', 'Attributed ASIN', 'Product ASIN', 'Purchased ASIN', 'Amazon Standard Identification Number'],
    spend: ['Spend', 'Cost', 'Kosten', 'Ausgaben'],
    sales: [
      'Sales', 'Revenue', 'Umsatz', 'Total Sales', 'Attributed Sales', 
      '7 Day Total Sales', '14 Day Total Sales', '30 Day Total Sales',
      'Total Sales - (Click)', 'Attributed Sales - (Click)', '14 Day Total Sales - (Click)'
    ],
    orders: [
      'Orders', 'Ordres', 'Purchases', 'Total Orders', 'Attributed Orders', 
      '7 Day Total Orders', '14 Day Total Orders', '30 Day Total Orders',
      'Units Sold', 'Total Orders (#) - (Click)', 'Attributed Orders (#) - (Click)', '14 Day Total Orders (#) - (Click)'
    ],
    impressions: ['Impressions', 'Einblendungen', 'Impressionen'],
    clicks: ['Clicks', 'Klicks'],
    portfolio: ['Portfolio', 'Portfolio name', 'Portfolioname'],
    campaign: ['Campaign Name', 'Kampagnenname', 'Campaign', 'Kampagne', 'Kampagnen-Name'],
    ad_group: ['Ad Group Name', 'Anzeigengruppenname', 'Ad Group', 'Anzeigengruppe', 'Anzeigen-Gruppe']
  },
};async function processMerchSales(filePath, profileId, originalName) {
  const insert = db.prepare(`
    INSERT INTO merch_sales (profile_id, date, asin, marketplace, units, returns, revenue, royalties, title, product_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction((rows) => {
    for (const row of rows) {
      insert.run(
        profileId, row.date, row.asin, row.marketplace, row.units, row.returns, 
        row.revenue, row.royalties, row.title, row.product_type
      );
    }
  });

  const parseNum = (val, isInt = false) => {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return isInt ? Math.round(val) : val;
    let clean = String(val).trim();
    if (clean.includes(',') && clean.includes('.')) {
      clean = clean.replace(/\./g, '').replace(',', '.');
    } else if (clean.includes(',')) {
      clean = clean.replace(',', '.');
    }
    const num = parseFloat(clean.replace(/[^0-9.-]+/g, ""));
    return isInt ? Math.round(num || 0) : (num || 0);
  };

  const processRow = (cleanData, mappedHeaders) => {
    return {
      date: normalizeDate(cleanData[mappedHeaders.date]),
      asin: normalizeAsin(cleanData[mappedHeaders.asin] || huntAsin(cleanData)),
      marketplace: cleanData[mappedHeaders.marketplace],
      units: parseNum(cleanData[mappedHeaders.units], true),
      returns: parseNum(cleanData[mappedHeaders.returns], true),
      revenue: parseNum(cleanData[mappedHeaders.revenue]),
      royalties: parseNum(cleanData[mappedHeaders.royalties]),
      title: cleanData[mappedHeaders.title],
      product_type: cleanData[mappedHeaders.product_type]
    };
  };

  if (isXlsx(filePath, originalName)) {
    console.log(`[Processor:Merch] Processing XLSX: ${originalName}`);
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);
    if (data.length === 0) return;

    const m = MAPPINGS.merch;
    const mappedHeaders = {
      date: getMap(data[0], m.date),
      asin: getMap(data[0], m.asin),
      marketplace: getMap(data[0], m.marketplace),
      units: getMap(data[0], m.units),
      returns: getMap(data[0], m.returns),
      revenue: getMap(data[0], m.revenue, ['acos', 'cost', 'spend']),
      royalties: getMap(data[0], m.royalties),
      title: getMap(data[0], m.title),
      product_type: getMap(data[0], m.product_type)
    };

    const chunkSize = 2000;
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      const rows = chunk.map(row => processRow(row, mappedHeaders));
      transaction(rows);
      
      if (PROGRESS_TRACKER) PROGRESS_TRACKER.merch = Math.min(i + chunkSize, data.length);
      
      // Yield to event loop
      await new Promise(resolve => setImmediate(resolve));
    }
    return;
  }

  // --- CSV Logic ---
  const rows = [];
  let count = 0;
  let mappedHeaders = null;

  const rawContent = fs.readFileSync(filePath, 'utf8');
  const content = rawContent.replace(/^\ufeff/, '');
  const firstLine = content.split('\n')[0];
  let separator = firstLine.includes('\t') ? '\t' : (firstLine.includes(';') ? ';' : ',');
  
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath).pipe(csv({ separator }));
    stream.on('data', (data) => {
      const cleanData = {};
      for (let key in data) {
        const cleanKey = key.replace(/^\ufeff/, '').replace(/^["']|["']$/g, '').trim();
        cleanData[cleanKey] = data[key];
      }

      const m = MAPPINGS.merch;
      if (!mappedHeaders) {
        mappedHeaders = {
          date: getMap(cleanData, m.date),
          asin: getMap(cleanData, m.asin),
          marketplace: getMap(cleanData, m.marketplace),
          units: getMap(cleanData, m.units),
          returns: getMap(cleanData, m.returns),
          revenue: getMap(cleanData, m.revenue, ['acos', 'cost', 'spend']),
          royalties: getMap(cleanData, m.royalties),
          title: getMap(cleanData, m.title),
          product_type: getMap(cleanData, m.product_type)
        };
      }

      rows.push(processRow(cleanData, mappedHeaders));
      count++;
      if (PROGRESS_TRACKER) PROGRESS_TRACKER.merch = count;
      if (rows.length >= 1000) transaction(rows.splice(0, rows.length));
    });
    stream.on('end', () => {
      if (rows.length > 0) transaction(rows);
      resolve();
    });
    stream.on('error', reject);
  });
}

async function processAdReport(filePath, tableName, profileId, originalName) {
  const insert = db.prepare(`
    INSERT INTO ${tableName} (profile_id, date, asin, spend, sales, orders, impressions, clicks, portfolio, campaign, ad_group)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const type = tableName.split('_')[0]; // 'sp', 'sb'

  const transaction = db.transaction((rows) => {
    for (const row of rows) {
      insert.run(
        profileId, row.date, row.asin, row.spend, row.sales, row.orders, 
        row.impressions, row.clicks, row.portfolio, row.campaign, row.ad_group
      );
    }
  });

  const parseNum = (val, isInt = false) => {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return isInt ? Math.round(val) : val;
    let clean = String(val).trim();
    if (clean.includes(',') && clean.includes('.')) {
      clean = clean.replace(/\./g, '').replace(',', '.');
    } else if (clean.includes(',')) {
      clean = clean.replace(',', '.');
    }
    const num = parseFloat(clean.replace(/[^0-9.-]+/g, ""));
    return isInt ? Math.round(num || 0) : (num || 0);
  };

  const processRow = (cleanData, mappedHeaders) => {
    const asin = normalizeAsin(cleanData[mappedHeaders.asin] || huntAsin(cleanData));
    if (!asin) return null;
    return {
      date: normalizeDate(cleanData[mappedHeaders.date]),
      asin,
      spend: parseNum(cleanData[mappedHeaders.spend]),
      sales: parseNum(cleanData[mappedHeaders.sales]),
      orders: parseNum(cleanData[mappedHeaders.orders], true),
      impressions: parseNum(cleanData[mappedHeaders.impressions], true),
      clicks: parseNum(cleanData[mappedHeaders.clicks], true),
      portfolio: cleanData[mappedHeaders.portfolio] || '',
      campaign: cleanData[mappedHeaders.campaign] || '',
      ad_group: cleanData[mappedHeaders.ad_group] || ''
    };
  };

  if (isXlsx(filePath, originalName)) {
    console.log(`[Processor:${tableName}] Processing XLSX: ${originalName}`);
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);
    if (data.length === 0) return;

    const m = MAPPINGS.ads;
    const mappedHeaders = {
      date: getMap(data[0], m.date),
      asin: getMap(data[0], m.asin),
      spend: getMap(data[0], m.spend),
      sales: getMap(data[0], m.sales, ['acos', 'cost', 'spend', 'rate']),
      orders: getMap(data[0], m.orders),
      impressions: getMap(data[0], m.impressions),
      clicks: getMap(data[0], m.clicks),
      portfolio: getMap(data[0], m.portfolio),
      campaign: getMap(data[0], m.campaign),
      ad_group: getMap(data[0], m.ad_group)
    };

    const chunkSize = 2000;
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      const rows = chunk.map(row => processRow(row, mappedHeaders)).filter(r => r !== null);
      if (rows.length > 0) transaction(rows);
      
      if (PROGRESS_TRACKER) PROGRESS_TRACKER[type] = Math.min(i + chunkSize, data.length);
      
      // Yield to event loop
      await new Promise(resolve => setImmediate(resolve));
    }
    return;
  }

  // --- CSV Logic ---
  const rows = [];
  let count = 0;
  let mappedHeaders = null;

  const rawContent = fs.readFileSync(filePath, 'utf8');
  const content = rawContent.replace(/^\ufeff/, '');
  const firstLine = content.split('\n')[0];
  let separator = firstLine.includes('\t') ? '\t' : (firstLine.includes(';') ? ';' : ',');

  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath).pipe(csv({ separator }));
    stream.on('data', (data) => {
      const cleanData = {};
      for (let key in data) {
        const cleanKey = key.replace(/^\ufeff/, '').replace(/^["']|["']$/g, '').trim();
        cleanData[cleanKey] = data[key];
      }

      const m = MAPPINGS.ads;
      if (!mappedHeaders) {
        mappedHeaders = {
          date: getMap(cleanData, m.date),
          asin: getMap(cleanData, m.asin),
          spend: getMap(cleanData, m.spend),
          sales: getMap(cleanData, m.sales, ['acos', 'cost', 'spend', 'rate']),
          orders: getMap(cleanData, m.orders),
          impressions: getMap(cleanData, m.impressions),
          clicks: getMap(cleanData, m.clicks),
          portfolio: getMap(cleanData, m.portfolio),
          campaign: getMap(cleanData, m.campaign),
          ad_group: getMap(cleanData, m.ad_group)
        };
      }

      const processed = processRow(cleanData, mappedHeaders);
      if (processed) {
        rows.push(processed);
        count++;
        if (PROGRESS_TRACKER) PROGRESS_TRACKER[type] = count;
        if (rows.length >= 1000) transaction(rows.splice(0, rows.length));
      }
    });
    stream.on('end', () => {
      if (rows.length > 0) transaction(rows);
      resolve();
    });
    stream.on('error', reject);
  });
}

function clearData(profileId) {
  db.prepare('DELETE FROM merch_sales WHERE profile_id = ?').run(profileId);
  db.prepare('DELETE FROM sp_ads WHERE profile_id = ?').run(profileId);
  db.prepare('DELETE FROM sb_ads WHERE profile_id = ?').run(profileId);
  db.prepare('DELETE FROM campaign_links WHERE profile_id = ?').run(profileId);
  db.prepare('DELETE FROM asin_status WHERE profile_id = ?').run(profileId);
}



module.exports = {
  processMerchSales,
  processAdReport,
  clearData,
  setProgressTracker,
  isXlsx
};
