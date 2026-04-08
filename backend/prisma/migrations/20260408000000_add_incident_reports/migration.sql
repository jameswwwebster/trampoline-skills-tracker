-- CreateTable
CREATE TABLE "incident_reports" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "gymnastId" TEXT,
    "reportedById" TEXT NOT NULL,
    "incidentDate" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "incidentType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "injuryDetails" TEXT,
    "firstAidGiven" TEXT,
    "outcome" TEXT,
    "witnessName" TEXT,
    "witnessContact" TEXT,
    "witnessStatement" TEXT,
    "adultNotifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incident_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incident_forwards" (
    "id" TEXT NOT NULL,
    "incidentReportId" TEXT NOT NULL,
    "forwardedById" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "toName" TEXT,
    "note" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incident_forwards_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "incident_reports" ADD CONSTRAINT "incident_reports_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_reports" ADD CONSTRAINT "incident_reports_gymnastId_fkey" FOREIGN KEY ("gymnastId") REFERENCES "gymnasts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_reports" ADD CONSTRAINT "incident_reports_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_forwards" ADD CONSTRAINT "incident_forwards_incidentReportId_fkey" FOREIGN KEY ("incidentReportId") REFERENCES "incident_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident_forwards" ADD CONSTRAINT "incident_forwards_forwardedById_fkey" FOREIGN KEY ("forwardedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
