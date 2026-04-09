-- CreateTable: guardian_invites
CREATE TABLE "guardian_invites" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "gymnastId" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guardian_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guardian_invites_token_key" ON "guardian_invites"("token");

-- AddForeignKey
ALTER TABLE "guardian_invites" ADD CONSTRAINT "guardian_invites_gymnastId_fkey"
    FOREIGN KEY ("gymnastId") REFERENCES "gymnasts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "guardian_invites" ADD CONSTRAINT "guardian_invites_invitedById_fkey"
    FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "guardian_invites" ADD CONSTRAINT "guardian_invites_acceptedById_fkey"
    FOREIGN KEY ("acceptedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: named_contacts
CREATE TABLE "named_contacts" (
    "id" TEXT NOT NULL,
    "gymnastId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "named_contacts_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "named_contacts" ADD CONSTRAINT "named_contacts_gymnastId_fkey"
    FOREIGN KEY ("gymnastId") REFERENCES "gymnasts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "named_contacts" ADD CONSTRAINT "named_contacts_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
