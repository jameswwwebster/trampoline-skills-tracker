-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CLUB_ADMIN', 'COACH', 'PARENT', 'GYMNAST');

-- CreateEnum
CREATE TYPE "LevelType" AS ENUM ('SEQUENTIAL', 'SIDE_PATH');

-- CreateEnum
CREATE TYPE "ProgressStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "CertificateFieldType" AS ENUM ('GYMNAST_NAME', 'COACH_NAME', 'DATE', 'LEVEL_NAME', 'LEVEL_NUMBER', 'CLUB_NAME', 'CUSTOM_TEXT');

-- CreateEnum
CREATE TYPE "CertificateStatus" AS ENUM ('AWARDED', 'PRINTED', 'DELIVERED');

-- CreateEnum
CREATE TYPE "CertificateType" AS ENUM ('LEVEL_COMPLETION', 'SPECIAL_ACHIEVEMENT', 'PARTICIPATION');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "password" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "clubId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "shareCode" TEXT,
    "passwordResetToken" TEXT,
    "passwordResetTokenExpiresAt" TIMESTAMP(3),
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "archivedById" TEXT,
    "archivedReason" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clubs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "codeOfTheDay" TEXT,
    "codeOfTheDayExpiresAt" TIMESTAMP(3),
    "accentColor" TEXT DEFAULT '#e74c3c',
    "backgroundColor" TEXT DEFAULT '#f8f9fa',
    "customCss" TEXT,
    "description" TEXT,
    "fontFamily" TEXT DEFAULT 'Arial, sans-serif',
    "logoUrl" TEXT,
    "primaryColor" TEXT DEFAULT '#3498db',
    "secondaryColor" TEXT DEFAULT '#2c3e50',
    "textColor" TEXT DEFAULT '#212529',
    "website" TEXT,

    CONSTRAINT "clubs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gymnasts" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "clubId" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "coachNotes" TEXT,
    "archivedAt" TIMESTAMP(3),
    "archivedById" TEXT,
    "archivedReason" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "gymnasts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "levels" (
    "id" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "identifier" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "LevelType",
    "prerequisiteId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skills" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "levelId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routines" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "levelId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "isAlternative" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "routines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routine_skills" (
    "id" TEXT NOT NULL,
    "routineId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "routine_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "routine_progress" (
    "id" TEXT NOT NULL,
    "gymnastId" TEXT NOT NULL,
    "routineId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ProgressStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "notes" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "routine_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_progress" (
    "id" TEXT NOT NULL,
    "gymnastId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ProgressStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "notes" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "skill_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "level_progress" (
    "id" TEXT NOT NULL,
    "gymnastId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "routineId" TEXT,
    "userId" TEXT NOT NULL,
    "status" "ProgressStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "level_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guardian_requests" (
    "id" TEXT NOT NULL,
    "guardianId" TEXT NOT NULL,
    "gymnastId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "processedBy" TEXT,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guardian_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invites" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "acceptedById" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'COACH',
    "token" TEXT NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competitions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "category" TEXT NOT NULL,

    CONSTRAINT "competitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "level_competitions" (
    "id" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "level_competitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificate_templates" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "certificate_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificate_fields" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "fieldType" "CertificateFieldType" NOT NULL,
    "label" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "width" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,
    "fontSize" INTEGER NOT NULL DEFAULT 18,
    "fontFamily" TEXT NOT NULL DEFAULT 'Arial',
    "fontColor" TEXT NOT NULL DEFAULT '#000000',
    "fontWeight" TEXT NOT NULL DEFAULT 'normal',
    "textAlign" TEXT NOT NULL DEFAULT 'center',
    "rotation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "customText" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "certificate_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificates" (
    "id" TEXT NOT NULL,
    "gymnastId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "awardedById" TEXT NOT NULL,
    "type" "CertificateType" NOT NULL DEFAULT 'LEVEL_COMPLETION',
    "status" "CertificateStatus" NOT NULL DEFAULT 'AWARDED',
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "printedAt" TIMESTAMP(3),
    "printedById" TEXT,
    "physicallyAwardedAt" TIMESTAMP(3),
    "physicallyAwardedById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "clubId" TEXT NOT NULL,
    "templateId" TEXT,

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_GuardianGymnasts" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "levels_identifier_key" ON "levels"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "routine_skills_routineId_skillId_key" ON "routine_skills"("routineId", "skillId");

-- CreateIndex
CREATE UNIQUE INDEX "routine_progress_gymnastId_routineId_key" ON "routine_progress"("gymnastId", "routineId");

-- CreateIndex
CREATE UNIQUE INDEX "skill_progress_gymnastId_skillId_key" ON "skill_progress"("gymnastId", "skillId");

-- CreateIndex
CREATE UNIQUE INDEX "level_progress_gymnastId_levelId_key" ON "level_progress"("gymnastId", "levelId");

-- CreateIndex
CREATE UNIQUE INDEX "guardian_requests_guardianId_gymnastId_key" ON "guardian_requests"("guardianId", "gymnastId");

-- CreateIndex
CREATE UNIQUE INDEX "invites_token_key" ON "invites"("token");

-- CreateIndex
CREATE UNIQUE INDEX "invites_email_clubId_status_key" ON "invites"("email", "clubId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "competitions_code_key" ON "competitions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "level_competitions_levelId_competitionId_key" ON "level_competitions"("levelId", "competitionId");

-- CreateIndex
CREATE UNIQUE INDEX "certificate_fields_templateId_fieldType_order_key" ON "certificate_fields"("templateId", "fieldType", "order");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_gymnastId_levelId_type_key" ON "certificates"("gymnastId", "levelId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "_GuardianGymnasts_AB_unique" ON "_GuardianGymnasts"("A", "B");

-- CreateIndex
CREATE INDEX "_GuardianGymnasts_B_index" ON "_GuardianGymnasts"("B");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_archivedById_fkey" FOREIGN KEY ("archivedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "clubs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gymnasts" ADD CONSTRAINT "gymnasts_archivedById_fkey" FOREIGN KEY ("archivedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gymnasts" ADD CONSTRAINT "gymnasts_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gymnasts" ADD CONSTRAINT "gymnasts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "levels" ADD CONSTRAINT "levels_prerequisiteId_fkey" FOREIGN KEY ("prerequisiteId") REFERENCES "levels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skills" ADD CONSTRAINT "skills_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routines" ADD CONSTRAINT "routines_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_skills" ADD CONSTRAINT "routine_skills_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "routines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_skills" ADD CONSTRAINT "routine_skills_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "skills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_progress" ADD CONSTRAINT "routine_progress_gymnastId_fkey" FOREIGN KEY ("gymnastId") REFERENCES "gymnasts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_progress" ADD CONSTRAINT "routine_progress_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "routines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "routine_progress" ADD CONSTRAINT "routine_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_progress" ADD CONSTRAINT "skill_progress_gymnastId_fkey" FOREIGN KEY ("gymnastId") REFERENCES "gymnasts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_progress" ADD CONSTRAINT "skill_progress_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "skills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_progress" ADD CONSTRAINT "skill_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "level_progress" ADD CONSTRAINT "level_progress_gymnastId_fkey" FOREIGN KEY ("gymnastId") REFERENCES "gymnasts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "level_progress" ADD CONSTRAINT "level_progress_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "level_progress" ADD CONSTRAINT "level_progress_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "routines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "level_progress" ADD CONSTRAINT "level_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian_requests" ADD CONSTRAINT "guardian_requests_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian_requests" ADD CONSTRAINT "guardian_requests_gymnastId_fkey" FOREIGN KEY ("gymnastId") REFERENCES "gymnasts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian_requests" ADD CONSTRAINT "guardian_requests_requestedBy_fkey" FOREIGN KEY ("requestedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invites" ADD CONSTRAINT "invites_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invites" ADD CONSTRAINT "invites_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invites" ADD CONSTRAINT "invites_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "level_competitions" ADD CONSTRAINT "level_competitions_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "level_competitions" ADD CONSTRAINT "level_competitions_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate_templates" ADD CONSTRAINT "certificate_templates_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificate_fields" ADD CONSTRAINT "certificate_fields_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "certificate_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_awardedById_fkey" FOREIGN KEY ("awardedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_gymnastId_fkey" FOREIGN KEY ("gymnastId") REFERENCES "gymnasts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_physicallyAwardedById_fkey" FOREIGN KEY ("physicallyAwardedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_printedById_fkey" FOREIGN KEY ("printedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "certificate_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GuardianGymnasts" ADD CONSTRAINT "_GuardianGymnasts_A_fkey" FOREIGN KEY ("A") REFERENCES "gymnasts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_GuardianGymnasts" ADD CONSTRAINT "_GuardianGymnasts_B_fkey" FOREIGN KEY ("B") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
