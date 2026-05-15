# Rename "incident report" → "first aid report" and add media uploads to welfare reports

Date: 2026-05-15

## Problem

- "Incident report" is the wrong mental model for the form that records what
  was injured and what first aid was given. The actual workflow is first-aid
  documentation, and admins/coaches confuse it with the safeguarding-focused
  "welfare report".
- Welfare reports can't carry photos or short videos (e.g. an image of a
  message, a clip of an interaction). Today the report description is the
  only place evidence lives.

## Design

### Label rename

Scope is label-only. Database tables (`incident_reports`,
`incident_forwards`), model names (`IncidentReport`, `IncidentForward`),
route paths (`/api/incidents`), and audit-log action ids (e.g.
`incident.create`) are left as-is to avoid a destructive migration with no
user-visible benefit.

Sweep every user-facing reference of "Incident report(s)" / "incident" (in
this product sense) to "First aid report(s)" / "first aid":

- Nav links and admin tiles (`AdminDashboard`, `AppLayout`).
- Page titles and button text (`AdminIncidents`, `MyIncidents`, admin help,
  public help/policies pages).
- Email subjects and bodies sent from the incident routes.
- Dashboard "incidents" tile label, descriptions, empty-state copy.

Out of scope:

- Renaming the API path. Frontend keeps calling `/api/incidents`. Internal
  variable names like `incidents` stay.
- Renaming `IncidentReport`/`IncidentForward` Prisma models.

### Welfare media upload

#### Schema

New `WelfareAttachment` model:

```prisma
model WelfareAttachment {
  id              String        @id @default(cuid())
  welfareReportId String
  fileName        String        // sanitised original filename
  storedPath      String        // path relative to STORAGE_ROOT
  mimeType        String
  fileSize        Int
  uploadedById    String
  createdAt       DateTime      @default(now())
  welfareReport   WelfareReport @relation(fields: [welfareReportId], references: [id], onDelete: Cascade)
  uploadedBy      User          @relation("WelfareAttachmentUploadedBy", fields: [uploadedById], references: [id])

  @@index([welfareReportId])
  @@map("welfare_attachments")
}
```

Single migration adds the table. The reverse relation on `User`
(`welfareAttachmentsUploaded WelfareAttachment[] @relation("WelfareAttachmentUploadedBy")`)
is added in the same change.

If audit-log display anywhere maps action ids to friendly labels, the
`incident.*` ids retain their existing labels but the displayed label is
renamed to "First aid …". The action ids themselves are not touched.

#### Storage

Files written under `${STORAGE_ROOT}/uploads/welfare/<welfareReportId>/<timestamp>-<random>-<safe-original-name>`.

- Per-file limit: **25 MB** (covers a 1080p ~30-second clip and any photo).
- Allowed MIME types: `image/png`, `image/jpeg`, `image/heic`, `image/heif`,
  `video/mp4`, `video/quicktime`.
- Up to **6 files** per upload request; no overall per-report cap (admins can
  upload again).

`createWelfareUpload()` factory in `backend/config/storage.js` returns a
multer instance with the per-welfare-report destination + MIME filter, mirroring
the certificate-template pattern.

#### API

All routes staff-only (mirror the existing `/api/welfare` guards):

- `POST /api/welfare/:id/attachments` — `multer.array('files', 6)`. Creates
  one `WelfareAttachment` row per accepted file. Returns the new rows.
- `DELETE /api/welfare/:id/attachments/:attachmentId` — deletes the row and
  the on-disk file (best-effort fs.unlink, log on failure).
- `GET /api/welfare/:id/attachments/:attachmentId/file` — streams the file
  with the stored `mimeType` and an inline `Content-Disposition`.

`GET /api/welfare/:id` is extended to include the attachments array (id,
fileName, mimeType, fileSize, createdAt, uploadedById, uploadedBy.firstName).

When a `WelfareReport` is deleted, Prisma cascades to attachments rows; the
delete route additionally `fs.rm`s the on-disk folder for that report.

#### UI

`AdminWelfare` detail view gets a new **Attachments** panel:

- File picker (`input type="file" accept="image/*,video/mp4,video/quicktime" multiple`)
  with the mobile `capture="environment"` attribute so phone users can shoot
  straight from camera.
- A drop-zone variant for desktop.
- Thumbnail grid:
  - Images: `<img>` set to the `/file` endpoint with `loading="lazy"`.
  - Videos: `<video controls preload="metadata">`.
- Each tile has a small `×` delete button (with confirm) and shows file
  size + upload author + date.
- Upload progress + per-file error display (e.g. "Too large", "Unsupported
  type").

## Out of scope

- Document attachments (PDFs, Word, etc.).
- Attachments on first-aid (incident) reports — separate feature if asked.
- Virus scanning. (Local-disk only; club admin sees their own uploads.)
- Image rotation/EXIF correction.

## Tests

Backend Jest:

1. Upload happy path: 2-image upload returns two rows, files exist on disk.
2. MIME rejection: PDF upload returns 400 with clear message.
3. Size rejection: 26 MB blob returns 400.
4. Delete attachment: row gone, file removed.
5. Cascade on report delete: report delete removes attachment rows and
   on-disk folder.
6. Non-staff access returns 403 on all three new routes.

No backend tests for the label rename — covered by manual smoke + existing
route tests (which don't reference user-facing strings).
