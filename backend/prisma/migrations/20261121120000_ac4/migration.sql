CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');
CREATE TYPE "ActivityAction" AS ENUM (
  'TRANSACTION_CREATED', 'TRANSACTION_UPDATED', 'TRANSACTION_DELETED',
  'CATEGORY_CREATED', 'ACCOUNT_ACTIVATED', 'ACCOUNT_DEACTIVATED'
);

ALTER TABLE "User"
  ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER',
  ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX "Category_id_userId_key" ON "Category"("id", "userId");
CREATE INDEX "Transaction_userId_type_createdAt_idx" ON "Transaction"("userId", "type", "createdAt");

CREATE TABLE "SpendingLimit" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  "categoryId" INTEGER NOT NULL,
  "month" INTEGER NOT NULL CHECK ("month" BETWEEN 1 AND 12),
  "year" INTEGER NOT NULL CHECK ("year" BETWEEN 1900 AND 9998),
  "amount" DECIMAL(10,2) NOT NULL CHECK ("amount" > 0),
  CONSTRAINT "SpendingLimit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SpendingLimit_categoryId_userId_fkey" FOREIGN KEY ("categoryId", "userId") REFERENCES "Category"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SpendingLimit_userId_categoryId_year_month_key" ON "SpendingLimit"("userId", "categoryId", "year", "month");

CREATE TABLE "Activity" (
  "id" SERIAL PRIMARY KEY,
  "actorId" INTEGER NOT NULL,
  "actorAccountId" INTEGER,
  CONSTRAINT "Activity_actor_identity_check" CHECK ("actorAccountId" = "actorId"),
  "action" "ActivityAction" NOT NULL,
  "recordId" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Activity_actorAccountId_fkey" FOREIGN KEY ("actorAccountId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "Activity_actorAccountId_idx" ON "Activity"("actorAccountId");
CREATE INDEX "Activity_createdAt_id_idx" ON "Activity"("createdAt", "id");
