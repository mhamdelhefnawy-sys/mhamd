-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('PLANNING', 'ACTIVE', 'ON_HOLD', 'CLOSED');

-- CreateEnum
CREATE TYPE "BOQStatus" AS ENUM ('ORIGINAL', 'REVISED', 'APPROVED_VARIATION', 'PENDING_VARIATION', 'FINAL');

-- CreateEnum
CREATE TYPE "VariationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "BudgetStatus" AS ENUM ('DRAFT', 'APPROVED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "TxStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'REVIEWED', 'APPROVED', 'POSTED', 'REVERSED');

-- CreateEnum
CREATE TYPE "CommitmentType" AS ENUM ('PURCHASE_ORDER', 'SUBCONTRACT', 'MATERIAL_ORDER', 'EQUIPMENT_CONTRACT', 'SERVICE_ORDER');

-- CreateEnum
CREATE TYPE "CertificateStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'CERTIFIED', 'PAID');

-- CreateEnum
CREATE TYPE "ProgressMethod" AS ENUM ('MANUAL', 'QUANTITY_BASED', 'WEIGHTED_BOQ');

-- CreateEnum
CREATE TYPE "PeriodStatus" AS ENUM ('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'FINALIZED');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('GREEN', 'YELLOW', 'RED', 'BLACK');

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "jobTitle" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "client" TEXT,
    "mainContractor" TEXT,
    "consultant" TEXT,
    "contractNumber" TEXT,
    "contractType" TEXT,
    "originalContractValue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "currentContractValue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "contractStartDate" TIMESTAMP(3),
    "originalFinishDate" TIMESTAMP(3),
    "currentFinishDate" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 15,
    "projectManager" TEXT,
    "costControlManager" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'PLANNING',
    "location" TEXT,
    "description" TEXT,
    "eacFormula" TEXT NOT NULL DEFAULT 'AC_PLUS_ETC',
    "allowedWasteDefault" DECIMAL(5,2) NOT NULL DEFAULT 2,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkPackage" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "WorkPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WBS" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "parentId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WBS_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostCategory" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CostCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostCode" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "parentId" TEXT,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "division" TEXT,
    "costCategoryId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,

    CONSTRAINT "CostCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BOQItem" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "itemNumber" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitRate" DECIMAL(18,4) NOT NULL,
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "division" TEXT,
    "section" TEXT,
    "wbsId" TEXT,
    "costCodeId" TEXT,
    "workPackageId" TEXT,
    "progressWeight" DECIMAL(9,6),
    "status" "BOQStatus" NOT NULL DEFAULT 'ORIGINAL',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BOQItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BOQRevisionLine" (
    "id" TEXT NOT NULL,
    "boqItemId" TEXT NOT NULL,
    "revisionNo" INTEGER NOT NULL,
    "reason" TEXT,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitRate" DECIMAL(18,4) NOT NULL,
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "status" "BOQStatus" NOT NULL,
    "changedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BOQRevisionLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Variation" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "status" "VariationStatus" NOT NULL DEFAULT 'DRAFT',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Variation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Budget" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "status" "BudgetStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetLine" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "wbsId" TEXT,
    "boqItemId" TEXT,
    "costCodeId" TEXT,
    "costCategoryId" TEXT,
    "budgetQuantity" DECIMAL(18,4),
    "budgetRate" DECIMAL(18,4),
    "budgetAmount" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "BudgetLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetRevision" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "deltaAmount" DECIMAL(18,2) NOT NULL,
    "changedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BudgetRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActualCostTransaction" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "documentNumber" TEXT,
    "supplier" TEXT,
    "subcontractorId" TEXT,
    "employeeName" TEXT,
    "materialId" TEXT,
    "equipmentEntryId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(18,4),
    "unit" TEXT,
    "unitRate" DECIMAL(18,4),
    "netAmount" DECIMAL(18,2) NOT NULL,
    "vatAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "grossAmount" DECIMAL(18,2) NOT NULL,
    "wbsId" TEXT,
    "boqItemId" TEXT,
    "costCodeId" TEXT,
    "costCategoryId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "exchangeRate" DECIMAL(12,6) NOT NULL DEFAULT 1,
    "reference" TEXT,
    "status" "TxStatus" NOT NULL DEFAULT 'DRAFT',
    "isUnallocated" BOOLEAN NOT NULL DEFAULT false,
    "reversedById" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActualCostTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CostAllocation" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "wbsId" TEXT,
    "boqItemId" TEXT,
    "costCodeId" TEXT,
    "costCategoryId" TEXT,
    "percentage" DECIMAL(7,4) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "CostAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commitment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "CommitmentType" NOT NULL,
    "number" TEXT NOT NULL,
    "vendorName" TEXT NOT NULL,
    "subcontractId" TEXT,
    "wbsId" TEXT,
    "boqItemId" TEXT,
    "costCodeId" TEXT,
    "originalAmount" DECIMAL(18,2) NOT NULL,
    "approvedVariations" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "certifiedAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "paidAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "forecastFinalCost" DECIMAL(18,2),
    "status" "TxStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Commitment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommitmentLine" (
    "id" TEXT NOT NULL,
    "commitmentId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(18,4),
    "unit" TEXT,
    "unitRate" DECIMAL(18,4),
    "amount" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "CommitmentLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Accrual" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "periodDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "workDoneAmount" DECIMAL(18,2) NOT NULL,
    "invoicedAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "accruedAmount" DECIMAL(18,2) NOT NULL,
    "wbsId" TEXT,
    "boqItemId" TEXT,
    "costCodeId" TEXT,
    "status" "TxStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Accrual_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subcontractor" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "scope" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subcontractor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subcontract" (
    "id" TEXT NOT NULL,
    "subcontractorId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "contractNumber" TEXT NOT NULL,
    "scope" TEXT,
    "costCodeId" TEXT,
    "originalValue" DECIMAL(18,2) NOT NULL,
    "approvedVariations" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "revisedValue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "advancePercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "retentionPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "status" "TxStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subcontract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentCertificate" (
    "id" TEXT NOT NULL,
    "subcontractId" TEXT NOT NULL,
    "certificateNumber" TEXT NOT NULL,
    "periodDate" TIMESTAMP(3) NOT NULL,
    "grossWorkDone" DECIMAL(18,2) NOT NULL,
    "cumulativeWorkDone" DECIMAL(18,2) NOT NULL,
    "advanceRecovery" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "retentionHeld" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "deductions" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "backCharges" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "netPayable" DECIMAL(18,2) NOT NULL,
    "status" "CertificateStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentCertificate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "costCodeId" TEXT,
    "allowedWastePercent" DECIMAL(5,2) NOT NULL DEFAULT 2,
    "standardRate" DECIMAL(18,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialReceipt" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "supplier" TEXT,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitRate" DECIMAL(18,4) NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialIssue" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "wbsId" TEXT,
    "boqItemId" TEXT,
    "quantity" DECIMAL(18,4) NOT NULL,
    "issuedTo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialReturn" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialConsumption" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "wbsId" TEXT,
    "boqItemId" TEXT,
    "budgetQuantity" DECIMAL(18,4),
    "quantity" DECIMAL(18,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialConsumption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialLoss" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "budgetQuantity" DECIMAL(18,4) NOT NULL,
    "actualUsedQuantity" DECIMAL(18,4) NOT NULL,
    "lossQuantity" DECIMAL(18,4) NOT NULL,
    "allowedWastePercent" DECIMAL(5,2) NOT NULL,
    "actualWastePercent" DECIMAL(5,2) NOT NULL,
    "lossCost" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialLoss_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManpowerEntry" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "category" TEXT NOT NULL,
    "trade" TEXT,
    "wbsId" TEXT,
    "boqItemId" TEXT,
    "costCodeId" TEXT,
    "headcount" DECIMAL(9,2) NOT NULL DEFAULT 1,
    "hours" DECIMAL(9,2),
    "days" DECIMAL(9,2),
    "rate" DECIMAL(18,4) NOT NULL,
    "overtimeHours" DECIMAL(9,2) NOT NULL DEFAULT 0,
    "overtimeRate" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "totalCost" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManpowerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentEntry" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "equipmentName" TEXT NOT NULL,
    "equipmentType" TEXT,
    "ownership" TEXT NOT NULL,
    "dailyRate" DECIMAL(18,4),
    "hourlyRate" DECIMAL(18,4),
    "operatingHours" DECIMAL(9,2) NOT NULL DEFAULT 0,
    "standbyHours" DECIMAL(9,2) NOT NULL DEFAULT 0,
    "fuelCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "maintenanceCost" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "operator" TEXT,
    "wbsId" TEXT,
    "costCodeId" TEXT,
    "totalCost" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EquipmentEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndirectCostEntry" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "allocationMethod" TEXT NOT NULL DEFAULT 'PROJECT_LEVEL',
    "wbsId" TEXT,
    "costCodeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IndirectCostEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FixedAsset" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "assetTag" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "purchaseDate" TIMESTAMP(3) NOT NULL,
    "purchaseCost" DECIMAL(18,2) NOT NULL,
    "usefulLifeMonths" INTEGER NOT NULL,
    "depreciationMethod" TEXT NOT NULL DEFAULT 'STRAIGHT_LINE',
    "costCodeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FixedAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepreciationEntry" (
    "id" TEXT NOT NULL,
    "fixedAssetId" TEXT NOT NULL,
    "periodDate" TIMESTAMP(3) NOT NULL,
    "monthlyDepreciation" DECIMAL(18,2) NOT NULL,
    "accumulatedDepreciation" DECIMAL(18,2) NOT NULL,
    "netBookValue" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DepreciationEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgressEntry" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "wbsId" TEXT,
    "boqItemId" TEXT,
    "costCodeId" TEXT,
    "method" "ProgressMethod" NOT NULL DEFAULT 'MANUAL',
    "plannedPercent" DECIMAL(7,4),
    "actualPercent" DECIMAL(7,4),
    "executedQuantity" DECIMAL(18,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgressEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForecastEntry" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "wbsId" TEXT,
    "boqItemId" TEXT,
    "costCodeId" TEXT,
    "scenario" TEXT NOT NULL DEFAULT 'MOST_LIKELY',
    "isManualOverride" BOOLEAN NOT NULL DEFAULT false,
    "manualETC" DECIMAL(18,2),
    "manualForecastCost" DECIMAL(18,2),
    "forecastRate" DECIMAL(18,4),
    "overrideReason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForecastEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EVMSnapshot" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "asOfDate" TIMESTAMP(3) NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'PROJECT',
    "bac" DECIMAL(18,2) NOT NULL,
    "pv" DECIMAL(18,2) NOT NULL,
    "ev" DECIMAL(18,2) NOT NULL,
    "ac" DECIMAL(18,2) NOT NULL,
    "cv" DECIMAL(18,2) NOT NULL,
    "sv" DECIMAL(18,2) NOT NULL,
    "cpi" DECIMAL(9,4) NOT NULL,
    "spi" DECIMAL(9,4) NOT NULL,
    "etc" DECIMAL(18,2) NOT NULL,
    "eac" DECIMAL(18,2) NOT NULL,
    "vac" DECIMAL(18,2) NOT NULL,
    "tcpi" DECIMAL(9,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EVMSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportingPeriod" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "cutoffDate" TIMESTAMP(3) NOT NULL,
    "status" "PeriodStatus" NOT NULL DEFAULT 'DRAFT',
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportingPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportSnapshot" (
    "id" TEXT NOT NULL,
    "reportingPeriodId" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertRule" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "threshold" DECIMAL(18,4) NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AlertRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "message" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSettings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "reportNumberFormat" TEXT NOT NULL DEFAULT 'CR-{project}-{seq:03d}',
    "defaultCurrency" TEXT NOT NULL DEFAULT 'SAR',
    "defaultVatRate" DECIMAL(5,2) NOT NULL DEFAULT 15,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualCostTransactionId" TEXT,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Role_companyId_name_key" ON "Role"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_roleId_module_action_key" ON "RolePermission"("roleId", "module", "action");

-- CreateIndex
CREATE UNIQUE INDEX "Project_companyId_code_key" ON "Project"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "WorkPackage_projectId_code_key" ON "WorkPackage"("projectId", "code");

-- CreateIndex
CREATE INDEX "WBS_projectId_parentId_idx" ON "WBS"("projectId", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "WBS_projectId_code_key" ON "WBS"("projectId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "CostCategory_projectId_code_key" ON "CostCategory"("projectId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "CostCode_projectId_code_key" ON "CostCode"("projectId", "code");

-- CreateIndex
CREATE INDEX "BOQItem_projectId_wbsId_idx" ON "BOQItem"("projectId", "wbsId");

-- CreateIndex
CREATE INDEX "BOQItem_projectId_costCodeId_idx" ON "BOQItem"("projectId", "costCodeId");

-- CreateIndex
CREATE UNIQUE INDEX "BOQItem_projectId_itemNumber_key" ON "BOQItem"("projectId", "itemNumber");

-- CreateIndex
CREATE INDEX "BOQRevisionLine_boqItemId_idx" ON "BOQRevisionLine"("boqItemId");

-- CreateIndex
CREATE UNIQUE INDEX "Variation_projectId_number_key" ON "Variation"("projectId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Budget_projectId_version_key" ON "Budget"("projectId", "version");

-- CreateIndex
CREATE INDEX "BudgetLine_budgetId_idx" ON "BudgetLine"("budgetId");

-- CreateIndex
CREATE INDEX "BudgetLine_projectId_costCodeId_idx" ON "BudgetLine"("projectId", "costCodeId");

-- CreateIndex
CREATE INDEX "ActualCostTransaction_projectId_date_idx" ON "ActualCostTransaction"("projectId", "date");

-- CreateIndex
CREATE INDEX "ActualCostTransaction_projectId_costCodeId_idx" ON "ActualCostTransaction"("projectId", "costCodeId");

-- CreateIndex
CREATE INDEX "ActualCostTransaction_projectId_isUnallocated_idx" ON "ActualCostTransaction"("projectId", "isUnallocated");

-- CreateIndex
CREATE INDEX "CostAllocation_transactionId_idx" ON "CostAllocation"("transactionId");

-- CreateIndex
CREATE INDEX "Commitment_projectId_costCodeId_idx" ON "Commitment"("projectId", "costCodeId");

-- CreateIndex
CREATE UNIQUE INDEX "Commitment_projectId_number_key" ON "Commitment"("projectId", "number");

-- CreateIndex
CREATE INDEX "Accrual_projectId_periodDate_idx" ON "Accrual"("projectId", "periodDate");

-- CreateIndex
CREATE UNIQUE INDEX "Subcontract_projectId_contractNumber_key" ON "Subcontract"("projectId", "contractNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentCertificate_subcontractId_certificateNumber_key" ON "PaymentCertificate"("subcontractId", "certificateNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Material_projectId_code_key" ON "Material"("projectId", "code");

-- CreateIndex
CREATE INDEX "ManpowerEntry_projectId_date_idx" ON "ManpowerEntry"("projectId", "date");

-- CreateIndex
CREATE INDEX "EquipmentEntry_projectId_date_idx" ON "EquipmentEntry"("projectId", "date");

-- CreateIndex
CREATE INDEX "IndirectCostEntry_projectId_date_idx" ON "IndirectCostEntry"("projectId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "FixedAsset_projectId_assetTag_key" ON "FixedAsset"("projectId", "assetTag");

-- CreateIndex
CREATE INDEX "ProgressEntry_projectId_date_idx" ON "ProgressEntry"("projectId", "date");

-- CreateIndex
CREATE INDEX "ForecastEntry_projectId_wbsId_idx" ON "ForecastEntry"("projectId", "wbsId");

-- CreateIndex
CREATE INDEX "EVMSnapshot_projectId_asOfDate_idx" ON "EVMSnapshot"("projectId", "asOfDate");

-- CreateIndex
CREATE UNIQUE INDEX "ReportingPeriod_projectId_periodLabel_key" ON "ReportingPeriod"("projectId", "periodLabel");

-- CreateIndex
CREATE INDEX "ReportSnapshot_reportingPeriodId_reportType_idx" ON "ReportSnapshot"("reportingPeriodId", "reportType");

-- CreateIndex
CREATE INDEX "Alert_projectId_isRead_idx" ON "Alert"("projectId", "isRead");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSettings_companyId_key" ON "SystemSettings"("companyId");

-- CreateIndex
CREATE INDEX "Attachment_entityType_entityId_idx" ON "Attachment"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkPackage" ADD CONSTRAINT "WorkPackage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WBS" ADD CONSTRAINT "WBS_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WBS" ADD CONSTRAINT "WBS_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "WBS"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostCategory" ADD CONSTRAINT "CostCategory_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostCode" ADD CONSTRAINT "CostCode_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostCode" ADD CONSTRAINT "CostCode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CostCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostCode" ADD CONSTRAINT "CostCode_costCategoryId_fkey" FOREIGN KEY ("costCategoryId") REFERENCES "CostCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BOQItem" ADD CONSTRAINT "BOQItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BOQItem" ADD CONSTRAINT "BOQItem_wbsId_fkey" FOREIGN KEY ("wbsId") REFERENCES "WBS"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BOQItem" ADD CONSTRAINT "BOQItem_costCodeId_fkey" FOREIGN KEY ("costCodeId") REFERENCES "CostCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BOQItem" ADD CONSTRAINT "BOQItem_workPackageId_fkey" FOREIGN KEY ("workPackageId") REFERENCES "WorkPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BOQRevisionLine" ADD CONSTRAINT "BOQRevisionLine_boqItemId_fkey" FOREIGN KEY ("boqItemId") REFERENCES "BOQItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Variation" ADD CONSTRAINT "Variation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_wbsId_fkey" FOREIGN KEY ("wbsId") REFERENCES "WBS"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_boqItemId_fkey" FOREIGN KEY ("boqItemId") REFERENCES "BOQItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_costCodeId_fkey" FOREIGN KEY ("costCodeId") REFERENCES "CostCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_costCategoryId_fkey" FOREIGN KEY ("costCategoryId") REFERENCES "CostCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetRevision" ADD CONSTRAINT "BudgetRevision_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActualCostTransaction" ADD CONSTRAINT "ActualCostTransaction_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActualCostTransaction" ADD CONSTRAINT "ActualCostTransaction_subcontractorId_fkey" FOREIGN KEY ("subcontractorId") REFERENCES "Subcontractor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActualCostTransaction" ADD CONSTRAINT "ActualCostTransaction_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActualCostTransaction" ADD CONSTRAINT "ActualCostTransaction_wbsId_fkey" FOREIGN KEY ("wbsId") REFERENCES "WBS"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActualCostTransaction" ADD CONSTRAINT "ActualCostTransaction_boqItemId_fkey" FOREIGN KEY ("boqItemId") REFERENCES "BOQItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActualCostTransaction" ADD CONSTRAINT "ActualCostTransaction_costCodeId_fkey" FOREIGN KEY ("costCodeId") REFERENCES "CostCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActualCostTransaction" ADD CONSTRAINT "ActualCostTransaction_costCategoryId_fkey" FOREIGN KEY ("costCategoryId") REFERENCES "CostCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostAllocation" ADD CONSTRAINT "CostAllocation_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "ActualCostTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostAllocation" ADD CONSTRAINT "CostAllocation_wbsId_fkey" FOREIGN KEY ("wbsId") REFERENCES "WBS"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostAllocation" ADD CONSTRAINT "CostAllocation_boqItemId_fkey" FOREIGN KEY ("boqItemId") REFERENCES "BOQItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostAllocation" ADD CONSTRAINT "CostAllocation_costCodeId_fkey" FOREIGN KEY ("costCodeId") REFERENCES "CostCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CostAllocation" ADD CONSTRAINT "CostAllocation_costCategoryId_fkey" FOREIGN KEY ("costCategoryId") REFERENCES "CostCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commitment" ADD CONSTRAINT "Commitment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commitment" ADD CONSTRAINT "Commitment_subcontractId_fkey" FOREIGN KEY ("subcontractId") REFERENCES "Subcontract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commitment" ADD CONSTRAINT "Commitment_wbsId_fkey" FOREIGN KEY ("wbsId") REFERENCES "WBS"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commitment" ADD CONSTRAINT "Commitment_boqItemId_fkey" FOREIGN KEY ("boqItemId") REFERENCES "BOQItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commitment" ADD CONSTRAINT "Commitment_costCodeId_fkey" FOREIGN KEY ("costCodeId") REFERENCES "CostCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommitmentLine" ADD CONSTRAINT "CommitmentLine_commitmentId_fkey" FOREIGN KEY ("commitmentId") REFERENCES "Commitment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Accrual" ADD CONSTRAINT "Accrual_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Accrual" ADD CONSTRAINT "Accrual_wbsId_fkey" FOREIGN KEY ("wbsId") REFERENCES "WBS"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Accrual" ADD CONSTRAINT "Accrual_boqItemId_fkey" FOREIGN KEY ("boqItemId") REFERENCES "BOQItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Accrual" ADD CONSTRAINT "Accrual_costCodeId_fkey" FOREIGN KEY ("costCodeId") REFERENCES "CostCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subcontractor" ADD CONSTRAINT "Subcontractor_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subcontract" ADD CONSTRAINT "Subcontract_subcontractorId_fkey" FOREIGN KEY ("subcontractorId") REFERENCES "Subcontractor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentCertificate" ADD CONSTRAINT "PaymentCertificate_subcontractId_fkey" FOREIGN KEY ("subcontractId") REFERENCES "Subcontract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialReceipt" ADD CONSTRAINT "MaterialReceipt_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialIssue" ADD CONSTRAINT "MaterialIssue_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialReturn" ADD CONSTRAINT "MaterialReturn_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialConsumption" ADD CONSTRAINT "MaterialConsumption_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialLoss" ADD CONSTRAINT "MaterialLoss_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManpowerEntry" ADD CONSTRAINT "ManpowerEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentEntry" ADD CONSTRAINT "EquipmentEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndirectCostEntry" ADD CONSTRAINT "IndirectCostEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepreciationEntry" ADD CONSTRAINT "DepreciationEntry_fixedAssetId_fkey" FOREIGN KEY ("fixedAssetId") REFERENCES "FixedAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressEntry" ADD CONSTRAINT "ProgressEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressEntry" ADD CONSTRAINT "ProgressEntry_wbsId_fkey" FOREIGN KEY ("wbsId") REFERENCES "WBS"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressEntry" ADD CONSTRAINT "ProgressEntry_boqItemId_fkey" FOREIGN KEY ("boqItemId") REFERENCES "BOQItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressEntry" ADD CONSTRAINT "ProgressEntry_costCodeId_fkey" FOREIGN KEY ("costCodeId") REFERENCES "CostCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForecastEntry" ADD CONSTRAINT "ForecastEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForecastEntry" ADD CONSTRAINT "ForecastEntry_wbsId_fkey" FOREIGN KEY ("wbsId") REFERENCES "WBS"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForecastEntry" ADD CONSTRAINT "ForecastEntry_boqItemId_fkey" FOREIGN KEY ("boqItemId") REFERENCES "BOQItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForecastEntry" ADD CONSTRAINT "ForecastEntry_costCodeId_fkey" FOREIGN KEY ("costCodeId") REFERENCES "CostCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EVMSnapshot" ADD CONSTRAINT "EVMSnapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportingPeriod" ADD CONSTRAINT "ReportingPeriod_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportSnapshot" ADD CONSTRAINT "ReportSnapshot_reportingPeriodId_fkey" FOREIGN KEY ("reportingPeriodId") REFERENCES "ReportingPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertRule" ADD CONSTRAINT "AlertRule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_actualCostTransactionId_fkey" FOREIGN KEY ("actualCostTransactionId") REFERENCES "ActualCostTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
