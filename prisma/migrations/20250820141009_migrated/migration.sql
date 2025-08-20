-- CreateEnum
CREATE TYPE "public"."ContextType" AS ENUM ('PDF', 'DOCX', 'TXT', 'JSON', 'CSV', 'LINK', 'TEXT');

-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('user', 'system');

-- CreateTable
CREATE TABLE "public"."Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Companion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "img" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "instructions" TEXT,
    "seed" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "Companion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CompanionContext" (
    "id" TEXT NOT NULL,
    "type" "public"."ContextType" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "fileName" TEXT,
    "filePath" TEXT,
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companionId" TEXT NOT NULL,

    CONSTRAINT "CompanionContext_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Message" (
    "id" TEXT NOT NULL,
    "role" "public"."Role" NOT NULL,
    "content" TEXT NOT NULL,
    "created" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stripe_customer_id" TEXT,
    "stripe_subscription_id" TEXT,
    "stripe_price_id" TEXT,
    "stripe_current_period_end" TIMESTAMP(3),

    CONSTRAINT "UserSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Companion_categoryId_idx" ON "public"."Companion"("categoryId");

-- CreateIndex
CREATE INDEX "CompanionContext_companionId_idx" ON "public"."CompanionContext"("companionId");

-- CreateIndex
CREATE INDEX "Message_companionId_idx" ON "public"."Message"("companionId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSubscription_userId_key" ON "public"."UserSubscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSubscription_stripe_customer_id_key" ON "public"."UserSubscription"("stripe_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "UserSubscription_stripe_subscription_id_key" ON "public"."UserSubscription"("stripe_subscription_id");

-- CreateIndex
CREATE UNIQUE INDEX "UserSubscription_stripe_price_id_key" ON "public"."UserSubscription"("stripe_price_id");
