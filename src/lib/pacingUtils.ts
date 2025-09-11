// Campaign parsing and filtering utilities for Pacing 2 - adapted from pacing-report

import { useCampaignFilter } from '@/contexts/CampaignFilterContext';

// Option interface for dropdowns
export interface FilterOption {
  value: string;
  label: string;
}

// Generate filter options from campaigns
export function generateFilterOptions(campaigns: { name: string }[], extractAgencyInfo: any, extractAdvertiserName: any): {
  agencies: FilterOption[];
  advertisers: FilterOption[];
  campaignNames: FilterOption[];
} {
  const agencySet = new Set<string>();
  const advertiserSet = new Set<string>();
  const campaignSet = new Set<string>();

  campaigns.forEach(campaign => {
    const { agency } = extractAgencyInfo(campaign.name);
    const advertiser = extractAdvertiserName(campaign.name);
    
    if (agency) agencySet.add(agency);
    if (advertiser) advertiserSet.add(advertiser);
    campaignSet.add(campaign.name);
  });

  return {
    agencies: Array.from(agencySet).sort().map(agency => ({ value: agency, label: agency })),
    advertisers: Array.from(advertiserSet).sort().map(advertiser => ({ value: advertiser, label: advertiser })),
    campaignNames: Array.from(campaignSet).sort().map(name => ({ value: name, label: name }))
  };
}

// Utility functions for formatting
export const formatPercentage = (num: number): string => {
  return `${(num * 100).toFixed(1)}%`;
};

export const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('en-US').format(Math.round(num));
};

export const formatCurrency = (num: number): string => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
};

// Pacing color utilities
export const getPacingColor = (pacing: number): string => {
  if (pacing >= 0.95 && pacing <= 1.05) return 'text-green-600';
  if (pacing >= 0.85 && pacing <= 1.15) return 'text-yellow-600';
  return 'text-red-600';
};

export const getPacingBgColor = (pacing: number): string => {
  if (pacing >= 0.95 && pacing <= 1.05) return 'bg-green-50 border-green-200';
  if (pacing >= 0.85 && pacing <= 1.15) return 'bg-yellow-50 border-yellow-200';
  return 'bg-red-50 border-red-200';
};

// Hook to get campaign filter utilities
export const useCampaignUtils = () => {
  const { extractAgencyInfo, extractAdvertiserName, isTestCampaign } = useCampaignFilter();
  
  return {
    extractAgencyInfo,
    extractAdvertiserName, 
    isTestCampaign,
    generateFilterOptions: (campaigns: { name: string }[]) => 
      generateFilterOptions(campaigns, extractAgencyInfo, extractAdvertiserName),
    formatPercentage,
    formatNumber,
    formatCurrency,
    getPacingColor,
    getPacingBgColor
  };
};