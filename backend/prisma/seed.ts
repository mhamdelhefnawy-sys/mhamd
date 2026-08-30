import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Standard permission matrix seeded per role (module, action, allowed).
// Modules match the frontend navigation / backend route prefixes.
const MODULES = [
  "projects", "wbs", "cost_codes", "boq", "budget", "variations", "actual_cost",
  "commitments", "accruals", "subcontractors", "materials", "manpower", "equipment",
  "indirect_costs", "fixed_assets", "progress", "forecast", "evm", "dashboard",
  "alerts", "reports", "users", "roles", "audit", "work_packages", "approvals", "settings",
];
const ACTIONS = ["view", "create", "edit", "delete", "approve", "post", "export", "import", "print", "review", "reverse", "manage_users", "manage_settings"];

function fullAccess() {
  return MODULES.flatMap((module) => ACTIONS.map((action) => ({ module, action, allowed: true })));
}

function viewOnly() {
  return MODULES.flatMap((module) => [
    { module, action: "view", allowed: true },
    { module, action: "export", allowed: true },
    { module, action: "print", allowed: true },
  ]);
}

function costEngineerAccess() {
  const editable = ["boq", "budget", "actual_cost", "commitments", "accruals", "progress", "forecast", "evm", "cost_codes", "wbs", "reports", "alerts"];
  return [
    ...editable.flatMap((module) => [
      { module, action: "view", allowed: true },
      { module, action: "create", allowed: true },
      { module, action: "edit", allowed: true },
      { module, action: "export", allowed: true },
    ]),
    { module: "dashboard", action: "view", allowed: true },
  ];
}

function storekeeperAccess() {
  return [
    { module: "materials", action: "view", allowed: true },
    { module: "materials", action: "create", allowed: true },
    { module: "dashboard", action: "view", allowed: true },
  ];
}

async function main() {
  console.log("Seeding demo data...");

  const company = await prisma.company.create({
    data: { name: "Al-Bina Construction Co.", address: "Riyadh, Saudi Arabia", phone: "+966 11 000 0000" },
  });

  await prisma.systemSettings.create({
    data: { companyId: company.id, defaultCurrency: "SAR", defaultVatRate: 15 },
  });

  // ── Roles ────────────────────────────────────────────────────────────
  const [superAdmin, pm, ccm, costEngineer, storekeeper, viewer] = await Promise.all([
    prisma.role.create({ data: { companyId: company.id, name: "Super Administrator", isSystem: true, permissions: { create: fullAccess() } } }),
    prisma.role.create({ data: { companyId: company.id, name: "Project Manager", permissions: { create: fullAccess() } } }),
    prisma.role.create({ data: { companyId: company.id, name: "Cost Control Manager", permissions: { create: fullAccess() } } }),
    prisma.role.create({ data: { companyId: company.id, name: "Cost Engineer", permissions: { create: costEngineerAccess() } } }),
    prisma.role.create({ data: { companyId: company.id, name: "Storekeeper", permissions: { create: storekeeperAccess() } } }),
    prisma.role.create({ data: { companyId: company.id, name: "Management / Viewer", permissions: { create: viewOnly() } } }),
  ]);
  await Promise.all([
    prisma.role.create({ data: { companyId: company.id, name: "Quantity Surveyor", permissions: { create: costEngineerAccess() } } }),
    prisma.role.create({ data: { companyId: company.id, name: "Planning Engineer", permissions: { create: costEngineerAccess() } } }),
    prisma.role.create({ data: { companyId: company.id, name: "Accountant", permissions: { create: costEngineerAccess() } } }),
    prisma.role.create({ data: { companyId: company.id, name: "Procurement", permissions: { create: costEngineerAccess() } } }),
    prisma.role.create({ data: { companyId: company.id, name: "Commercial Manager", permissions: { create: fullAccess() } } }),
  ]);

  // ── Users ───────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash("Passw0rd!123", 10);
  const admin = await prisma.user.create({
    data: {
      companyId: company.id,
      email: "admin@albina.sa",
      passwordHash,
      fullName: "Ahmed Al-Rashid",
      jobTitle: "Super Administrator",
      roles: { create: { roleId: superAdmin.id } },
    },
  });
  await prisma.user.create({
    data: {
      companyId: company.id,
      email: "ccm@albina.sa",
      passwordHash,
      fullName: "Fatimah Al-Zahrani",
      jobTitle: "Cost Control Manager",
      roles: { create: { roleId: ccm.id } },
    },
  });
  await prisma.user.create({
    data: {
      companyId: company.id,
      email: "engineer@albina.sa",
      passwordHash,
      fullName: "Khalid Al-Otaibi",
      jobTitle: "Cost Engineer",
      roles: { create: { roleId: costEngineer.id } },
    },
  });
  await prisma.user.create({
    data: {
      companyId: company.id,
      email: "store@albina.sa",
      passwordHash,
      fullName: "Yusuf Al-Ghamdi",
      jobTitle: "Storekeeper",
      roles: { create: { roleId: storekeeper.id } },
    },
  });
  await prisma.user.create({
    data: {
      companyId: company.id,
      email: "viewer@albina.sa",
      passwordHash,
      fullName: "Sara Al-Harbi",
      jobTitle: "Management",
      roles: { create: { roleId: viewer.id } },
    },
  });

  // ── Project ─────────────────────────────────────────────────────────
  const project = await prisma.project.create({
    data: {
      companyId: company.id,
      code: "PRJ-001",
      name: "Al-Noor Residential Towers",
      client: "Al-Noor Real Estate Development",
      mainContractor: "Al-Bina Construction Co.",
      consultant: "Gulf Engineering Consultants",
      contractNumber: "CN-2025-0142",
      contractType: "Lump Sum",
      originalContractValue: 62_000_000,
      currentContractValue: 63_500_000,
      contractStartDate: new Date("2025-02-01"),
      originalFinishDate: new Date("2027-01-31"),
      currentFinishDate: new Date("2027-03-31"),
      currency: "SAR",
      vatRate: 15,
      projectManager: "Ahmed Al-Rashid",
      costControlManager: "Fatimah Al-Zahrani",
      status: "ACTIVE",
      location: "Riyadh, Saudi Arabia",
      description: "Two 20-storey residential towers with shared podium, MEP, and landscaping.",
      eacFormula: "BAC_OVER_CPI",
      allowedWasteDefault: 2,
    },
  });

  // ── Work Packages ───────────────────────────────────────────────────
  const wpNames: [string, string][] = [
    ["WP-CIV", "Civil Works"],
    ["WP-CON", "Concrete"],
    ["WP-REI", "Reinforcement"],
    ["WP-FRM", "Formwork"],
    ["WP-MAS", "Masonry"],
    ["WP-MEP", "MEP"],
    ["WP-FIN", "Finishing"],
  ];
  const workPackages = Object.fromEntries(
    await Promise.all(
      wpNames.map(async ([code, name]) => [code, await prisma.workPackage.create({ data: { projectId: project.id, code, name } })])
    )
  );

  // ── WBS (Project > Division > Building > Zone) ─────────────────────
  const wbsDivisionCivil = await prisma.wBS.create({ data: { projectId: project.id, code: "D1", name: "Civil & Structure", level: 0 } });
  const wbsTowerA = await prisma.wBS.create({ data: { projectId: project.id, parentId: wbsDivisionCivil.id, code: "D1-A", name: "Tower A", level: 1 } });
  const wbsTowerB = await prisma.wBS.create({ data: { projectId: project.id, parentId: wbsDivisionCivil.id, code: "D1-B", name: "Tower B", level: 1 } });
  const wbsDivisionMep = await prisma.wBS.create({ data: { projectId: project.id, code: "D2", name: "MEP", level: 0 } });
  const wbsDivisionFinishing = await prisma.wBS.create({ data: { projectId: project.id, code: "D3", name: "Finishing & External Works", level: 0 } });

  // ── Cost Categories ─────────────────────────────────────────────────
  const catNames: [string, string][] = [
    ["MAT", "Material"], ["SUB", "Subcontractor"], ["SKL", "Skilled Manpower"],
    ["UNS", "Unskilled Manpower"], ["EQP", "Equipment"], ["EXP", "Site Expense"],
    ["IND", "Indirect Cost"], ["OTH", "Other"],
  ];
  const categories = Object.fromEntries(
    await Promise.all(catNames.map(async ([code, name]) => [code, await prisma.costCategory.create({ data: { projectId: project.id, code, name } })]))
  );

  // ── Cost Codes ──────────────────────────────────────────────────────
  const costCodeDefs: [string, string, string][] = [
    ["03-300", "Concrete Works", "MAT"],
    ["03-200", "Reinforcement Steel", "MAT"],
    ["03-100", "Formwork", "SUB"],
    ["04-200", "Masonry", "SUB"],
    ["09-900", "Painting & Finishes", "SUB"],
    ["15-400", "Plumbing", "SUB"],
    ["15-800", "HVAC", "SUB"],
    ["16-100", "Electrical", "SUB"],
    ["01-500", "Site Management & Indirect", "IND"],
  ];
  const costCodes = Object.fromEntries(
    await Promise.all(
      costCodeDefs.map(async ([code, description, catKey]) => [
        code,
        await prisma.costCode.create({
          data: { projectId: project.id, code, description, division: code.split("-")[0], costCategoryId: categories[catKey].id },
        }),
      ])
    )
  );

  // ── BOQ Items ───────────────────────────────────────────────────────
  const boqDefs = [
    { itemNumber: "B-001", description: "Reinforced Concrete Foundations", unit: "m3", quantity: 8500, unitRate: 320, wbs: wbsTowerA, costCode: "03-300", wp: "WP-CON" },
    { itemNumber: "B-002", description: "Reinforced Concrete Columns & Slabs", unit: "m3", quantity: 14200, unitRate: 340, wbs: wbsTowerA, costCode: "03-300", wp: "WP-CON" },
    { itemNumber: "B-003", description: "Reinforcement Steel (Rebar)", unit: "ton", quantity: 2100, unitRate: 3200, wbs: wbsTowerA, costCode: "03-200", wp: "WP-REI" },
    { itemNumber: "B-004", description: "Formwork - Columns & Slabs", unit: "m2", quantity: 46000, unitRate: 55, wbs: wbsTowerA, costCode: "03-100", wp: "WP-FRM" },
    { itemNumber: "B-005", description: "Block Masonry Walls 20cm", unit: "m2", quantity: 28000, unitRate: 65, wbs: wbsTowerB, costCode: "04-200", wp: "WP-MAS" },
    { itemNumber: "B-006", description: "Internal Painting", unit: "m2", quantity: 52000, unitRate: 22, wbs: wbsDivisionFinishing, costCode: "09-900", wp: "WP-FIN" },
    { itemNumber: "B-007", description: "Plumbing Rough-in & Fixtures", unit: "LS", quantity: 1, unitRate: 3_800_000, wbs: wbsDivisionMep, costCode: "15-400", wp: "WP-MEP" },
    { itemNumber: "B-008", description: "HVAC Installation", unit: "LS", quantity: 1, unitRate: 5_200_000, wbs: wbsDivisionMep, costCode: "15-800", wp: "WP-MEP" },
    { itemNumber: "B-009", description: "Electrical Installation", unit: "LS", quantity: 1, unitRate: 4_600_000, wbs: wbsDivisionMep, costCode: "16-100", wp: "WP-MEP" },
    { itemNumber: "B-010", description: "Site Management & Supervision", unit: "month", quantity: 24, unitRate: 180_000, wbs: wbsDivisionCivil, costCode: "01-500", wp: "WP-CIV" },
  ];
  const boqItems: Record<string, Awaited<ReturnType<typeof prisma.bOQItem.create>>> = {};
  for (const d of boqDefs) {
    const totalAmount = round2(d.quantity * d.unitRate);
    const item = await prisma.bOQItem.create({
      data: {
        projectId: project.id,
        itemNumber: d.itemNumber,
        description: d.description,
        unit: d.unit,
        quantity: d.quantity,
        unitRate: d.unitRate,
        totalAmount,
        wbsId: d.wbs.id,
        costCodeId: costCodes[d.costCode].id,
        workPackageId: (workPackages[d.wp] as any).id,
        status: "ORIGINAL",
      },
    });
    await prisma.bOQRevisionLine.create({
      data: { boqItemId: item.id, revisionNo: 1, reason: "Original BOQ entry", quantity: d.quantity, unitRate: d.unitRate, totalAmount, status: "ORIGINAL" },
    });
    boqItems[d.itemNumber] = item;
  }

  // ── Variation ───────────────────────────────────────────────────────
  await prisma.variation.create({
    data: { projectId: project.id, number: "VO-01", title: "Additional basement waterproofing", amount: 1_500_000, status: "APPROVED", approvedAt: new Date("2025-06-15") },
  });

  // ── Budget (Original, from BOQ) ─────────────────────────────────────
  const originalBudget = await prisma.budget.create({
    data: {
      projectId: project.id,
      version: 1,
      label: "Original Budget",
      status: "APPROVED",
      approvedAt: new Date("2025-02-10"),
      lines: {
        create: boqDefs.map((d) => ({
          projectId: project.id,
          wbsId: d.wbs.id,
          boqItemId: boqItems[d.itemNumber].id,
          costCodeId: costCodes[d.costCode].id,
          costCategoryId: categories.MAT.id,
          budgetQuantity: d.quantity,
          budgetRate: d.unitRate,
          budgetAmount: round2(d.quantity * d.unitRate),
        })),
      },
    },
  });

  // ── Subcontractors / Subcontracts / Certificates ────────────────────
  const sub1 = await prisma.subcontractor.create({ data: { projectId: project.id, companyName: "Gulf Rebar & Concrete LLC", scope: "Concrete & Reinforcement" } });
  const contract1 = await prisma.subcontract.create({
    data: {
      subcontractorId: sub1.id, projectId: project.id, contractNumber: "SC-001", scope: "Concrete & Reinforcement Works",
      costCodeId: costCodes["03-300"].id, originalValue: 9_500_000, approvedVariations: 200_000, revisedValue: 9_700_000,
      advancePercent: 10, retentionPercent: 5, status: "POSTED",
    },
  });
  await prisma.paymentCertificate.create({
    data: { subcontractId: contract1.id, certificateNumber: "IPC-01", periodDate: new Date("2025-08-31"), grossWorkDone: 1_200_000, cumulativeWorkDone: 1_200_000, advanceRecovery: 120_000, retentionHeld: 60_000, netPayable: 1_020_000, status: "CERTIFIED" },
  });
  await prisma.paymentCertificate.create({
    data: { subcontractId: contract1.id, certificateNumber: "IPC-02", periodDate: new Date("2026-06-30"), grossWorkDone: 2_850_000, cumulativeWorkDone: 4_050_000, advanceRecovery: 285_000, retentionHeld: 142_500, netPayable: 2_422_500, status: "CERTIFIED" },
  });

  const sub2 = await prisma.subcontractor.create({ data: { projectId: project.id, companyName: "Precision MEP Contracting", scope: "MEP Works" } });
  const contract2 = await prisma.subcontract.create({
    data: {
      subcontractorId: sub2.id, projectId: project.id, contractNumber: "SC-002", scope: "Plumbing, HVAC & Electrical",
      costCodeId: costCodes["15-800"].id, originalValue: 12_800_000, approvedVariations: 0, revisedValue: 12_800_000,
      advancePercent: 10, retentionPercent: 5, status: "POSTED",
    },
  });
  await prisma.paymentCertificate.create({
    data: { subcontractId: contract2.id, certificateNumber: "IPC-01", periodDate: new Date("2026-06-30"), grossWorkDone: 1_450_000, cumulativeWorkDone: 1_450_000, advanceRecovery: 145_000, retentionHeld: 72_500, netPayable: 1_232_500, status: "CERTIFIED" },
  });

  // ── Commitments ─────────────────────────────────────────────────────
  await prisma.commitment.create({
    data: {
      projectId: project.id, type: "SUBCONTRACT", number: "SC-001", vendorName: "Gulf Rebar & Concrete LLC",
      subcontractId: contract1.id, wbsId: wbsTowerA.id, costCodeId: costCodes["03-300"].id,
      originalAmount: 9_500_000, approvedVariations: 200_000, certifiedAmount: 4_050_000, paidAmount: 3_642_500, status: "POSTED",
    },
  });
  await prisma.commitment.create({
    data: {
      projectId: project.id, type: "SUBCONTRACT", number: "SC-002", vendorName: "Precision MEP Contracting",
      subcontractId: contract2.id, wbsId: wbsDivisionMep.id, costCodeId: costCodes["15-800"].id,
      originalAmount: 12_800_000, approvedVariations: 0, certifiedAmount: 1_450_000, paidAmount: 1_087_500, status: "POSTED",
    },
  });
  await prisma.commitment.create({
    data: {
      projectId: project.id, type: "MATERIAL_ORDER", number: "PO-1042", vendorName: "Saudi Steel Trading Co.",
      wbsId: wbsTowerA.id, costCodeId: costCodes["03-200"].id, originalAmount: 6_700_000, certifiedAmount: 4_200_000, status: "POSTED",
    },
  });

  // ── Actual Costs ────────────────────────────────────────────────────
  const actualDefs = [
    { date: "2026-01-15", description: "Rebar delivery - Batch 4", supplier: "Saudi Steel Trading Co.", netAmount: 1_050_000, boqItem: "B-003", costCode: "03-200", category: "MAT" },
    { date: "2026-02-20", description: "Concrete pour - Tower A L12-L14", supplier: "Gulf Rebar & Concrete LLC", netAmount: 1_820_000, boqItem: "B-002", costCode: "03-300", category: "SUB" },
    { date: "2026-03-05", description: "Formwork rental - March", supplier: "Al-Faisal Formwork Rentals", netAmount: 410_000, boqItem: "B-004", costCode: "03-100", category: "EQP" },
    { date: "2026-04-12", description: "Masonry works progress", supplier: "Eastern Masonry Est.", netAmount: 980_000, boqItem: "B-005", costCode: "04-200", category: "SUB" },
    { date: "2026-05-18", description: "Site management payroll - May", supplier: null, netAmount: 185_000, boqItem: "B-010", costCode: "01-500", category: "IND" },
    { date: "2026-06-30", description: "MEP works - HVAC ductwork", supplier: "Precision MEP Contracting", netAmount: 1_450_000, boqItem: "B-008", costCode: "15-800", category: "SUB" },
  ];
  for (const a of actualDefs) {
    const vat = round2(a.netAmount * 0.15);
    await prisma.actualCostTransaction.create({
      data: {
        projectId: project.id, date: new Date(a.date), description: a.description, supplier: a.supplier ?? undefined,
        netAmount: a.netAmount, vatAmount: vat, grossAmount: round2(a.netAmount + vat),
        boqItemId: boqItems[a.boqItem].id, wbsId: boqItems[a.boqItem].wbsId, costCodeId: costCodes[a.costCode].id,
        costCategoryId: categories[a.category].id, status: "POSTED", isUnallocated: false,
        allocations: {
          create: [{ boqItemId: boqItems[a.boqItem].id, wbsId: boqItems[a.boqItem].wbsId, costCodeId: costCodes[a.costCode].id, costCategoryId: categories[a.category].id, percentage: 100, amount: a.netAmount }],
        },
      },
    });
  }

  // An intentionally unallocated invoice, to demonstrate the Unallocated Cost report / alert.
  const unallocatedTx = await prisma.actualCostTransaction.create({
    data: {
      projectId: project.id, date: new Date("2026-07-01"), description: "Miscellaneous site invoice - pending coding",
      supplier: "Various", netAmount: 125_000, vatAmount: 18_750, grossAmount: 143_750, status: "POSTED", isUnallocated: true,
    },
  });
  await prisma.alert.create({
    data: { projectId: project.id, severity: "YELLOW", message: `Unallocated cost of SAR ${Number(unallocatedTx.netAmount).toLocaleString()} requires coding`, entityType: "ActualCostTransaction", entityId: unallocatedTx.id },
  });

  // ── Accruals ────────────────────────────────────────────────────────
  await prisma.accrual.create({
    data: { projectId: project.id, periodDate: new Date("2026-06-30"), description: "MEP works executed, invoice pending", workDoneAmount: 1_650_000, invoicedAmount: 1_450_000, accruedAmount: 200_000, boqItemId: boqItems["B-008"].id, costCodeId: costCodes["15-800"].id, status: "APPROVED" },
  });
  await prisma.accrual.create({
    data: { projectId: project.id, periodDate: new Date("2026-06-30"), description: "Concrete works executed, IPC pending", workDoneAmount: 4_400_000, invoicedAmount: 4_050_000, accruedAmount: 350_000, boqItemId: boqItems["B-002"].id, costCodeId: costCodes["03-300"].id, status: "APPROVED" },
  });

  // ── Materials + Storage + Loss ──────────────────────────────────────
  const cementMat = await prisma.material.create({ data: { projectId: project.id, code: "MAT-CEM", description: "OPC Cement (bulk)", unit: "ton", costCodeId: costCodes["03-300"].id, allowedWastePercent: 2, standardRate: 380 } });
  await prisma.materialReceipt.create({ data: { materialId: cementMat.id, date: new Date("2026-01-10"), supplier: "Yamama Cement Co.", quantity: 3200, unitRate: 380, amount: 1_216_000, reference: "GRN-2201" } });
  await prisma.materialIssue.create({ data: { materialId: cementMat.id, date: new Date("2026-02-01"), boqItemId: boqItems["B-002"].id, quantity: 2900, issuedTo: "Batching Plant" } });
  await prisma.materialConsumption.create({ data: { materialId: cementMat.id, date: new Date("2026-02-28"), boqItemId: boqItems["B-002"].id, budgetQuantity: 2750, quantity: 2879 } });
  await prisma.materialLoss.create({
    data: { materialId: cementMat.id, date: new Date("2026-02-28"), budgetQuantity: 2750, actualUsedQuantity: 2879, lossQuantity: 129, allowedWastePercent: 2, actualWastePercent: 4.69, lossCost: round2((2879 - 2750 * 1.02) * 380) },
  });

  const rebarMat = await prisma.material.create({ data: { projectId: project.id, code: "MAT-REB", description: "Rebar 16mm", unit: "ton", costCodeId: costCodes["03-200"].id, allowedWastePercent: 3, standardRate: 3200 } });
  await prisma.materialReceipt.create({ data: { materialId: rebarMat.id, date: new Date("2026-01-15"), supplier: "Saudi Steel Trading Co.", quantity: 850, unitRate: 3200, amount: 2_720_000, reference: "GRN-2210" } });
  await prisma.materialIssue.create({ data: { materialId: rebarMat.id, date: new Date("2026-02-10"), boqItemId: boqItems["B-003"].id, quantity: 780, issuedTo: "Site" } });

  // ── Manpower ────────────────────────────────────────────────────────
  await prisma.manpowerEntry.create({ data: { projectId: project.id, date: new Date("2026-05-31"), category: "Skilled", trade: "Steel Fixer", wbsId: wbsTowerA.id, costCodeId: costCodes["03-200"].id, headcount: 24, days: 26, rate: 180, totalCost: round2(24 * 26 * 180) } });
  await prisma.manpowerEntry.create({ data: { projectId: project.id, date: new Date("2026-05-31"), category: "Unskilled", trade: "General Labor", wbsId: wbsTowerA.id, costCodeId: costCodes["03-300"].id, headcount: 40, days: 26, rate: 90, totalCost: round2(40 * 26 * 90) } });
  await prisma.manpowerEntry.create({ data: { projectId: project.id, date: new Date("2026-05-31"), category: "Supervisor", trade: "Site Supervision", wbsId: wbsDivisionCivil.id, costCodeId: costCodes["01-500"].id, headcount: 4, days: 26, rate: 350, totalCost: round2(4 * 26 * 350) } });

  // ── Equipment ───────────────────────────────────────────────────────
  await prisma.equipmentEntry.create({ data: { projectId: project.id, date: new Date("2026-05-31"), equipmentName: "Tower Crane TC-01", equipmentType: "Tower Crane", ownership: "RENTED", dailyRate: 3500, operatingHours: 0, standbyHours: 0, wbsId: wbsTowerA.id, costCodeId: costCodes["03-300"].id, totalCost: round2(3500 * 26) } });
  await prisma.equipmentEntry.create({ data: { projectId: project.id, date: new Date("2026-05-31"), equipmentName: "Concrete Pump CP-02", equipmentType: "Concrete Pump", ownership: "RENTED", hourlyRate: 450, operatingHours: 180, standbyHours: 20, fuelCost: 22_000, maintenanceCost: 8_000, wbsId: wbsTowerA.id, costCodeId: costCodes["03-300"].id, totalCost: round2(450 * 200 + 22_000 + 8_000) } });

  // ── Indirect Costs ──────────────────────────────────────────────────
  await prisma.indirectCostEntry.create({ data: { projectId: project.id, date: new Date("2026-05-31"), category: "Site Offices", description: "Site office rental & utilities - May", amount: 65_000, costCodeId: costCodes["01-500"].id } });
  await prisma.indirectCostEntry.create({ data: { projectId: project.id, date: new Date("2026-05-31"), category: "Security", description: "Site security services - May", amount: 42_000, costCodeId: costCodes["01-500"].id } });
  await prisma.indirectCostEntry.create({ data: { projectId: project.id, date: new Date("2026-05-31"), category: "Insurance", description: "CAR insurance premium (monthly allocation)", amount: 28_000, costCodeId: costCodes["01-500"].id } });

  // ── Progress ────────────────────────────────────────────────────────
  await prisma.progressEntry.create({ data: { projectId: project.id, date: new Date("2026-06-30"), method: "MANUAL", plannedPercent: 48, actualPercent: 41 } });
  await prisma.progressEntry.create({ data: { projectId: project.id, date: new Date("2026-06-30"), wbsId: wbsTowerA.id, boqItemId: boqItems["B-002"].id, method: "QUANTITY_BASED", plannedPercent: 55, actualPercent: round2((6200 / 14200) * 100), executedQuantity: 6200 } });
  await prisma.progressEntry.create({ data: { projectId: project.id, date: new Date("2026-06-30"), wbsId: wbsTowerA.id, boqItemId: boqItems["B-003"].id, method: "QUANTITY_BASED", plannedPercent: 50, actualPercent: round2((900 / 2100) * 100), executedQuantity: 900 } });
  await prisma.progressEntry.create({ data: { projectId: project.id, date: new Date("2026-06-30"), wbsId: wbsDivisionMep.id, boqItemId: boqItems["B-008"].id, method: "MANUAL", plannedPercent: 30, actualPercent: 28 } });

  // ── Alert Rules ─────────────────────────────────────────────────────
  const cpiRules: [string, number][] = [["GTE", 1.0], ["LT", 1.0], ["LT", 0.85], ["LT", 0.65]];
  const severities = ["GREEN", "YELLOW", "RED", "BLACK"] as const;
  for (let i = 0; i < cpiRules.length; i++) {
    await prisma.alertRule.create({ data: { projectId: project.id, metric: "CPI", operator: cpiRules[i][0] as any, threshold: cpiRules[i][1], severity: severities[i] } });
    await prisma.alertRule.create({ data: { projectId: project.id, metric: "SPI", operator: cpiRules[i][0] as any, threshold: cpiRules[i][1], severity: severities[i] } });
  }

  console.log("Seed complete.");
  console.log("Login: admin@albina.sa / Passw0rd!123 (Super Administrator)");
  console.log("Other demo users: ccm@albina.sa, engineer@albina.sa, store@albina.sa, viewer@albina.sa (same password)");
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
