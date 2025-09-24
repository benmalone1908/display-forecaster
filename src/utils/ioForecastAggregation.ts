/**
 * IO Forecast Aggregation Utility
 *
 * Aggregates forecast data by IO number using the existing forecast calculations
 * from the main dashboard modal popups.
 */

import { parseDateString } from "@/lib/utils";
import { calculateMTDMetrics, getDatesInMonth } from "./forecastCalculations";
import { extractIONumber, groupDataByIO, groupDataByIODisplay, getIODisplayFormat, extractIONumbers } from "./ioNumberExtraction";

export interface IOForecastData {
  ioNumber: string; // Legacy field for backward compatibility
  ioDisplayFormat: string; // New field: "2001567" or "2001567/2001568"
  ioNumbers: string[]; // Array of individual IO numbers
  mtdSpend: number;
  forecastSpend: number;
  lastMonthSpend: number;
  campaignCount: number;
}

/**
 * Calculate current and last month date boundaries
 */
const getMonthBoundaries = (currentDate: Date) => {
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  // Current month boundaries
  const currentMonthStart = new Date(currentYear, currentMonth, 1);
  const currentMonthEnd = currentDate; // Up to current date

  // Last month boundaries
  const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
  const lastMonthStart = new Date(lastMonthYear, lastMonth, 1);
  const lastMonthEnd = new Date(currentYear, currentMonth, 0); // Last day of previous month

  return {
    currentMonthStart,
    currentMonthEnd,
    lastMonthStart,
    lastMonthEnd,
    currentMonth,
    currentYear,
    lastMonth: lastMonth,
    lastMonthYear
  };
};

/**
 * Calculate MTD spend for campaigns in an IO
 */
const calculateMTDSpendForIO = (
  campaignData: any[],
  currentDate: Date
): number => {
  const { currentMonthStart, currentMonthEnd } = getMonthBoundaries(currentDate);

  let mtdSpend = 0;

  campaignData.forEach(row => {
    if (!row.DATE || row.DATE === 'Totals') return;

    const rowDate = parseDateString(row.DATE);
    if (!rowDate) return;

    // Check if date is in current month and not in future
    if (rowDate >= currentMonthStart && rowDate <= currentMonthEnd) {
      mtdSpend += Number(row.SPEND) || 0;
    }
  });

  return mtdSpend;
};

/**
 * Calculate last month spend for campaigns in an IO
 */
const calculateLastMonthSpendForIO = (
  campaignData: any[],
  currentDate: Date
): number => {
  const { lastMonthStart, lastMonthEnd } = getMonthBoundaries(currentDate);

  let lastMonthSpend = 0;

  campaignData.forEach(row => {
    if (!row.DATE || row.DATE === 'Totals') return;

    const rowDate = parseDateString(row.DATE);
    if (!rowDate) return;

    // Check if date is in last month
    if (rowDate >= lastMonthStart && rowDate <= lastMonthEnd) {
      lastMonthSpend += Number(row.SPEND) || 0;
    }
  });

  return lastMonthSpend;
};

/**
 * Calculate forecast spend for campaigns in an IO using existing logic
 */
const calculateForecastSpendForIO = (
  campaignData: any[],
  currentDate: Date
): number => {
  const { currentMonth, currentYear } = getMonthBoundaries(currentDate);

  // Get all dates in current month
  const datesInMonth = getDatesInMonth(currentYear, currentMonth);
  const totalDaysInMonth = datesInMonth.length;

  // Calculate days elapsed (up to current date)
  const daysElapsed = currentDate.getDate();

  // Calculate MTD spend
  const mtdSpend = calculateMTDSpendForIO(campaignData, currentDate);

  if (daysElapsed === 0 || mtdSpend === 0) {
    return mtdSpend; // No projection possible
  }

  // Calculate daily average spend
  const dailyAvgSpend = mtdSpend / daysElapsed;

  // Project for remaining days in month
  const remainingDays = totalDaysInMonth - daysElapsed;
  const projectedSpend = dailyAvgSpend * remainingDays;

  // Return total forecast (MTD + projected)
  return mtdSpend + projectedSpend;
};

/**
 * Aggregate forecast data by IO display format for all campaigns
 */
export const aggregateForecastByIO = (
  campaignData: any[],
  currentDate: Date = new Date()
): IOForecastData[] => {
  console.log(`📊 Aggregating forecasts by IO display format for ${campaignData.length} rows`);

  // Group campaign data by IO display format (handles slash-separated)
  const groupedByIODisplay = groupDataByIODisplay(campaignData);

  const ioForecasts: IOForecastData[] = [];

  Object.entries(groupedByIODisplay).forEach(([ioDisplayFormat, ioCampaignData]) => {
    console.log(`📊 Processing IO ${ioDisplayFormat} with ${ioCampaignData.length} rows`);

    const mtdSpend = calculateMTDSpendForIO(ioCampaignData, currentDate);
    const forecastSpend = calculateForecastSpendForIO(ioCampaignData, currentDate);
    const lastMonthSpend = calculateLastMonthSpendForIO(ioCampaignData, currentDate);

    // Get the individual IO numbers from this display format
    const firstCampaign = ioCampaignData[0];
    const campaignName = firstCampaign["CAMPAIGN ORDER NAME"] || firstCampaign.campaign_order_name || "";
    const ioNumbers = extractIONumbers(campaignName);

    // Count unique campaigns for this IO
    const uniqueCampaigns = new Set(
      ioCampaignData.map(row => row["CAMPAIGN ORDER NAME"] || row.campaign_order_name)
    );

    ioForecasts.push({
      ioNumber: ioNumbers[0] || ioDisplayFormat, // Legacy field - use first number or display format
      ioDisplayFormat,
      ioNumbers,
      mtdSpend,
      forecastSpend,
      lastMonthSpend,
      campaignCount: uniqueCampaigns.size
    });
  });

  console.log(`📊 Generated forecasts for ${ioForecasts.length} IO display formats`);

  return ioForecasts.sort((a, b) => a.ioDisplayFormat.localeCompare(b.ioDisplayFormat));
};

/**
 * Filter campaign data by date range (respects date picker)
 */
export const filterDataByDateRange = (
  campaignData: any[],
  dateRange: { from?: Date; to?: Date } | undefined
): any[] => {
  if (!dateRange || !dateRange.from) {
    return campaignData;
  }

  const fromDate = dateRange.from;
  const toDate = dateRange.to || new Date();

  return campaignData.filter(row => {
    if (!row.DATE || row.DATE === 'Totals') return false;

    const rowDate = parseDateString(row.DATE);
    if (!rowDate) return false;

    return rowDate >= fromDate && rowDate <= toDate;
  });
};

/**
 * Get IO forecast data filtered by date range
 */
export const getIOForecastsForDateRange = (
  campaignData: any[],
  dateRange: { from?: Date; to?: Date } | undefined
): IOForecastData[] => {
  const filteredData = filterDataByDateRange(campaignData, dateRange);
  const currentDate = dateRange?.to || new Date();

  return aggregateForecastByIO(filteredData, currentDate);
};