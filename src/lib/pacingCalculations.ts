import { differenceInDays, parseISO } from 'date-fns';
import { parseDateString } from '@/lib/utils';
import type { ContractTerms, PacingDeliveryData, CampaignMetrics, ProcessedCampaign } from '../types/pacing';

export const parseCampaignDate = (dateStr: string): Date => {
  if (!dateStr) {
    throw new Error('Date string is empty or undefined');
  }
  
  // Use the same parsing logic as the rest of the app
  const parsed = parseDateString(dateStr);
  if (!parsed) {
    throw new Error(`Invalid date format: ${dateStr}`);
  }
  return parsed;
};

export const calculateCampaignMetrics = (
  contractTerms: ContractTerms,
  deliveryData: PacingDeliveryData[],
  globalMostRecentDate?: Date,
  unfilteredDeliveryData?: PacingDeliveryData[]
): CampaignMetrics => {
  try {
    // Validate input data
    if (!contractTerms) {
      throw new Error('Contract terms data is missing');
    }
    
    if (!contractTerms.Budget || !contractTerms.CPM || !contractTerms['Impressions Goal']) {
      throw new Error('Missing required fields in contract terms');
    }
    
    const budget = parseFloat((contractTerms.Budget || '0').replace(/[$,]/g, ''));
    const cpm = parseFloat((contractTerms.CPM || '0').replace(/[$,]/g, ''));
    const impressionGoal = parseInt((contractTerms['Impressions Goal'] || '0').replace(/[,]/g, ''));
    
    if (isNaN(budget) || isNaN(cpm) || isNaN(impressionGoal)) {
      throw new Error(`Invalid numeric values - Budget: ${contractTerms.Budget}, CPM: ${contractTerms.CPM}, Impressions Goal: ${contractTerms['Impressions Goal']}`);
    }
    
    const startDate = parseCampaignDate(contractTerms['Start Date']);
    const endDate = parseCampaignDate(contractTerms['End Date']);
    
    // Find the most recent date in delivery data for this campaign
    const campaignDeliveryData = deliveryData.filter(row => row['CAMPAIGN ORDER NAME'] === contractTerms.Name);
    const deliveryDates = campaignDeliveryData
      .map(row => parseDateString(row.DATE))
      .filter(Boolean) as Date[];
    
    // Use campaign-specific most recent date if available, otherwise use global most recent date, fallback to today
    const mostRecentDataDate = deliveryDates.length > 0 
      ? new Date(Math.max(...deliveryDates.map(d => d.getTime())))
      : globalMostRecentDate || new Date();
  
  // Calculate campaign duration (inclusive of both start and end dates)
  const totalCampaignDays = differenceInDays(endDate, startDate) + 1;
  
  // Calculate days into campaign based on most recent data date
  const daysIntoCampaign = Math.max(0, Math.min(
    differenceInDays(mostRecentDataDate, startDate),
    totalCampaignDays
  ));
  
  // Calculate days remaining from most recent data date to end date
  const daysUntilEnd = Math.max(0, differenceInDays(endDate, mostRecentDataDate));
  
  
  // Calculate expected impressions (total goal / total days * days elapsed)
  const averageDailyImpressions = impressionGoal / totalCampaignDays;
  const expectedImpressions = averageDailyImpressions * daysIntoCampaign;
  
  // Calculate actual impressions from unfiltered delivery data (if available) to get true totals
  const dataForCalculation = unfilteredDeliveryData || deliveryData;
  const actualImpressions = dataForCalculation
    .filter(row => row['CAMPAIGN ORDER NAME'] === contractTerms.Name)
    .reduce((sum, row) => sum + parseInt(row.IMPRESSIONS.replace(/[,]/g, '') || '0'), 0);
  
  // Calculate current pacing (actual / expected)
  const currentPacing = expectedImpressions > 0 ? (actualImpressions / expectedImpressions) : 0;
  
  // Debug logging for pacing calculation
  if (currentPacing === 0 && actualImpressions > 0) {
    console.log(`\n=== PACING DEBUG: ${contractTerms.Name} ===`);
    console.log(`Expected impressions: ${expectedImpressions}`);
    console.log(`Actual impressions: ${actualImpressions}`);
    console.log(`Days into campaign: ${daysIntoCampaign}`);
    console.log(`Total campaign days: ${totalCampaignDays}`);
    console.log(`Average daily impressions: ${averageDailyImpressions}`);
    console.log(`Current pacing: ${currentPacing}`);
  }
  
  // Calculate remaining impressions needed
  const remainingImpressions = Math.max(0, impressionGoal - actualImpressions);
  
  // Calculate remaining average needed per day
  const remainingAverageNeeded = daysUntilEnd > 0 ? remainingImpressions / daysUntilEnd : 0;
  
  // Get yesterday's impressions (second most recent day in delivery data for this campaign)
  const sortedCampaignDeliveryData = dataForCalculation
    .filter(row => row['CAMPAIGN ORDER NAME'] === contractTerms.Name)
    .map(row => ({ ...row, parsedDate: parseDateString(row.DATE) }))
    .filter(row => row.parsedDate)
    .sort((a, b) => b.parsedDate!.getTime() - a.parsedDate!.getTime());
  
  const yesterdayImpressions = sortedCampaignDeliveryData.length > 1 
    ? parseInt(sortedCampaignDeliveryData[1].IMPRESSIONS.replace(/[,]/g, '') || '0')
    : 0;
  
  // Calculate yesterday vs remaining needed
  const yesterdayVsNeeded = remainingAverageNeeded > 0 ? (yesterdayImpressions / remainingAverageNeeded) : 0;
  
    return {
      campaignName: contractTerms.Name,
      budget,
      cpm,
      impressionGoal,
      startDate,
      endDate,
      daysIntoCampaign,
      daysUntilEnd,
      expectedImpressions,
      actualImpressions,
      currentPacing,
      remainingImpressions,
      remainingAverageNeeded,
      yesterdayImpressions,
      yesterdayVsNeeded
    };
  } catch (error) {
    console.error('Error calculating campaign metrics:', error);
    throw error;
  }
};

export const processCampaigns = (
  contractTermsData: ContractTerms[],
  deliveryData: PacingDeliveryData[],
  unfilteredDeliveryData?: PacingDeliveryData[]
): ProcessedCampaign[] => {
  const processedCampaigns: ProcessedCampaign[] = [];
  const skippedCampaigns: string[] = [];

  // Calculate global most recent date from unfiltered delivery data (if available), otherwise use filtered data
  const dataForGlobalDate = unfilteredDeliveryData || deliveryData;
  const allDeliveryDates = dataForGlobalDate
    .map(row => parseDateString(row.DATE))
    .filter(Boolean) as Date[];
  
  const globalMostRecentDate = allDeliveryDates.length > 0 
    ? new Date(Math.max(...allDeliveryDates.map(d => d.getTime())))
    : new Date();

  console.log(`Global most recent date from all delivery data: ${globalMostRecentDate.toDateString()}`);

  contractTermsData.forEach(contractTerms => {
    try {
      const campaignDeliveryData = deliveryData.filter(
        row => row['CAMPAIGN ORDER NAME'] === contractTerms.Name
      );
      
      const metrics = calculateCampaignMetrics(contractTerms, deliveryData, globalMostRecentDate, unfilteredDeliveryData);
      
      processedCampaigns.push({
        name: contractTerms.Name,
        contractTerms,
        deliveryData: campaignDeliveryData,
        metrics
      });
    } catch (error) {
      console.warn(`Skipping campaign "${contractTerms.Name}" due to error:`, error);
      skippedCampaigns.push(contractTerms.Name);
    }
  });

  if (skippedCampaigns.length > 0) {
    console.log(`Successfully processed ${processedCampaigns.length} campaigns. Skipped ${skippedCampaigns.length} campaigns with errors: ${skippedCampaigns.join(', ')}`);
  }

  return processedCampaigns;
};