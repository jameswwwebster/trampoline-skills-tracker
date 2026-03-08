import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getAuditLog, getAuditStaff } from '../../../utils/bookingApi';
import { format } from 'date-fns';

const ACTION_LABELS = {
  'booking.create': 'Created booking',
  'booking.cancel': 'Cancelled booking',
  'credit.create': 'Added credit',
  'credit.delete': 'Deleted credit',
  'membership.create': 'Added membership',
  'membership.update': 'Updated membership',
  'membership.delete': 'Cancelled membership',
  'refund.issue': 'Issued refund',
  'session.cancel': 'Cancelled session',
  'member.create': 'Added member',
  'member.edit': 'Edited member',
  'member.delete': 'Deleted member',
};

export default function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [staff, setStaff] = useState([]);

  const [staffId, setStaffId] = useState('');
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const observerRef = useRef();
  const bottomRef = useRef();

  const fetchPage = useCallback(async (pageNum, reset = false) => {
    setLoading(true);
    try {
      const params = {
        page: pageNum,
        ...(staffId && { staffId }),
        ...(action && { action }),
        ...(from && { from }),
        ...(to && { to }),
      };
      const { data } = await getAuditLog(params);
      setLogs(prev => reset ? data.logs : [...prev, ...data.logs]);
      setTotal(data.total);
      setHasMore(data.hasMore);
      setPage(pageNum);
    } catch (err) {
      console.error('Failed to load audit log', err);
    } finally {
      setLoading(false);
    }
  }, [staffId, action, from, to]);

  useEffect(() => {
    fetchPage(1, true);
  }, [staffId, action, from, to, fetchPage]);

  useEffect(() => {
    getAuditStaff().then(({ data }) => setStaff(data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loading) {
        fetchPage(page + 1);
      }
    });
    if (bottomRef.current) observerRef.current.observe(bottomRef.current);
    return () => observerRef.current?.disconnect();
  }, [hasMore, loading, page, fetchPage]);

  return (
    <div className="bk-page">
      <div className="bk-page-header">
        <h1 className="bk-page-title">Audit Log</h1>
        <p className="bk-page-subtitle">{total} {total === 1 ? 'entry' : 'entries'}</p>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <select value={staffId} onChange={e => setStaffId(e.target.value)} className="bk-select">
          <option value="">All staff</option>
          {staff.map(s => (
            <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
          ))}
        </select>
        <select value={action} onChange={e => setAction(e.target.value)} className="bk-select">
          <option value="">All actions</option>
          {Object.entries(ACTION_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="bk-input" />
        <input type="date" value={to} onChange={e => setTo(e.target.value)} className="bk-input" />
        {(staffId || action || from || to) && (
          <button
            onClick={() => { setStaffId(''); setAction(''); setFrom(''); setTo(''); }}
            className="bk-btn bk-btn--ghost"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="bk-table-wrap">
        <table className="bk-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Staff</th>
              <th>Action</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => (
              <tr key={log.id}>
                <td style={{ whiteSpace: 'nowrap', color: 'var(--booking-text-muted)', fontSize: '0.85rem' }}>
                  {format(new Date(log.createdAt), 'dd MMM yyyy HH:mm')}
                </td>
                <td>{log.user ? `${log.user.firstName} ${log.user.lastName}` : '—'}</td>
                <td>
                  <span className="bk-badge">{ACTION_LABELS[log.action] || log.action}</span>
                </td>
                <td style={{ fontSize: '0.85rem', color: 'var(--booking-text-muted)' }}>
                  {log.entityType}{log.entityId ? ` #${log.entityId.slice(-6)}` : ''}
                  {log.metadata && Object.keys(log.metadata).length > 0 && (
                    <span>
                      {' — '}
                      {Object.entries(log.metadata)
                        .filter(([k]) => !k.toLowerCase().endsWith('id'))
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(', ')}
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {logs.length === 0 && !loading && (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', color: 'var(--booking-text-muted)', padding: '2rem' }}>
                  No entries found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div ref={bottomRef} style={{ height: '1px' }} />
      {loading && (
        <p style={{ textAlign: 'center', color: 'var(--booking-text-muted)', padding: '1rem' }}>Loading…</p>
      )}
    </div>
  );
}
