import { parseDateString } from "@/lib/utils";

export interface DailyForecastData {
  date: string;
  agencyType: 'Direct' | 'Channel Partner';
  impressions: number;
  spend: number;
  forecast: number;
  dailyForecast: number; // What the forecast would have been on this specific day
  isProjection: boolean;
}

export interface ForecastSummary {
  agencyType: 'Direct' | 'Channel Partner';
  mtdImpressions: number;
  mtdSpend: number;
  forecastImpressions: number;
  forecastSpend: number;
  dailyAvgSpend: number;
  mostRecentDaySpend: number;
}

// Determine if a campaign belongs to MediaJel Direct or Channel Partners
export function getAgencyType(agencyAbbreviation: string): 'Direct' | 'Channel Partner' {
  return agencyAbbreviation === 'MJ' ? 'Direct' : 'Channel Partner';
}

// Get all dates in a month
export function getDatesInMonth(year: number, month: number): Date[] {
  const dates: Date[] = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  
  for (let day = 1; day <= daysInMonth; day++) {
    dates.push(new Date(year, month, day));
  }
  
  return dates;
}

// Calculate MTD metrics for a specific agency type
export function calculateMTDMetrics(
  data: any[], 
  agencyType: 'Direct' | 'Channel Partner',
  currentDate: Date,
  extractAgencyInfo: (campaignName: string) => { abbreviation: string }
): { mtdImpressions: number; mtdSpend: number; dailyData: any[] } {
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  
  // Filter data for current month and agency type
  const filteredData = data.filter(row => {
    if (!row.DATE || row.DATE === 'Totals') return false;
    
    const rowDate = parseDateString(row.DATE);
    if (!rowDate) return false;
    
    // Check if date is in current month
    if (rowDate.getMonth() !== currentMonth || rowDate.getFullYear() !== currentYear) {
      return false;
    }
    
    // Check if date is not in future
    if (rowDate > currentDate) return false;
    
    // Check agency type
    const campaignName = row["CAMPAIGN ORDER NAME"] || "";
    const { abbreviation } = extractAgencyInfo(campaignName);
    const rowAgencyType = getAgencyType(abbreviation);
    
    return rowAgencyType === agencyType;
  });
  
  // Group by date and sum metrics
  const dailyData: Record<string, { impressions: number; spend: number; date: string }> = {};
  
  filteredData.forEach(row => {
    const dateKey = row.DATE;
    if (!dailyData[dateKey]) {
      dailyData[dateKey] = {
        date: dateKey,
        impressions: 0,
        spend: 0
      };
    }
    
    dailyData[dateKey].impressions += Number(row.IMPRESSIONS) || 0;
    dailyData[dateKey].spend += Number(row.SPEND) || 0;
  });
  
  const dailyDataArray = Object.values(dailyData).sort((a, b) => {
    const dateA = parseDateString(a.date);
    const dateB = parseDateString(b.date);
    return (dateA?.getTime() || 0) - (dateB?.getTime() || 0);
  });
  
  // Calculate MTD totals
  const mtdImpressions = dailyDataArray.reduce((sum, day) => sum + day.impressions, 0);
  const mtdSpend = dailyDataArray.reduce((sum, day) => sum + day.spend, 0);
  
  return { mtdImpressions, mtdSpend, dailyData: dailyDataArray };
}

// Calculate forecast based on MTD + daily extrapolation
export function calculateDailyForecast(
  mtdSpend: number,
  dailyData: any[],
  currentDate: Date
): number {
  if (dailyData.length === 0) return mtdSpend;
  
  // Get most recent day's spend
  const mostRecentDay = dailyData[dailyData.length - 1];
  const mostRecentDaySpend = mostRecentDay?.spend || 0;
  
  // Calculate remaining days in month
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const currentDayOfMonth = currentDate.getDate();
  const remainingDays = daysInMonth - currentDayOfMonth;
  
  // Forecast = MTD + (Most Recent Day Spend × Remaining Days)
  const forecast = mtdSpend + (mostRecentDaySpend * remainingDays);
  
  return forecast;
}

// Calculate what the forecast would have been on a specific date
export function calculateForecastAsOfDate(
  dailyData: any[],
  asOfDate: Date,
  currentMonth: number,
  currentYear: number
): number {
  // Filter data up to the specific date (inclusive)
  const dataUpToDate = dailyData.filter(day => {
    const dayDate = parseDateString(day.date);
    if (!dayDate) return false;
    
    // Compare dates by setting both to the same time (start of day)
    const dayStart = new Date(dayDate);
    dayStart.setHours(0, 0, 0, 0);
    const asOfStart = new Date(asOfDate);
    asOfStart.setHours(0, 0, 0, 0);
    
    return dayStart <= asOfStart;
  });
  
  if (dataUpToDate.length === 0) return 0;
  
  // Calculate MTD spend as of that date
  const mtdSpendAsOfDate = dataUpToDate.reduce((sum, day) => sum + day.spend, 0);
  
  // Get the most recent day's spend up to that date
  const mostRecentDaySpend = dataUpToDate[dataUpToDate.length - 1]?.spend || 0;
  
  // Calculate remaining days in the month after this date
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const dayOfMonth = asOfDate.getDate();
  const remainingDays = daysInMonth - dayOfMonth; // Days remaining after this date
  
  return mtdSpendAsOfDate + (mostRecentDaySpend * remainingDays);
}

// Generate complete daily breakdown for the month
export function generateDailyBreakdown(
  data: any[],
  currentDate: Date,
  extractAgencyInfo: (campaignName: string) => { abbreviation: string }
): DailyForecastData[] {
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  const allDatesInMonth = getDatesInMonth(currentYear, currentMonth);
  
  const result: DailyForecastData[] = [];
  
  // Calculate MTD data for both agency types
  const directMTD = calculateMTDMetrics(data, 'Direct', currentDate, extractAgencyInfo);
  const channelMTD = calculateMTDMetrics(data, 'Channel Partner', currentDate, extractAgencyInfo);
  
  // Calculate forecasts
  const directForecast = calculateDailyForecast(directMTD.mtdSpend, directMTD.dailyData, currentDate);
  const channelForecast = calculateDailyForecast(channelMTD.mtdSpend, channelMTD.dailyData, currentDate);
  
  // Create lookup maps for actual daily data
  const directDailyMap = new Map(directMTD.dailyData.map(d => [d.date, d]));
  const channelDailyMap = new Map(channelMTD.dailyData.map(d => [d.date, d]));
  
  // Generate daily breakdown for entire month
  allDatesInMonth.forEach(date => {
    const dateStr = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
    const isProjection = date > currentDate;
    
    // Calculate forecast shifted by one day - each row shows the forecast as of the NEXT day
    // This means: Day 1 shows Day 2's forecast, Day 2 shows Day 3's forecast, etc.
    // Last day shows 0 since there's no next day
    const nextDay = new Date(date);
    nextDay.setDate(date.getDate() + 1);
    const isLastDayOfMonth = date.getDate() === new Date(currentYear, currentMonth + 1, 0).getDate();
    
    let directDailyForecast, channelDailyForecast;
    
    if (isProjection) {
      // For future dates, use current forecast
      directDailyForecast = directForecast;
      channelDailyForecast = channelForecast;
    } else {
      // For current and past dates, show forecast as of the end of that day
      directDailyForecast = calculateForecastAsOfDate(directMTD.dailyData, date, currentMonth, currentYear);
      channelDailyForecast = calculateForecastAsOfDate(channelMTD.dailyData, date, currentMonth, currentYear);
    }
    
    // Direct row
    const directData = directDailyMap.get(dateStr);
    result.push({
      date: dateStr,
      agencyType: 'Direct',
      impressions: directData?.impressions || 0,
      spend: directData?.spend || 0,
      forecast: directForecast,
      dailyForecast: directDailyForecast,
      isProjection
    });
    
    // Channel Partner row
    const channelData = channelDailyMap.get(dateStr);
    result.push({
      date: dateStr,
      agencyType: 'Channel Partner',
      impressions: channelData?.impressions || 0,
      spend: channelData?.spend || 0,
      forecast: channelForecast,
      dailyForecast: channelDailyForecast,
      isProjection
    });
  });
  
  return result.sort((a, b) => {
    const dateA = parseDateString(a.date);
    const dateB = parseDateString(b.date);
    if ((dateA?.getTime() || 0) !== (dateB?.getTime() || 0)) {
      return (dateA?.getTime() || 0) - (dateB?.getTime() || 0);
    }
    // Within same date, show Direct first
    return a.agencyType === 'Direct' ? -1 : 1;
  });
}

// Generate forecast summary for both agency types
export function generateForecastSummary(
  data: any[],
  currentDate: Date,
  extractAgencyInfo: (campaignName: string) => { abbreviation: string }
): ForecastSummary[] {
  const directMTD = calculateMTDMetrics(data, 'Direct', currentDate, extractAgencyInfo);
  const channelMTD = calculateMTDMetrics(data, 'Channel Partner', currentDate, extractAgencyInfo);
  
  const directForecast = calculateDailyForecast(directMTD.mtdSpend, directMTD.dailyData, currentDate);
  const channelForecast = calculateDailyForecast(channelMTD.mtdSpend, channelMTD.dailyData, currentDate);
  
  // Calculate daily averages
  const directDailyAvg = directMTD.dailyData.length > 0 ? directMTD.mtdSpend / directMTD.dailyData.length : 0;
  const channelDailyAvg = channelMTD.dailyData.length > 0 ? channelMTD.mtdSpend / channelMTD.dailyData.length : 0;
  
  // Get most recent day spend
  const directMostRecent = directMTD.dailyData.length > 0 ? directMTD.dailyData[directMTD.dailyData.length - 1].spend : 0;
  const channelMostRecent = channelMTD.dailyData.length > 0 ? channelMTD.dailyData[channelMTD.dailyData.length - 1].spend : 0;
  
  return [
    {
      agencyType: 'Direct',
      mtdImpressions: directMTD.mtdImpressions,
      mtdSpend: directMTD.mtdSpend,
      forecastImpressions: directMTD.mtdImpressions, // For now, same as MTD since we're not projecting impressions
      forecastSpend: directForecast,
      dailyAvgSpend: directDailyAvg,
      mostRecentDaySpend: directMostRecent
    },
    {
      agencyType: 'Channel Partner',
      mtdImpressions: channelMTD.mtdImpressions,
      mtdSpend: channelMTD.mtdSpend,
      forecastImpressions: channelMTD.mtdImpressions,
      forecastSpend: channelForecast,
      dailyAvgSpend: channelDailyAvg,
      mostRecentDaySpend: channelMostRecent
    }
  ];
}