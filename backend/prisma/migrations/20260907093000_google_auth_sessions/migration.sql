-- AlterTable
ALTER TABLE "User" ADD COLUMN "googleSubject" TEXT;

-- CreateTable
CREATE TABLE "Session" (
    "tokenHash" CHAR(64) NOT NULL,
    "userId" UUID NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_pkey" PRIMARY KEY ("tokenHash")
);

CREATE TABLE "OAuthLogin" (
    "stateHash" CHAR(64) NOT NULL,
    "bindingHash" CHAR(64) NOT NULL,
    "nonce" TEXT NOT NULL,
    "verifier" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "OAuthLogin_pkey" PRIMARY KEY ("stateHash")
);

CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
CREATE INDEX "OAuthLogin_expiresAt_idx" ON "OAuthLogin"("expiresAt");
CREATE INDEX "OAuthLogin_bindingHash_idx" ON "OAuthLogin"("bindingHash");
CREATE UNIQUE INDEX "User_googleSubject_key" ON "User"("googleSubject");
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
