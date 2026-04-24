// 12TWO NEC Calculator Library
// All table data sourced from NEC 2023 (backwards-compatible with 2026 for these calcs).
// Pure functions — no DOM dependencies. Import or load as a plain script.
// window.NEC is set at the bottom for script-tag usage.

// ─── NEC 310.16 Ampacity Table (copper, in conduit / raceway) ─────────────────
// Columns: [60°C, 75°C, 90°C]
const AMPACITY = {
  //  AWG/kcmil : [60°C, 75°C, 90°C]
  '14':  [15,  20,  25],
  '12':  [20,  25,  30],
  '10':  [30,  35,  40],
  '8':   [40,  50,  55],
  '6':   [55,  65,  75],
  '4':   [70,  85,  95],
  '3':   [85,  100, 110],
  '2':   [95,  115, 130],
  '1':   [110, 130, 145],
  '1/0': [125, 150, 170],
  '2/0': [145, 175, 195],
  '3/0': [165, 200, 225],
  '4/0': [195, 230, 260],
  '250': [215, 255, 290],
  '300': [240, 285, 320],
  '350': [260, 310, 350],
  '400': [280, 335, 380],
  '500': [320, 380, 430],
};
const AWG_ORDER = ['14','12','10','8','6','4','3','2','1','1/0','2/0','3/0','4/0','250','300','350','400','500'];
const TEMP_COL  = { '60': 0, '75': 1, '90': 2 };

// NEC 310.15(B)(3)(a) ambient temp correction factors for 75°C rating
const AMBIENT_CORRECTION_75 = {
  '10-15': 1.20, '16-20': 1.15, '21-25': 1.11,
  '26-30': 1.05, '31-35': 1.00, '36-40': 0.94,
  '41-45': 0.88, '46-50': 0.82, '51-55': 0.75,
  '56-60': 0.67, '61-70': 0.50, '71-80': 0.25,
};

// ─── NEC Chapter 9, Table 9 — conductor resistance at 75°C (Ω per 1000 ft, copper) ──
const RESISTANCE_PER_1000FT = {
  '14':  3.14,  '12': 1.98,  '10': 1.24,  '8':  0.778,
  '6':   0.491, '4':  0.308, '3':  0.245,  '2':  0.194,
  '1':   0.154, '1/0':0.122, '2/0':0.0967, '3/0':0.0766,
  '4/0': 0.0608,'250':0.0515,'300':0.0429, '350':0.0367,
  '400': 0.0321,'500':0.0258,
};

// ─── NEC Chapter 9, Table 5 — THHN/THWN conductor area (in², including insulation) ──
const CONDUCTOR_AREA_IN2 = {
  '14':  0.0097, '12': 0.0133, '10': 0.0211, '8':  0.0366,
  '6':   0.0507, '4':  0.0824, '3':  0.0973,  '2':  0.1158,
  '1':   0.1562, '1/0':0.1855, '2/0':0.2223,  '3/0':0.2679,
  '4/0': 0.3237, '250':0.3970, '300':0.4608,  '350':0.5281,
  '400': 0.5958, '500':0.7073,
};

// ─── NEC Chapter 9, Table 4 — EMT internal area (in²) ────────────────────────
const EMT_INTERNAL_AREA = {
  '1/2':  0.304,  '3/4':  0.533,  '1':    0.864,
  '1-1/4':1.496,  '1-1/2':2.036,  '2':    3.356,
  '2-1/2':5.858,  '3':    8.846,  '3-1/2':11.545, '4': 14.753,
};
const EMT_SIZES = ['1/2','3/4','1','1-1/4','1-1/2','2','2-1/2','3','3-1/2','4'];

// Fill % per NEC Chapter 9, Table 1
function fillPercent(conductorCount) {
  if (conductorCount === 1) return 0.53;
  if (conductorCount === 2) return 0.31;
  return 0.40;
}

// ─── NEC 314.16(B) Box Fill — volume per conductor (in³) ──────────────────────
const BOX_FILL_PER_CONDUCTOR = {
  '14': 2.00, '12': 2.25, '10': 2.50, '8': 3.00, '6': 3.50,
};


// ══════════════════════════════════════════════════════════════════════════════
// 1. WIRE SIZING  — NEC 310.16
// Given a load (amps) and terminal temp rating, returns the minimum AWG.
// ══════════════════════════════════════════════════════════════════════════════
/**
 * @param {number} amps       Continuous load (after 125% factor if continuous)
 * @param {string} tempRating '60' | '75' | '90'  (terminal/insulation rating)
 * @param {number} [ambientC] Ambient temperature in °C (default 30)
 * @returns {{ awg: string, ampacity: number, note: string } | { error: string }}
 */
function wireSize(amps, tempRating = '75', ambientC = 30) {
  const col = TEMP_COL[String(tempRating)];
  if (col === undefined) return { error: 'Invalid temp rating. Use 60, 75, or 90.' };
  if (amps <= 0) return { error: 'Amps must be greater than 0.' };

  // Ambient correction (simplified: use 75°C column factors for all ratings)
  const corrFactor = getAmbientFactor(ambientC);

  for (const awg of AWG_ORDER) {
    const baseAmpacity = AMPACITY[awg][col];
    const correctedAmpacity = baseAmpacity * corrFactor;
    if (correctedAmpacity >= amps) {
      const note = corrFactor !== 1
        ? `Ambient ${ambientC}°C correction applied (×${corrFactor.toFixed(2)}). Base ampacity: ${baseAmpacity}A.`
        : '';
      return { awg, ampacity: Math.round(correctedAmpacity * 10) / 10, note };
    }
  }
  return { error: 'Load exceeds 500 kcmil. Use parallel conductors.' };
}

function getAmbientFactor(ambientC) {
  for (const [range, factor] of Object.entries(AMBIENT_CORRECTION_75)) {
    const [lo, hi] = range.split('-').map(Number);
    if (ambientC >= lo && ambientC <= hi) return factor;
  }
  return 1.0;
}

// ══════════════════════════════════════════════════════════════════════════════
// 2. CONDUIT FILL — NEC Chapter 9
// ══════════════════════════════════════════════════════════════════════════════
/**
 * @param {Array<{awg: string, count: number}>} conductors  e.g. [{awg:'12', count:3}]
 * @param {string} [conduitType] 'EMT' (default) — expand as needed
 * @returns {{ size: string, fillArea: number, maxAllowed: number, fillPct: number } | { error: string }}
 */
function conduitFill(conductors, conduitType = 'EMT') {
  if (!conductors || conductors.length === 0) return { error: 'No conductors specified.' };

  let totalArea = 0;
  let totalCount = 0;
  const errors = [];

  for (const { awg, count = 1 } of conductors) {
    const area = CONDUCTOR_AREA_IN2[String(awg)];
    if (!area) { errors.push(`Unknown AWG: ${awg}`); continue; }
    totalArea += area * count;
    totalCount += count;
  }
  if (errors.length) return { error: errors.join('; ') };

  const maxFillFraction = fillPercent(totalCount);
  const areaTable = EMT_INTERNAL_AREA;
  const sizes = EMT_SIZES;

  for (const size of sizes) {
    const internalArea = areaTable[size];
    const maxAllowed = internalArea * maxFillFraction;
    if (maxAllowed >= totalArea) {
      return {
        size,
        fillArea: Math.round(totalArea * 10000) / 10000,
        maxAllowed: Math.round(maxAllowed * 10000) / 10000,
        fillPct: Math.round((totalArea / internalArea) * 1000) / 10,
        conductorCount: totalCount,
        rule: `${Math.round(maxFillFraction * 100)}% fill (${totalCount} conductor${totalCount !== 1 ? 's' : ''})`,
      };
    }
  }
  return { error: 'Total fill exceeds 4" EMT. Use parallel conduits or larger raceway system.' };
}

// ══════════════════════════════════════════════════════════════════════════════
// 3. BOX FILL — NEC 314.16(B)
// ══════════════════════════════════════════════════════════════════════════════
/**
 * @param {object} opts
 * @param {Array<{awg: string, count: number}>} opts.conductors  Current-carrying + neutrals entering box
 * @param {number} [opts.devices]          Number of yoke-mounted devices (switches, outlets)
 * @param {boolean} [opts.hasClamps]       Internal cable clamps present?
 * @param {number} [opts.groundCount]      Number of grounding conductors (counted as 1 total)
 * @returns {{ cubicInches: number, largestAwg: string } | { error: string }}
 */
function boxFill({ conductors = [], devices = 0, hasClamps = false, groundCount = 0 }) {
  if (!conductors.length && !devices && !groundCount) return { error: 'No components specified.' };

  let total = 0;
  let largestAwg = '14';
  const errors = [];

  for (const { awg, count = 1 } of conductors) {
    const vol = BOX_FILL_PER_CONDUCTOR[String(awg)];
    if (!vol) { errors.push(`AWG ${awg} not in box fill table (14–6 only)`); continue; }
    total += vol * count;
    if (AWG_ORDER.indexOf(String(awg)) > AWG_ORDER.indexOf(largestAwg)) largestAwg = String(awg);
  }
  if (errors.length) return { error: errors.join('; ') };

  const largestVol = BOX_FILL_PER_CONDUCTOR[largestAwg] || 2.00;

  // Devices: 2× the largest conductor volume per yoke
  total += devices * 2 * largestVol;

  // Clamps: 1× largest conductor volume for ALL clamps combined
  if (hasClamps) total += largestVol;

  // Grounds: 1× largest ground conductor volume for ALL grounds combined
  if (groundCount > 0) total += largestVol;

  return {
    cubicInches: Math.round(total * 100) / 100,
    largestAwg,
    breakdown: {
      conductors: Math.round((total - (devices * 2 * largestVol) - (hasClamps ? largestVol : 0) - (groundCount > 0 ? largestVol : 0)) * 100) / 100,
      devices: Math.round(devices * 2 * largestVol * 100) / 100,
      clamps: hasClamps ? largestVol : 0,
      grounds: groundCount > 0 ? largestVol : 0,
    },
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// 4. VOLTAGE DROP — NEC 210.19(A) informational note (3% guideline)
// ══════════════════════════════════════════════════════════════════════════════
/**
 * @param {string} awg         Conductor AWG/kcmil
 * @param {number} lengthFt    One-way run length in feet
 * @param {number} amps        Load current
 * @param {number} voltage     System voltage (120, 208, 240, 277, 480...)
 * @param {string} [phases]    '1' (default) | '3'
 * @returns {{ dropVolts: number, dropPct: number, endVolts: number, pass: boolean }}
 */
function voltageDrop(awg, lengthFt, amps, voltage, phases = '1') {
  const r = RESISTANCE_PER_1000FT[String(awg)];
  if (!r) return { error: `Unknown AWG: ${awg}` };
  if (lengthFt <= 0 || amps <= 0 || voltage <= 0) return { error: 'Length, amps, and voltage must be > 0.' };

  const multiplier = phases === '3' ? Math.sqrt(3) : 2;
  const dropVolts = (multiplier * r * amps * lengthFt) / 1000;
  const dropPct   = (dropVolts / voltage) * 100;

  return {
    dropVolts:  Math.round(dropVolts * 100) / 100,
    dropPct:    Math.round(dropPct * 100) / 100,
    endVolts:   Math.round((voltage - dropVolts) * 100) / 100,
    pass:       dropPct <= 3,
    guideline:  '3% max per NEC 210.19(A) informational note',
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// 5. AMPACITY LOOKUP — given AWG, return ampacity at each temp rating
// ══════════════════════════════════════════════════════════════════════════════
function ampacityLookup(awg) {
  const row = AMPACITY[String(awg)];
  if (!row) return { error: `Unknown AWG/kcmil: ${awg}` };
  return { awg: String(awg), '60C': row[0], '75C': row[1], '90C': row[2] };
}

// ── Public table exports (for UI dropdowns / reference displays) ───────────────
const TABLES = {
  AWG_ORDER,
  AMPACITY,
  RESISTANCE_PER_1000FT,
  CONDUCTOR_AREA_IN2,
  EMT_INTERNAL_AREA,
  EMT_SIZES,
  BOX_FILL_PER_CONDUCTOR,
};

// Browser global
if (typeof window !== 'undefined') {
  window.NEC = { wireSize, conduitFill, boxFill, voltageDrop, ampacityLookup, TABLES };
}

// ESM export (for bundlers / future Node tests)
export { wireSize, conduitFill, boxFill, voltageDrop, ampacityLookup, TABLES };
