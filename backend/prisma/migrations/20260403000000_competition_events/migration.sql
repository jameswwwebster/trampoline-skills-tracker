-- CreateEnum
CREATE TYPE "CompetitionEntryStatus" AS ENUM ('INVITED', 'PAYMENT_PENDING', 'PAID', 'DECLINED');

-- CreateTable
CREATE TABLE "competition_events" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "entryDeadline" TIMESTAMP(3) NOT NULL,
    "lateEntryFee" INTEGER,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competition_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competition_categories" (
    "id" TEXT NOT NULL,
    "competitionEventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "competition_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competition_category_skill_levels" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "skillCompetitionId" TEXT NOT NULL,

    CONSTRAINT "competition_category_skill_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competition_price_tiers" (
    "id" TEXT NOT NULL,
    "competitionEventId" TEXT NOT NULL,
    "entryNumber" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,

    CONSTRAINT "competition_price_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competition_entries" (
    "id" TEXT NOT NULL,
    "competitionEventId" TEXT NOT NULL,
    "gymnastId" TEXT NOT NULL,
    "status" "CompetitionEntryStatus" NOT NULL DEFAULT 'INVITED',
    "totalAmount" INTEGER,
    "stripePaymentIntentId" TEXT,
    "coachConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competition_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competition_entry_categories" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "competition_entry_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "competition_category_skill_levels_categoryId_skillCompetitionId_key" ON "competition_category_skill_levels"("categoryId", "skillCompetitionId");

-- CreateIndex
CREATE UNIQUE INDEX "competition_price_tiers_competitionEventId_entryNumber_key" ON "competition_price_tiers"("competitionEventId", "entryNumber");

-- CreateIndex
CREATE UNIQUE INDEX "competition_entries_competitionEventId_gymnastId_key" ON "competition_entries"("competitionEventId", "gymnastId");

-- CreateIndex
CREATE UNIQUE INDEX "competition_entry_categories_entryId_categoryId_key" ON "competition_entry_categories"("entryId", "categoryId");

-- AddForeignKey
ALTER TABLE "competition_events" ADD CONSTRAINT "competition_events_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_categories" ADD CONSTRAINT "competition_categories_competitionEventId_fkey" FOREIGN KEY ("competitionEventId") REFERENCES "competition_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_category_skill_levels" ADD CONSTRAINT "competition_category_skill_levels_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "competition_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_category_skill_levels" ADD CONSTRAINT "competition_category_skill_levels_skillCompetitionId_fkey" FOREIGN KEY ("skillCompetitionId") REFERENCES "competitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_price_tiers" ADD CONSTRAINT "competition_price_tiers_competitionEventId_fkey" FOREIGN KEY ("competitionEventId") REFERENCES "competition_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_entries" ADD CONSTRAINT "competition_entries_competitionEventId_fkey" FOREIGN KEY ("competitionEventId") REFERENCES "competition_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_entries" ADD CONSTRAINT "competition_entries_gymnastId_fkey" FOREIGN KEY ("gymnastId") REFERENCES "gymnasts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_entry_categories" ADD CONSTRAINT "competition_entry_categories_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "competition_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competition_entry_categories" ADD CONSTRAINT "competition_entry_categories_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "competition_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
