export interface ProfitabilityInputs {
  currentContractValue: number; // Forecast Revenue proxy (no separate variation-to-revenue module yet)
  forecastCost: number; // EAC
  budgetCost: number; // BAC
}

export interface ProfitabilityResult {
  forecastRevenue: number;
  forecastCost: number;
  forecastProfit: number;
  forecastMarginPercent: number;
  budgetProfit: number;
  profitVariance: number;
}

export function computeProfitability({
  currentContractValue,
  forecastCost,
  budgetCost,
}: ProfitabilityInputs): ProfitabilityResult {
  const forecastProfit = round2(currentContractValue - forecastCost);
  const forecastMarginPercent =
    currentContractValue !== 0 ? round2((forecastProfit / currentContractValue) * 100) : 0;
  const budgetProfit = round2(currentContractValue - budgetCost);
  const profitVariance = round2(forecastProfit - budgetProfit);
  return {
    forecastRevenue: currentContractValue,
    forecastCost: round2(forecastCost),
    forecastProfit,
    forecastMarginPercent,
    budgetProfit,
    profitVariance,
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
