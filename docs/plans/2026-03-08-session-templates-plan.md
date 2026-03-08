# Session Templates Admin Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a full CRUD admin UI for session templates with a TipTap rich-text "information" field visible to members on the session detail page.

**Architecture:** New `information String?` field on `SessionTemplate`. New backend router at `/api/booking/templates` with CRUD + cascade logic for future instances. New `SessionTemplates` React component added to the top of the existing `BookingAdmin.js` sessions page. TipTap rich text editor for the information field. Information rendered on the public `SessionDetail.js` page.

**Tech Stack:** Express, Prisma 5, PostgreSQL, React 18, TipTap (`@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-link`)

**Design doc:** `docs/plans/2026-03-08-session-templates-design.md`

---

### Task 1: Add `information` field to SessionTemplate schema and migration

**Files:**
- Modify: `backend/prisma/schema.prisma` (SessionTemplate model)
- Create: `backend/prisma/migrations/20260308000002_add_session_template_information/migration.sql`

**Step 1: Add field to SessionTemplate model in schema.prisma**

Find the `SessionTemplate` model (currently ends with `instances SessionInstance[]` and `@@map("session_templates")`). Add `information` before the relations:

```prisma
model SessionTemplate {
  id          String            @id @default(cuid())
  clubId      String
  dayOfWeek   Int
  startTime   String
  endTime     String
  openSlots   Int               @default(12)
  minAge      Int?
  information String?
  isActive    Boolean           @default(true)
  createdAt   DateTime          @default(now())
  updatedAt   DateTime          @updatedAt
  club        Club              @relation(fields: [clubId], references: [id])
  instances   SessionInstance[]

  @@map("session_templates")
}
```

**Step 2: Create migration SQL file**

Create `backend/prisma/migrations/20260308000002_add_session_template_information/migration.sql`:

```sql
ALTER TABLE "session_templates" ADD COLUMN "information" TEXT;
```

**Step 3: Apply migration and regenerate client**

```bash
cd /path/to/backend && npx prisma migrate deploy && npx prisma generate
```

Expected: Migration applied, client regenerated.

**Step 4: Verify**

```bash
node -e "const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient(); p.sessionTemplate.findFirst().then(t => console.log('information' in (t || {}), 'field exists')).catch(() => console.log('no templates yet - field exists')).finally(() => p.\$disconnect());"
```

Expected: no error (field is recognised by Prisma client).

**Step 5: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/20260308000002_add_session_template_information/
git commit -m "feat: add information field to SessionTemplate"
```

---

### Task 2: Backend CRUD router for session templates

**Files:**
- Create: `backend/routes/booking/templates.js`

**Step 1: Create the router file**

```js
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const Joi = require('joi');
const { auth, requireRole } = require('../../middleware/auth');
const { generateRollingInstances } = require('../../services/sessionGenerator');

const router = express.Router();
const prisma = new PrismaClient();

const templateSchema = Joi.object({
  dayOfWeek: Joi.number().integer().min(0).max(6).required(),
  startTime: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
  endTime: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
  openSlots: Joi.number().integer().min(1).required(),
  minAge: Joi.number().integer().min(0).allow(null).optional(),
  information: Joi.string().allow('', null).optional(),
});

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// GET /api/booking/templates — list all templates for the club
router.get('/', auth, requireRole(['CLUB_ADMIN', 'COACH']), async (req, res) => {
  try {
    const templates = await prisma.sessionTemplate.findMany({
      where: { clubId: req.user.clubId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
    res.json(templates);
  } catch (err) {
    console.error('List templates error:', err);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// POST /api/booking/templates — create a new template
router.post('/', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  const { error, value } = templateSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  try {
    const template = await prisma.sessionTemplate.create({
      data: { ...value, clubId: req.user.clubId },
    });
    // Generate instances immediately so the new template appears in the calendar
    await generateRollingInstances(req.user.clubId);
    res.status(201).json(template);
  } catch (err) {
    console.error('Create template error:', err);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// PUT /api/booking/templates/:id — update a template
router.put('/:id', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  const { error, value } = templateSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });

  const { applyToFutureInstances } = req.body;

  try {
    const template = await prisma.sessionTemplate.findUnique({ where: { id: req.params.id } });
    if (!template) return res.status(404).json({ error: 'Template not found' });
    if (template.clubId !== req.user.clubId) return res.status(403).json({ error: 'Forbidden' });

    const updated = await prisma.sessionTemplate.update({
      where: { id: template.id },
      data: value,
    });

    if (applyToFutureInstances && value.openSlots !== template.openSlots) {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      // Update future instances that have no confirmed bookings
      const futureInstances = await prisma.sessionInstance.findMany({
        where: { templateId: template.id, date: { gt: today }, cancelledAt: null },
        include: { bookings: { where: { status: 'CONFIRMED' } } },
      });
      for (const inst of futureInstances) {
        if (inst.bookings.length === 0) {
          await prisma.sessionInstance.update({
            where: { id: inst.id },
            data: { openSlotsOverride: value.openSlots },
          });
        }
      }
    }

    await generateRollingInstances(req.user.clubId);
    res.json(updated);
  } catch (err) {
    console.error('Update template error:', err);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// PATCH /api/booking/templates/:id/toggle — activate or deactivate
router.patch('/:id/toggle', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  const { applyToFutureInstances } = req.body;

  try {
    const template = await prisma.sessionTemplate.findUnique({ where: { id: req.params.id } });
    if (!template) return res.status(404).json({ error: 'Template not found' });
    if (template.clubId !== req.user.clubId) return res.status(403).json({ error: 'Forbidden' });

    const updated = await prisma.sessionTemplate.update({
      where: { id: template.id },
      data: { isActive: !template.isActive },
    });

    // If deactivating and flag set, cancel future unbooked instances
    if (!updated.isActive && applyToFutureInstances) {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const futureInstances = await prisma.sessionInstance.findMany({
        where: { templateId: template.id, date: { gt: today }, cancelledAt: null },
        include: { bookings: { where: { status: 'CONFIRMED' } } },
      });
      for (const inst of futureInstances) {
        if (inst.bookings.length === 0) {
          await prisma.sessionInstance.update({
            where: { id: inst.id },
            data: { cancelledAt: new Date() },
          });
        }
      }
    }

    res.json(updated);
  } catch (err) {
    console.error('Toggle template error:', err);
    res.status(500).json({ error: 'Failed to toggle template' });
  }
});

// DELETE /api/booking/templates/:id — delete a template
router.delete('/:id', auth, requireRole(['CLUB_ADMIN']), async (req, res) => {
  const { applyToFutureInstances } = req.body;

  try {
    const template = await prisma.sessionTemplate.findUnique({ where: { id: req.params.id } });
    if (!template) return res.status(404).json({ error: 'Template not found' });
    if (template.clubId !== req.user.clubId) return res.status(403).json({ error: 'Forbidden' });

    const today = new Date(); today.setHours(0, 0, 0, 0);

    // Check for future instances with confirmed bookings — always block deletion in that case
    const bookedFuture = await prisma.sessionInstance.findMany({
      where: { templateId: template.id, date: { gt: today } },
      include: { bookings: { where: { status: 'CONFIRMED' } } },
    });
    const hasConfirmedBookings = bookedFuture.some(inst => inst.bookings.length > 0);
    if (hasConfirmedBookings) {
      return res.status(400).json({ error: 'Cannot delete: future sessions have confirmed bookings. Cancel those bookings first.' });
    }

    if (applyToFutureInstances) {
      // Cancel and delete future unbooked instances
      const futureIds = bookedFuture.map(i => i.id);
      if (futureIds.length > 0) {
        await prisma.sessionInstance.deleteMany({ where: { id: { in: futureIds } } });
      }
    }

    await prisma.sessionTemplate.delete({ where: { id: template.id } });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete template error:', err);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

module.exports = router;
```

**Step 2: Register router in server.js**

In `backend/server.js`, add after the existing booking routes (after the line `app.use('/api/booking/admin', ...)`):

```js
app.use('/api/booking/templates', require('./routes/booking/templates'));
```

**Step 3: Verify backend starts**

```bash
cd backend && node -e "require('./server')" 2>&1 | head -20
```

Expected: Server starts with no errors.

**Step 4: Commit**

```bash
git add backend/routes/booking/templates.js backend/server.js
git commit -m "feat: add session template CRUD API"
```

---

### Task 3: Expose `information` in the sessions API

**Files:**
- Modify: `backend/routes/booking/sessions.js`

**Step 1: Add `information` to the `GET /:instanceId` response**

In `sessions.js`, find the `GET /:instanceId` route. In the `prisma.sessionInstance.findUnique` call, the `template: true` include returns all template fields including the new `information` field automatically. Add `information` to the response object:

```js
res.json({
  id: instance.id,
  date: instance.date,
  startTime: instance.template.startTime,
  endTime: instance.template.endTime,
  minAge: instance.template.minAge,
  information: instance.template.information || null,   // ADD THIS LINE
  capacity,
  bookedCount,
  availableSlots: Math.max(0, capacity - bookedCount),
  cancelledAt: instance.cancelledAt,
  bookings: instance.bookings,
});
```

**Step 2: Verify**

```bash
cd backend && node -e "require('./server')" 2>&1 | head -5
```

Expected: No errors.

**Step 3: Commit**

```bash
git add backend/routes/booking/sessions.js
git commit -m "feat: expose information field in session instance API response"
```

---

### Task 4: Install TipTap and add API methods to bookingApi.js

**Files:**
- Modify: `frontend/package.json` (via npm install)
- Modify: `frontend/src/utils/bookingApi.js`

**Step 1: Install TipTap packages**

```bash
cd frontend && npm install @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-link
```

Expected: Packages added to node_modules and package.json.

**Step 2: Add template API methods to bookingApi.js**

Read `frontend/src/utils/bookingApi.js` first to understand the existing pattern (it uses a mix of raw fetch and axios). Add at the end of the file, following the axios pattern used for `getAuditLog`:

```js
// Session templates (admin)
export const getTemplates = () =>
  api.get('/booking/templates');

export const createTemplate = (data) =>
  api.post('/booking/templates', data);

export const updateTemplate = (id, data) =>
  api.put(`/booking/templates/${id}`, data);

export const toggleTemplate = (id, applyToFutureInstances) =>
  api.patch(`/booking/templates/${id}/toggle`, { applyToFutureInstances });

export const deleteTemplate = (id, applyToFutureInstances) =>
  api.delete(`/booking/templates/${id}`, { data: { applyToFutureInstances } });
```

Note: `api.delete` with a body requires passing it as `{ data: ... }` in axios.

**Step 3: Verify frontend builds**

```bash
cd frontend && npx react-scripts build 2>&1 | tail -5
```

Expected: Compiled successfully.

**Step 4: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/utils/bookingApi.js
git commit -m "feat: install TipTap and add template API methods"
```

---

### Task 5: Create SessionTemplates admin component

**Files:**
- Create: `frontend/src/pages/booking/admin/SessionTemplates.js`

**Step 1: Create the component**

```jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import { getTemplates, createTemplate, updateTemplate, toggleTemplate, deleteTemplate } from '../../../utils/bookingApi';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const EMPTY_FORM = { dayOfWeek: '1', startTime: '', endTime: '', openSlots: '12', minAge: '', information: '' };

// Minimal TipTap toolbar
function Toolbar({ editor }) {
  if (!editor) return null;
  const btn = (label, action, active) => (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); action(); }}
      style={{
        padding: '0.25rem 0.5rem',
        background: active ? 'var(--booking-accent)' : 'var(--booking-bg-light)',
        color: active ? '#fff' : 'var(--booking-text-on-light)',
        border: '1px solid var(--booking-border)',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '0.8rem',
        fontWeight: 600,
      }}
    >{label}</button>
  );
  return (
    <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', padding: '0.4rem', borderBottom: '1px solid var(--booking-border)', background: 'var(--booking-bg-light)' }}>
      {btn('B', () => editor.chain().focus().toggleBold().run(), editor.isActive('bold'))}
      {btn('I', () => editor.chain().focus().toggleItalic().run(), editor.isActive('italic'))}
      {btn('• List', () => editor.chain().focus().toggleBulletList().run(), editor.isActive('bulletList'))}
      {btn('1. List', () => editor.chain().focus().toggleOrderedList().run(), editor.isActive('orderedList'))}
      {btn('Link', () => {
        const url = window.prompt('URL');
        if (url) editor.chain().focus().setLink({ href: url }).run();
      }, editor.isActive('link'))}
      {editor.isActive('link') && btn('Unlink', () => editor.chain().focus().unsetLink().run(), false)}
    </div>
  );
}

function RichTextEditor({ value, onChange }) {
  const editor = useEditor({
    extensions: [StarterKit, Link.configure({ openOnClick: false })],
    content: value || '',
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // Sync external value changes (e.g. when form is reset)
  useEffect(() => {
    if (editor && value === '') {
      editor.commands.clearContent();
    }
  }, [editor, value]);

  return (
    <div style={{ border: '1.5px solid var(--booking-border)', borderRadius: 'var(--booking-radius)', overflow: 'hidden' }}>
      <Toolbar editor={editor} />
      <EditorContent
        editor={editor}
        style={{ minHeight: '120px', padding: '0.6rem 0.75rem', fontSize: '0.9rem', cursor: 'text' }}
      />
    </div>
  );
}

// Modal for confirming future instance changes
function ConfirmModal({ message, onYes, onNo, onCancel }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
    }}>
      <div style={{ background: 'var(--booking-bg-white)', borderRadius: 'var(--booking-radius-lg)', padding: '1.5rem', maxWidth: '420px', width: '100%', boxShadow: '0 8px 40px rgba(0,0,0,0.18)' }}>
        <p style={{ margin: '0 0 1.25rem', color: 'var(--booking-text-on-light)', lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          {onCancel && <button className="bk-btn bk-btn--ghost" onClick={onCancel}>Cancel</button>}
          {onNo && <button className="bk-btn bk-btn--ghost" onClick={onNo}>No</button>}
          <button className="bk-btn bk-btn--primary" onClick={onYes}>Yes</button>
        </div>
      </div>
    </div>
  );
}

export default function SessionTemplates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null); // null = not editing, 'new' = create form
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState(null); // { type, templateId, payload }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getTemplates();
      setTemplates(data);
    } catch (err) {
      setError('Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditingId('new');
    setForm(EMPTY_FORM);
  };

  const openEdit = (t) => {
    setEditingId(t.id);
    setForm({
      dayOfWeek: String(t.dayOfWeek),
      startTime: t.startTime,
      endTime: t.endTime,
      openSlots: String(t.openSlots),
      minAge: t.minAge != null ? String(t.minAge) : '',
      information: t.information || '',
    });
  };

  const closeForm = () => { setEditingId(null); setForm(EMPTY_FORM); };

  const buildPayload = () => ({
    dayOfWeek: parseInt(form.dayOfWeek),
    startTime: form.startTime,
    endTime: form.endTime,
    openSlots: parseInt(form.openSlots),
    minAge: form.minAge !== '' ? parseInt(form.minAge) : null,
    information: form.information || null,
  });

  const handleSave = async (applyToFutureInstances) => {
    setSaving(true);
    setModal(null);
    try {
      if (editingId === 'new') {
        await createTemplate(buildPayload());
      } else {
        await updateTemplate(editingId, { ...buildPayload(), applyToFutureInstances });
      }
      closeForm();
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingId === 'new') {
      handleSave(false);
    } else {
      setModal({ type: 'edit' });
    }
  };

  const handleToggle = (t) => {
    if (t.isActive) {
      setModal({ type: 'deactivate', templateId: t.id });
    } else {
      // Reactivating — no cascade needed
      executeToggle(t.id, false);
    }
  };

  const executeToggle = async (templateId, applyToFutureInstances) => {
    setModal(null);
    try {
      await toggleTemplate(templateId, applyToFutureInstances);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to toggle template');
    }
  };

  const handleDelete = (t) => {
    setModal({ type: 'delete', templateId: t.id });
  };

  const executeDelete = async (templateId, applyToFutureInstances) => {
    setModal(null);
    try {
      await deleteTemplate(templateId, applyToFutureInstances);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete template');
    }
  };

  return (
    <div style={{ marginBottom: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--booking-text-on-light)' }}>Session Templates</h2>
        {editingId === null && (
          <button className="bk-btn bk-btn--primary" onClick={openCreate}>+ New Template</button>
        )}
      </div>

      {error && <p style={{ color: 'var(--booking-danger)', fontSize: '0.875rem', marginBottom: '0.75rem' }}>{error}</p>}

      {/* Create / Edit form */}
      {editingId !== null && (
        <form onSubmit={handleSubmit} style={{ background: 'var(--booking-bg-light)', borderRadius: 'var(--booking-radius)', padding: '1.25rem', marginBottom: '1rem', border: '2px solid var(--booking-accent)' }}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 700 }}>{editingId === 'new' ? 'New Template' : 'Edit Template'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.85rem', fontWeight: 600 }}>
              Day
              <select value={form.dayOfWeek} onChange={e => setForm(f => ({ ...f, dayOfWeek: e.target.value }))} className="bk-select" required>
                {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.85rem', fontWeight: 600 }}>
              Start time
              <input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} className="bk-input" required />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.85rem', fontWeight: 600 }}>
              End time
              <input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} className="bk-input" required />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.85rem', fontWeight: 600 }}>
              Capacity
              <input type="number" min="1" value={form.openSlots} onChange={e => setForm(f => ({ ...f, openSlots: e.target.value }))} className="bk-input" required />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.85rem', fontWeight: 600 }}>
              Min age (optional)
              <input type="number" min="0" value={form.minAge} onChange={e => setForm(f => ({ ...f, minAge: e.target.value }))} className="bk-input" placeholder="None" />
            </label>
          </div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', fontSize: '0.85rem', fontWeight: 600, marginBottom: '1rem' }}>
            Session information (optional)
            <RichTextEditor value={form.information} onChange={v => setForm(f => ({ ...f, information: v }))} />
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="submit" disabled={saving} className="bk-btn bk-btn--primary">{saving ? 'Saving…' : 'Save'}</button>
            <button type="button" className="bk-btn bk-btn--ghost" onClick={closeForm}>Cancel</button>
          </div>
        </form>
      )}

      {/* Template list */}
      {loading ? (
        <p style={{ color: 'var(--booking-text-muted)' }}>Loading…</p>
      ) : templates.length === 0 ? (
        <p style={{ color: 'var(--booking-text-muted)' }}>No templates yet. Create one to start generating sessions.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {templates.map(t => (
            <div key={t.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem',
              padding: '0.75rem 1rem',
              border: '1.5px solid var(--booking-border)',
              borderRadius: 'var(--booking-radius)',
              background: 'var(--booking-bg-white)',
              opacity: t.isActive ? 1 : 0.6,
            }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--booking-text-on-light)' }}>
                  {DAY_NAMES[t.dayOfWeek]} {t.startTime}–{t.endTime}
                  <span style={{
                    marginLeft: '0.5rem', fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.45rem',
                    borderRadius: '999px',
                    background: t.isActive ? 'rgba(124,53,232,0.12)' : 'rgba(0,0,0,0.07)',
                    color: t.isActive ? 'var(--booking-accent)' : 'var(--booking-text-muted)',
                  }}>{t.isActive ? 'Active' : 'Inactive'}</span>
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--booking-text-muted)', marginTop: '0.15rem' }}>
                  {t.openSlots} slots{t.minAge ? ` · ${t.minAge}+` : ''}
                  {t.information && <span> · <em>Has info text</em></span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0 }}>
                <button className="bk-btn bk-btn--ghost" style={{ fontSize: '0.82rem', padding: '0.3rem 0.65rem' }} onClick={() => openEdit(t)}>Edit</button>
                <button className="bk-btn bk-btn--ghost" style={{ fontSize: '0.82rem', padding: '0.3rem 0.65rem' }} onClick={() => handleToggle(t)}>
                  {t.isActive ? 'Deactivate' : 'Activate'}
                </button>
                <button className="bk-btn bk-btn--ghost" style={{ fontSize: '0.82rem', padding: '0.3rem 0.65rem', color: 'var(--booking-danger)' }} onClick={() => handleDelete(t)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmation modals */}
      {modal?.type === 'edit' && (
        <ConfirmModal
          message="Apply these changes to already-scheduled future sessions that have no confirmed bookings?"
          onYes={() => handleSave(true)}
          onNo={() => handleSave(false)}
          onCancel={() => setModal(null)}
        />
      )}
      {modal?.type === 'deactivate' && (
        <ConfirmModal
          message="Stop generating new sessions for this template. Also cancel future sessions with no confirmed bookings?"
          onYes={() => executeToggle(modal.templateId, true)}
          onNo={() => executeToggle(modal.templateId, false)}
          onCancel={() => setModal(null)}
        />
      )}
      {modal?.type === 'delete' && (
        <ConfirmModal
          message="Permanently delete this template. Also delete future sessions with no confirmed bookings? This cannot be undone."
          onYes={() => executeDelete(modal.templateId, true)}
          onNo={() => executeDelete(modal.templateId, false)}
          onCancel={() => setModal(null)}
        />
      )}
    </div>
  );
}
```

**Step 2: Verify the file was created (no syntax errors)**

```bash
cd frontend && node -e "require('@babel/parser') && console.log('ok')" 2>/dev/null || echo "check file manually"
```

(Just visually confirm the file looks correct — no need for a build step yet.)

**Step 3: Commit**

```bash
git add frontend/src/pages/booking/admin/SessionTemplates.js
git commit -m "feat: add SessionTemplates admin component with TipTap editor"
```

---

### Task 6: Add SessionTemplates to BookingAdmin.js

**Files:**
- Modify: `frontend/src/pages/booking/admin/BookingAdmin.js`

**Step 1: Read BookingAdmin.js to find the right insertion point**

The file has a main export function. Find the `return (` statement and locate where the sessions heading / month navigation renders. Add the `SessionTemplates` component above the session list.

**Step 2: Add import at the top of BookingAdmin.js**

```js
import SessionTemplates from './SessionTemplates';
```

**Step 3: Add `<SessionTemplates />` above the sessions month navigation**

Find the section that renders the month navigation (the `<strong>{MONTHS[month - 1]} {year}</strong>` block, around line 370). Add the component just before the parent container of the sessions list. The exact insertion point depends on the component structure — it should go above the month nav, inside the main page container.

Look for a pattern like:
```jsx
<div className="bk-page">
  ...
  {/* month nav and sessions list */}
```

Add `<SessionTemplates />` as the first child after the page header or before the sessions section.

**Step 4: Build to verify no errors**

```bash
cd frontend && npx react-scripts build 2>&1 | tail -10
```

Expected: Compiled successfully.

**Step 5: Commit**

```bash
git add frontend/src/pages/booking/admin/BookingAdmin.js
git commit -m "feat: add SessionTemplates section to booking admin sessions page"
```

---

### Task 7: Render `information` HTML on SessionDetail.js

**Files:**
- Modify: `frontend/src/pages/booking/SessionDetail.js`

**Step 1: Read SessionDetail.js to find where session details are rendered**

The component fetches session data which now includes an `information` field. Find where `session.startTime`, `session.endTime`, `session.minAge` etc. are displayed to the user.

**Step 2: Add information rendering**

After the session time/capacity block (wherever `startTime`/`endTime` are shown), add:

```jsx
{session.information && (
  <div
    className="bk-session-info"
    dangerouslySetInnerHTML={{ __html: session.information }}
    style={{
      marginTop: '1rem',
      padding: '0.75rem 1rem',
      background: 'var(--booking-bg-light)',
      borderRadius: 'var(--booking-radius)',
      fontSize: '0.9rem',
      color: 'var(--booking-text-on-light)',
      lineHeight: 1.6,
    }}
  />
)}
```

**Step 3: Build to verify**

```bash
cd frontend && npx react-scripts build 2>&1 | tail -5
```

Expected: Compiled successfully.

**Step 4: Commit**

```bash
git add frontend/src/pages/booking/SessionDetail.js
git commit -m "feat: render session information HTML on session detail page"
```

---

### Task 8: Push to production

**Step 1: Push**

```bash
git push origin main
```

**Step 2: Verify on production**

- Log in as `contact@trampoline.life`
- Navigate to `/booking/admin` (Sessions page)
- Create a session template — confirm it appears and sessions generate in the calendar
- Add information text using the rich text editor, save, open a session as a member — confirm information renders
