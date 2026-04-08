-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'WELFARE';

-- CreateTable
CREATE TABLE "welfare_reports" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "gymnastId" TEXT,
    "reportedById" TEXT NOT NULL,
    "incidentDate" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "concernType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "actionTaken" TEXT,
    "outcome" TEXT,
    "witnessName" TEXT,
    "witnessContact" TEXT,
    "witnessStatement" TEXT,
    "referredExternally" BOOLEAN NOT NULL DEFAULT false,
    "referralDetails" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "welfare_reports_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "welfare_reports" ADD CONSTRAINT "welfare_reports_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "welfare_reports" ADD CONSTRAINT "welfare_reports_gymnastId_fkey" FOREIGN KEY ("gymnastId") REFERENCES "gymnasts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "welfare_reports" ADD CONSTRAINT "welfare_reports_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
