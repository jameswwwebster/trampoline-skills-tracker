import React, { useState, useEffect } from 'react';
import { bookingApi } from '../../utils/bookingApi';
import { useAuth } from '../../contexts/AuthContext';
import RichTextEditor from '../../components/RichTextEditor';
import RecipientPicker from '../../components/RecipientPicker';
import './Noticeboard.css';
import './booking-shared.css';

const EMPTY_FORM = { title: '', body: '', archiveAt: '', recipientFilter: null, videoEmbeds: [] };
const isStaff = (user) => user?.role === 'CLUB_ADMIN' || user?.role === 'COACH';

function isValidVideoUrl(url) {
  return /^https:\/\/(www\.)?(youtube\.com\/(watch|shorts)|youtu\.be\/|vimeo\.com\/\d+)/.test(url);
}

function getEmbedUrl(url) {
  let m;
  m = url.match(/youtube\.com\/watch\?.*v=([^&]+)/);
  if (m) return `https://www.youtube.com/embed/${m[1]}`;
  m = url.match(/youtu\.be\/([^?]+)/);
  if (m) return `https://www.youtube.com/embed/${m[1]}`;
  m = url.match(/youtube\.com\/shorts\/([^?]+)/);
  if (m) return `https://www.youtube.com/embed/${m[1]}`;
  m = url.match(/vimeo\.com\/(\d+)/);
  if (m) return `https://player.vimeo.com/video/${m[1]}`;
  return null;
}

function PostForm({ initial, onSave, onCancel, groups = [] }) {
  const [form, setForm] = useState(initial || EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [videoInput, setVideoInput] = useState('');
  const [videoInputError, setVideoInputError] = useState(null);

  const handleImageUpload = async (file) => {
    const fd = new FormData();
    fd.append('image', file);
    const res = await bookingApi.uploadNoticeboardImage(fd);
    return res.data.url;
  };

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
        <div style={{ marginBottom: '0.75rem' }}>
          <p className="bk-label" style={{ margin: '0 0 0.25rem' }}>Message</p>
          <RichTextEditor
            value={form.body}
            onChange={html => setForm(f => ({ ...f, body: html }))}
            placeholder="Write your notice..."
            onImageUpload={handleImageUpload}
          />
        </div>
        <div style={{ marginBottom: '0.75rem' }}>
          <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.3rem' }}>
            Video embeds (optional, max 5)
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              className="bk-input"
              placeholder="Paste YouTube or Vimeo URL…"
              value={videoInput}
              onChange={e => { setVideoInput(e.target.value); setVideoInputError(null); }}
            />
            <button
              type="button"
              className="bk-btn bk-btn--sm bk-btn--primary"
              disabled={form.videoEmbeds.length >= 5}
              onClick={() => {
                const url = videoInput.trim();
                if (!isValidVideoUrl(url)) {
                  setVideoInputError('Please enter a valid YouTube or Vimeo URL');
                  return;
                }
                setForm(f => ({ ...f, videoEmbeds: [...f.videoEmbeds, url] }));
                setVideoInput('');
                setVideoInputError(null);
              }}
            >
              Add
            </button>
          </div>
          {videoInputError && <p className="bk-error" style={{ marginTop: '0.25rem' }}>{videoInputError}</p>}
          {form.videoEmbeds.map((url, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0.6rem', background: 'var(--booking-bg-light)', borderRadius: '6px', marginTop: '0.3rem', fontSize: '0.85rem' }}>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--booking-text-muted)' }}>{url}</span>
              <button type="button" onClick={() => setForm(f => ({ ...f, videoEmbeds: f.videoEmbeds.filter((_, j) => j !== i) }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--booking-text-muted)', fontSize: '1rem', lineHeight: 1 }}>✕</button>
            </div>
          ))}
        </div>
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
        {!initial && (
          <RecipientPicker
            value={form.recipientFilter}
            onChange={rf => setForm(f => ({ ...f, recipientFilter: rf }))}
            groups={groups}
          />
        )}
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
  const [groups, setGroups] = useState([]);

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

  useEffect(() => {
    load();
    if (isStaff(user)) {
      bookingApi.getRecipientGroups().then(r => setGroups(r.data)).catch(() => {});
    }
  }, []);

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
        <PostForm onSave={handleCreate} onCancel={() => setShowForm(false)} groups={groups} />
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
              videoEmbeds: post.videoEmbeds ?? [],
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
            {post.videoEmbeds?.length > 0 && (
              <div style={{ marginTop: '1rem', borderTop: '1px solid var(--booking-bg-light)', paddingTop: '0.75rem' }}>
                <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--booking-text-muted)' }}>Videos</p>
                {post.videoEmbeds.map((url, i) => {
                  const embedUrl = getEmbedUrl(url);
                  if (!embedUrl) return null;
                  return (
                    <div key={i} style={{ position: 'relative', paddingBottom: '56.25%', height: 0, overflow: 'hidden', borderRadius: '8px', marginBottom: '0.75rem' }}>
                      <iframe
                        src={embedUrl}
                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        title={`Video ${i + 1}`}
                      />
                    </div>
                  );
                })}
              </div>
            )}
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
