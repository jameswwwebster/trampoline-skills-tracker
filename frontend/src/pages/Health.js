import React, { useEffect, useState } from 'react';

const Health = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/health', { credentials: 'include' });
        if (!res.ok) {
          throw new Error(`Request failed: ${res.status}`);
        }
        const json = await res.json();
        setData(json);
      } catch (e) {
        setError(e.message || 'Failed to load');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  if (loading) return <div className="loading"><div className="spinner"></div></div>;
  if (error) return <div className="alert alert-error">{error}</div>;

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">System Health</h3>
      </div>
      <div className="card-body">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
          <div className="metric-stat">
            <div className="metric-number">{data?.status === 'healthy' ? '✅' : '⚠️'}</div>
            <div className="metric-label">API</div>
          </div>
          <div className="metric-stat">
            <div className="metric-number">{data?.dbConnected ? '✅' : '❌'}</div>
            <div className="metric-label">Database</div>
          </div>
          <div className="metric-stat">
            <div className="metric-number">{data?.storage || '-'}</div>
            <div className="metric-label">Storage</div>
          </div>
        </div>
        <div style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#666' }}>
          <div>Environment: {data?.environment}</div>
          <div>Uptime: {Math.round(data?.uptime)}s</div>
          <div>Timestamp: {new Date(data?.timestamp).toLocaleString()}</div>
        </div>
      </div>
    </div>
  );
};

export default Health;
