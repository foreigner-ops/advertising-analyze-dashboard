import React, { useState, useEffect, useRef } from 'react';
import { FileUp, CheckCircle, AlertCircle, Loader2, BarChart3 } from 'lucide-react';
import { API_URL } from '../config';


function UploadView({ onUploadSuccess, setProcessing }) {
  const [files, setFiles] = useState({ merch: null, sp: null, sb: null });
  const [status, setStatus] = useState('idle'); 
  const [newProfile, setNewProfile] = useState(null);
  const [progress, setProgress] = useState({ merch: 0, sp: 0, sb: 0, status: 'idle' });
  const pollingRef = useRef(null);

  const handleFileChange = (type, file) => {
    setFiles(prev => ({ ...prev, [type]: file }));
  };

  const startPolling = () => {
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/progress`);
        const data = await res.json();

        setProgress(data);
        if (data.status === 'done' || data.status === 'error') {
          clearInterval(pollingRef.current);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 200); // Faster polling for smoother updates
  };

  const handleClear = async () => {
    if (!window.confirm("ARE YOU SURE? This will permanently delete all saved Merch and Ad data from the database.")) return;
    
    setProcessing(true);
    try {
      const res = await fetch(`${API_URL}/clear`, { method: 'POST' });
      if (res.ok) {
        alert('Database cleared successfully.');

        setProgress({ merch: 0, sp: 0, sb: 0, status: 'idle' });
        setFiles({ merch: null, sp: null, sb: null });
        setStatus('idle');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to clear database.');
    } finally {
      setProcessing(false);
    }
  };

  const handleUpload = async () => {
    // Merch is no longer strictly required if appending data, 
    // but at least one file must be selected.
    if (!files.merch && !files.sp && !files.sb) {
      alert('Please select at least one report to import!');
      return;
    }

    setStatus('uploading');
    setProcessing(true);
    startPolling();

    const formData = new FormData();
    if (files.merch) formData.append('merch', files.merch);
    if (files.sp) formData.append('sp', files.sp);
    if (files.sb) formData.append('sb', files.sb);


    try {
      const res = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        setNewProfile(data.profile);
        setStatus('success');
        setTimeout(() => {
          setProcessing(false);
          onUploadSuccess();
        }, 2500); // Slightly longer to allow reading the message
      } else {
        setStatus('error');
        setProcessing(false);
      }
    } catch (err) {
      console.error(err);
      setStatus('error');
      setProcessing(false);
    }
  };

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const FileInput = ({ label, type, file }) => (
    <div style={{ marginBottom: '0.75rem' }}>
      <label style={{ display: 'block', marginBottom: '0.3rem', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600 }}>
        {label}
      </label>
      <div className="glass-panel" style={{ position: 'relative', height: '40px', background: '#fefefe' }}>
        <input 
          type="file" 
          accept=".csv,.xlsx"
          onChange={(e) => handleFileChange(type, e.target.files[0])}
          style={{ width: '100%', height: '100%', opacity: 0, position: 'absolute', cursor: 'pointer', zIndex: 10 }}
        />
        <div style={{ height: '100%', padding: '0 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FileUp size={14} color={file ? 'var(--success-color)' : 'var(--text-secondary)'} />
          <span style={{ fontSize: '0.8rem', color: file ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
            {file ? file.name : 'Select CSV or XLSX file...'}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fade-in" style={{ maxWidth: '800px', margin: '2rem auto', width: '100%' }}>
      <div className="glass-panel" style={{ padding: '2rem' }}>
        <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <BarChart3 size={24} color="var(--accent-color)" /> Data Import Center
        </h2>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <FileInput label="⬇️ Merch Sales Rep" type="merch" file={files.merch} />
          <FileInput label="⬇️ SP Prod Rep" type="sp" file={files.sp} />
          <FileInput label="⬇️ SB Camp Rep" type="sb" file={files.sb} />

        </div>

        {status === 'uploading' && (
          <div style={{ marginBottom: '1.5rem', padding: '1.5rem', background: '#f8fafc', borderRadius: '12px', border: '1px solid var(--grid-line)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '0.75rem', fontWeight: 700 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Loader2 className="animate-spin" size={16} color="var(--accent-color)" />
                {progress.status === 'processing' ? 'Ingesting Rows...' : 'Uploading Files...'}
              </span>
              <span style={{ color: 'var(--accent-color)', fontFamily: 'monospace' }}>
                {(progress.merch + progress.sp + progress.sb).toLocaleString()} Rows
              </span>
            </div>
            
            <div className="progress-container" style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden', marginBottom: '1rem' }}>
              <div 
                className="progress-bar" 
                style={{ 
                  width: status === 'uploading' ? '100%' : '0%', 
                  height: '100%',
                  background: 'linear-gradient(90deg, var(--accent-color), #6366f1)',
                  transition: 'width 0.5s ease-out'
                }}
              ></div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
              <div style={{ background: '#fff', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--grid-line)', textAlign: 'center' }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Merch</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{progress.merch.toLocaleString()}</div>
              </div>
              <div style={{ background: '#fff', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--grid-line)', textAlign: 'center' }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>SP Ads</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{progress.sp.toLocaleString()}</div>
              </div>
              <div style={{ background: '#fff', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--grid-line)', textAlign: 'center' }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>SB Ads</div>
                <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{progress.sb.toLocaleString()}</div>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button 
            className="btn btn-primary" 
            style={{ flex: 2, height: '45px', justifyContent: 'center', fontSize: '1rem' }}
            onClick={handleUpload}
            disabled={status === 'uploading'}
          >
            {status === 'uploading' ? <><Loader2 className="animate-spin" size={18} /> Processing...</> : 'Import & Analyze'}
          </button>
          
          <button 
            className="btn btn-outline" 
            style={{ flex: 1, height: '45px', justifyContent: 'center', borderColor: 'var(--danger-color)', color: 'var(--danger-color)' }}
            onClick={handleClear}
            disabled={status === 'uploading'}
          >
            Clear Database
          </button>
        </div>

        {status === 'success' && (
          <div style={{ textAlign: 'center', marginTop: '1.5rem', animation: 'fadeIn 0.5s ease-out' }}>
            <div style={{ color: 'var(--success-color)', fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.5rem' }}>
              🎉 Import Complete!
            </div>
            {newProfile && (
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Created new profile: <span style={{ color: 'var(--accent-color)', fontWeight: 600 }}>{newProfile.name}</span>
              </div>
            )}
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
              Redirecting to dashboard...
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default UploadView;
