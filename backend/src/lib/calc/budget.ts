// Original -> + Approved Variations -> Revised -> Current Budget (BAC) roll-up.
export interface BudgetRollupInputs {
  originalBudget: number;
  approvedVariations: number;
}

export interface BudgetRollupResult {
  originalBudget: number;
  approvedVariations: number;
  revisedBudget: number;
  currentBudget: number; // BAC
}

export function computeBudgetRollup({ originalBudget, approvedVariations }: BudgetRollupInputs): BudgetRollupResult {
  const revisedBudget = round2(originalBudget + approvedVariations);
  return {
    originalBudget: round2(originalBudget),
    approvedVariations: round2(approvedVariations),
    revisedBudget,
    currentBudget: revisedBudget,
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
