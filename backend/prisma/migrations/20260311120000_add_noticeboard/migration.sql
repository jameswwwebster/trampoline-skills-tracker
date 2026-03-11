CREATE TABLE "NoticeboardPost" (
  "id"        TEXT NOT NULL,
  "clubId"    TEXT NOT NULL,
  "authorId"  TEXT NOT NULL,
  "title"     TEXT NOT NULL,
  "body"      TEXT NOT NULL,
  "archiveAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NoticeboardPost_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NoticeboardRead" (
  "id"     TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NoticeboardRead_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "NoticeboardPost"
  ADD CONSTRAINT "NoticeboardPost_clubId_fkey"
  FOREIGN KEY ("clubId") REFERENCES "clubs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "NoticeboardPost"
  ADD CONSTRAINT "NoticeboardPost_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "NoticeboardRead"
  ADD CONSTRAINT "NoticeboardRead_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "NoticeboardPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NoticeboardRead"
  ADD CONSTRAINT "NoticeboardRead_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "NoticeboardRead_postId_userId_key"
  ON "NoticeboardRead"("postId", "userId");
