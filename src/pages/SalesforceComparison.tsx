import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Upload, AlertTriangle, Loader2, X, ChevronUp, ChevronDown, FileText, Target } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SalesforceFileUpload from "@/components/SalesforceFileUpload";
import { loadAllCampaignData } from "@/utils/dataStorage";
import { loadAllSalesforceData, groupSalesforceByMonthAndIO, calculateProratedSalesforceForecasts } from "@/utils/salesforceDataStorage";
import { getIOForecastsForDateRange } from "@/utils/ioForecastAggregation";
import { findMismatchedIOs, extractAllIONumbers, extractIONumber, findIOMatches, extractIONumbers, getIODisplayFormat } from "@/utils/ioNumberExtraction";
import IODetailsModal from "@/components/IODetailsModal";
import { CampaignFilterProvider, useCampaignFilter } from "@/contexts/CampaignFilterContext";
import { parseDateString } from "@/lib/utils";

const SalesforceComparisonContent = () => {
  const navigate = useNavigate();
  const { extractAdvertiserName } = useCampaignFilter();

  // Function to get Salesforce forecast breakdown for an IO
  const getSalesforceCalculationBreakdown = (ioNumber: string, targetMonth: string): {
    breakdown: string;
    total: number;
    details: Array<{ type: string; amount: number; source: string }>;
  } => {
    const ioRecords = salesforceData.filter(row => row.mjaa_number === ioNumber);
    let total = 0;
    const details: Array<{ type: string; amount: number; source: string }> = [];

    ioRecords.forEach(record => {
      const revenue = Number(record.monthly_revenue) || 0;
      const revenueDate = new Date(record.revenue_date);
      const revenueDateMonth = `${revenueDate.getFullYear()}-${String(revenueDate.getMonth() + 1).padStart(2, '0')}`;

      const daysInRevenueMonth = new Date(revenueDate.getFullYear(), revenueDate.getMonth() + 1, 0).getDate();
      const remainingDaysInRevenueMonth = daysInRevenueMonth - revenueDate.getDate() + 1;
      const dailyRate = revenue / remainingDaysInRevenueMonth;

      // Current month start
      if (revenueDateMonth === targetMonth) {
        const amount = dailyRate * remainingDaysInRevenueMonth;
        total += amount;
        details.push({
          type: 'Current Month Launch',
          amount,
          source: `$${revenue.toLocaleString()} ÷ ${remainingDaysInRevenueMonth} days from ${revenueDate.getMonth() + 1}/${revenueDate.getDate()}`
        });
      }
      // Carryover from previous month
      else if (isNextMonth(revenueDateMonth, targetMonth)) {
        const targetDate = new Date(targetMonth + '-01');
        const targetMonthDays = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate();

        const usedInRevenueMonth = dailyRate * remainingDaysInRevenueMonth;
        const remainingBudget = revenue - usedInRevenueMonth;
        const daysToApply = Math.min(targetMonthDays, Math.ceil(remainingBudget / dailyRate));
        const amount = dailyRate * daysToApply;

        if (amount > 0) {
          total += amount;
          details.push({
            type: 'Carryover',
            amount,
            source: `$${remainingBudget.toLocaleString()} remaining from ${revenueDate.getMonth() + 1}/${revenueDate.getDate()} launch`
          });
        }
      }
    });

    const breakdown = details.length > 0
      ? details.map(d => `${d.type}: $${d.amount.toLocaleString()} (${d.source})`).join(' + ')
      : 'No forecast data';

    return { breakdown, total, details };
  };

  // Helper function to check if targetMonth is next month after baseMonth
  const isNextMonth = (baseMonth: string, targetMonth: string): boolean => {
    const [baseYear, baseMonthNum] = baseMonth.split('-').map(Number);
    const [targetYear, targetMonthNum] = targetMonth.split('-').map(Number);

    if (baseYear === targetYear) {
      return targetMonthNum === baseMonthNum + 1;
    } else if (targetYear === baseYear + 1) {
      return baseMonthNum === 12 && targetMonthNum === 1;
    }
    return false;
  };
  const [salesforceData, setSalesforceData] = useState<any[]>([]);
  const [campaignData, setCampaignData] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [activeTab, setActiveTab] = useState<'matched' | 'salesforce-only' | 'dashboard-only'>('matched');
  const [ioDetailsModal, setIODetailsModal] = useState<{
    open: boolean;
    ioNumber: string;
  }>({ open: false, ioNumber: "" });
  const [sortConfig, setSortConfig] = useState<{
    key: 'ioNumber' | 'advertiser' | null;
    direction: 'asc' | 'desc';
  }>({ key: null, direction: 'asc' });
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [mismatchDetailsModal, setMismatchDetailsModal] = useState<{
    open: boolean;
    ioNumber: string;
    type: 'salesforce' | 'dashboard';
  }>({ open: false, ioNumber: "", type: 'salesforce' });
  const [mismatchesByAdvertiserModal, setMismatchesByAdvertiserModal] = useState(false);

  // Calculate data freshness timestamps
  const dataFreshness = useMemo(() => {
    let salesforceLastUpdated = null;
    let dashboardLastUpdated = null;

    if (salesforceData.length > 0) {
      const salesforceTimestamps = salesforceData
        .map(row => row.uploaded_at)
        .filter(timestamp => timestamp)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
      salesforceLastUpdated = salesforceTimestamps[0] || null;
    }

    if (campaignData.length > 0) {
      const dashboardTimestamps = campaignData
        .map(row => row.uploaded_at)
        .filter(timestamp => timestamp)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
      dashboardLastUpdated = dashboardTimestamps[0] || null;
    }

    return { salesforceLastUpdated, dashboardLastUpdated };
  }, [salesforceData, campaignData]);

  // Format timestamp to Pacific Time
  const formatTimestamp = (timestamp: string | null): string => {
    if (!timestamp) return 'No data uploaded';

    try {
      const date = new Date(timestamp);
      return date.toLocaleString('en-US', {
        timeZone: 'America/Los_Angeles',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZoneName: 'short'
      });
    } catch (error) {
      return 'Invalid date';
    }
  };

  // Load existing data on component mount
  useEffect(() => {
    const loadExistingData = async () => {
      try {
        console.log('📥 Loading existing campaign and Salesforce data...');

        // Load campaign data
        const campaignResult = await loadAllCampaignData();
        if (campaignResult.success && campaignResult.data.length > 0) {
          console.log(`✅ Loaded ${campaignResult.data.length} campaign records`);
          setCampaignData(campaignResult.data);
        }

        // Load Salesforce data
        const salesforceResult = await loadAllSalesforceData();
        if (salesforceResult.success && salesforceResult.data.length > 0) {
          console.log(`✅ Loaded ${salesforceResult.data.length} Salesforce records`);
          setSalesforceData(salesforceResult.data);
        }

      } catch (error) {
        console.error('❌ Error loading data:', error);
        toast.error('Failed to load existing data');
      } finally {
        setIsLoadingData(false);
      }
    };

    loadExistingData();
  }, []);

  // Handle new Salesforce data upload
  const handleSalesforceDataLoaded = async (newData: any[]) => {
    try {
      // Reload all Salesforce data from database to get complete dataset
      const salesforceResult = await loadAllSalesforceData();
      if (salesforceResult.success) {
        setSalesforceData(salesforceResult.data);
        console.log(`🔄 Refreshed with ${salesforceResult.data.length} Salesforce records`);
      }
    } catch (error) {
      console.error('❌ Error reloading Salesforce data:', error);
    }
  };

  // Calculate comparison data using new matching approach
  const comparisonData = useMemo(() => {
    if (salesforceData.length === 0 || campaignData.length === 0) {
      return {
        matchedIOs: [],
        salesforceOnlyIOs: [],
        dashboardOnlyIOs: [],
        mismatches: { onlyInSalesforce: [], onlyInDashboard: [], matched: [] }
      };
    }

    // Extract IO numbers from Salesforce data
    const salesforceIOs = [...new Set(salesforceData.map(row => row.mjaa_number))];

    // Find matches using new approach that handles slash-separated IOs
    const ioMatches = findIOMatches(salesforceIOs, campaignData);

    console.log('📊 Found matches:', ioMatches.matches.length);
    console.log('📊 Unmatched Salesforce IOs:', ioMatches.unmatchedSalesforce.length);
    console.log('📊 Unmatched Dashboard IOs:', ioMatches.unmatchedDashboard.length);

    // Get IO forecasts using new display format approach
    const ioForecasts = getIOForecastsForDateRange(campaignData, undefined);
    const ioForecastMap = new Map(ioForecasts.map(io => [io.ioDisplayFormat, io]));
    const ioForecastLegacyMap = new Map(ioForecasts.map(io => [io.ioNumber, io]));

    // Get current month and last month keys
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const lastMonth = now.getMonth() === 0
      ? `${now.getFullYear() - 1}-12`
      : `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`;

    // Calculate prorated Salesforce forecasts for current and last month
    const currentMonthSalesforceForecasts = calculateProratedSalesforceForecasts(salesforceData, currentMonth);
    const lastMonthSalesforceForecasts = calculateProratedSalesforceForecasts(salesforceData, lastMonth);

    // Build matched IOs comparison data
    const matchedIOs = ioMatches.matches.map(match => {
      const forecast = ioForecastMap.get(match.displayFormat);

      // Calculate total Salesforce amounts for all matched IOs using proration
      const currentMonthSF = match.matchedSalesforceIOs.reduce((sum, ioNumber) =>
        sum + (currentMonthSalesforceForecasts[ioNumber] || 0), 0);
      const lastMonthSF = match.matchedSalesforceIOs.reduce((sum, ioNumber) =>
        sum + (lastMonthSalesforceForecasts[ioNumber] || 0), 0);

      // Find first campaign name for this display format to extract advertiser
      const firstCampaignForIO = campaignData.find(row => {
        const campaignName = row["CAMPAIGN ORDER NAME"] || row.campaign_order_name || "";
        const displayFormat = getIODisplayFormat(campaignName);
        return displayFormat === match.displayFormat;
      });

      const advertiser = firstCampaignForIO
        ? extractAdvertiserName(firstCampaignForIO["CAMPAIGN ORDER NAME"] || firstCampaignForIO.campaign_order_name || "")
        : "";

      return {
        ioNumber: match.displayFormat, // Now shows "2001567" or "2001567/2001568"
        ioNumbers: match.ioNumbers, // Array of individual IO numbers
        advertiser,
        currentMonthSF,
        currentMonthDashboard: forecast?.mtdSpend || 0,
        currentMonthForecast: forecast?.forecastSpend || 0,
        lastMonthSF,
        lastMonthDashboard: forecast?.lastMonthSpend || 0
      };
    });

    // Find unmatched display formats (campaigns not matched to Salesforce)
    const matchedDisplayFormats = new Set(ioMatches.matches.map(m => m.displayFormat));
    const allDisplayFormats = [...ioForecastMap.keys()]; // These are display formats
    const unmatchedDisplayFormats = allDisplayFormats.filter(displayFormat =>
      !matchedDisplayFormats.has(displayFormat)
    );

    // Filter unmatched display formats for those with current activity
    const filteredDashboardDisplayFormats = unmatchedDisplayFormats.filter(displayFormat => {
      const forecast = ioForecastMap.get(displayFormat);
      const hasSpend = (forecast?.mtdSpend || 0) > 0;
      const hasForecast = (forecast?.forecastSpend || 0) > 0;
      return hasSpend || hasForecast;
    });

    console.log(`📊 Filtered Dashboard Display Formats: ${unmatchedDisplayFormats.length} -> ${filteredDashboardDisplayFormats.length} (removed ${unmatchedDisplayFormats.length - filteredDashboardDisplayFormats.length} zero-value campaigns)`);

    // Filter Salesforce-only IOs to only include those with current month prorated revenue
    const filteredSalesforceIOs = ioMatches.unmatchedSalesforce.filter(ioNumber => {
      const currentMonthSF = currentMonthSalesforceForecasts[ioNumber] || 0;
      return currentMonthSF > 0; // Only include IOs with current month Salesforce revenue
    });

    console.log(`📊 Filtered Salesforce IOs: ${ioMatches.unmatchedSalesforce.length} -> ${filteredSalesforceIOs.length} (removed ${ioMatches.unmatchedSalesforce.length - filteredSalesforceIOs.length} zero-revenue IOs)`);

    // Build Salesforce-only IOs data
    const salesforceOnlyIOs = filteredSalesforceIOs.map(ioNumber => {
      const currentMonthSF = currentMonthSalesforceForecasts[ioNumber] || 0;
      const lastMonthSF = lastMonthSalesforceForecasts[ioNumber] || 0;

      // Find account name from Salesforce data
      const salesforceRecord = salesforceData.find(row => row.mjaa_number === ioNumber);
      const advertiser = salesforceRecord?.account_name || "";

      return {
        ioNumber,
        ioNumbers: [ioNumber],
        advertiser, // Use Account Name from Salesforce
        currentMonthSF,
        currentMonthDashboard: 0, // Not in dashboard
        currentMonthForecast: 0, // Not in dashboard
        lastMonthSF,
        lastMonthDashboard: 0 // Not in dashboard
      };
    });

    // Build Dashboard-only IOs data using display formats
    const dashboardOnlyIOs = filteredDashboardDisplayFormats.map(displayFormat => {
      const forecast = ioForecastMap.get(displayFormat);

      // Find first campaign name for this display format to extract advertiser
      const firstCampaignForIO = campaignData.find(row => {
        const campaignName = row["CAMPAIGN ORDER NAME"] || row.campaign_order_name || "";
        const ioDisplayFormat = getIODisplayFormat(campaignName);
        return ioDisplayFormat === displayFormat;
      });

      const advertiser = firstCampaignForIO
        ? extractAdvertiserName(firstCampaignForIO["CAMPAIGN ORDER NAME"] || firstCampaignForIO.campaign_order_name || "")
        : "";

      // Get the individual IO numbers for this display format
      const ioNumbers = extractIONumbers(firstCampaignForIO?.["CAMPAIGN ORDER NAME"] || firstCampaignForIO?.campaign_order_name || "");

      return {
        ioNumber: displayFormat, // Show the full display format (e.g., "2001482/2001620")
        ioNumbers, // Array of individual IOs
        advertiser,
        currentMonthSF: 0, // Not in Salesforce
        currentMonthDashboard: forecast?.mtdSpend || 0,
        currentMonthForecast: forecast?.forecastSpend || 0,
        lastMonthSF: 0, // Not in Salesforce
        lastMonthDashboard: forecast?.lastMonthSpend || 0
      };
    });

    // Create legacy mismatch format for compatibility
    const mismatches = {
      onlyInSalesforce: filteredSalesforceIOs,
      onlyInDashboard: filteredDashboardDisplayFormats, // Now using display formats
      matched: ioMatches.matches.map(m => m.displayFormat)
    };

    return { matchedIOs, salesforceOnlyIOs, dashboardOnlyIOs, mismatches };
  }, [salesforceData, campaignData, extractAdvertiserName]);

  // Calculate totals for mismatched IOs
  const mismatchTotals = useMemo(() => {
    if (salesforceData.length === 0 || campaignData.length === 0) {
      return {
        salesforceOnly: { currentMonthForecast: 0, lastMonthForecast: 0 },
        dashboardOnly: { currentMonthForecast: 0, lastMonthSpend: 0 }
      };
    }

    // Get current month and last month keys for calculations
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const lastMonth = now.getMonth() === 0
      ? `${now.getFullYear() - 1}-12`
      : `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`;

    // Calculate prorated Salesforce forecasts for totals
    const currentMonthSalesforceForecasts = calculateProratedSalesforceForecasts(salesforceData, currentMonth);
    const lastMonthSalesforceForecasts = calculateProratedSalesforceForecasts(salesforceData, lastMonth);

    // Calculate Salesforce-only totals (current month forecast + last month forecast)
    const salesforceOnly = {
      currentMonthForecast: comparisonData.mismatches.onlyInSalesforce.reduce((sum, io) =>
        sum + (currentMonthSalesforceForecasts[io] || 0), 0),
      lastMonthForecast: comparisonData.mismatches.onlyInSalesforce.reduce((sum, io) =>
        sum + (lastMonthSalesforceForecasts[io] || 0), 0)
    };

    // For dashboard-only, we need to get forecasts using legacy approach since they're individual IOs
    const ioForecasts = getIOForecastsForDateRange(campaignData, undefined);
    const ioForecastMap = new Map(ioForecasts.map(io => [io.ioNumber, io])); // Using legacy ioNumber field

    const dashboardOnly = {
      currentMonthForecast: comparisonData.mismatches.onlyInDashboard.reduce((sum, io) => {
        const forecast = ioForecastMap.get(io);
        return sum + (forecast?.forecastSpend || 0);
      }, 0),
      lastMonthSpend: comparisonData.mismatches.onlyInDashboard.reduce((sum, io) => {
        const forecast = ioForecastMap.get(io);
        return sum + (forecast?.lastMonthSpend || 0);
      }, 0)
    };

    return { salesforceOnly, dashboardOnly };
  }, [comparisonData.mismatches, salesforceData, campaignData]);

  // Handle sorting
  const handleSort = (key: 'ioNumber' | 'advertiser') => {
    setSortConfig(prevConfig => ({
      key,
      direction: prevConfig.key === key && prevConfig.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Get current tab data and sort it
  const getCurrentTabData = () => {
    switch (activeTab) {
      case 'matched':
        return comparisonData.matchedIOs;
      case 'salesforce-only':
        return comparisonData.salesforceOnlyIOs;
      case 'dashboard-only':
        return comparisonData.dashboardOnlyIOs;
      default:
        return comparisonData.matchedIOs;
    }
  };

  // Sort the current tab's IOs based on current sort configuration
  const sortedCurrentTabIOs = useMemo(() => {
    const currentTabData = getCurrentTabData();
    if (!sortConfig.key) return currentTabData;

    return [...currentTabData].sort((a, b) => {
      let aValue: string;
      let bValue: string;

      if (sortConfig.key === 'ioNumber') {
        aValue = a.ioNumber;
        bValue = b.ioNumber;
      } else {
        aValue = a.advertiser || '';
        bValue = b.advertiser || '';
      }

      if (sortConfig.direction === 'asc') {
        return aValue.localeCompare(bValue);
      } else {
        return bValue.localeCompare(aValue);
      }
    });
  }, [activeTab, comparisonData.matchedIOs, comparisonData.salesforceOnlyIOs, comparisonData.dashboardOnlyIOs, sortConfig]);

  // Calculate totals for all columns based on current tab
  const totals = useMemo(() => {
    const currentTabData = getCurrentTabData();
    return currentTabData.reduce((acc, io) => ({
      currentMonthSF: acc.currentMonthSF + io.currentMonthSF,
      currentMonthDashboard: acc.currentMonthDashboard + io.currentMonthDashboard,
      currentMonthForecast: acc.currentMonthForecast + io.currentMonthForecast,
      lastMonthSF: acc.lastMonthSF + io.lastMonthSF,
      lastMonthDashboard: acc.lastMonthDashboard + io.lastMonthDashboard,
    }), {
      currentMonthSF: 0,
      currentMonthDashboard: 0,
      currentMonthForecast: 0,
      lastMonthSF: 0,
      lastMonthDashboard: 0,
    });
  }, [activeTab, comparisonData.matchedIOs, comparisonData.salesforceOnlyIOs, comparisonData.dashboardOnlyIOs]);

  // Calculate grand totals for the summary cards (always all data)
  const grandTotals = useMemo(() => {
    const matchedTotals = comparisonData.matchedIOs.reduce((acc, io) => ({
      currentMonthSF: acc.currentMonthSF + io.currentMonthSF,
      currentMonthDashboard: acc.currentMonthDashboard + io.currentMonthDashboard,
      currentMonthForecast: acc.currentMonthForecast + io.currentMonthForecast,
      lastMonthSF: acc.lastMonthSF + io.lastMonthSF,
      lastMonthDashboard: acc.lastMonthDashboard + io.lastMonthDashboard,
    }), {
      currentMonthSF: 0,
      currentMonthDashboard: 0,
      currentMonthForecast: 0,
      lastMonthSF: 0,
      lastMonthDashboard: 0,
    });

    return matchedTotals;
  }, [comparisonData.matchedIOs]);

  // Handle IO number click
  const handleIOClick = (ioNumber: string) => {
    setIODetailsModal({ open: true, ioNumber });
  };

  // Handle mismatch IO click
  const handleMismatchIOClick = (ioNumber: string, type: 'salesforce' | 'dashboard') => {
    console.log('Handling mismatch IO click:', ioNumber, type);
    setMismatchDetailsModal({ open: true, ioNumber, type });
  };

  // Get MJAA filenames with current month revenue for a specific IO number
  const getMJAAFilenamesWithRevenue = (ioNumber: string) => {
    try {
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

      // Get current month records for this IO
      const currentMonthRecords = salesforceData.filter(row =>
        row.mjaa_number === ioNumber && row.month === currentMonth
      );

      // Get unique filenames with their revenue
      const filenameMap = new Map();
      currentMonthRecords.forEach(row => {
        if (row.mjaa_filename) {
          const filenames = row.mjaa_filename.split(', ');
          filenames.forEach(filename => {
            if (filename.trim()) {
              filenameMap.set(filename.trim(), (filenameMap.get(filename.trim()) || 0) + (row.monthly_revenue || 0));
            }
          });
        }
      });

      return Array.from(filenameMap.entries()).map(([filename, revenue]) => ({
        filename,
        revenue
      }));
    } catch (error) {
      console.error('Error getting MJAA filenames with revenue:', error);
      return [];
    }
  };

  // Get campaign names with forecast data for a specific IO number
  const getCampaignNamesWithForecast = (ioNumber: string) => {
    try {
      console.log(`🔍 Looking for campaigns with IO number: ${ioNumber}`);

      const matchingRows = campaignData.filter(row => {
        const campaignName = row["CAMPAIGN ORDER NAME"] || row.campaign_order_name || "";
        const extractedIO = extractIONumber(campaignName);
        const allIOs = extractIONumbers(campaignName); // Check both methods

        console.log(`Campaign: "${campaignName}" -> extractIONumber: ${extractedIO}, extractIONumbers: [${allIOs.join(', ')}]`);

        // Check if the IO matches either the single extraction or any of the multiple extractions
        return extractedIO === ioNumber || allIOs.includes(ioNumber);
      });

      console.log(`Found ${matchingRows.length} matching rows for IO ${ioNumber}`);

      // Group by campaign name and calculate forecast for each
      const campaignForecasts = new Map<string, number>();
      const uniqueCampaigns = new Set<string>();

      matchingRows.forEach(row => {
        const campaignName = row["CAMPAIGN ORDER NAME"] || row.campaign_order_name || "";
        uniqueCampaigns.add(campaignName);
      });

      // Calculate individual campaign forecasts
      const calculateForecastForCampaign = (campaignName: string): number => {
        const campaignRows = campaignData.filter(row => {
          const rowCampaignName = row["CAMPAIGN ORDER NAME"] || row.campaign_order_name || "";
          return rowCampaignName === campaignName;
        });

        const currentDate = new Date();
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();
        const currentMonthStart = new Date(currentYear, currentMonth, 1);
        const daysElapsed = currentDate.getDate();
        const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

        let mtdSpend = 0;
        campaignRows.forEach(row => {
          if (!row.DATE || row.DATE === 'Totals') return;
          const rowDate = parseDateString(row.DATE);
          if (!rowDate) return;

          if (rowDate >= currentMonthStart && rowDate <= currentDate) {
            mtdSpend += Number(row.SPEND) || 0;
          }
        });

        if (daysElapsed === 0 || mtdSpend === 0) return mtdSpend;

        const dailyAvgSpend = mtdSpend / daysElapsed;
        const remainingDays = totalDaysInMonth - daysElapsed;
        const projectedSpend = dailyAvgSpend * remainingDays;

        return mtdSpend + projectedSpend;
      };

      // For each unique campaign, calculate its individual forecast and filter out zero amounts
      const campaignsWithForecast = Array.from(uniqueCampaigns)
        .map(campaignName => {
          const forecast = calculateForecastForCampaign(campaignName);
          return {
            name: campaignName,
            currentMonthForecast: forecast
          };
        })
        .filter(campaign => campaign.currentMonthForecast > 0);

      return campaignsWithForecast;
    } catch (error) {
      console.error('Error getting campaign names with forecast:', error);
      return [];
    }
  };

  if (isLoadingData) {
    return (
      <div className="container py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
            <p className="text-gray-600">Loading existing data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="border-b animate-fade-in">
        <div className="flex items-center justify-between px-1 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
            <h1 className="text-2xl font-bold">Salesforce Comparison</h1>
          </div>
          <Button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2"
          >
            <Upload className="h-4 w-4" />
            Upload Salesforce Data
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="mt-2 space-y-2">
        {/* Data Freshness Notice */}
        {(salesforceData.length > 0 || campaignData.length > 0) && (
          <div className="text-xs text-gray-500 flex items-center justify-end gap-4 px-1">
            <span>Data Last Updated:</span>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
              <span>Salesforce: {formatTimestamp(dataFreshness.salesforceLastUpdated)}</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
              <span>Dashboard: {formatTimestamp(dataFreshness.dashboardLastUpdated)}</span>
            </div>
          </div>
        )}

        {/* Comparison Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-end gap-3">
                <CardTitle>Forecast Comparison</CardTitle>
                {getCurrentTabData().length > 0 && (
                  <span className="text-sm text-gray-600 translate-y-0.5">
                    {getCurrentTabData().length} IOs in {activeTab === 'matched' ? 'Matched' : activeTab === 'salesforce-only' ? 'Salesforce-Only' : 'Dashboard-Only'} tab
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMismatchesByAdvertiserModal(true)}
                  className="flex items-center gap-2"
                  disabled={comparisonData.salesforceOnlyIOs.length === 0 && comparisonData.dashboardOnlyIOs.length === 0}
                >
                  <AlertTriangle className="h-4 w-4" />
                  Mismatches by Advertiser ({comparisonData.salesforceOnlyIOs.length + comparisonData.dashboardOnlyIOs.length})
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {salesforceData.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Upload Salesforce data to see revenue comparisons
              </div>
            ) : campaignData.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No campaign data available. Please upload campaign data from the main dashboard first.
              </div>
            ) : comparisonData.matchedIOs.length === 0 && comparisonData.salesforceOnlyIOs.length === 0 && comparisonData.dashboardOnlyIOs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No IO data found in either Salesforce or campaign data
              </div>
            ) : (
              <>
                {/* Forecast Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {/* Salesforce Forecast Card */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Salesforce Forecast</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex flex-col">
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-medium text-gray-500">Current Month</div>
                            <div className="text-2xl font-bold text-green-600">
                              ${(grandTotals.currentMonthSF + mismatchTotals.salesforceOnly.currentMonthForecast).toLocaleString()}
                            </div>
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <div className="text-sm text-gray-500">vs Last Month</div>
                            <div className="flex items-center gap-2">
                              <div className="text-sm text-gray-600">
                                ${(grandTotals.lastMonthSF + mismatchTotals.salesforceOnly.lastMonthForecast).toLocaleString()}
                              </div>
                              {(() => {
                                const currentTotal = grandTotals.currentMonthSF + mismatchTotals.salesforceOnly.currentMonthForecast;
                                const lastTotal = grandTotals.lastMonthSF + mismatchTotals.salesforceOnly.lastMonthForecast;
                                const change = currentTotal - lastTotal;
                                const percentage = lastTotal > 0 ? (change / lastTotal) * 100 : 0;
                                return change !== 0 ? (
                                  <div className={`text-xs px-2 py-1 rounded-full ${
                                    change > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                  }`}>
                                    {change > 0 ? '+' : ''}{percentage.toFixed(1)}%
                                  </div>
                                ) : null;
                              })()}
                            </div>
                          </div>
                        </div>
                        <div className="pt-3 border-t space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Matched IOs:</span>
                            <span className="font-medium">${grandTotals.currentMonthSF.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Unmatched IOs:</span>
                            <span className="font-medium">
                              ${mismatchTotals.salesforceOnly.currentMonthForecast.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Dashboard Forecast Card */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Dashboard Forecast</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex flex-col">
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-medium text-gray-500">Current Month</div>
                            <div className="text-2xl font-bold text-blue-600">
                              ${Math.round(grandTotals.currentMonthForecast + mismatchTotals.dashboardOnly.currentMonthForecast).toLocaleString()}
                            </div>
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <div className="text-sm text-gray-500">vs Last Month</div>
                            <div className="flex items-center gap-2">
                              <div className="text-sm text-gray-600">
                                ${Math.round(grandTotals.lastMonthDashboard + mismatchTotals.dashboardOnly.lastMonthSpend).toLocaleString()}
                              </div>
                              {(() => {
                                const currentTotal = grandTotals.currentMonthForecast + mismatchTotals.dashboardOnly.currentMonthForecast;
                                const lastTotal = grandTotals.lastMonthDashboard + mismatchTotals.dashboardOnly.lastMonthSpend;
                                const change = currentTotal - lastTotal;
                                const percentage = lastTotal > 0 ? (change / lastTotal) * 100 : 0;
                                return change !== 0 ? (
                                  <div className={`text-xs px-2 py-1 rounded-full ${
                                    change > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                  }`}>
                                    {change > 0 ? '+' : ''}{percentage.toFixed(1)}%
                                  </div>
                                ) : null;
                              })()}
                            </div>
                          </div>
                        </div>
                        <div className="pt-3 border-t space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Matched IOs:</span>
                            <span className="font-medium">${Math.round(grandTotals.currentMonthForecast).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Unmatched IOs:</span>
                            <span className="font-medium">
                              ${Math.round(mismatchTotals.dashboardOnly.currentMonthForecast).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Discrepancies Card */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Discrepancies</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex flex-col">
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-medium text-gray-500">Current Month</div>
                            <div className={`text-2xl font-bold ${
                              ((grandTotals.currentMonthSF + mismatchTotals.salesforceOnly.currentMonthForecast) -
                               (grandTotals.currentMonthForecast + mismatchTotals.dashboardOnly.currentMonthForecast)) >= 0 ? 'text-red-600' : 'text-green-600'
                            }`}>
                              ${Math.abs((grandTotals.currentMonthSF + mismatchTotals.salesforceOnly.currentMonthForecast) -
                                        (grandTotals.currentMonthForecast + mismatchTotals.dashboardOnly.currentMonthForecast)).toLocaleString()}
                            </div>
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <div className="text-sm text-gray-500">vs Last Month</div>
                            <div className="flex items-center gap-2">
                              <div className="text-sm text-gray-600">
                                ${Math.abs((grandTotals.lastMonthSF + mismatchTotals.salesforceOnly.lastMonthForecast) -
                                          (grandTotals.lastMonthDashboard + mismatchTotals.dashboardOnly.lastMonthSpend)).toLocaleString()}
                              </div>
                              {(() => {
                                const currentDiscrepancy = Math.abs((grandTotals.currentMonthSF + mismatchTotals.salesforceOnly.currentMonthForecast) -
                                                                   (grandTotals.currentMonthForecast + mismatchTotals.dashboardOnly.currentMonthForecast));
                                const lastDiscrepancy = Math.abs((grandTotals.lastMonthSF + mismatchTotals.salesforceOnly.lastMonthForecast) -
                                                                 (grandTotals.lastMonthDashboard + mismatchTotals.dashboardOnly.lastMonthSpend));
                                const change = currentDiscrepancy - lastDiscrepancy;
                                const percentage = lastDiscrepancy > 0 ? (change / lastDiscrepancy) * 100 : 0;
                                return change !== 0 ? (
                                  <div className={`text-xs px-2 py-1 rounded-full ${
                                    change > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                                  }`}>
                                    {change > 0 ? '+' : ''}{percentage.toFixed(1)}%
                                  </div>
                                ) : null;
                              })()}
                            </div>
                          </div>
                        </div>
                        <div className="pt-3 border-t space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Matched IOs:</span>
                            <span className={`font-medium ${
                              (grandTotals.currentMonthSF - grandTotals.currentMonthForecast) >= 0 ? 'text-red-600' : 'text-green-600'
                            }`}>
                              ${Math.abs(grandTotals.currentMonthSF - grandTotals.currentMonthForecast).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Unmatched IOs:</span>
                            <span className={`font-medium ${
                              (mismatchTotals.salesforceOnly.currentMonthForecast - mismatchTotals.dashboardOnly.currentMonthForecast) >= 0 ? 'text-red-600' : 'text-green-600'
                            }`}>
                              ${Math.abs(mismatchTotals.salesforceOnly.currentMonthForecast - mismatchTotals.dashboardOnly.currentMonthForecast).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Tabs for different IO views */}
                <Tabs value={activeTab} onValueChange={(value: string) => setActiveTab(value as 'matched' | 'salesforce-only' | 'dashboard-only')} className="mb-6">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="matched" className="flex items-center gap-2">
                      Matched IOs
                      {comparisonData.matchedIOs.length > 0 && (
                        <span className="ml-1 px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">
                          {comparisonData.matchedIOs.length}
                        </span>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="salesforce-only" className="flex items-center gap-2">
                      Salesforce-Only
                      {comparisonData.salesforceOnlyIOs.length > 0 && (
                        <span className="ml-1 px-2 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">
                          {comparisonData.salesforceOnlyIOs.length}
                        </span>
                      )}
                    </TabsTrigger>
                    <TabsTrigger value="dashboard-only" className="flex items-center gap-2">
                      Dashboard-Only
                      {comparisonData.dashboardOnlyIOs.length > 0 && (
                        <span className="ml-1 px-2 py-0.5 text-xs bg-amber-100 text-amber-700 rounded-full">
                          {comparisonData.dashboardOnlyIOs.length}
                        </span>
                      )}
                    </TabsTrigger>
                  </TabsList>
                </Tabs>

              <div className="rounded-md border">
                {/* Sticky Header */}
                <div className="sticky top-0 z-50 bg-white border-b">
                  {activeTab === 'matched' && (
                    <div className="grid grid-cols-7 gap-0 py-3 px-4 text-sm font-medium text-muted-foreground">
                      <div className="w-[160px]">
                        <button
                          onClick={() => handleSort('ioNumber')}
                          className="text-left flex items-center gap-1 hover:bg-gray-50 py-1 px-1 rounded transition-colors"
                        >
                          <span>IO Number</span>
                          {sortConfig.key === 'ioNumber' ? (
                            sortConfig.direction === 'asc' ? (
                              <ChevronUp className="h-3 w-3" />
                            ) : (
                              <ChevronDown className="h-3 w-3" />
                            )
                          ) : (
                            <div className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                      <div className="w-[140px]">
                        <button
                          onClick={() => handleSort('advertiser')}
                          className="text-left flex items-center gap-1 hover:bg-gray-50 py-1 px-1 rounded transition-colors"
                        >
                          <span>Advertiser</span>
                          {sortConfig.key === 'advertiser' ? (
                            sortConfig.direction === 'asc' ? (
                              <ChevronUp className="h-3 w-3" />
                            ) : (
                              <ChevronDown className="h-3 w-3" />
                            )
                          ) : (
                            <div className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                      <div className="text-center">Current Month<br/>Salesforce Revenue</div>
                      <div className="text-center">Current Month<br/>Dashboard Spend</div>
                      <div className="text-center">Current Month<br/>Dashboard Forecast</div>
                      <div className="text-center">Last Month<br/>Salesforce Revenue</div>
                      <div className="text-center">Last Month<br/>Dashboard Spend</div>
                    </div>
                  )}
                  {activeTab === 'salesforce-only' && (
                    <div className="grid grid-cols-4 gap-0 py-3 px-4 text-sm font-medium text-muted-foreground">
                      <div className="w-[160px]">
                        <button
                          onClick={() => handleSort('ioNumber')}
                          className="text-left flex items-center gap-1 hover:bg-gray-50 py-1 px-1 rounded transition-colors"
                        >
                          <span>IO Number</span>
                          {sortConfig.key === 'ioNumber' ? (
                            sortConfig.direction === 'asc' ? (
                              <ChevronUp className="h-3 w-3" />
                            ) : (
                              <ChevronDown className="h-3 w-3" />
                            )
                          ) : (
                            <div className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                      <div className="w-[300px]">
                        <button
                          onClick={() => handleSort('advertiser')}
                          className="text-left flex items-center gap-1 hover:bg-gray-50 py-1 px-1 rounded transition-colors"
                        >
                          <span>Advertiser</span>
                          {sortConfig.key === 'advertiser' ? (
                            sortConfig.direction === 'asc' ? (
                              <ChevronUp className="h-3 w-3" />
                            ) : (
                              <ChevronDown className="h-3 w-3" />
                            )
                          ) : (
                            <div className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                      <div className="text-center">Current Month<br/>Salesforce Revenue</div>
                      <div className="text-center">Last Month<br/>Salesforce Revenue</div>
                    </div>
                  )}
                  {activeTab === 'dashboard-only' && (
                    <div className="grid grid-cols-5 gap-0 py-3 px-4 text-sm font-medium text-muted-foreground">
                      <div className="w-[160px]">
                        <button
                          onClick={() => handleSort('ioNumber')}
                          className="text-left flex items-center gap-1 hover:bg-gray-50 py-1 px-1 rounded transition-colors"
                        >
                          <span>IO Number</span>
                          {sortConfig.key === 'ioNumber' ? (
                            sortConfig.direction === 'asc' ? (
                              <ChevronUp className="h-3 w-3" />
                            ) : (
                              <ChevronDown className="h-3 w-3" />
                            )
                          ) : (
                            <div className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                      <div className="w-[220px]">
                        <button
                          onClick={() => handleSort('advertiser')}
                          className="text-left flex items-center gap-1 hover:bg-gray-50 py-1 px-1 rounded transition-colors"
                        >
                          <span>Advertiser</span>
                          {sortConfig.key === 'advertiser' ? (
                            sortConfig.direction === 'asc' ? (
                              <ChevronUp className="h-3 w-3" />
                            ) : (
                              <ChevronDown className="h-3 w-3" />
                            )
                          ) : (
                            <div className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                      <div className="text-center">Current Month<br/>Dashboard Spend</div>
                      <div className="text-center">Current Month<br/>Dashboard Forecast</div>
                      <div className="text-center">Last Month<br/>Dashboard Spend</div>
                    </div>
                  )}
                </div>

                {/* Scrollable Table Body */}
                <div className="max-h-[600px] overflow-y-auto">
                  {sortedCurrentTabIOs.map((io) => (
                    <div key={io.ioNumber}>
                      {activeTab === 'matched' && (
                        <div className="grid grid-cols-7 gap-0 py-3 px-4 border-b hover:bg-gray-50">
                          <div className="w-[160px] text-sm">
                            <button
                              onClick={() => handleIOClick(io.ioNumber)}
                              className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                            >
                              {io.ioNumber}
                            </button>
                          </div>
                          <div className="w-[140px] text-sm">
                            <div className="truncate" title={io.advertiser}>
                              {io.advertiser || "—"}
                            </div>
                          </div>
                          <div className="text-center text-sm">${io.currentMonthSF.toLocaleString()}</div>
                          <div className="text-center text-sm">${Math.round(io.currentMonthDashboard).toLocaleString()}</div>
                          <div className="text-center text-sm">${Math.round(io.currentMonthForecast).toLocaleString()}</div>
                          <div className="text-center text-sm">${io.lastMonthSF.toLocaleString()}</div>
                          <div className="text-center text-sm">${Math.round(io.lastMonthDashboard).toLocaleString()}</div>
                        </div>
                      )}
                      {activeTab === 'salesforce-only' && (
                        <div className="grid grid-cols-4 gap-0 py-3 px-4 border-b hover:bg-gray-50">
                          <div className="w-[160px] text-sm">
                            <button
                              onClick={() => handleIOClick(io.ioNumber)}
                              className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                            >
                              {io.ioNumber}
                            </button>
                          </div>
                          <div className="w-[300px] text-sm">
                            <div>
                              {io.advertiser || "—"}
                            </div>
                          </div>
                          <div className="text-center text-sm">${io.currentMonthSF.toLocaleString()}</div>
                          <div className="text-center text-sm">${io.lastMonthSF.toLocaleString()}</div>
                        </div>
                      )}
                      {activeTab === 'dashboard-only' && (
                        <div className="grid grid-cols-5 gap-0 py-3 px-4 border-b hover:bg-gray-50">
                          <div className="w-[160px] text-sm">
                            <button
                              onClick={() => handleIOClick(io.ioNumber)}
                              className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                            >
                              {io.ioNumber}
                            </button>
                          </div>
                          <div className="w-[220px] text-sm">
                            <div>
                              {io.advertiser || "—"}
                            </div>
                          </div>
                          <div className="text-center text-sm">${Math.round(io.currentMonthDashboard).toLocaleString()}</div>
                          <div className="text-center text-sm">${Math.round(io.currentMonthForecast).toLocaleString()}</div>
                          <div className="text-center text-sm">${Math.round(io.lastMonthDashboard).toLocaleString()}</div>
                        </div>
                      )}
                    </div>
                  ))}
                  {getCurrentTabData().length > 0 && (
                    <div>
                      {activeTab === 'matched' && (
                        <div className="grid grid-cols-7 gap-0 py-3 px-4 border-t-2 border-gray-300 bg-gray-50 font-semibold">
                          <div className="w-[160px] text-sm font-bold">Total</div>
                          <div className="w-[140px] text-sm font-bold">—</div>
                          <div className="text-center text-sm font-bold">${totals.currentMonthSF.toLocaleString()}</div>
                          <div className="text-center text-sm font-bold">${Math.round(totals.currentMonthDashboard).toLocaleString()}</div>
                          <div className="text-center text-sm font-bold">${Math.round(totals.currentMonthForecast).toLocaleString()}</div>
                          <div className="text-center text-sm font-bold">${totals.lastMonthSF.toLocaleString()}</div>
                          <div className="text-center text-sm font-bold">${Math.round(totals.lastMonthDashboard).toLocaleString()}</div>
                        </div>
                      )}
                      {activeTab === 'salesforce-only' && (
                        <div className="grid grid-cols-4 gap-0 py-3 px-4 border-t-2 border-gray-300 bg-gray-50 font-semibold">
                          <div className="w-[160px] text-sm font-bold">Total</div>
                          <div className="w-[300px] text-sm font-bold">—</div>
                          <div className="text-center text-sm font-bold">${totals.currentMonthSF.toLocaleString()}</div>
                          <div className="text-center text-sm font-bold">${totals.lastMonthSF.toLocaleString()}</div>
                        </div>
                      )}
                      {activeTab === 'dashboard-only' && (
                        <div className="grid grid-cols-5 gap-0 py-3 px-4 border-t-2 border-gray-300 bg-gray-50 font-semibold">
                          <div className="w-[160px] text-sm font-bold">Total</div>
                          <div className="w-[220px] text-sm font-bold">—</div>
                          <div className="text-center text-sm font-bold">${Math.round(totals.currentMonthDashboard).toLocaleString()}</div>
                          <div className="text-center text-sm font-bold">${Math.round(totals.currentMonthForecast).toLocaleString()}</div>
                          <div className="text-center text-sm font-bold">${Math.round(totals.lastMonthDashboard).toLocaleString()}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>


      {/* IO Details Modal */}
      <IODetailsModal
        open={ioDetailsModal.open}
        onOpenChange={(open) => setIODetailsModal({ ...ioDetailsModal, open })}
        ioNumber={ioDetailsModal.ioNumber}
        campaignData={campaignData}
        salesforceData={salesforceData}
      />

      {/* Upload Salesforce Data Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Upload Salesforce Data
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowUploadModal(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="p-0">
              <SalesforceFileUpload
                onDataLoaded={(newData) => {
                  handleSalesforceDataLoaded(newData);
                  setShowUploadModal(false);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Mismatch Details Modal */}
      {mismatchDetailsModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  IO Details: {mismatchDetailsModal.ioNumber}
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMismatchDetailsModal({ ...mismatchDetailsModal, open: false })}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {mismatchDetailsModal.type === 'salesforce' ? (
                <div>
                  <h4 className="font-medium text-red-700 mb-4 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    MJAA Filenames from Salesforce
                  </h4>
                  {(() => {
                    const mjaaFilenamesWithRevenue = getMJAAFilenamesWithRevenue(mismatchDetailsModal.ioNumber);
                    const totalRevenue = mjaaFilenamesWithRevenue.reduce((sum, item) => sum + item.revenue, 0);

                    return mjaaFilenamesWithRevenue.length === 0 ? (
                      <p className="text-gray-500 text-sm">No MJAA filenames found for this IO number in current month</p>
                    ) : (
                      <>
                        <div className="space-y-3">
                          {mjaaFilenamesWithRevenue.map((item, index) => (
                            <div
                              key={index}
                              className="p-3 bg-red-50 border border-red-200 rounded-lg flex justify-between items-center"
                            >
                              <p className="font-medium text-sm text-red-900 flex-1 mr-4 truncate">
                                {item.filename}
                              </p>
                              <p className="font-semibold text-sm text-red-700 whitespace-nowrap">
                                ${item.revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </p>
                            </div>
                          ))}
                        </div>
                        {mjaaFilenamesWithRevenue.length > 1 && (
                          <div className="mt-4 pt-3 border-t border-red-200">
                            <div className="flex justify-between items-center p-3 bg-red-100 border border-red-300 rounded-lg">
                              <p className="font-semibold text-sm text-red-800">Total Revenue:</p>
                              <p className="font-bold text-base text-red-700">
                                ${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </p>
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}

                  {/* Salesforce Calculation Breakdown */}
                  <div className="mt-6">
                    <h4 className="font-medium text-blue-700 mb-4 flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Current Month Forecast Calculation
                    </h4>
                    {(() => {
                      const now = new Date();
                      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                      const breakdown = getSalesforceCalculationBreakdown(mismatchDetailsModal.ioNumber, currentMonth);

                      if (breakdown.details.length === 0) {
                        return <p className="text-gray-500 text-sm">No forecast calculation available</p>;
                      }

                      return (
                        <>
                          <div className="space-y-3">
                            {breakdown.details.map((detail, index) => (
                              <div
                                key={index}
                                className="p-3 bg-blue-50 border border-blue-200 rounded-lg"
                              >
                                <div className="flex justify-between items-start">
                                  <div>
                                    <p className="font-medium text-sm text-blue-900">
                                      {detail.type}
                                    </p>
                                    <p className="text-xs text-blue-700 mt-1">
                                      {detail.source}
                                    </p>
                                  </div>
                                  <p className="font-semibold text-sm text-blue-700 whitespace-nowrap">
                                    ${detail.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="mt-4 pt-3 border-t border-blue-200">
                            <div className="flex justify-between items-center p-3 bg-blue-100 border border-blue-300 rounded-lg">
                              <p className="font-semibold text-sm text-blue-800">Total Current Month Forecast:</p>
                              <p className="font-bold text-base text-blue-700">
                                ${breakdown.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </p>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              ) : (
                <div>
                  <h4 className="font-medium text-amber-700 mb-4 flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Campaign Names from Dashboard
                  </h4>
                  {(() => {
                    const campaignsWithForecast = getCampaignNamesWithForecast(mismatchDetailsModal.ioNumber);

                    if (campaignsWithForecast.length === 0) {
                      return <p className="text-gray-500 text-sm">No campaigns found for this IO number</p>;
                    }

                    const totalForecast = campaignsWithForecast.reduce((sum, campaign) => sum + campaign.currentMonthForecast, 0);

                    return (
                      <>
                        <div className="space-y-3">
                          {campaignsWithForecast.map((campaign, index) => (
                            <div
                              key={index}
                              className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex justify-between items-center"
                            >
                              <p className="font-medium text-sm text-amber-900 flex-1 mr-4 truncate">
                                {campaign.name}
                              </p>
                              <p className="font-semibold text-sm text-amber-700 whitespace-nowrap">
                                ${campaign.currentMonthForecast.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </p>
                            </div>
                          ))}
                        </div>
                        {campaignsWithForecast.length > 1 && (
                          <div className="mt-4 pt-3 border-t border-amber-200">
                            <div className="flex justify-between items-center p-3 bg-amber-100 border border-amber-300 rounded-lg">
                              <p className="font-semibold text-sm text-amber-800">Total Current Month Forecast:</p>
                              <p className="font-bold text-base text-amber-700">
                                ${totalForecast.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </p>
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>

            <div className="p-6 border-t bg-gray-50">
              <Button
                onClick={() => setMismatchDetailsModal({ ...mismatchDetailsModal, open: false })}
                className="w-full"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Mismatches by Advertiser Modal */}
      {mismatchesByAdvertiserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                  Mismatches by Advertiser
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMismatchesByAdvertiserModal(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {(() => {
                // Combine salesforce-only and dashboard-only IOs into a single array with platform info
                const mismatchedIOs = [
                  ...comparisonData.salesforceOnlyIOs.map(io => {
                    // Find MJAA filename from Salesforce data for this IO
                    const salesforceRecord = salesforceData.find(row => row.mjaa_number === io.ioNumber);
                    const mjaaFilename = salesforceRecord?.mjaa_filename || 'N/A';

                    return {
                      platform: 'Salesforce' as const,
                      advertiser: io.advertiser || 'N/A',
                      ioNumber: io.ioNumber,
                      currentMonthForecast: io.currentMonthSF,
                      campaign: mjaaFilename
                    };
                  }),
                  ...comparisonData.dashboardOnlyIOs.map(io => {
                    // Find a campaign name for this IO from the campaign data
                    const campaignName = campaignData.find(row => {
                      const rowCampaignName = row["CAMPAIGN ORDER NAME"] || row.campaign_order_name || "";
                      const ioDisplayFormat = getIODisplayFormat(rowCampaignName);
                      return ioDisplayFormat === io.ioNumber;
                    })?.["CAMPAIGN ORDER NAME"] || campaignData.find(row => {
                      const rowCampaignName = row["CAMPAIGN ORDER NAME"] || row.campaign_order_name || "";
                      const ioDisplayFormat = getIODisplayFormat(rowCampaignName);
                      return ioDisplayFormat === io.ioNumber;
                    })?.campaign_order_name || 'N/A';

                    return {
                      platform: 'Dashboard' as const,
                      advertiser: io.advertiser || 'N/A',
                      ioNumber: io.ioNumber,
                      currentMonthForecast: io.currentMonthForecast,
                      campaign: campaignName
                    };
                  })
                ];

                if (mismatchedIOs.length === 0) {
                  return (
                    <div className="text-center py-8 text-gray-500">
                      No mismatched IOs found
                    </div>
                  );
                }

                return (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="text-left py-2 px-3 font-medium text-gray-700" style={{fontSize: '0.6875rem'}}>Platform</th>
                          <th className="text-left py-2 px-3 font-medium text-gray-700" style={{fontSize: '0.6875rem'}}>IO Number</th>
                          <th className="text-left py-2 px-3 font-medium text-gray-700" style={{fontSize: '0.6875rem'}}>Advertiser Name</th>
                          <th className="text-left py-2 px-3 font-medium text-gray-700" style={{fontSize: '0.6875rem'}}>Campaign</th>
                          <th className="text-right py-2 px-3 font-medium text-gray-700" style={{fontSize: '0.6875rem'}}>Current Month Forecast</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mismatchedIOs
                          .sort((a, b) => a.advertiser.localeCompare(b.advertiser) || a.platform.localeCompare(b.platform))
                          .map((io, index) => (
                          <tr key={index} className="border-b last:border-b-0 hover:bg-gray-50">
                            <td className="py-2 px-3">
                              <div className="flex items-center gap-1.5">
                                <div className={`w-1.5 h-1.5 rounded-full ${
                                  io.platform === 'Salesforce' ? 'bg-green-500' : 'bg-blue-500'
                                }`}></div>
                                <span className="font-medium" style={{fontSize: '0.6875rem'}}>{io.platform}</span>
                              </div>
                            </td>
                            <td className="py-2 px-3" style={{fontSize: '0.6875rem'}}>{io.ioNumber}</td>
                            <td className="py-2 px-3" style={{fontSize: '0.6875rem'}}>{io.advertiser}</td>
                            <td className="py-2 px-3" style={{fontSize: '0.6875rem'}}>
                              {io.campaign}
                            </td>
                            <td className="py-2 px-3 text-right font-semibold" style={{fontSize: '0.6875rem'}}>
                              ${io.currentMonthForecast.toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                              })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>

            <div className="p-6 border-t bg-gray-50">
              <Button
                onClick={() => setMismatchesByAdvertiserModal(false)}
                className="w-full"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const SalesforceComparison = () => {
  return (
    <CampaignFilterProvider>
      <SalesforceComparisonContent />
    </CampaignFilterProvider>
  );
};

export default SalesforceComparison;