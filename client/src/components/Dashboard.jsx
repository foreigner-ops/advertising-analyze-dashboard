import React, { useMemo, useState, useEffect, useRef } from 'react';
import { ArrowUpDown, Search, FileDown, Loader2, Filter, Plus, Trash2, X, Copy, Check, CheckCircle, Circle, ExternalLink, Settings, Edit2, Save, Folder } from 'lucide-react';
import { API_URL } from '../config';


function FilterModal({ activeFilters, setActiveFilters, onClose }) {
  const [filters, setFilters] = useState(activeFilters.length > 0 ? [...activeFilters] : [{ joiner: 'AND', field: 'total_revenue', operator: '>', value: '' }]);

  const fields = [
    { id: 'total_revenue', label: 'Revenue' },
    { id: 'total_units', label: 'Units Sold' },
    { id: 'product_type', label: 'Product Type' },
    { id: 'total_royalties', label: 'Royalties' },
    { id: 'total_spend', label: 'Total Ads Spend' },
    { id: 'tacos', label: 'TACoS (%)' },
    { id: 'acos', label: 'ACoS (%)' },
    { id: 'profit', label: 'Profit' },
    { id: 'organic_orders', label: 'Organic Orders' },
    { id: 'total_returns', label: 'Returns' },
    { id: 'avg_price', label: 'Avg. Price' },
    { id: 'total_ad_sales', label: 'Total Ads Sales' },
    { id: 'total_ad_orders', label: 'Total Ads Orders' },
    { id: 'sp_orders', label: 'SP Ads Orders' },
    { id: 'sp_sales', label: 'SP Ads Sales' },
    { id: 'sp_spend', label: 'SP Ads Spend' },
    { id: 'sp_acos', label: 'SP ACoS' },
    { id: 'sb_orders', label: 'SB Ads Orders' },
    { id: 'sb_sales', label: 'SB Ads Sales' },
    { id: 'sb_spend', label: 'SB Ads Spend' },
    { id: 'sb_acos', label: 'SB ACoS' }
  ];

  const operators = [
    { id: '>', label: 'Greater than' },
    { id: '<', label: 'Less than' },
    { id: '=', label: 'Equal to' },
    { id: '>=', label: 'Greater or equal' },
    { id: '<=', label: 'Less or equal' },
    { id: '!=', label: 'Not equal to' },
    { id: 'LIKE', label: 'Contains' }
  ];

  const addFilter = () => setFilters([...filters, { joiner: 'AND', field: 'total_revenue', operator: '>', value: '' }]);
  const removeFilter = (index) => setFilters(filters.filter((_, i) => i !== index));
  const updateFilter = (index, key, val) => {
    const newFilters = [...filters];
    newFilters[index][key] = val;
    setFilters(newFilters);
  };

  const apply = () => {
    const valid = filters.filter(f => f.value !== '');
    setActiveFilters(valid);
    onClose();
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.4)', zIndex: 1000,
      display: 'flex', justifyContent: 'center', alignItems: 'center'
    }}>
      <div className="glass-panel" style={{ width: '650px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', background: '#fff' }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid var(--grid-line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Advanced Filters</h3>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}><X size={20} /></button>
        </div>
        <div style={{ padding: '1rem', overflowY: 'auto', flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filters.map((f, i) => (
            <div key={i} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              {i > 0 ? (
                <select
                  style={{ width: '70px', height: '36px', borderRadius: '4px', border: '1px solid var(--grid-line)', fontWeight: 600 }}
                  value={f.joiner}
                  onChange={(e) => updateFilter(i, 'joiner', e.target.value)}
                >
                  <option value="AND">AND</option>
                  <option value="OR">OR</option>
                </select>
              ) : (
                <div style={{ width: '70px', textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>WHERE</div>
              )}

              <select
                className="btn btn-outline"
                style={{ flexGrow: 1, height: '36px' }}
                value={f.field}
                onChange={(e) => updateFilter(i, 'field', e.target.value)}
              >
                {fields.map(field => <option key={field.id} value={field.id}>{field.label}</option>)}
              </select>
              <select
                className="btn btn-outline"
                style={{ width: '130px', height: '36px' }}
                value={f.operator}
                onChange={(e) => updateFilter(i, 'operator', e.target.value)}
              >
                {operators.map(op => <option key={op.id} value={op.id}>{op.label}</option>)}
              </select>
              <input
                type={f.field === 'product_type' ? "text" : "number"}
                placeholder="Value..."
                className="btn btn-outline"
                style={{ width: '90px', height: '36px', padding: '0 0.5rem' }}
                value={f.value}
                onChange={(e) => updateFilter(i, 'value', e.target.value)}
              />
              <button
                onClick={() => removeFilter(i)}
                style={{ border: 'none', background: '#fee2e2', color: '#dc2626', padding: '8px', borderRadius: '4px', cursor: 'pointer' }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <button
            className="btn btn-outline"
            style={{ width: '100%', padding: '0.5rem', borderStyle: 'dashed', background: '#f8fafc' }}
            onClick={addFilter}
          >
            <Plus size={16} /> Add Condition
          </button>
        </div>
        <div style={{ padding: '1rem', borderTop: '1px solid var(--grid-line)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button className="btn btn-outline" onClick={() => { setActiveFilters([]); onClose(); }}>Clear All</button>
          <button className="btn btn-primary" onClick={apply}>Apply Filters</button>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ summary, columnConfig, formatCurrency, formatPercent }) {
  if (!summary) return null;

  const visibleCols = columnConfig.filter(c => c.visible);
  
  // Calculate relative metrics for summary
  const acos = summary.ad_sls > 0 ? (summary.spnd / summary.ad_sls) * 100 : 0;
  const tacos = summary.rev > 0 ? (summary.spnd / summary.rev) * 100 : 0;
  const spAcos = summary.sp_sls > 0 ? (summary.sp_spnd / summary.sp_sls) * 100 : 0;
  const sbAcos = summary.sb_sls > 0 ? (summary.sb_spnd / summary.sb_sls) * 100 : 0;
  const royPct = summary.rev > 0 ? (summary.roy / summary.rev) * 100 : 0;

  return (
    <tr style={{ background: '#f1f5f9', fontWeight: 700, position: 'sticky', bottom: 0, zIndex: 10, boxShadow: '0 -2px 10px rgba(0,0,0,0.05)' }}>
      {visibleCols.map((col, idx) => {
        const style = { textAlign: 'right', padding: '12px' };
        
        // Custom styles for specific groups
        if (col.id.startsWith('sp_')) style.background = '#e0f2fe';
        if (col.id.startsWith('sb_')) style.background = '#f0fdf4';
        if (['sp_orders', 'sb_orders'].includes(col.id)) style.borderLeft = '2px solid #e2e8f0';
        if (col.id === 'profit') style.background = '#e2e8f0';

        let content = null;
        switch(col.id) {
          case 'asin':
            return <td key={idx} style={{ textAlign: 'center', background: 'white', color: 'black' }}>TOTALS</td>;
          case 'total_units': content = summary.unts; break;
          case 'total_returns': content = summary.retrns; style.color = summary.retrns > 0 ? 'var(--danger-color)' : 'inherit'; break;
          case 'total_revenue': content = formatCurrency(summary.rev); break;
          case 'total_royalties': content = formatCurrency(summary.roy); break;
          case 'unit_royalty_percent': content = formatPercent(royPct); break;
          case 'organic_orders': content = summary.org_ord; break;
          case 'total_spend': content = formatCurrency(summary.spnd); style.color = 'var(--danger-color)'; break;
          case 'total_ad_sales': content = formatCurrency(summary.ad_sls); break;
          case 'total_ad_orders': content = summary.ad_ord; break;
          case 'tacos': 
            content = <span className={tacos > 20 ? 'metric-negative' : 'metric-positive'}>{formatPercent(tacos)}</span>;
            break;
          case 'acos': content = formatPercent(acos); break;
          case 'profit': content = formatCurrency(summary.prf); break;
          case 'sp_orders': content = summary.sp_ord; break;
          case 'sp_sales': content = formatCurrency(summary.sp_sls); break;
          case 'sp_spend': content = formatCurrency(summary.sp_spnd); break;
          case 'sp_acos': content = formatPercent(spAcos); break;
          case 'sb_orders': content = summary.sb_ord; break;
          case 'sb_sales': content = formatCurrency(summary.sb_sls); break;
          case 'sb_spend': content = formatCurrency(summary.sb_spnd); break;
          case 'sb_acos': content = formatPercent(sbAcos); break;
          default: content = '';
        }
        
        return <td key={idx} style={style}>{content}</td>;
      })}
    </tr>
  );
}

function AdBreakdownModal({ asin, title, onClose, formatCurrency, formatPercent, isPrivacyMode }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hideWithSales, setHideWithSales] = useState(false);

  useEffect(() => {
    const fetchBreakdown = async () => {
      try {
        const res = await fetch(`${API_URL}/ad-breakdown/${asin}`);
        const json = await res.json();

        setData(json);
      } catch (err) {
        console.error('Failed to fetch breakdown', err);
      } finally {
        setLoading(false);
      }
    };
    fetchBreakdown();
  }, [asin]);

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.6)', zIndex: 2000,
      display: 'flex', justifyContent: 'center', alignItems: 'center'
    }}>
      <div className="glass-panel" style={{ width: '1200px', maxWidth: '95vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column', background: '#fff', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--grid-line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(to bottom, #f8fafc, #fff)' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, background: 'var(--accent-color)', color: 'white', padding: '2px 6px', borderRadius: '4px' }}>ASIN Breakdown</span>
              <h3 className={isPrivacyMode ? 'privacy-blur' : ''} style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>{asin}</h3>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '600px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <a 
              href={`https://www.amazon.com/dp/${asin}`} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="btn btn-outline"
              style={{ fontSize: '0.8rem', height: '36px', textDecoration: 'none', color: 'var(--accent-color)', borderColor: 'var(--accent-color)' }}
            >
              Open on Amazon
            </a>
            <button onClick={onClose} style={{ border: 'none', background: '#f1f5f9', color: '#64748b', cursor: 'pointer', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center' }}><X size={20} /></button>
          </div>
        </div>
        
        <div style={{ padding: '1.5rem', overflowY: 'auto', overflowX: 'auto', flexGrow: 1 }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 0', gap: '1rem' }}>
              <Loader2 className="animate-spin" size={40} color="var(--accent-color)" />
              <div style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Loading campaign data...</div>
            </div>
          ) : data.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>No advertising data found for this ASIN.</div>
              <div style={{ fontSize: '0.9rem', opacity: 0.7 }}>This product might only have organic sales.</div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                <button 
                  className={`btn ${hideWithSales ? 'btn-primary' : 'btn-outline'}`}
                  style={{ height: '32px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                  onClick={() => setHideWithSales(!hideWithSales)}
                >
                  <Filter size={14} />
                  {hideWithSales ? 'Showing: 0 Sales Only' : 'Filter: Hide Sales > 0'}
                </button>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid var(--grid-line)' }}>
                  <th style={{ textAlign: 'left', padding: '12px', fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b' }}>Campaign / Ad Group</th>
                  <th style={{ textAlign: 'right', padding: '12px', fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b' }}>Spend</th>
                  <th style={{ textAlign: 'right', padding: '12px', fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b' }}>Sales</th>
                  <th style={{ textAlign: 'right', padding: '12px', fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b' }}>Clicks</th>
                  <th style={{ textAlign: 'right', padding: '12px', fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b' }}>Orders</th>
                  <th style={{ textAlign: 'right', padding: '12px', fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b' }}>ACoS</th>
                </tr>
              </thead>
              <tbody>
                {data
                  .filter(row => !hideWithSales || row.sales <= 0)
                  .map((row, i) => {
                  const acos = row.sales > 0 ? (row.spend / row.sales) * 100 : 0;
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid var(--grid-line)', transition: 'background 0.2s' }}>
                      <td style={{ padding: '14px 12px' }}>
                        {row.link ? (
                          <a 
                            href={row.link} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            style={{ 
                              fontWeight: 700, 
                              color: 'var(--accent-color)', 
                              fontSize: '0.9rem', 
                              textDecoration: 'none', 
                              display: 'inline-flex', 
                              alignItems: 'center', 
                              gap: '4px' 
                            }}
                            onMouseOver={(e) => e.currentTarget.style.textDecoration = 'underline'}
                            onMouseOut={(e) => e.currentTarget.style.textDecoration = 'none'}
                          >
                            <span className={isPrivacyMode ? 'privacy-blur' : ''}>{row.campaign || 'N/A'}</span>
                            <ExternalLink size={12} />
                          </a>
                        ) : (
                          <div className={isPrivacyMode ? 'privacy-blur' : ''} style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{row.campaign || 'N/A'}</div>
                        )}
                        <div className={isPrivacyMode ? 'privacy-blur' : ''} style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{row.ad_group || 'N/A'}</div>
                      </td>
                      <td style={{ textAlign: 'right', padding: '12px', fontWeight: 600, color: 'var(--danger-color)' }}>{formatCurrency(row.spend)}</td>
                      <td style={{ textAlign: 'right', padding: '12px', fontWeight: 600 }}>{formatCurrency(row.sales)}</td>
                      <td style={{ textAlign: 'right', padding: '12px' }}>{row.clicks}</td>
                      <td style={{ textAlign: 'right', padding: '12px' }}>{row.orders}</td>
                      <td style={{ textAlign: 'right', padding: '12px' }}>
                        <span className={acos > 30 ? 'metric-negative' : 'metric-positive'} style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                          {formatPercent(acos)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
          )}
        </div>
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--grid-line)', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' }}>
          <button className="btn btn-primary" onClick={onClose} style={{ padding: '0.5rem 1.5rem' }}>Close Breakdown</button>
        </div>
      </div>
    </div>
  );
}

function Dashboard({ currentProfile, isPrivacyMode, columnConfig }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState('');
  const [exportFormat, setExportFormat] = useState('csv');
  const [sortField, setSortField] = useState('total_revenue');
  const [sortOrder, setSortOrder] = useState('DESC');
  const [activeFilters, setActiveFilters] = useState([]);
  const [summary, setSummary] = useState(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedAsinForBreakdown, setSelectedAsinForBreakdown] = useState(null); // { asin, title }
  const [copyingStatus, setCopyingStatus] = useState('idle'); // idle, copying, success

  const containerRef = useRef(null);
  const limit = 50;

  const [loadingType, setLoadingType] = useState('sort'); // 'sort' or 'scroll'

  const fetchData = async (reset = false) => {
    if (loading) return;
    setLoading(true);
    setLoadingType(reset ? 'sort' : 'scroll');
    const currentOffset = reset ? 0 : offset;
    try {
      const filterParam = activeFilters.length > 0 ? `&filters=${encodeURIComponent(JSON.stringify(activeFilters))}` : '';
      const res = await fetch(`${API_URL}/tacos?limit=${limit}&offset=${currentOffset}&search=${search}&sortField=${sortField}&sortOrder=${sortOrder}${filterParam}`);
      const json = await res.json();


      if (reset) {
        setData(json);
        setOffset(limit);
        setHasMore(json.length >= limit); // Correctly set hasMore based on first batch
        if (containerRef.current) containerRef.current.scrollTop = 0;
      } else {
        setData(prev => [...prev, ...json]);
        setOffset(prev => prev + limit);
        if (json.length < limit) setHasMore(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const filterParam = activeFilters.length > 0 ? `&filters=${encodeURIComponent(JSON.stringify(activeFilters))}` : '';
      const res = await fetch(`${API_URL}/summary?search=${search}${filterParam}`);
      const json = await res.json();

      setSummary(json);
    } catch (err) {
      console.error('Summary fetch failed', err);
    }
  };

  useEffect(() => {
    fetchData(true);
    fetchSummary();
  }, [search, sortField, sortOrder, activeFilters, currentProfile]);

  const handleSort = (field) => {
    if (loading) return; // Prevent sorting while already loading
    if (sortField === field) {
      setSortOrder(prev => (prev === 'DESC' ? 'ASC' : 'DESC'));
    } else {
      setSortField(field);
      setSortOrder('DESC');
    }
  };

  const SortHeader = ({ field, label, style = {} }) => (
    <th
      onClick={() => handleSort(field)}
      style={{ cursor: loading ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', ...style }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', opacity: loading ? 0.5 : 1 }}>
        {label}
        <ArrowUpDown size={12} opacity={sortField === field ? 1 : 0.3} color={sortField === field ? 'var(--accent-color)' : 'currentColor'} />
      </div>
    </th>
  );

  const handleExport = () => {
    const filterParam = activeFilters.length > 0 ? `&filters=${encodeURIComponent(JSON.stringify(activeFilters))}` : '';
    window.open(`${API_URL}/export?search=${search}&format=${exportFormat}${filterParam}`, '_blank');
  };


  const handleCopyToClipboard = async () => {
    if (copyingStatus !== 'idle') return;
    setCopyingStatus('copying');
    
    try {
      const filterParam = activeFilters.length > 0 ? `&filters=${encodeURIComponent(JSON.stringify(activeFilters))}` : '';
      const res = await fetch(`${API_URL}/export-raw?search=${search}${filterParam}`);
      const json = await res.json();

      
      if (json.length === 0) {
        alert("No data to copy.");
        setCopyingStatus('idle');
        return;
      }

      // Convert to TSV
      const headers = Object.keys(json[0]);
      const tsvContent = [
        headers.join('\t'),
        ...json.map(row => headers.map(h => {
          const val = row[h];
          // Format percentages specifically for spreadsheet software
          if (['TACoS', 'ACoS', 'SP ACoS', 'SB ACoS'].includes(h)) {
            return (val * 100).toFixed(2) + '%';
          }
          return val;
        }).join('\t'))
      ].join('\n');

      await navigator.clipboard.writeText(tsvContent);
      setCopyingStatus('success');
      setTimeout(() => setCopyingStatus('idle'), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
      alert('Failed to copy to clipboard.');
      setCopyingStatus('idle');
    }
  };

  const handleToggleStatus = async (asin, currentStatus) => {
    const newStatus = currentStatus === 1 ? 0 : 1;
    
    // Optimistic update
    setData(prev => prev.map(row => row.asin === asin ? { ...row, is_done: newStatus } : row));
    
    try {
      await fetch(`${API_URL}/update-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asin, is_done: newStatus })
      });

    } catch (err) {
      console.error('Failed to update status', err);
      // Rollback on failure
      setData(prev => prev.map(row => row.asin === asin ? { ...row, is_done: currentStatus } : row));
    }
  };

  const handleClear = async () => {
    if (!window.confirm("ARE YOU SURE? This will permanently delete all saved Merch and Ad data from the database.")) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/clear`, { method: 'POST' });
      if (res.ok) {

        alert('Database cleared successfully.');
        setData([]);
        setOffset(0);
        setHasMore(false);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to clear database.');
    } finally {
      setLoading(false);
    }
  };

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollHeight - scrollTop <= clientHeight + 200 && hasMore && !loading) {
      fetchData();
    }
  };

  const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val || 0);
  const formatPercent = (val) => `${(val || 0).toFixed(2)}%`;

  return (
    <div className="glass-panel" style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
      {showFilterModal && (
        <FilterModal
          activeFilters={activeFilters}
          setActiveFilters={setActiveFilters}
          onClose={() => setShowFilterModal(false)}
        />
      )}

      {selectedAsinForBreakdown && (
        <AdBreakdownModal
          asin={selectedAsinForBreakdown.asin}
          title={selectedAsinForBreakdown.title}
          onClose={() => setSelectedAsinForBreakdown(null)}
          formatCurrency={formatCurrency}
          formatPercent={formatPercent}
          isPrivacyMode={isPrivacyMode}
        />
      )}

      {loading && data.length > 0 && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(255,255,255,0.7)', zIndex: 100,
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          backdropFilter: 'blur(2px)'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <Loader2 className="animate-spin" size={48} color="var(--accent-color)" />
            <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{loadingType === 'sort' ? 'Sorting' : 'Loading'} Data...</div>
          </div>
        </div>
      )}

      <div style={{ padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', borderBottom: '1px solid var(--grid-line)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Performance Grid</h2>
            <div style={{ fontSize: '0.65rem', color: '#2563eb', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Folder size={10} /> {currentProfile?.name || 'Loading...'}
            </div>
          </div>
          <div className="btn btn-outline" style={{ padding: '0.2rem 0.5rem', height: '28px' }}>
            <Search size={14} />
            <input
              type="text"
              placeholder="Filter ASIN or Title..."
              style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.8rem', width: '200px' }}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            className={`btn ${activeFilters.length > 0 ? 'btn-primary' : 'btn-outline'}`}
            style={{ height: '30px', padding: '0 0.75rem', gap: '4px' }}
            onClick={() => setShowFilterModal(true)}
          >
            <Filter size={14} />
            Advanced {activeFilters.length > 0 && `(${activeFilters.length})`}
          </button>
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
            onClick={handleExport}
          >
            <FileDown size={14} /> Export All
          </button>

          <button
            className={`btn ${copyingStatus === 'success' ? 'btn-success' : 'btn-outline'}`}
            style={{ 
              height: '30px', 
              padding: '0 0.75rem',
              borderColor: copyingStatus === 'success' ? '#16a34a' : 'var(--grid-line)',
              background: copyingStatus === 'success' ? '#f0fdf4' : '#fff',
              color: copyingStatus === 'success' ? '#16a34a' : 'var(--text-primary)',
              minWidth: '160px'
            }}
            onClick={handleCopyToClipboard}
            disabled={copyingStatus === 'copying'}
          >
            {copyingStatus === 'copying' ? (
              <Loader2 size={14} className="animate-spin" />
            ) : copyingStatus === 'success' ? (
              <>
                <Check size={14} /> Copied to Clipboard
              </>
            ) : (
              <>
                <Copy size={14} /> Copy for Google Sheets
              </>
            )}
          </button>

          <button
            className="btn btn-outline"
            style={{ height: '30px', padding: '0 0.75rem', borderColor: 'var(--danger-color)', color: 'var(--danger-color)' }}
            onClick={handleClear}
          >
            Clear Table
          </button>
        </div>
      </div>

      <div className="table-container" onScroll={handleScroll} ref={containerRef}>
        <table>
          <thead>
            <tr>
              {columnConfig.filter(c => c.visible).map(col => {
                const style = {};
                if (col.id.startsWith('sp_')) Object.assign(style, { background: '#e0f2fe', color: '#0369a1' });
                if (col.id.startsWith('sb_')) Object.assign(style, { background: '#f0fdf4', color: '#15803d' });
                
                if (col.id === 'unit_royalty_percent') {
                  return <th key={col.id} style={style}>{col.label}</th>;
                }
                return <SortHeader key={col.id} field={col.id} label={col.label} style={style} />;
              })}
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

              return (
                <tr key={row.asin} style={{ opacity: row.is_done ? 0.6 : 1, transition: 'opacity 0.2s' }}>
                  {columnConfig.filter(c => c.visible).map(col => {
                    const style = { textAlign: 'right' };
                    if (col.id === 'asin') style.textAlign = 'left';
                    if (['sp_orders', 'sb_orders'].includes(col.id)) style.borderLeft = '2px solid #e2e8f0';
                    
                    let content = null;
                    switch(col.id) {
                      case 'asin':
                        return (
                          <td key={col.id} style={{ minWidth: '220px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleToggleStatus(row.asin, row.is_done); }}
                                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', color: row.is_done ? '#16a34a' : '#cbd5e1' }}
                              >
                                {row.is_done ? <CheckCircle size={18} /> : <Circle size={18} />}
                              </button>
                              <div style={{ flexGrow: 1 }}>
                                <div
                                  className={`asin-link ${isPrivacyMode ? 'privacy-blur' : ''}`}
                                  style={{ fontWeight: 600, color: 'var(--accent-color)', fontSize: '0.85rem', cursor: 'pointer', textDecoration: row.is_done ? 'line-through' : 'none' }}
                                  onClick={() => setSelectedAsinForBreakdown({ asin: row.asin, title: row.title })}
                                >
                                  {row.asin}
                                </div>
                                <div className={isPrivacyMode ? 'privacy-blur' : ''} style={{ 
                                  fontSize: '0.65rem', 
                                  color: 'var(--text-secondary)', 
                                  maxWidth: '200px', 
                                  overflow: 'hidden', 
                                  textOverflow: 'ellipsis',
                                  fontStyle: row.title === 'Unknown Title' ? 'italic' : 'normal',
                                  opacity: row.title === 'Unknown Title' ? 0.7 : 1
                                }}>
                                  {row.title}
                                </div>
                              </div>
                            </div>
                          </td>
                        );
                      case 'product_type': content = row.product_type || 'N/A'; style.fontSize = '0.75rem'; style.color = 'var(--text-secondary)'; break;
                      case 'avg_price': content = formatCurrency(row.avg_price); break;
                      case 'total_units': content = row.total_units; break;
                      case 'total_returns': content = row.total_returns; style.color = row.total_returns > 0 ? 'var(--danger-color)' : 'inherit'; break;
                      case 'total_revenue': content = formatCurrency(row.total_revenue); style.fontWeight = 700; break;
                      case 'total_royalties': content = formatCurrency(row.total_royalties); break;
                      case 'unit_royalty_percent': content = formatPercent(unitRoyaltyPercent); break;
                      case 'organic_orders': 
                        content = (
                          <>
                            <span style={{ fontWeight: 700 }}>{Math.max(0, organicOrders)}</span>
                            <span style={{ fontSize: '0.65rem', marginLeft: '4px', opacity: 0.5 }}>
                              ({row.total_units > 0 ? Math.max(0, (organicOrders / row.total_units) * 100).toFixed(0) : 0}%)
                            </span>
                          </>
                        );
                        break;
                      case 'total_spend': content = formatCurrency(row.total_spend); style.color = 'var(--danger-color)'; break;
                      case 'total_ad_sales': content = formatCurrency(row.total_ad_sales); break;
                      case 'total_ad_orders': content = row.total_ad_orders; break;
                      case 'tacos': 
                        content = <span className={tacos > 20 ? 'metric-negative' : 'metric-positive'}>{formatPercent(tacos)}</span>;
                        break;
                      case 'acos': content = formatPercent(acos); break;
                      case 'profit': 
                        content = <span className={profit > 0 ? 'metric-positive' : 'metric-negative'}>{formatCurrency(profit)}</span>;
                        style.background = '#f8fafc';
                        break;
                      case 'sp_orders': content = row.sp_orders; break;
                      case 'sp_sales': content = formatCurrency(row.sp_sales); break;
                      case 'sp_spend': content = formatCurrency(row.sp_spend); break;
                      case 'sp_acos': content = formatPercent(spAcos); break;
                      case 'sb_orders': content = row.sb_orders; break;
                      case 'sb_sales': content = formatCurrency(row.sb_sales); break;
                      case 'sb_spend': content = formatCurrency(row.sb_spend); break;
                      case 'sb_acos': content = formatPercent(sbAcos); break;
                      default: content = '';
                    }

                    return <td key={col.id} style={style}>{content}</td>;
                  })}
                </tr>
              );
            })}
          </tbody>
          <tfoot style={{ position: 'sticky', bottom: 0, zIndex: 10 }}>
            <SummaryRow summary={summary} columnConfig={columnConfig} formatCurrency={formatCurrency} formatPercent={formatPercent} />
          </tfoot>
        </table>
        {loading && <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--accent-color)', fontWeight: 600 }}>Loading Batch...</div>}
      </div>
    </div>
  );
}

export default Dashboard;
