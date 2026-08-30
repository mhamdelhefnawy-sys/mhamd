-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "headOfficeOverheadPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "insuranceRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "provisionRate" DECIMAL(5,2) NOT NULL DEFAULT 0;
