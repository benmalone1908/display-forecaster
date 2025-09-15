/**
 * Orangellow Spend Correction Utility
 * 
 * Orangellow campaigns (SM and OG agency codes) have overstated spend amounts
 * because the dashboard shows client-facing CPM, not MediaJel's cost.
 * This utility recalculates spend using impressions and a $7 CPM.
 */

import { AGENCY_MAPPING } from '@/contexts/CampaignFilterContext';

// Orangellow CPM rate for spend correction
const ORANGELLOW_CPM = 7.0;

/**
 * Check if a campaign belongs to Orangellow based on agency code
 */
export const isOrangellowCampaign = (campaignName: string): boolean => {
  if (!campaignName) return false;
  
  // Extract agency code from campaign name using similar logic to CampaignFilterContext
  const agencyMatch = campaignName.match(/^\d+(?:\/\d+)?:\s*([^:]+):/);
  if (!agencyMatch) return false;
  
  const agencyCode = agencyMatch[1].trim();
  
  // Check if it's SM or OG (both map to Orangellow)
  return agencyCode === 'SM' || agencyCode === 'OG';
};

/**
 * Calculate corrected spend for Orangellow campaigns using $7 CPM
 */
export const calculateCorrectedSpend = (impressions: number, originalSpend: number, campaignName: string): number => {
  if (!isOrangellowCampaign(campaignName)) {
    return originalSpend;
  }
  
  // Calculate spend using $7 CPM: (impressions / 1000) * $7
  const correctedSpend = (impressions / 1000) * ORANGELLOW_CPM;
  
  // Spend corrected silently
  
  return correctedSpend;
};

/**
 * Apply spend corrections to a data row
 */
export const applySpendCorrection = (row: any): any => {
  if (!row || !row["CAMPAIGN ORDER NAME"]) return row;
  
  const campaignName = row["CAMPAIGN ORDER NAME"];
  const originalSpend = Number(row.SPEND) || 0;
  const impressions = Number(row.IMPRESSIONS) || 0;
  
  if (!isOrangellowCampaign(campaignName)) {
    return row;
  }
  
  const correctedSpend = calculateCorrectedSpend(impressions, originalSpend, campaignName);
  
  return {
    ...row,
    SPEND: correctedSpend,
    // Add a flag to indicate this row has been corrected
    _ORANGELLOW_CORRECTED: true,
    _ORIGINAL_SPEND: originalSpend
  };
};

/**
 * Apply spend corrections to an entire dataset
 */
export const applySpendCorrections = (data: any[]): any[] => {
  if (!Array.isArray(data)) return data;
  
  let correctedCount = 0;
  const correctedData = data.map(row => {
    const correctedRow = applySpendCorrection(row);
    if (correctedRow._ORANGELLOW_CORRECTED) {
      correctedCount++;
    }
    return correctedRow;
  });
  
  // Corrections applied silently
  
  return correctedData;
};

/**
 * Get summary of spend corrections applied
 */
export const getSpendCorrectionSummary = (data: any[]): {
  totalRows: number;
  correctedRows: number;
  originalTotalSpend: number;
  correctedTotalSpend: number;
  savings: number;
} => {
  let correctedRows = 0;
  let originalTotalSpend = 0;
  let correctedTotalSpend = 0;
  
  data.forEach(row => {
    if (row._ORANGELLOW_CORRECTED) {
      correctedRows++;
      originalTotalSpend += row._ORIGINAL_SPEND || 0;
    }
    correctedTotalSpend += Number(row.SPEND) || 0;
  });
  
  const savings = originalTotalSpend - (correctedTotalSpend - (data.reduce((sum, row) => sum + (row._ORANGELLOW_CORRECTED ? 0 : (Number(row.SPEND) || 0)), 0)));
  
  return {
    totalRows: data.length,
    correctedRows,
    originalTotalSpend,
    correctedTotalSpend,
    savings
  };
};