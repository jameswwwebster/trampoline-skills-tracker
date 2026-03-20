# Noticeboard Media Design

## Goal

Allow coaches and admins to attach images (inline, in the post body) and embed YouTube/Vimeo videos (displayed below the body) when creating or editing noticeboard posts.

## Scope

- Inline images in the rich text body via the existing Tiptap editor
- YouTube and Vimeo video embeds stored as a separate array field, rendered below the body
- Max 5 video embeds per post; images up to 5MB each
- No uploaded video files — embed links only

---

## Architecture

### Backend

**New endpoint: `POST /api/noticeboard/upload-image`**
- Auth required; role: `CLUB_ADMIN` or `COACH`
- Multer upload, single file, field name `image`
- File size limit: 5MB; Multer `fileFilter` accepts only `image/jpeg`, `image/png`, `image/gif`, `image/webp`
- Additionally validate the file extension server-side (`.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`) to prevent trivially spoofed MIME types
- Storage path: `path.join(__dirname, '..', 'uploads', 'noticeboard', req.user.clubId)` — per-club subdirectory. In the Multer `diskStorage` `destination` callback, call `fs.mkdirSync(dest, { recursive: true })` before calling `cb(null, dest)` to ensure the directory exists for first-time uploads. This uses `__dirname`-relative resolution (same as the `express.static('uploads')` server in `server.js` which resolves relative to `process.cwd()` = backend dir) so uploaded files and served files resolve to the same location.
- Returns `{ url: '/uploads/noticeboard/<clubId>/<filename>' }`
- Already served by `app.use('/uploads', express.static('uploads'))` in `server.js`

**Route registration order:** `upload-image` must be registered before any `/:id` routes in `noticeboard.js` to avoid Express matching `upload-image` as an `:id` parameter. (Same principle as the existing `preview-recipients` route.)

**Schema change: `NoticeboardPost`**
```prisma
videoEmbeds  String[]  @default([])
```
Migration:
```sql
ALTER TABLE "noticeboard_posts" ADD COLUMN "videoEmbeds" TEXT[] NOT NULL DEFAULT '{}';
```

**Joi schema updates**

Create schema — new field:
```js
videoEmbeds: Joi.array().items(
  Joi.string().uri().pattern(/^https:\/\/(www\.)?(youtube\.com|youtu\.be|vimeo\.com)/)
).max(5).optional(),
```

Update schema — same addition. Note: `recipientFilter` is not persisted in the existing PATCH handler (pre-existing gap, out of scope for this feature — document as known issue in code comment).

**Create/update handlers** — pass `videoEmbeds: value.videoEmbeds ?? []` into the Prisma `data` object.

---

### Frontend

#### `RichTextEditor.js`

- Install `@tiptap/extension-image` (npm)
- Add `Image` extension to the editor's extension list
- Accept optional props: `onImageUpload: async (file) => url`
- When `onImageUpload` is provided, show an 🖼 Image button in the toolbar
- On click: open a hidden `<input type="file" accept="image/*">`, call `onImageUpload(file)`, on success insert via `editor.chain().focus().setImage({ src: url }).run()`
- On upload error: show an `alert()` with the error message (consistent with error handling elsewhere in this codebase)

#### `Noticeboard.js` — `PostForm` component

**State additions:**
```js
const EMPTY_FORM = { title: '', body: '', archiveAt: '', recipientFilter: null, videoEmbeds: [] };
```

Local state for the video input field:
```js
const [videoInput, setVideoInput] = useState('');
const [videoInputError, setVideoInputError] = useState(null);
```

**Image upload handler** (passed to `RichTextEditor` as `onImageUpload`):
```js
async (file) => {
  const fd = new FormData();
  fd.append('image', file);
  const res = await bookingApi.uploadNoticeboardImage(fd);
  return res.data.url;
}
```

**Video embeds UI** (below the body field, above archive date):
- Text input bound to `videoInput`
- "Add" button: validate URL against YouTube/Vimeo pattern; if invalid set `videoInputError`; otherwise push to `form.videoEmbeds` (max 5) and clear input/error
- List of added embeds: each row shows the URL truncated and an ✕ remove button
- Accepted patterns: `youtube.com/watch?v=`, `youtu.be/`, `youtube.com/shorts/`, `vimeo.com/<numeric-id>` only (e.g. `https://vimeo.com/123456789`). Vimeo channel/group URLs are not supported and the validation pattern should enforce a numeric ID to prevent unsupported embed formats.

**Payload**: `videoEmbeds` included in both create and update calls.

#### `bookingApi.js`

```js
uploadNoticeboardImage: (formData) =>
  axios.post(`${API_URL}/noticeboard/upload-image`, formData, {
    headers: getHeaders(),
    // Do NOT set Content-Type manually — axios sets it automatically from
    // FormData including the required multipart boundary parameter.
  }),
```

#### Post display (read view in `Noticeboard.js`)

Below the HTML body, if `post.videoEmbeds.length > 0`:
- Render a "Videos" section header
- For each URL, call `getEmbedUrl(url)` to convert to an embed URL, then render as a responsive `<iframe>` (16:9 aspect ratio via `padding-bottom: 56.25%` wrapper)
- `getEmbedUrl` returns `null` for unrecognised URLs — these are silently skipped (defensive guard for future/malformed data, not a normal code path)

**`getEmbedUrl` logic:**
```
youtube.com/watch?v=ID      → https://www.youtube.com/embed/ID
youtu.be/ID                 → https://www.youtube.com/embed/ID
youtube.com/shorts/ID       → https://www.youtube.com/embed/ID
vimeo.com/ID                → https://player.vimeo.com/video/ID
```

---

## File Changes

| File | Change |
|------|--------|
| `backend/prisma/schema.prisma` | Add `videoEmbeds String[] @default([])` to `NoticeboardPost` |
| `backend/prisma/migrations/…` | New migration adding `videoEmbeds TEXT[]` column |
| `backend/routes/noticeboard.js` | New upload-image route (registered before `/:id`); update Joi + create/update handlers |
| `frontend/package.json` | Add `@tiptap/extension-image` |
| `frontend/src/components/RichTextEditor.js` | Image extension + toolbar button + `onImageUpload` prop |
| `frontend/src/pages/booking/Noticeboard.js` | `videoEmbeds` state, video embed UI, upload handler, display |
| `frontend/src/utils/bookingApi.js` | `uploadNoticeboardImage` method |

---

## Out of Scope

- Uploaded video files
- Image galleries / lightbox
- Deleting previously uploaded images from disk
- Editing images inline (resize, crop)
- Fixing the pre-existing `recipientFilter` not-persisted-on-update bug
