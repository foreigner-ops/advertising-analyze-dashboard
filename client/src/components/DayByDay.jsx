import React, { useState, useEffect } from 'react';
import { ArrowLeft, Calendar } from 'lucide-react';
import { API_URL } from '../config';


function DayByDay({ asin, onBack }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const res = await fetch(`${API_URL}/day-by-day/${asin}`);
        const json = await res.json();

        setData(Array.isArray(json) ? json : []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [asin]);

  const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  if (loading) return <div style={{ textAlign: 'center', padding: '5rem' }}>Loading Daily Data...</div>;

  return (
    <div className="glass-panel fade-in" style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <button className="btn btn-outline" onClick={onBack} title="Back to Dashboard">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 style={{ fontSize: '1.25rem' }}>Daily Breakdown: <span style={{ color: 'var(--accent-color)' }}>{asin}</span></h2>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Historic performance by date</div>
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Units</th>
              <th>Returns</th>
              <th>Royalties</th>
              <th>Ad Spend</th>
              <th>Organic</th>
              <th>TACOS</th>
              <th>Profit</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => {
              const tacos = row.revenue > 0 ? (row.spend / row.revenue) * 100 : 0;
              const profit = row.royalties - row.spend;
              const organicOrders = row.units - (row.ad_orders || 0);
              
              return (
                <tr key={idx}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Calendar size={14} color="var(--text-secondary)" />
                      {row.date}
                    </div>
                  </td>
                  <td>{row.units}</td>
                  <td style={{ color: row.returns > 0 ? 'var(--danger-color)' : 'inherit' }}>{row.returns}</td>
                  <td>{formatCurrency(row.royalties)}</td>
                  <td style={{ color: row.spend > 0 ? 'var(--danger-color)' : 'inherit' }}>
                    {formatCurrency(row.spend)}
                  </td>
                  <td>
                    {organicOrders < 0 && (
                      <span style={{ color: 'var(--danger-color)', marginRight: '4px', cursor: 'help' }} title="Negative organic orders usually mean ad attribution is at the Campaign level and including other products.">⚠️</span>
                    )}
                    {organicOrders}
                  </td>
                  <td>
                    <span className={tacos > 25 ? 'metric-negative' : 'metric-positive'}>
                      {tacos.toFixed(1)}%
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>
                    <span className={profit > 0 ? 'metric-positive' : 'metric-negative'}>
                      {formatCurrency(profit)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DayByDay;
