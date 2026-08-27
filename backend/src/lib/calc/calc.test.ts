import { describe, expect, it } from "vitest";
import { computeEVM } from "./evm";
import { computeForecast } from "./forecast";
import { computeQtyRateVariance } from "./variance";
import { computeMaterialLoss } from "./materialLoss";
import { validateAllocation, computeAllocationAmounts } from "./allocation";
import { computeBudgetRollup } from "./budget";

describe("EVM", () => {
  it("computes CV/SV/CPI/SPI correctly", () => {
    const r = computeEVM({ bac: 1_000_000, plannedPercent: 60, actualPercent: 50, actualCost: 550_000 });
    expect(r.pv).toBe(600_000);
    expect(r.ev).toBe(500_000);
    expect(r.cv).toBe(-50_000);
    expect(r.sv).toBe(-100_000);
    expect(r.cpi).toBeCloseTo(0.9091, 3);
    expect(r.spi).toBeCloseTo(0.8333, 3);
  });
});

describe("Forecast / EAC", () => {
  it("BAC_OVER_CPI matches BAC/CPI", () => {
    const r = computeForecast({ bac: 1_000_000, ac: 550_000, ev: 500_000, cpi: 0.9091, formula: "BAC_OVER_CPI" });
    expect(r.eac).toBeCloseTo(1_100_000, -2);
    expect(r.vac).toBeCloseTo(-100_000, -2);
  });

  it("manual ETC override wins regardless of formula", () => {
    const r = computeForecast({
      bac: 1_000_000,
      ac: 550_000,
      ev: 500_000,
      cpi: 0.9091,
      formula: "BAC_OVER_CPI",
      manualETC: 400_000,
    });
    expect(r.eac).toBe(950_000);
    expect(r.isManualOverride).toBe(true);
  });
});

describe("Quantity vs Rate variance", () => {
  it("splits total variance correctly", () => {
    // Budget: 10,000 m3 @ 300 = 3,000,000 ; Actual: 6,200 m3 @ 310
    const r = computeQtyRateVariance({
      budgetQuantity: 10_000,
      budgetRate: 300,
      actualQuantity: 6_200,
      actualRate: 310,
    });
    expect(r.budgetAmount).toBe(3_000_000);
    expect(r.actualAmount).toBe(1_922_000);
    // qtyVar = (10000-6200)*300 = 1,140,000 ; rateVar = (300-310)*6200 = -62,000
    expect(r.quantityVariance).toBe(1_140_000);
    expect(r.rateVariance).toBe(-62_000);
    expect(r.totalVariance).toBe(1_078_000);
  });
});

describe("Material loss", () => {
  it("flags excess waste above allowed %", () => {
    // Budget waste 2%, actual waste 4.7% per the spec example
    const r = computeMaterialLoss({
      budgetQuantity: 1000,
      actualUsedQuantity: 1047,
      allowedWastePercent: 2,
      unitRate: 50,
    });
    expect(r.actualWastePercent).toBe(4.7);
    expect(r.excessWastePercent).toBe(2.7);
    expect(r.isOverAllowed).toBe(true);
    // allowed qty = 1020, excess = 27 units * 50 = 1350
    expect(r.excessQuantity).toBe(27);
    expect(r.excessCost).toBe(1350);
  });
});

describe("Allocation", () => {
  it("rejects allocations that don't sum to 100%", () => {
    expect(() => validateAllocation([{ percentage: 40 }, { percentage: 40 }])).toThrow();
  });
  it("splits amount by percentage", () => {
    const amounts = computeAllocationAmounts(20_000, [{ percentage: 30 }, { percentage: 70 }]);
    expect(amounts[0].amount).toBe(6_000);
    expect(amounts[1].amount).toBe(14_000);
  });
});

describe("Budget rollup", () => {
  it("Original + Approved Variations = Current Budget", () => {
    const r = computeBudgetRollup({ originalBudget: 50_000_000, approvedVariations: 1_500_000 });
    expect(r.currentBudget).toBe(51_500_000);
  });
});
