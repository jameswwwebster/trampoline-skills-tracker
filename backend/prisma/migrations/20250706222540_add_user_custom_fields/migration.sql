-- CreateEnum
CREATE TYPE "CustomFieldType" AS ENUM ('TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'EMAIL', 'PHONE', 'DROPDOWN', 'MULTI_SELECT', 'TEXTAREA');

-- CreateTable
CREATE TABLE "user_custom_fields" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "fieldType" "CustomFieldType" NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "options" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_custom_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_custom_field_values" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "value" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_custom_field_values_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_custom_fields_clubId_key_key" ON "user_custom_fields"("clubId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "user_custom_field_values_userId_fieldId_key" ON "user_custom_field_values"("userId", "fieldId");

-- AddForeignKey
ALTER TABLE "user_custom_fields" ADD CONSTRAINT "user_custom_fields_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "clubs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_custom_field_values" ADD CONSTRAINT "user_custom_field_values_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_custom_field_values" ADD CONSTRAINT "user_custom_field_values_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "user_custom_fields"("id") ON DELETE CASCADE ON UPDATE CASCADE;
