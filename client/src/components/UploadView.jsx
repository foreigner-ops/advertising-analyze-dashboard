import React, { useState, useEffect, useRef } from 'react';
import { FileUp, CheckCircle, AlertCircle, Loader2, BarChart3 } from 'lucide-react';

function UploadView({ onUploadSuccess, setProcessing }) {
  const [files, setFiles] = useState({ merch: null, sp: null, sb: null, sd: null });
  const [status, setStatus] = useState('idle'); 
  const [progress, setProgress] = useState({ merch: 0, sp: 0, sb: 0, sd: 0, status: 'idle' });
  const pollingRef = useRef(null);

  const handleFileChange = (type, file) => {
    setFiles(prev => ({ ...prev, [type]: file }));
  };

  const startPolling = () => {
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch('http://localhost:3001/progress');
        const data = await res.json();
        setProgress(data);
        if (data.status === 'done' || data.status === 'error') {
          clearInterval(pollingRef.current);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 500);
  };

  const handleUpload = async () => {
    if (!files.merch) {
      alert('Merch Sales Report is required!');
      return;
    }

    setStatus('uploading');
    setProcessing(true);
    startPolling();

    const formData = new FormData();
    if (files.merch) formData.append('merch', files.merch);
    if (files.sp) formData.append('sp', files.sp);
    if (files.sb) formData.append('sb', files.sb);
    if (files.sd) formData.append('sd', files.sd);

    try {
      const res = await fetch('http://localhost:3001/upload', {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        setStatus('success');
        setTimeout(() => {
          setProcessing(false);
          onUploadSuccess();
        }, 1500);
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
        {label} {type === 'merch' && <span style={{ color: 'var(--danger-color)' }}>*</span>}
      </label>
      <div className="glass-panel" style={{ position: 'relative', height: '40px', background: '#fefefe' }}>
        <input 
          type="file" 
          accept=".csv"
          onChange={(e) => handleFileChange(type, e.target.files[0])}
          style={{ width: '100%', height: '100%', opacity: 0, position: 'absolute', cursor: 'pointer', zIndex: 10 }}
        />
        <div style={{ height: '100%', padding: '0 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FileUp size={14} color={file ? 'var(--success-color)' : 'var(--text-secondary)'} />
          <span style={{ fontSize: '0.8rem', color: file ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
            {file ? file.name : 'Select CSV file...'}
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
          <div style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f1f5f9', borderRadius: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.5rem', fontWeight: 600 }}>
              <span>Status: {progress.status === 'processing' ? 'Ingesting Rows...' : 'Preparing...'}</span>
              <span style={{ color: 'var(--accent-color)' }}>{progress.merch + progress.sp + progress.sb} Total Rows</span>
            </div>
            <div className="progress-container">
              <div className="progress-bar" style={{ width: status === 'uploading' ? '100%' : '0%', animation: status==='uploading' ? 'none' : 'none' }}></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', fontSize: '0.7rem', textAlign: 'center' }}>
              <div>Sales: {progress.merch}</div>
              <div>SP: {progress.sp}</div>
              <div>SB: {progress.sb}</div>
            </div>
          </div>
        )}

        <button 
          className="btn btn-primary" 
          style={{ width: '100%', height: '45px', justifyContent: 'center', fontSize: '1rem' }}
          onClick={handleUpload}
          disabled={status === 'uploading'}
        >
          {status === 'uploading' ? <><Loader2 className="animate-spin" size={18} /> Processing...</> : 'Import & Analyze'}
        </button>

        {status === 'success' && (
          <div style={{ color: 'var(--success-color)', textAlign: 'center', marginTop: '1rem', fontWeight: 600 }}>
            🎉 Import Complete! Loading Dashboard...
          </div>
        )}
      </div>
    </div>
  );
}

export default UploadView;
