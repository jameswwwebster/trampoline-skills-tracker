-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT');

-- CreateTable
CREATE TABLE "attendances" (
    "id" TEXT NOT NULL,
    "sessionInstanceId" TEXT NOT NULL,
    "gymnastId" TEXT NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "markedById" TEXT NOT NULL,
    "markedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attendances_sessionInstanceId_gymnastId_key" ON "attendances"("sessionInstanceId", "gymnastId");

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_sessionInstanceId_fkey" FOREIGN KEY ("sessionInstanceId") REFERENCES "session_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_gymnastId_fkey" FOREIGN KEY ("gymnastId") REFERENCES "gymnasts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_markedById_fkey" FOREIGN KEY ("markedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
