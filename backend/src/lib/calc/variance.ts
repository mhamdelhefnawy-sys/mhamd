// Splits total cost variance into Quantity Variance and Rate Variance per BOQ/cost-code line.
// QtyVariance  = (BudgetQty - ActualQty) x BudgetRate
// RateVariance = (BudgetRate - ActualRate) x ActualQty
// TotalVariance = BudgetAmount - ActualAmount = QtyVariance + RateVariance

export interface QtyRateVarianceInputs {
  budgetQuantity: number;
  budgetRate: number;
  actualQuantity: number;
  actualRate: number;
}

export interface QtyRateVarianceResult {
  budgetAmount: number;
  actualAmount: number;
  quantityVariance: number;
  rateVariance: number;
  totalVariance: number;
  remainingQuantity: number;
}

export function computeQtyRateVariance({
  budgetQuantity,
  budgetRate,
  actualQuantity,
  actualRate,
}: QtyRateVarianceInputs): QtyRateVarianceResult {
  const budgetAmount = round2(budgetQuantity * budgetRate);
  const actualAmount = round2(actualQuantity * actualRate);
  const quantityVariance = round2((budgetQuantity - actualQuantity) * budgetRate);
  const rateVariance = round2((budgetRate - actualRate) * actualQuantity);
  const totalVariance = round2(quantityVariance + rateVariance);
  const remainingQuantity = round2(budgetQuantity - actualQuantity);
  return { budgetAmount, actualAmount, quantityVariance, rateVariance, totalVariance, remainingQuantity };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
