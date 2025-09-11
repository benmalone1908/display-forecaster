export interface MissingContractTermsInfo {
  campaignName: string;
  totalImpressions: number;
  totalSpend: number;
  totalRevenue: number;
}

export interface ContractTermsValidationResult {
  missingCampaigns: MissingContractTermsInfo[];
  totalMissingCampaigns: number;
  hasActiveCampaignsMissing: boolean;
}

/**
 * Identifies campaigns that have delivery data with impressions but are missing from contract terms
 */
export function validateContractTerms(
  deliveryData: any[],
  contractTermsData: any[]
): ContractTermsValidationResult {
  // Get all campaigns with impressions > 0 from delivery data
  const campaignsWithImpressions = new Map<string, MissingContractTermsInfo>();
  
  deliveryData.forEach(row => {
    const campaignName = row["CAMPAIGN ORDER NAME"];
    const impressions = Number(row.IMPRESSIONS) || 0;
    const spend = Number(row.SPEND) || 0;
    const revenue = Number(row.REVENUE) || 0;
    
    if (campaignName && impressions > 0) {
      if (campaignsWithImpressions.has(campaignName)) {
        const existing = campaignsWithImpressions.get(campaignName)!;
        existing.totalImpressions += impressions;
        existing.totalSpend += spend;
        existing.totalRevenue += revenue;
      } else {
        campaignsWithImpressions.set(campaignName, {
          campaignName,
          totalImpressions: impressions,
          totalSpend: spend,
          totalRevenue: revenue
        });
      }
    }
  });
  
  // Get all campaigns available in contract terms
  const contractTermsCampaigns = new Set<string>();
  
  contractTermsData.forEach(row => {
    const possibleNameFields = ['NAME', 'CAMPAIGN', 'Campaign', 'name', 'campaign', 'Campaign Name', 'CAMPAIGN NAME', 'Name'];
    
    for (const field of possibleNameFields) {
      const campaignName = row[field];
      if (campaignName) {
        contractTermsCampaigns.add(String(campaignName).trim());
        break; // Only use the first valid field found
      }
    }
  });
  
  // Find campaigns with impressions that are missing from contract terms
  const missingCampaigns: MissingContractTermsInfo[] = [];
  
  campaignsWithImpressions.forEach((campaignInfo, campaignName) => {
    if (!contractTermsCampaigns.has(campaignName)) {
      missingCampaigns.push(campaignInfo);
    }
  });
  
  // Sort by total impressions descending (most active campaigns first)
  missingCampaigns.sort((a, b) => b.totalImpressions - a.totalImpressions);
  
  return {
    missingCampaigns,
    totalMissingCampaigns: missingCampaigns.length,
    hasActiveCampaignsMissing: missingCampaigns.length > 0
  };
}

/**
 * Formats numbers for display in the missing campaigns modal
 */
export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  } else {
    return num.toLocaleString();
  }
}

/**
 * Formats currency for display
 */
export function formatCurrency(amount: number): string {
  return '$' + amount.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}