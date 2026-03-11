import React, { useState, useEffect } from 'react';
import { bookingApi } from '../../utils/bookingApi';
import { useAuth } from '../../contexts/AuthContext';
import RichTextEditor from '../../components/RichTextEditor';
import './Noticeboard.css';
import './booking-shared.css';

const EMPTY_FORM = { title: '', body: '', archiveAt: '' };
const isStaff = (user) => user?.role === 'CLUB_ADMIN' || user?.role === 'COACH';

function PostForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body || !form.archiveAt) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(form);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save.');
      setSaving(false);
    }
  };

  return (
    <div className="noticeboard-form">
      <h3 style={{ margin: '0 0 1rem' }}>{initial ? 'Edit post' : 'New post'}</h3>
      <form onSubmit={handleSubmit}>
        <label className="bk-label" style={{ display: 'block', marginBottom: '0.75rem' }}>
          Title
          <input
            className="bk-input"
            style={{ marginTop: '0.25rem' }}
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            required
            maxLength={200}
          />
        </label>
        <label className="bk-label" style={{ display: 'block', marginBottom: '0.75rem' }}>
          Message
          <div style={{ marginTop: '0.25rem' }}>
            <RichTextEditor
              value={form.body}
              onChange={html => setForm(f => ({ ...f, body: html }))}
              placeholder="Write your notice..."
            />
          </div>
        </label>
        <label className="bk-label" style={{ display: 'block', marginBottom: '1rem' }}>
          Archive after
          <input
            type="date"
            className="bk-input"
            style={{ marginTop: '0.25rem' }}
            value={form.archiveAt}
            onChange={e => setForm(f => ({ ...f, archiveAt: e.target.value }))}
            required
            min={new Date().toISOString().slice(0, 10)}
          />
        </label>
        {error && <p className="bk-error">{error}</p>}
        <div className="bk-row">
          <button type="submit" disabled={saving} className="bk-btn bk-btn--primary bk-btn--sm">
            {saving ? 'Saving…' : 'Save post'}
          </button>
          <button type="button" className="bk-btn bk-btn--sm" style={{ border: '1px solid var(--booking-border)' }} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export default function Noticeboard() {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const staff = isStaff(user);

  const load = async () => {
    try {
      const res = await bookingApi.getNoticeboard();
      setPosts(res.data);
      res.data
        .filter(p => !p.isRead)
        .forEach(p => bookingApi.markNoticeboardRead(p.id).catch(() => {}));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (form) => {
    await bookingApi.createNoticeboardPost({
      ...form,
      archiveAt: new Date(form.archiveAt + 'T23:59:59').toISOString(),
    });
    setShowForm(false);
    load();
  };

  const handleUpdate = async (form) => {
    await bookingApi.updateNoticeboardPost(editingId, {
      ...form,
      archiveAt: new Date(form.archiveAt + 'T23:59:59').toISOString(),
    });
    setEditingId(null);
    load();
  };

  const handleDelete = async (id) => {
    await bookingApi.deleteNoticeboardPost(id);
    setConfirmDelete(null);
    load();
  };

  if (loading) return <p className="bk-center">Loading…</p>;

  return (
    <div className="bk-page bk-page--md">
      <div className="bk-row bk-row--between" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0 }}>Noticeboard</h2>
        {staff && !showForm && !editingId && (
          <button className="bk-btn bk-btn--primary" onClick={() => setShowForm(true)}>
            + New post
          </button>
        )}
      </div>

      {showForm && (
        <PostForm onSave={handleCreate} onCancel={() => setShowForm(false)} />
      )}

      {posts.length === 0 && !showForm && (
        <p className="bk-muted">No notices at the moment.</p>
      )}

      {posts.map(post => (
        editingId === post.id ? (
          <PostForm
            key={post.id}
            initial={{
              title: post.title,
              body: post.body,
              archiveAt: post.archiveAt.slice(0, 10),
            }}
            onSave={handleUpdate}
            onCancel={() => setEditingId(null)}
          />
        ) : (
          <div key={post.id} className="noticeboard-post">
            <div className="noticeboard-post__header">
              <h3 className="noticeboard-post__title">{post.title}</h3>
              <span className="noticeboard-post__meta">
                {post.author.firstName} {post.author.lastName}
                {' · '}
                {new Date(post.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                {' · '}
                Expires {new Date(post.archiveAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
              </span>
            </div>
            <div
              className="noticeboard-post__body"
              dangerouslySetInnerHTML={{ __html: post.body }}
            />
            {staff && (
              <div className="noticeboard-post__actions">
                <button
                  className="bk-btn bk-btn--sm"
                  style={{ border: '1px solid var(--booking-border)' }}
                  onClick={() => { setEditingId(post.id); setShowForm(false); }}
                >
                  Edit
                </button>
                {confirmDelete === post.id ? (
                  <>
                    <button
                      className="bk-btn bk-btn--sm"
                      style={{ background: 'var(--booking-danger)', color: '#fff', border: 'none' }}
                      onClick={() => handleDelete(post.id)}
                    >
                      Confirm delete
                    </button>
                    <button
                      className="bk-btn bk-btn--sm"
                      style={{ border: '1px solid var(--booking-border)' }}
                      onClick={() => setConfirmDelete(null)}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    className="bk-btn bk-btn--sm"
                    style={{ color: 'var(--booking-danger)', border: '1px solid var(--booking-danger)' }}
                    onClick={() => setConfirmDelete(post.id)}
                  >
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
        )
      ))}
    </div>
  );
}
