import React, { useMemo, useState, useEffect, useRef } from 'react';
import { ArrowUpDown, Search, FileDown } from 'lucide-react';

function Dashboard({ onAsinClick }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState('');
  const [exportFormat, setExportFormat] = useState('csv');
  
  const containerRef = useRef(null);
  const limit = 50;

  const fetchData = async (reset = false) => {
    if (loading) return;
    setLoading(true);
    const currentOffset = reset ? 0 : offset;
    try {
      const res = await fetch(`http://localhost:3001/tacos?limit=${limit}&offset=${currentOffset}&search=${search}`);
      const json = await res.json();
      if (json.length < limit) setHasMore(false);
      if (reset) {
        setData(json);
        setOffset(limit);
        setHasMore(true);
      } else {
        setData(prev => [...prev, ...json]);
        setOffset(prev => prev + limit);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(true);
  }, [search]);

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollHeight - scrollTop <= clientHeight + 200 && hasMore && !loading) {
      fetchData();
    }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val || 0);
  const formatPercent = (val) => `${(val || 0).toFixed(2)}%`;

  return (
    <div className="glass-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', borderBottom: '1px solid var(--grid-line)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>Performance Grid</h2>
          <div className="btn btn-outline" style={{ padding: '0.2rem 0.5rem', height: '28px' }}>
            <Search size={14} />
            <input 
              type="text" 
              placeholder="Filter ASIN or Title..." 
              style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.8rem', width: '200px' }}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            {data.length} Items Listed
          </div>
          <div style={{ display: 'flex', background: '#fff', border: '1px solid var(--grid-line)', borderRadius: '4px', padding: '2px' }}>
            <button 
              className={`btn ${exportFormat === 'csv' ? 'btn-primary' : ''}`}
              style={{ height: '26px', padding: '0 0.5rem', border: 'none', fontSize: '0.7rem' }}
              onClick={() => setExportFormat('csv')}
            >CSV</button>
            <button 
              className={`btn ${exportFormat === 'xlsx' ? 'btn-primary' : ''}`}
              style={{ height: '26px', padding: '0 0.5rem', border: 'none', fontSize: '0.7rem' }}
              onClick={() => setExportFormat('xlsx')}
            >XLSX</button>
          </div>
          <button 
            className="btn btn-primary" 
            style={{ height: '30px', padding: '0 0.75rem' }}
            onClick={() => window.open(`http://localhost:3001/export?search=${search}&format=${exportFormat}`, '_blank')}
          >
            <FileDown size={14} /> Export All
          </button>
        </div>
      </div>

      <div className="table-container" onScroll={handleScroll}>
        <table>
          <thead>
            <tr>
              <th>Product (ASIN/Title)</th>
              <th>Portfolio</th>
              <th>Units</th>
              <th>Returns</th>
              <th>Revenue</th>
              <th>Royalties</th>
              <th>Royalties %</th>
              <th>Organic</th>
              <th>Ads Spend</th>
              <th>Ads Sales</th>
              <th>Ads Orders</th>
              <th>TACoS</th>
              <th>ACoS</th>
              <th>Profit</th>
              
              {/* SP Breakdown */}
              <th style={{ background: '#e0f2fe', color: '#0369a1' }}>SP Ads Orders</th>
              <th style={{ background: '#e0f2fe', color: '#0369a1' }}>SP Ads Sales</th>
              <th style={{ background: '#e0f2fe', color: '#0369a1' }}>SP Ads Spend</th>
              <th style={{ background: '#e0f2fe', color: '#0369a1' }}>SP ACoS</th>

              {/* SB Breakdown */}
              <th style={{ background: '#f0fdf4', color: '#15803d' }}>SB Ads Orders</th>
              <th style={{ background: '#f0fdf4', color: '#15803d' }}>SB Ads Sales</th>
              <th style={{ background: '#f0fdf4', color: '#15803d' }}>SB Ads Spend</th>
              <th style={{ background: '#f0fdf4', color: '#15803d' }}>SB ACoS</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => {
              const tacos = row.total_revenue > 0 ? (row.total_spend / row.total_revenue) * 100 : 0;
              const acos = row.total_ad_sales > 0 ? (row.total_spend / row.total_ad_sales) * 100 : 0;
              const unitRoyaltyPercent = row.total_revenue > 0 ? (row.total_royalties / row.total_revenue) * 100 : 0;
              const profit = row.total_royalties - row.total_spend;
              const organicOrders = row.total_units - (row.total_ad_orders || 0);
              
              const spAcos = row.sp_sales > 0 ? (row.sp_spend / row.sp_sales) * 100 : 0;
              const sbAcos = row.sb_sales > 0 ? (row.sb_spend / row.sb_sales) * 100 : 0;
              const sdAcos = row.sd_sales > 0 ? (row.sd_spend / row.sd_sales) * 100 : 0;

              return (
                <tr key={row.asin} onClick={() => onAsinClick(row.asin)} style={{ cursor: 'pointer' }}>
                  <td>
                    <div style={{ color: 'var(--accent-color)', fontSize: '0.8rem' }}>{row.asin}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {row.title}
                    </div>
                  </td>
                  <td><div style={{ fontSize: '0.75rem', opacity: 0.7 }}>{row.portfolio || '-'}</div></td>
                  <td style={{ textAlign: 'right' }}>{row.total_units}</td>
                  <td style={{ textAlign: 'right', color: row.total_returns > 0 ? 'var(--danger-color)' : 'inherit' }}>{row.total_returns}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatCurrency(row.total_revenue)}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(row.total_royalties)}</td>
                  <td style={{ textAlign: 'right' }}>{formatPercent(unitRoyaltyPercent)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <span style={{ fontWeight: 700 }}>{Math.max(0, organicOrders)}</span>
                    <span style={{ fontSize: '0.65rem', marginLeft: '4px', opacity: 0.5 }}>
                      ({row.total_units > 0 ? Math.max(0, (organicOrders / row.total_units) * 100).toFixed(0) : 0}%)
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', color: 'var(--danger-color)' }}>{formatCurrency(row.total_spend)}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(row.total_ad_sales)}</td>
                  <td style={{ textAlign: 'right' }}>{row.total_ad_orders}</td>
                  <td style={{ textAlign: 'right' }}>
                    <span className={tacos > 20 ? 'metric-negative' : 'metric-positive'}>
                      {formatPercent(tacos)}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>{formatPercent(acos)}</td>
                  <td style={{ textAlign: 'right', background: '#f8fafc' }}>
                    <span className={profit > 0 ? 'metric-positive' : 'metric-negative'}>
                      {formatCurrency(profit)}
                    </span>
                  </td>

                  {/* SP */}
                  <td style={{ textAlign: 'right', borderLeft: '2px solid #e2e8f0' }}>{row.sp_orders}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(row.sp_sales)}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(row.sp_spend)}</td>
                  <td style={{ textAlign: 'right' }}>{formatPercent(spAcos)}</td>

                  {/* SB */}
                  <td style={{ textAlign: 'right', borderLeft: '2px solid #e2e8f0' }}>{row.sb_orders}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(row.sb_sales)}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(row.sb_spend)}</td>
                  <td style={{ textAlign: 'right' }}>{formatPercent(sbAcos)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {loading && <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--accent-color)', fontWeight: 600 }}>Loading Batch...</div>}
      </div>
    </div>
  );
}

export default Dashboard;
