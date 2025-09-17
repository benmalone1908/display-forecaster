/**
 * Manual CPM Calculation Utility
 *
 * Applies manual CPM adjustments for specific campaigns to recalculate
 * spend based on impressions and target CPM rates.
 */

export interface CpmAdjustment {
  identifier: string;
  cpm: number;
  description: string;
}

// Manual CPM adjustments for specific campaigns
export const MANUAL_CPM_ADJUSTMENTS: CpmAdjustment[] = [
  { identifier: "CN:ILGM", cpm: 6.0, description: "ILGM campaigns" },
  { identifier: "WWX: Zebra CBD", cpm: 5.0, description: "Zebra CBD campaigns" },
  { identifier: "MJ: Purple Lotus", cpm: 6.0, description: "Purple Lotus campaigns" },
  { identifier: "WWX: Thick Ass Glass", cpm: 5.0, description: "Thick Ass Glass campaigns" },
  { identifier: "MJ: Garden Remedies", cpm: 8.5, description: "Garden Remedies campaigns" },
  { identifier: "MJ: Urb-Retargeting", cpm: 14.0, description: "Urb-Retargeting campaigns" },
  { identifier: "FS: Sweet Flower", cpm: 8.0, description: "Sweet Flower campaigns" },
  { identifier: "HG: Formulated Wellness", cpm: 7.0, description: "Formulated Wellness campaigns" },
  { identifier: "2001938", cpm: 8.0, description: "Campaign 2001938" },
];

/**
 * Check if a campaign name matches any of the manual CPM adjustment identifiers
 */
export const getManualCpmAdjustment = (campaignName: string): CpmAdjustment | null => {
  if (!campaignName) return null;

  // Check each identifier to see if it's contained in the campaign name
  for (const adjustment of MANUAL_CPM_ADJUSTMENTS) {
    if (campaignName.includes(adjustment.identifier)) {
      return adjustment;
    }
  }

  return null;
};

/**
 * Calculate corrected spend using manual CPM adjustments
 */
export const calculateManualCpmSpend = (impressions: number, originalSpend: number, campaignName: string): number => {
  const adjustment = getManualCpmAdjustment(campaignName);

  if (!adjustment) {
    return originalSpend;
  }

  // Calculate spend using manual CPM: (impressions / 1000) * CPM
  const correctedSpend = (impressions / 1000) * adjustment.cpm;

  return correctedSpend;
};

/**
 * Apply manual CPM corrections to a data row
 */
export const applyManualCpmCorrection = (row: any): any => {
  if (!row || !row["CAMPAIGN ORDER NAME"]) return row;

  const campaignName = row["CAMPAIGN ORDER NAME"];
  const originalSpend = Number(row.SPEND) || 0;
  const impressions = Number(row.IMPRESSIONS) || 0;

  const adjustment = getManualCpmAdjustment(campaignName);

  if (!adjustment) {
    return row;
  }

  const correctedSpend = calculateManualCpmSpend(impressions, originalSpend, campaignName);

  return {
    ...row,
    SPEND: correctedSpend,
    // Add flags to indicate this row has been corrected
    _MANUAL_CPM_CORRECTED: true,
    _MANUAL_CPM_RATE: adjustment.cpm,
    _MANUAL_CPM_IDENTIFIER: adjustment.identifier,
    _ORIGINAL_SPEND: originalSpend
  };
};

/**
 * Apply manual CPM corrections to an entire dataset
 */
export const applyManualCpmCorrections = (data: any[]): any[] => {
  if (!Array.isArray(data)) return data;

  let correctedCount = 0;
  const correctedData = data.map(row => {
    const correctedRow = applyManualCpmCorrection(row);
    if (correctedRow._MANUAL_CPM_CORRECTED) {
      correctedCount++;
    }
    return correctedRow;
  });

  if (correctedCount > 0) {
    console.log(`Applied manual CPM corrections to ${correctedCount} campaigns`);
  }

  return correctedData;
};

/**
 * Get summary of manual CPM corrections applied
 */
export const getManualCpmCorrectionSummary = (data: any[]): {
  totalRows: number;
  correctedRows: number;
  originalTotalSpend: number;
  correctedTotalSpend: number;
  adjustmentsByType: { [key: string]: { count: number; cpm: number; originalSpend: number; correctedSpend: number } };
} => {
  let correctedRows = 0;
  let originalTotalSpend = 0;
  let correctedTotalSpend = 0;
  const adjustmentsByType: { [key: string]: { count: number; cpm: number; originalSpend: number; correctedSpend: number } } = {};

  data.forEach(row => {
    if (row._MANUAL_CPM_CORRECTED) {
      correctedRows++;
      const originalSpend = row._ORIGINAL_SPEND || 0;
      const correctedSpend = Number(row.SPEND) || 0;
      const identifier = row._MANUAL_CPM_IDENTIFIER;
      const cpm = row._MANUAL_CPM_RATE;

      originalTotalSpend += originalSpend;

      if (!adjustmentsByType[identifier]) {
        adjustmentsByType[identifier] = {
          count: 0,
          cpm: cpm,
          originalSpend: 0,
          correctedSpend: 0
        };
      }

      adjustmentsByType[identifier].count++;
      adjustmentsByType[identifier].originalSpend += originalSpend;
      adjustmentsByType[identifier].correctedSpend += correctedSpend;
    }
    correctedTotalSpend += Number(row.SPEND) || 0;
  });

  return {
    totalRows: data.length,
    correctedRows,
    originalTotalSpend,
    correctedTotalSpend,
    adjustmentsByType
  };
};

/**
 * Check if any manual CPM adjustments have been applied to the dataset
 */
export const hasManualCpmCorrections = (data: any[]): boolean => {
  return data.some(row => row._MANUAL_CPM_CORRECTED);
};

/**
 * Get list of all campaigns that would be affected by manual CPM adjustments
 */
export const getAffectedCampaigns = (data: any[]): { campaignName: string; adjustment: CpmAdjustment }[] => {
  const affected: { campaignName: string; adjustment: CpmAdjustment }[] = [];

  data.forEach(row => {
    if (row["CAMPAIGN ORDER NAME"]) {
      const adjustment = getManualCpmAdjustment(row["CAMPAIGN ORDER NAME"]);
      if (adjustment) {
        const existing = affected.find(item => item.campaignName === row["CAMPAIGN ORDER NAME"]);
        if (!existing) {
          affected.push({ campaignName: row["CAMPAIGN ORDER NAME"], adjustment });
        }
      }
    }
  });

  return affected;
};