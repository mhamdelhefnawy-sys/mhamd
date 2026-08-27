// ETC / EAC / VAC with 4 selectable formulas (System Settings / Project.eacFormula).
export type EacFormula =
  | "AC_PLUS_ETC" // EAC = AC + ETC (bottom-up ETC re-estimate)
  | "BAC_OVER_CPI" // EAC = BAC / CPI
  | "AC_PLUS_BAC_MINUS_EV" // EAC = AC + (BAC - EV)  -- atypical variances assumed
  | "AC_PLUS_BAC_MINUS_EV_OVER_CPI"; // EAC = AC + ((BAC - EV) / CPI) -- typical variances assumed to continue

export interface ForecastInputs {
  bac: number;
  ac: number;
  ev: number;
  cpi: number;
  formula: EacFormula;
  manualETC?: number | null; // bottom-up / manual override
}

export interface ForecastResult {
  etc: number;
  eac: number;
  vac: number;
  formulaUsed: EacFormula;
  isManualOverride: boolean;
}

export function computeForecast({ bac, ac, ev, cpi, formula, manualETC }: ForecastInputs): ForecastResult {
  let eac: number;
  const isManualOverride = manualETC != null;

  if (isManualOverride) {
    eac = round2(ac + (manualETC as number));
  } else {
    switch (formula) {
      case "BAC_OVER_CPI":
        eac = round2(cpi !== 0 ? bac / cpi : bac);
        break;
      case "AC_PLUS_BAC_MINUS_EV":
        eac = round2(ac + (bac - ev));
        break;
      case "AC_PLUS_BAC_MINUS_EV_OVER_CPI":
        eac = round2(ac + (cpi !== 0 ? (bac - ev) / cpi : bac - ev));
        break;
      case "AC_PLUS_ETC":
      default:
        // Without a bottom-up ETC, fall back to the CPI-driven remaining-work estimate.
        eac = round2(ac + (cpi !== 0 ? (bac - ev) / cpi : bac - ev));
        break;
    }
  }

  const etc = round2(eac - ac);
  const vac = round2(bac - eac);
  return { etc, eac, vac, formulaUsed: formula, isManualOverride };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
