import React, { useState, useEffect } from 'react';
import UploadView from './components/UploadView';
import Dashboard from './components/Dashboard';
import DayByDay from './components/DayByDay';
import { LayoutDashboard, Upload, History, Loader2 } from 'lucide-react';

function App() {
  const [view, setView] = useState('upload'); // 'upload', 'dashboard', 'detail'
  const [selectedAsin, setSelectedAsin] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ merch: 0, sp: 0, sb: 0 });

  useEffect(() => {
    let interval;
    if (isProcessing) {
      interval = setInterval(async () => {
        try {
          const res = await fetch('http://localhost:3001/progress');
          const data = await res.json();
          setProgress(data);
          if (data.status === 'done' || data.status === 'error') {
            clearInterval(interval);
          }
        } catch (err) {
          console.error('Polling error:', err);
        }
      }, 500);
    }
    return () => clearInterval(interval);
  }, [isProcessing]);

  const fetchTacos = async () => {
    setView('dashboard');
  };

  const handleSelectAsin = (asin) => {
    setSelectedAsin(asin);
    setView('detail');
  };

  const totalRows = (progress.merch || 0) + (progress.sp || 0) + (progress.sb || 0) + (progress.sd || 0);

  return (
    <div className="container fade-in" style={{ height: 'calc(100vh - 40px)', display: 'flex', flexDirection: 'column' }}>
      {isProcessing && (
        <div className="loading-overlay">
          <Loader2 className="animate-spin" size={48} color="var(--accent-color)" style={{ marginBottom: '1rem' }} />
          <div className="title" style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
            Processing Data...
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent-color)' }}>
            {totalRows.toLocaleString()} Rows
          </div>
          <div style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            Indexing Merch & Ad Reports
          </div>
        </div>
      )}

      <header className="header" style={{ flexShrink: 0 }}>
        <h1 className="title">Shaggy Analyzer PRO</h1>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button 
            className={`btn ${view === 'upload' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setView('upload')}
          >
            <Upload size={18} /> Import
          </button>
          <button 
            className={`btn ${view === 'dashboard' ? 'btn-primary' : 'btn-outline'}`}
            onClick={fetchTacos}
          >
            <LayoutDashboard size={18} /> Dashboard
          </button>
        </div>
      </header>

      <main style={{ flexGrow: 1, overflow: 'hidden' }}>
        {view === 'upload' && (
          <UploadView setProcessing={setIsProcessing} onUploadSuccess={fetchTacos} />
        )}
        
        {view === 'dashboard' && (
          <Dashboard onAsinClick={handleSelectAsin} />
        )}

        {view === 'detail' && (
          <DayByDay asin={selectedAsin} onBack={() => setView('dashboard')} />
        )}
      </main>
    </div>
  );
}

export default App;
