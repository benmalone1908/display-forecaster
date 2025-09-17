/**
 * Data Recalculation Utility
 *
 * Handles recalculation of existing data with updated CPM corrections.
 * Provides preview functionality and safe application of corrections.
 */

import { applySpendCorrections, getSpendCorrectionSummary } from "./orangellowSpendCorrection";
import { applyManualCpmCorrections, getManualCpmCorrectionSummary } from "./manualCpmCalculations";
import { loadAllCampaignData, saveCampaignData } from "./dataStorage";

export interface RecalculationPreview {
  totalRows: number;
  affectedRows: number;
  orangellowCorrections: {
    count: number;
    totalOriginalSpend: number;
    totalCorrectedSpend: number;
  };
  manualCpmCorrections: {
    count: number;
    totalOriginalSpend: number;
    totalCorrectedSpend: number;
    byType: { [key: string]: { count: number; cpm: number; originalSpend: number; correctedSpend: number } };
  };
  campaignChanges: Array<{
    campaignName: string;
    correctionType: 'orangellow' | 'manual_cpm';
    originalSpend: number;
    correctedSpend: number;
    difference: number;
    cpmRate?: number;
    identifier?: string;
  }>;
}

export interface RecalculationResult {
  success: boolean;
  message: string;
  preview?: RecalculationPreview;
  updatedData?: any[];
}

/**
 * Generate a preview of what would change if recalculation is applied
 */
export const previewRecalculation = async (): Promise<RecalculationResult> => {
  try {
    console.log('📊 Starting recalculation preview...');

    // Load current data from database
    const loadResult = await loadAllCampaignData();
    console.log('📊 Load result:', loadResult);

    if (!loadResult.success) {
      console.error('📊 Load failed:', loadResult.message);
      return {
        success: false,
        message: `Failed to load data: ${loadResult.message}`
      };
    }

    if (!loadResult.data || loadResult.data.length === 0) {
      console.warn('📊 No data found');
      return {
        success: false,
        message: 'No data available to recalculate'
      };
    }

    const loadedData = loadResult.data;
    console.log(`📊 Loaded ${loadedData.length} rows for preview`);

    // First, restore original spend values if data was previously corrected
    const restoredData = loadedData.map(row => {
      if (row._ORIGINAL_SPEND !== undefined) {
        console.log(`📊 Restoring original spend for ${row["CAMPAIGN ORDER NAME"]}: ${row.SPEND} -> ${row._ORIGINAL_SPEND}`);
        return {
          ...row,
          SPEND: row._ORIGINAL_SPEND,
          // Remove correction flags
          _ORANGELLOW_CORRECTED: undefined,
          _MANUAL_CPM_CORRECTED: undefined,
          _MANUAL_CPM_RATE: undefined,
          _MANUAL_CPM_IDENTIFIER: undefined,
          _ORIGINAL_SPEND: undefined
        };
      }
      return row;
    });

    const restoredCount = loadedData.filter(row => row._ORIGINAL_SPEND !== undefined).length;
    console.log(`📊 Restored ${restoredCount} previously corrected rows`);

    // Apply Orangellow corrections to restored data
    const orangellowCorrected = applySpendCorrections(restoredData);
    const orangellowSummary = getSpendCorrectionSummary(orangellowCorrected);

    // Apply manual CPM corrections
    const fullyCorrected = applyManualCpmCorrections(orangellowCorrected);
    const manualCpmSummary = getManualCpmCorrectionSummary(fullyCorrected);

    // Build detailed campaign changes list
    const campaignChanges: Array<{
      campaignName: string;
      correctionType: 'orangellow' | 'manual_cpm';
      originalSpend: number;
      correctedSpend: number;
      difference: number;
      cpmRate?: number;
      identifier?: string;
    }> = [];

    // Track Orangellow changes
    fullyCorrected.forEach(row => {
      if (row._ORANGELLOW_CORRECTED && row._ORIGINAL_SPEND !== undefined) {
        campaignChanges.push({
          campaignName: row["CAMPAIGN ORDER NAME"] || 'Unknown',
          correctionType: 'orangellow',
          originalSpend: row._ORIGINAL_SPEND,
          correctedSpend: Number(row.SPEND) || 0,
          difference: (Number(row.SPEND) || 0) - row._ORIGINAL_SPEND,
          cpmRate: 7.0
        });
      }
    });

    // Track Manual CPM changes
    fullyCorrected.forEach(row => {
      if (row._MANUAL_CPM_CORRECTED && row._ORIGINAL_SPEND !== undefined) {
        campaignChanges.push({
          campaignName: row["CAMPAIGN ORDER NAME"] || 'Unknown',
          correctionType: 'manual_cpm',
          originalSpend: row._ORIGINAL_SPEND,
          correctedSpend: Number(row.SPEND) || 0,
          difference: (Number(row.SPEND) || 0) - row._ORIGINAL_SPEND,
          cpmRate: row._MANUAL_CPM_RATE,
          identifier: row._MANUAL_CPM_IDENTIFIER
        });
      }
    });

    // Remove duplicates (a campaign might have both corrections, but we want the final state)
    const uniqueChanges = campaignChanges.reduce((acc, change) => {
      const existing = acc.find(c => c.campaignName === change.campaignName);
      if (!existing) {
        acc.push(change);
      } else {
        // Keep the one with the larger difference (final correction)
        if (Math.abs(change.difference) > Math.abs(existing.difference)) {
          const index = acc.indexOf(existing);
          acc[index] = change;
        }
      }
      return acc;
    }, [] as typeof campaignChanges);

    const preview: RecalculationPreview = {
      totalRows: originalData.length,
      affectedRows: orangellowSummary.correctedRows + manualCpmSummary.correctedRows,
      orangellowCorrections: {
        count: orangellowSummary.correctedRows,
        totalOriginalSpend: orangellowSummary.originalTotalSpend,
        totalCorrectedSpend: orangellowSummary.correctedTotalSpend
      },
      manualCpmCorrections: {
        count: manualCpmSummary.correctedRows,
        totalOriginalSpend: manualCpmSummary.originalTotalSpend,
        totalCorrectedSpend: manualCpmSummary.correctedTotalSpend,
        byType: manualCpmSummary.adjustmentsByType
      },
      campaignChanges: uniqueChanges
    };

    console.log('📊 Preview generated:', preview);

    return {
      success: true,
      message: `Preview ready: ${preview.affectedRows} campaigns will be updated`,
      preview
    };

  } catch (error) {
    console.error('❌ Error generating recalculation preview:', error);
    return {
      success: false,
      message: `Preview failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
};

/**
 * Apply recalculation to existing data and save to database
 */
export const applyRecalculation = async (): Promise<RecalculationResult> => {
  try {
    console.log('🔄 Starting data recalculation...');

    // Load current data from database
    const loadResult = await loadAllCampaignData();
    if (!loadResult.success || !loadResult.data || loadResult.data.length === 0) {
      return {
        success: false,
        message: 'No data available to recalculate'
      };
    }

    const loadedData = loadResult.data;
    console.log(`🔄 Loaded ${loadedData.length} rows for recalculation`);

    // First, restore original spend values if data was previously corrected
    const restoredData = loadedData.map(row => {
      if (row._ORIGINAL_SPEND !== undefined) {
        console.log(`🔄 Restoring original spend for ${row["CAMPAIGN ORDER NAME"]}: ${row.SPEND} -> ${row._ORIGINAL_SPEND}`);
        return {
          ...row,
          SPEND: row._ORIGINAL_SPEND,
          // Remove correction flags
          _ORANGELLOW_CORRECTED: undefined,
          _MANUAL_CPM_CORRECTED: undefined,
          _MANUAL_CPM_RATE: undefined,
          _MANUAL_CPM_IDENTIFIER: undefined,
          _ORIGINAL_SPEND: undefined
        };
      }
      return row;
    });

    const applyRestoredCount = loadedData.filter(row => row._ORIGINAL_SPEND !== undefined).length;
    console.log(`🔄 Restored ${applyRestoredCount} previously corrected rows`);

    // Apply all corrections to restored data
    const orangellowCorrected = applySpendCorrections(restoredData);
    const fullyCorrected = applyManualCpmCorrections(orangellowCorrected);

    // Save corrected data back to database
    console.log('💾 Saving recalculated data to database...');
    const saveResult = await saveCampaignData(fullyCorrected);

    if (!saveResult.success) {
      return {
        success: false,
        message: `Failed to save recalculated data: ${saveResult.message}`
      };
    }

    // Generate summary
    const orangellowSummary = getSpendCorrectionSummary(fullyCorrected);
    const manualCpmSummary = getManualCpmCorrectionSummary(fullyCorrected);

    const totalAffected = orangellowSummary.correctedRows + manualCpmSummary.correctedRows;

    console.log('✅ Recalculation completed successfully');

    return {
      success: true,
      message: `Successfully recalculated ${totalAffected} campaigns`,
      updatedData: fullyCorrected
    };

  } catch (error) {
    console.error('❌ Error during recalculation:', error);
    return {
      success: false,
      message: `Recalculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
};

/**
 * Check if any data exists that could benefit from recalculation
 */
export const canRecalculate = async (): Promise<boolean> => {
  try {
    const loadResult = await loadAllCampaignData();
    return loadResult.success && loadResult.data && loadResult.data.length > 0;
  } catch {
    return false;
  }
};