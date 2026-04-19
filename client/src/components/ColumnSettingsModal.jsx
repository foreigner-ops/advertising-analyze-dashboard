import React, { useState } from 'react';
import { X, ArrowUp, ArrowDown, RotateCcw, Check } from 'lucide-react';

const DEFAULT_COLUMNS = [
  { id: 'asin', label: 'Product (ASIN/Title)', visible: true },
  { id: 'product_type', label: 'Product Type', visible: true },
  { id: 'avg_price', label: 'Avg. Price', visible: true },
  { id: 'total_units', label: 'Units', visible: true },
  { id: 'total_returns', label: 'Returns', visible: true },
  { id: 'total_revenue', label: 'Revenue', visible: true },
  { id: 'total_royalties', label: 'Royalties', visible: true },
  { id: 'unit_royalty_percent', label: 'Royalties %', visible: true },
  { id: 'organic_orders', label: 'Organic', visible: true },
  { id: 'total_spend', label: 'Ads Spend', visible: true },
  { id: 'total_ad_sales', label: 'Ads Sales', visible: true },
  { id: 'total_ad_orders', label: 'Ads Orders', visible: true },
  { id: 'tacos', label: 'TACoS', visible: true },
  { id: 'acos', label: 'ACoS', visible: true },
  { id: 'profit', label: 'Profit', visible: true },
  { id: 'sp_orders', label: 'SP Orders', visible: true },
  { id: 'sp_sales', label: 'SP Sales', visible: true },
  { id: 'sp_spend', label: 'SP Spend', visible: true },
  { id: 'sp_acos', label: 'SP ACoS', visible: true },
  { id: 'sb_orders', label: 'SB Orders', visible: true },
  { id: 'sb_sales', label: 'SB Sales', visible: true },
  { id: 'sb_spend', label: 'SB Spend', visible: true },
  { id: 'sb_acos', label: 'SB ACoS', visible: true }
];

export { DEFAULT_COLUMNS };

function ColumnSettingsModal({ config, onSave, onClose }) {
  const [columns, setColumns] = useState(config || DEFAULT_COLUMNS);

  const toggleVisibility = (id) => {
    setColumns(prev => prev.map(col => 
      col.id === id ? { ...col, visible: !col.visible } : col
    ));
  };

  const moveColumn = (index, direction) => {
    const newColumns = [...columns];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newColumns.length) return;
    
    const [movedItem] = newColumns.splice(index, 1);
    newColumns.splice(targetIndex, 0, movedItem);
    setColumns(newColumns);
  };

  const handleReset = () => {
    if (window.confirm("Reset all column settings to default?")) {
      setColumns(DEFAULT_COLUMNS);
    }
  };

  const handleApply = () => {
    onSave(columns);
    onClose();
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', zIndex: 4000,
      display: 'flex', justifyContent: 'center', alignItems: 'center'
    }}>
      <div className="glass-panel" style={{ width: '550px', maxHeight: '85vh', background: '#fff', padding: '1.5rem', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            Column Settings
          </h3>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }}><X size={20} /></button>
        </div>

        <div style={{ flexGrow: 1, overflowY: 'auto', marginBottom: '1.5rem', border: '1px solid var(--grid-line)', borderRadius: '8px' }}>
          {columns.map((col, index) => (
            <div key={col.id} style={{ 
              padding: '10px 12px', 
              borderBottom: '1px solid var(--grid-line)', 
              display: 'flex', 
              alignItems: 'center',
              gap: '12px',
              background: col.visible ? 'transparent' : '#f8fafc',
              opacity: col.visible ? 1 : 0.7
            }}>
              <input 
                type="checkbox" 
                checked={col.visible} 
                onChange={() => toggleVisibility(col.id)}
                style={{ cursor: 'pointer', width: '16px', height: '16px' }}
              />
              <span style={{ flexGrow: 1, fontWeight: col.visible ? 600 : 400, fontSize: '0.9rem' }}>
                {col.label}
              </span>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button 
                  className="btn btn-outline" 
                  style={{ padding: '4px', height: '28px', width: '28px', opacity: index === 0 ? 0.3 : 1 }}
                  disabled={index === 0}
                  onClick={() => moveColumn(index, -1)}
                >
                  <ArrowUp size={14} />
                </button>
                <button 
                  className="btn btn-outline" 
                  style={{ padding: '4px', height: '28px', width: '28px', opacity: index === columns.length - 1 ? 0.3 : 1 }}
                  disabled={index === columns.length - 1}
                  onClick={() => moveColumn(index, 1)}
                >
                  <ArrowDown size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button 
            className="btn btn-outline" 
            style={{ color: '#dc2626', borderColor: '#fecaca', gap: '6px' }}
            onClick={handleReset}
          >
            <RotateCcw size={16} /> Reset Default
          </button>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleApply} style={{ gap: '6px' }}>
              <Check size={16} /> Apply Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ColumnSettingsModal;
