// Distinguishes Actual vs Committed(remaining) vs Accrued, per requirement §18/§88.
export interface CostExposureInputs {
  actualCost: number;
  committedTotal: number; // revised commitment value
  committedInvoicedOrActualized: number; // portion of commitment already posted as Actual
  accruedAmount: number;
}

export interface CostExposureResult {
  actualCost: number;
  remainingCommitment: number;
  accruedAmount: number;
  costExposure: number; // Actual + remaining commitment + accrued
}

export function computeCostExposure({
  actualCost,
  committedTotal,
  committedInvoicedOrActualized,
  accruedAmount,
}: CostExposureInputs): CostExposureResult {
  const remainingCommitment = round2(Math.max(0, committedTotal - committedInvoicedOrActualized));
  const costExposure = round2(actualCost + remainingCommitment + accruedAmount);
  return { actualCost: round2(actualCost), remainingCommitment, accruedAmount: round2(accruedAmount), costExposure };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
