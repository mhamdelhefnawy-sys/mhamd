export interface MaterialLossInputs {
  budgetQuantity: number;
  actualUsedQuantity: number;
  allowedWastePercent: number;
  unitRate: number;
}

export interface MaterialLossResult {
  lossQuantity: number;
  actualWastePercent: number;
  excessWastePercent: number;
  excessQuantity: number;
  excessCost: number;
  isOverAllowed: boolean;
}

// "Loss" here = actual consumption above the theoretical (budget) quantity required.
export function computeMaterialLoss({
  budgetQuantity,
  actualUsedQuantity,
  allowedWastePercent,
  unitRate,
}: MaterialLossInputs): MaterialLossResult {
  const lossQuantity = round4(actualUsedQuantity - budgetQuantity);
  const actualWastePercent = budgetQuantity !== 0 ? round2((lossQuantity / budgetQuantity) * 100) : 0;
  const excessWastePercent = round2(actualWastePercent - allowedWastePercent);
  const allowedQuantity = budgetQuantity * (1 + allowedWastePercent / 100);
  const excessQuantity = round4(Math.max(0, actualUsedQuantity - allowedQuantity));
  const excessCost = round2(excessQuantity * unitRate);
  return {
    lossQuantity,
    actualWastePercent,
    excessWastePercent,
    excessQuantity,
    excessCost,
    isOverAllowed: excessWastePercent > 0,
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
function round4(n: number) {
  return Math.round(n * 10000) / 10000;
}
