// Types for Pacing 2 functionality - adapted from pacing-report project

export interface ContractTerms {
  Name: string;
  "Start Date": string;
  "End Date": string;
  Budget: string;
  CPM: string;
  "Impressions Goal": string;
}

export interface PacingDeliveryData {
  DATE: string;
  "CAMPAIGN ORDER NAME": string;
  IMPRESSIONS: string;
  SPEND: string;
}

export interface CampaignMetrics {
  campaignName: string;
  budget: number;
  cpm: number;
  impressionGoal: number;
  startDate: Date;
  endDate: Date;
  daysIntoCampaign: number;
  daysUntilEnd: number;
  expectedImpressions: number;
  actualImpressions: number;
  currentPacing: number;
  remainingImpressions: number;
  remainingAverageNeeded: number;
  yesterdayImpressions: number;
  yesterdayVsNeeded: number;
}

export interface ProcessedCampaign {
  name: string;
  contractTerms: ContractTerms;
  deliveryData: PacingDeliveryData[];
  metrics: CampaignMetrics;
}