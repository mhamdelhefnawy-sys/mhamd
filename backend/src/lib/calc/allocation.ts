export interface AllocationInput {
  wbsId?: string | null;
  boqItemId?: string | null;
  costCodeId?: string | null;
  costCategoryId?: string | null;
  percentage: number;
}

const EPSILON = 0.01; // percent tolerance

export function validateAllocation(lines: AllocationInput[], allowOverride = false) {
  const total = lines.reduce((sum, l) => sum + l.percentage, 0);
  const diff = Math.abs(total - 100);
  if (diff > EPSILON && !allowOverride) {
    throw new Error(
      `Allocation must total 100% (got ${total.toFixed(2)}%). Use an authorized override to bypass.`
    );
  }
  return { total, isValid: diff <= EPSILON };
}

export function computeAllocationAmounts(netAmount: number, lines: AllocationInput[]) {
  return lines.map((l) => ({
    ...l,
    amount: Math.round(((netAmount * l.percentage) / 100) * 100) / 100,
  }));
}
