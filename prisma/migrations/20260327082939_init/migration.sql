-- CreateEnum
CREATE TYPE "ListingSessionStatus" AS ENUM ('collecting', 'processing', 'ready', 'editing', 'publishing', 'published', 'failed');

-- CreateEnum
CREATE TYPE "SessionAssetKind" AS ENUM ('photo', 'audio');

-- CreateEnum
CREATE TYPE "SessionAssetStatus" AS ENUM ('uploaded', 'processed', 'deleted');

-- CreateTable
CREATE TABLE "ListingSession" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "status" "ListingSessionStatus" NOT NULL,
    "sourceText" TEXT,
    "transcript" TEXT,
    "extractedFacts" JSONB,
    "generatedDraft" JSONB,
    "editedDraft" JSONB,
    "sanityDocumentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListingSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionAsset" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "kind" "SessionAssetKind" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "status" "SessionAssetStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SessionAsset_sessionId_idx" ON "SessionAsset"("sessionId");

-- AddForeignKey
ALTER TABLE "SessionAsset" ADD CONSTRAINT "SessionAsset_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ListingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
