import React, { useState, useEffect, useCallback } from 'react';
import { 
  LayoutDashboard, 
  ClipboardList, 
  FileText, 
  Activity, 
  Database, 
  Clock, 
  RefreshCw, 
  Plus, 
  Trash2, 
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  X,
  Layers,
  Terminal,
  Settings
} from 'lucide-react';
import api, { Item, HealthStatus } from './services/api';
import './styles/theme.css';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'items' | 'docs'>('dashboard');
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [healthLoading, setHealthLoading] = useState<boolean>(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Form states
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newStatus, setNewStatus] = useState('pending');

  // Add toast helper
  const addToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Fetch backend health status
  const checkSystemHealth = useCallback(async (silent = false) => {
    if (!silent) setHealthLoading(true);
    try {
      const data = await api.getHealth();
      setHealth(data);
      if (!silent) addToast('System status synchronized', 'success');
    } catch (error) {
      setHealth(null);
      if (!silent) addToast('Failed to reach the backend service', 'error');
    } finally {
      if (!silent) setHealthLoading(false);
    }
  }, [addToast]);

  // Fetch Items
  const loadItems = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await api.getItems();
      setItems(data);
    } catch (error) {
      addToast('Failed to load database records', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [addToast]);

  // Initial load
  useEffect(() => {
    checkSystemHealth(true);
    loadItems(true);
    
    // Poll health check every 15 seconds
    const interval = setInterval(() => {
      checkSystemHealth(true);
    }, 15000);
    return () => clearInterval(interval);
  }, [checkSystemHealth, loadItems]);

  // Handle Form submit
  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      addToast('Title field is required', 'error');
      return;
    }
    
    try {
      const created = await api.createItem({
        title: newTitle,
        description: newDesc || undefined,
        status: newStatus
      });
      addToast(`Created item "${created.title}" successfully`, 'success');
      setNewTitle('');
      setNewDesc('');
      setNewStatus('pending');
      loadItems(true);
      checkSystemHealth(true);
    } catch (error) {
      addToast('Failed to submit item creation', 'error');
    }
  };

  // Handle Delete
  const handleDeleteItem = async (id: number) => {
    try {
      await api.deleteItem(id);
      addToast('Database item removed', 'success');
      loadItems(true);
      checkSystemHealth(true);
    } catch (error) {
      addToast('Failed to remove database item', 'error');
    }
  };

  // Handle item status change directly from table
  const toggleStatus = async (item: Item) => {
    const nextStatus = item.status === 'pending' 
      ? 'in-progress' 
      : item.status === 'in-progress' 
        ? 'completed' 
        : 'pending';
    
    try {
      await api.updateItem(item.id, { status: nextStatus });
      addToast(`Updated status to ${nextStatus}`, 'info');
      loadItems(true);
    } catch (error) {
      addToast('Failed to update status', 'error');
    }
  };

  return (
    <div className="app-container">
      {/* SIDEBAR NAVIGATION */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <Layers size={24} color="#00f0ff" />
          <span>STACKTEMPLATE</span>
        </div>
        
        <ul className="sidebar-menu">
          <li>
            <button 
              onClick={() => setActiveTab('dashboard')} 
              className={`sidebar-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            >
              <LayoutDashboard size={18} />
              <span>Dashboard</span>
            </button>
          </li>
          <li>
            <button 
              onClick={() => setActiveTab('items')} 
              className={`sidebar-item ${activeTab === 'items' ? 'active' : ''}`}
            >
              <ClipboardList size={18} />
              <span>Items Manager</span>
            </button>
          </li>
          <li>
            <button 
              onClick={() => setActiveTab('docs')} 
              className={`sidebar-item ${activeTab === 'docs' ? 'active' : ''}`}
            >
              <FileText size={18} />
              <span>API Explorer</span>
            </button>
          </li>
        </ul>

        <div className="sidebar-footer">
          <p>Version 1.0.0</p>
          <p style={{ marginTop: '0.2rem', opacity: 0.5 }}>FastAPI + React</p>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="main-content">
        {/* HEADER SECTION */}
        <header className="flex-row-between" style={{ marginBottom: '2rem' }}>
          <div>
            <h1>
              {activeTab === 'dashboard' && 'Developer Dashboard'}
              {activeTab === 'items' && 'Database Items Manager'}
              {activeTab === 'docs' && 'API Documentation'}
            </h1>
            <p className="subtitle" style={{ margin: 0 }}>
              {activeTab === 'dashboard' && 'Monitor health diagnostics, database metrics, and boilerplate tools.'}
              {activeTab === 'items' && 'Perform full CREATE, READ, UPDATE, and DELETE operations live.'}
              {activeTab === 'docs' && 'Access interactive Swagger documentation generated directly by FastAPI.'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            {/* System Status Pill */}
            {health ? (
              <span className="status-pill online">
                <span className="status-indicator pulse-indicator"></span>
                API Connected
              </span>
            ) : (
              <span className="status-pill offline">
                <span className="status-indicator"></span>
                API Offline
              </span>
            )}
            
            <button 
              onClick={() => {
                checkSystemHealth();
                loadItems(true);
              }} 
              disabled={healthLoading}
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', gap: '0.5rem', height: '38px' }}
            >
              <RefreshCw size={14} className={healthLoading ? 'spin' : ''} />
              Refresh
            </button>
          </div>
        </header>

        {/* ----------------------------------------------------
            TAB CONTENT: DASHBOARD
        ---------------------------------------------------- */}
        {activeTab === 'dashboard' && (
          <div>
            {/* Metric Status Grid */}
            <div className="metrics-grid">
              {/* API CARD */}
              <div className="glass-card">
                <div className="metric-header">
                  <span>Backend Status</span>
                  <div className="metric-icon-wrapper secondary">
                    <Activity size={18} />
                  </div>
                </div>
                <div className="metric-value" style={{ color: health ? '#00f0ff' : 'var(--danger)' }}>
                  {health ? 'ONLINE' : 'OFFLINE'}
                </div>
                <div className="metric-desc">
                  FastAPI service at localhost:8000
                </div>
              </div>

              {/* DB CARD */}
              <div className="glass-card">
                <div className="metric-header">
                  <span>SQLite Database</span>
                  <div className="metric-icon-wrapper success">
                    <Database size={18} />
                  </div>
                </div>
                <div className="metric-value">
                  {health ? health.database.toUpperCase() : 'UNKNOWN'}
                </div>
                <div className="metric-desc">
                  SQLAlchemy engine initialized
                </div>
              </div>

              {/* COUNT CARD */}
              <div className="glass-card">
                <div className="metric-header">
                  <span>Total Records</span>
                  <div className="metric-icon-wrapper primary">
                    <ClipboardList size={18} />
                  </div>
                </div>
                <div className="metric-value">
                  {health ? health.items_count : '-'}
                </div>
                <div className="metric-desc">
                  Counted rows in items table
                </div>
              </div>

              {/* LATENCY CARD */}
              <div className="glass-card">
                <div className="metric-header">
                  <span>API Latency</span>
                  <div className="metric-icon-wrapper" style={{ color: 'var(--warning)', background: 'rgba(255,183,0,0.08)' }}>
                    <Clock size={18} />
                  </div>
                </div>
                <div className="metric-value">
                  {health ? `${health.latency_ms} ms` : '-'}
                </div>
                <div className="metric-desc">
                  Ping round-trip diagnostics
                </div>
              </div>
            </div>

            {/* Template Features Card */}
            <div className="glass-card" style={{ marginBottom: '2rem' }}>
              <h3 style={{ marginBottom: '1.25rem', color: '#fff', fontSize: '1.2rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <Terminal size={18} color="var(--secondary)" />
                Boilerplate Configuration Details
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                <div>
                  <h4 style={{ color: 'var(--secondary)', marginBottom: '0.75rem', fontSize: '0.95rem' }}>Backend Stack</h4>
                  <ul style={{ listStyleType: 'none', display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <CheckCircle2 size={14} color="var(--success)" /> FastAPI (Async ASGI router framework)
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <CheckCircle2 size={14} color="var(--success)" /> SQLite Local database engine
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <CheckCircle2 size={14} color="var(--success)" /> SQLAlchemy 2.0 ORM base & get_db DI pattern
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <CheckCircle2 size={14} color="var(--success)" /> Pydantic v2 schemas data validation
                    </li>
                  </ul>
                </div>

                <div>
                  <h4 style={{ color: 'var(--primary)', marginBottom: '0.75rem', fontSize: '0.95rem' }}>Frontend Stack</h4>
                  <ul style={{ listStyleType: 'none', display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <CheckCircle2 size={14} color="var(--success)" /> React 18 & Vite bundler (sub-second HMR)
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <CheckCircle2 size={14} color="var(--success)" /> TypeScript for interface safety
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <CheckCircle2 size={14} color="var(--success)" /> Vanilla CSS variables & premium design layouts
                    </li>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <CheckCircle2 size={14} color="var(--success)" /> Async fetch client service routing
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Quickstart Developer Guide */}
            <div className="glass-card">
              <h3 style={{ marginBottom: '1rem', color: '#fff', fontSize: '1.2rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <Settings size={18} color="var(--primary)" />
                Quickstart & Database Seeding
              </h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.5', marginBottom: '1rem' }}>
                You can try out CRUD operations right away using the <strong>Items Manager</strong> tab. 
                Below is the standard setup file path to execute manual queries. The sqlite database is automatically created in the backend root workspace directory as <code>sql_app.db</code>.
              </p>
              <div style={{ background: 'rgba(0,0,0,0.4)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--secondary)' }}>
                # API Endpoints Base Path: http://localhost:8000/api/v1/items<br/>
                # DB file location: backend/sql_app.db
              </div>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------
            TAB CONTENT: ITEMS CRUD MANAGER
        ---------------------------------------------------- */}
        {activeTab === 'items' && (
          <div className="crud-grid">
            {/* Items Table Section */}
            <div className="glass-card" style={{ padding: '1.25rem' }}>
              <div className="flex-row-between" style={{ marginBottom: '1.5rem', padding: '0.5rem' }}>
                <h3 style={{ color: '#fff' }}>Stored Items</h3>
                <button 
                  onClick={() => loadItems()} 
                  disabled={loading}
                  className="btn btn-secondary btn-sm"
                  style={{ gap: '0.35rem' }}
                >
                  <RefreshCw size={12} className={loading ? 'spin' : ''} />
                  Refresh List
                </button>
              </div>

              {loading ? (
                <div className="empty-state">
                  <RefreshCw size={32} className="spin" color="var(--primary)" />
                  <p>Loading database entries...</p>
                </div>
              ) : items.length === 0 ? (
                <div className="empty-state">
                  <Database size={40} />
                  <p>No items found in database table</p>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                    Add one using the side panel form
                  </span>
                </div>
              ) : (
                <div className="glass-table-container">
                  <table className="glass-table">
                    <thead>
                      <tr>
                        <th>Item Details</th>
                        <th>Status</th>
                        <th>Created At</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <div className="item-title">{item.title}</div>
                            <div className="item-desc">{item.description || 'No description provided'}</div>
                          </td>
                          <td>
                            <button 
                              onClick={() => toggleStatus(item)}
                              title="Click to toggle status"
                              className={`status-pill ${
                                item.status === 'completed' ? 'online' : item.status === 'in-progress' ? 'pending' : 'offline'
                              }`}
                              style={{ border: 'none', cursor: 'pointer' }}
                            >
                              <span className="status-indicator"></span>
                              {item.status}
                            </button>
                          </td>
                          <td className="time-stamp">
                            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button 
                              onClick={() => handleDeleteItem(item.id)} 
                              className="btn-danger-ghost"
                              title="Delete Item"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Creation Form Panel */}
            <div className="glass-card">
              <h3 style={{ marginBottom: '1.25rem', color: '#fff', fontSize: '1.15rem' }}>Create New Item</h3>
              
              <form onSubmit={handleCreateItem}>
                <div className="form-group">
                  <label htmlFor="item-title">Title *</label>
                  <input 
                    type="text" 
                    id="item-title" 
                    placeholder="e.g. Write integration tests"
                    className="form-control" 
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="item-desc">Description</label>
                  <textarea 
                    id="item-desc" 
                    placeholder="Provide additional details..." 
                    className="form-control"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="item-status">Initial Status</label>
                  <select 
                    id="item-status" 
                    className="form-control"
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                  >
                    <option value="pending">Pending</option>
                    <option value="in-progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                <button 
                  type="submit" 
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: '0.75rem' }}
                >
                  <Plus size={16} />
                  Add to Database
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------
            TAB CONTENT: API DOCUMENTATION
        ---------------------------------------------------- */}
        {activeTab === 'docs' && (
          <div className="docs-grid">
            <div className="glass-card docs-card">
              <h3 style={{ color: '#fff' }}>Swagger UI</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.5' }}>
                FastAPI generates a interactive Swagger documentation out of the box. 
                You can test all endpoints directly through the web browser.
              </p>
              <a 
                href="http://localhost:8000/docs" 
                target="_blank" 
                rel="noreferrer"
                className="btn btn-primary docs-link-icon"
              >
                Open Swagger UI
                <ExternalLink size={16} />
              </a>
            </div>

            <div className="glass-card docs-card">
              <h3 style={{ color: '#fff' }}>ReDoc</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: '1.5' }}>
                A beautiful, clean secondary documentation format created by Redocly. 
                Provides structured nested paths and query specifications.
              </p>
              <a 
                href="http://localhost:8000/redoc" 
                target="_blank" 
                rel="noreferrer"
                className="btn btn-secondary docs-link-icon"
              >
                Open ReDoc
                <ExternalLink size={16} />
              </a>
            </div>
          </div>
        )}
      </main>

      {/* TOAST CONTAINER FOR NOTIFICATIONS */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            {toast.type === 'success' && <CheckCircle2 size={16} color="var(--success)" />}
            {toast.type === 'error' && <AlertCircle size={16} color="var(--danger)" />}
            {toast.type === 'info' && <Activity size={16} color="var(--secondary)" />}
            <span className="toast-message">{toast.message}</span>
            <button className="toast-close" onClick={() => removeToast(toast.id)}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
      
      {/* Dynamic spinner CSS rules injection */}
      <style>{`
        .spin {
          animation: spinAnimation 1s linear infinite;
        }
        @keyframes spinAnimation {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
