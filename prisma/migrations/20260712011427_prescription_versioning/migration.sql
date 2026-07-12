/*
  Warnings:

  - A unique constraint covering the columns `[supersedes_id]` on the table `prescriptions` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "PrescriptionStatus" AS ENUM ('ACTIVE', 'SUPERSEDED');

-- DropIndex
DROP INDEX "prescriptions_consultation_id_key";

-- AlterTable
ALTER TABLE "prescriptions" ADD COLUMN     "pdf_url" TEXT,
ADD COLUMN     "status" "PrescriptionStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "supersedes_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "prescriptions_supersedes_id_key" ON "prescriptions"("supersedes_id");

-- CreateIndex
CREATE INDEX "prescriptions_consultation_id_idx" ON "prescriptions"("consultation_id");

-- AddForeignKey
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_supersedes_id_fkey" FOREIGN KEY ("supersedes_id") REFERENCES "prescriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
