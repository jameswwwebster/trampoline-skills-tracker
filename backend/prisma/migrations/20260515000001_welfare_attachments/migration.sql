CREATE TABLE "welfare_attachments" (
    "id" TEXT NOT NULL,
    "welfareReportId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storedPath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "welfare_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "welfare_attachments_welfareReportId_idx" ON "welfare_attachments"("welfareReportId");

ALTER TABLE "welfare_attachments" ADD CONSTRAINT "welfare_attachments_welfareReportId_fkey"
  FOREIGN KEY ("welfareReportId") REFERENCES "welfare_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "welfare_attachments" ADD CONSTRAINT "welfare_attachments_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
