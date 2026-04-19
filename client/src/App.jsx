import React, { useState, useEffect } from 'react';
import UploadView from './components/UploadView';
import Dashboard from './components/Dashboard';
import DayByDay from './components/DayByDay';
import { LayoutDashboard, Upload, History, Loader2, Settings, Folder, X, Save, CheckCircle, Edit2, Trash2, Plus, Eye, EyeOff } from 'lucide-react';
import ColumnSettingsModal, { DEFAULT_COLUMNS } from './components/ColumnSettingsModal';
import { API_URL } from './config';


function ProfileManagementModal({ onClose, profiles, onActivate, onSave, onRename, onDelete }) {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', zIndex: 3000,
      display: 'flex', justifyContent: 'center', alignItems: 'center'
    }}>
      <div className="glass-panel" style={{ width: '500px', background: '#fff', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Folder size={20} color="var(--accent-color)" />
            Manage Profiles
          </h3>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}><X size={20} /></button>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <input 
            className="btn btn-outline" 
            style={{ flexGrow: 1, height: '36px', padding: '0 10px' }} 
            placeholder="Save current view as..." 
            value={newName}
            onChange={e => setNewName(e.target.value)}
          />
          <button 
            className={`btn ${newName ? 'btn-primary' : 'btn-outline'}`}
            style={{ height: '36px' }}
            onClick={() => { if(newName) { onSave(newName); setNewName(''); } }}
          >
            <Save size={16} /> Save
          </button>
        </div>

        <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--grid-line)', borderRadius: '8px' }}>
          {profiles.map(p => (
            <div key={p.id} style={{ 
              padding: '12px', 
              borderBottom: '1px solid var(--grid-line)', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              background: p.is_active ? '#eff6ff' : 'transparent'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {p.is_active && <CheckCircle size={16} color="#2563eb" />}
                  {editingId === p.id ? (
                    <input 
                      style={{ border: '1px solid #2563eb', outline: 'none', padding: '2px 4px', borderRadius: '4px' }} 
                      value={editValue} 
                      onChange={e => setEditValue(e.target.value)}
                      onBlur={() => { onRename(p.id, editValue); setEditingId(null); }}
                      onKeyDown={e => e.key === 'Enter' && (onRename(p.id, editValue), setEditingId(null))}
                      autoFocus
                    />
                  ) : (
                    <span style={{ fontWeight: p.is_active ? 700 : 500 }}>{p.name}</span>
                  )}
                </div>
                <div style={{ fontSize: '0.65rem', color: '#64748b', marginLeft: p.is_active ? '26px' : '0' }}>
                  {(p.row_count || 0).toLocaleString()} rows
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {!p.is_active && (
                  <button className="btn btn-outline" style={{ padding: '4px 8px', fontSize: '0.75rem', height: '28px' }} onClick={() => onActivate(p.id)}>Load</button>
                )}
                <button 
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b' }} 
                  onClick={() => { setEditingId(p.id); setEditValue(p.name); }}
                >
                  <Edit2 size={14} />
                </button>
                {profiles.length > 1 && (
                  <button 
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#ef4444' }} 
                    onClick={() => onDelete(p.id)}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function App() {
  const [view, setView] = useState(null); // 'upload', 'dashboard', null during check
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ merch: 0, sp: 0, sb: 0 });
  const [checking, setChecking] = useState(true);
  const [profiles, setProfiles] = useState([]);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [currentProfile, setCurrentProfile] = useState(null);
  const [isPrivacyMode, setIsPrivacyMode] = useState(false);
  const [columnConfig, setColumnConfig] = useState(DEFAULT_COLUMNS);
  const [showColumnModal, setShowColumnModal] = useState(false);

  useEffect(() => {
    const checkInitialData = async () => {
      try {
        const res = await fetch(`${API_URL}/tacos?limit=1`);
        const data = await res.json();

        if (data && data.length > 0) {
          setView('dashboard');
        } else {
          setView('upload');
        }
      } catch (err) {
        console.error('Check failed', err);
        setView('upload');
      } finally {
        setChecking(false);
      }
    };
    checkInitialData();
    fetchProfiles();
    fetchColumnConfig();
  }, []);

  const fetchColumnConfig = async () => {
    try {
      const res = await fetch(`${API_URL}/api/settings/column_config`);
      const json = await res.json();

      if (json) setColumnConfig(json);
    } catch (err) {
      console.error('Failed to fetch column config', err);
    }
  };

  const handleUpdateColumnConfig = async (newConfig) => {
    setColumnConfig(newConfig);
    try {
      await fetch(`${API_URL}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'column_config', value: newConfig })
      });

    } catch (err) {
      console.error('Failed to save column config', err);
    }
  };

  const fetchProfiles = async () => {
    try {
      const res = await fetch(`${API_URL}/api/profiles`);
      const json = await res.json();

      setProfiles(json);
      const active = json.find(p => p.is_active);
      setCurrentProfile(active);
    } catch (err) {
      console.error('Failed to fetch profiles', err);
    }
  };

  const handleSaveProfile = async (name) => {
    try {
      await fetch(`${API_URL}/api/profiles/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });

      fetchProfiles();
    } catch (err) {
      console.error(err);
    }
  };

  const handleActivateProfile = async (id) => {
    try {
      await fetch(`${API_URL}/api/profiles/${id}/activate`, { method: 'POST' });
      fetchProfiles();

    } catch (err) {
      console.error(err);
    }
  };

  const handleRenameProfile = async (id, name) => {
    try {
      await fetch(`${API_URL}/api/profiles/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });

      fetchProfiles();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteProfile = async (id) => {
    const p = profiles.find(x => x.id === id);
    if (!window.confirm(`Delete profile "${p.name}"? ALL DATA FOR THIS PROFILE WILL BE LOST.`)) return;
    try {
      const res = await fetch(`${API_URL}/api/profiles/${id}`, { method: 'DELETE' });
      if (res.ok) {

        fetchProfiles();
      } else {
        const errData = await res.json();
        alert(`Failed to delete profile: ${errData.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error(err);
      alert('Network error while deleting profile.');
    }
  };

  useEffect(() => {
    let interval;
    if (isProcessing) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`${API_URL}/progress`);
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
    await fetchProfiles();
    setView('dashboard');
  };

  const [displayRows, setDisplayRows] = useState(0);

  useEffect(() => {
    const total = (progress.merch || 0) + (progress.sp || 0) + (progress.sb || 0);
    if (total > displayRows) {
      const diff = total - displayRows;
      const step = Math.max(1, Math.floor(diff / 10));
      const timeout = setTimeout(() => {
        setDisplayRows(prev => Math.min(total, prev + step));
      }, 50);
      return () => clearTimeout(timeout);
    } else if (total < displayRows) {
      setDisplayRows(total);
    }
  }, [progress, displayRows]);

  return (
    <div className="container fade-in" style={{ height: 'calc(100vh - 40px)', display: 'flex', flexDirection: 'column' }}>
      {isProcessing && (
        <div className="loading-overlay">
          <Loader2 className="animate-spin" size={48} color="var(--accent-color)" style={{ marginBottom: '1rem' }} />
          <div className="title" style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
            Processing Data...
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent-color)', fontFamily: 'monospace', transition: 'all 0.2s ease' }}>
            {displayRows.toLocaleString()} Rows
          </div>
          <div style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            Indexing Merch & Ad Reports
          </div>
        </div>
      )}

      <header className="header" style={{ flexShrink: 0 }}>
        <h1 className="title">Advertising-Analyzer</h1>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            className="btn btn-outline"
            style={{ width: '40px', padding: 0, justifyContent: 'center' }}
            onClick={() => setShowColumnModal(true)}
            title="Column Settings"
          >
            <Settings size={18} />
          </button>
          <button
            className={`btn ${isPrivacyMode ? 'btn-primary' : 'btn-outline'}`}
            style={{ width: '40px', padding: 0, justifyContent: 'center' }}
            onClick={() => setIsPrivacyMode(!isPrivacyMode)}
            title={isPrivacyMode ? "Disable Privacy Mode" : "Enable Privacy Mode"}
          >
            {isPrivacyMode ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
          <button
            className="btn btn-outline"
            style={{ borderColor: 'var(--accent-color)', color: 'var(--accent-color)' }}
            onClick={() => setShowProfileModal(true)}
          >
            <Settings size={18} /> Profiles {currentProfile && `(${currentProfile.name})`}
          </button>
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
        {checking ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-secondary)' }}>
            <Loader2 className="animate-spin" size={32} style={{ opacity: 0.5 }} />
          </div>
        ) : (
          <>
            {view === 'upload' && (
              <UploadView setProcessing={setIsProcessing} onUploadSuccess={fetchTacos} />
            )}
            
            {view === 'dashboard' && (
              <Dashboard currentProfile={currentProfile} isPrivacyMode={isPrivacyMode} columnConfig={columnConfig} />
            )}

            {showColumnModal && (
              <ColumnSettingsModal 
                config={columnConfig} 
                onSave={handleUpdateColumnConfig} 
                onClose={() => setShowColumnModal(false)} 
              />
            )}

            {showProfileModal && (
              <ProfileManagementModal 
                onClose={() => setShowProfileModal(false)}
                profiles={profiles}
                onActivate={handleActivateProfile}
                onSave={handleSaveProfile}
                onRename={handleRenameProfile}
                onDelete={handleDeleteProfile}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;
