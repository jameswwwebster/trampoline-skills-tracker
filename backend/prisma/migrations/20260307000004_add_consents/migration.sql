CREATE TABLE "consents" (
    "id" TEXT NOT NULL,
    "gymnastId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "consents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "consents_gymnastId_type_key" ON "consents"("gymnastId", "type");

ALTER TABLE "consents" ADD CONSTRAINT "consents_gymnastId_fkey"
  FOREIGN KEY ("gymnastId") REFERENCES "gymnasts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
