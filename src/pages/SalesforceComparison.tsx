import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Upload, AlertTriangle, Loader2, X, ChevronUp, ChevronDown, FileText, Target } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import SalesforceFileUpload from "@/components/SalesforceFileUpload";
import { loadAllCampaignData } from "@/utils/dataStorage";
import { loadAllSalesforceData, groupSalesforceByMonthAndIO } from "@/utils/salesforceDataStorage";
import { getIOForecastsForDateRange } from "@/utils/ioForecastAggregation";
import { findMismatchedIOs, extractAllIONumbers, extractIONumber, findIOMatches, extractIONumbers, getIODisplayFormat } from "@/utils/ioNumberExtraction";
import IODetailsModal from "@/components/IODetailsModal";
import { CampaignFilterProvider, useCampaignFilter } from "@/contexts/CampaignFilterContext";

const SalesforceComparisonContent = () => {
  const navigate = useNavigate();
  const { extractAdvertiserName } = useCampaignFilter();
  const [salesforceData, setSalesforceData] = useState<any[]>([]);
  const [campaignData, setCampaignData] = useState<any[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [showMismatchModal, setShowMismatchModal] = useState(false);
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
      return { matchedIOs: [], mismatches: { onlyInSalesforce: [], onlyInDashboard: [], matched: [] } };
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

    // Group Salesforce data by month and IO
    const salesforceGrouped = groupSalesforceByMonthAndIO(salesforceData);

    // Get current month and last month keys
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const lastMonth = now.getMonth() === 0
      ? `${now.getFullYear() - 1}-12`
      : `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`;

    // Build matched IOs comparison data
    const matchedIOs = ioMatches.matches.map(match => {
      const forecast = ioForecastMap.get(match.displayFormat);

      // Calculate total Salesforce amounts for all matched IOs
      const currentMonthSF = match.matchedSalesforceIOs.reduce((sum, ioNumber) =>
        sum + (salesforceGrouped[currentMonth]?.[ioNumber] || 0), 0);
      const lastMonthSF = match.matchedSalesforceIOs.reduce((sum, ioNumber) =>
        sum + (salesforceGrouped[lastMonth]?.[ioNumber] || 0), 0);

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

    // Filter out dashboard IOs with zero spend/forecast
    const filteredDashboardIOs = ioMatches.unmatchedDashboard.filter(io => {
      const forecast = ioForecastMap.get(io); // Using legacy ioNumber field for individual IOs
      const hasSpend = (forecast?.mtdSpend || 0) > 0;
      const hasForecast = (forecast?.forecastSpend || 0) > 0;
      return hasSpend || hasForecast;
    });

    console.log(`📊 Filtered Dashboard IOs: ${ioMatches.unmatchedDashboard.length} -> ${filteredDashboardIOs.length} (removed ${ioMatches.unmatchedDashboard.length - filteredDashboardIOs.length} zero-value IOs)`);

    // Create legacy mismatch format for compatibility
    const mismatches = {
      onlyInSalesforce: ioMatches.unmatchedSalesforce,
      onlyInDashboard: filteredDashboardIOs,
      matched: ioMatches.matches.map(m => m.displayFormat)
    };

    return { matchedIOs, mismatches };
  }, [salesforceData, campaignData, extractAdvertiserName]);

  // Calculate totals for mismatched IOs
  const mismatchTotals = useMemo(() => {
    if (salesforceData.length === 0 || campaignData.length === 0) {
      return {
        salesforceOnly: { currentMonthForecast: 0, lastMonthForecast: 0 },
        dashboardOnly: { currentMonthForecast: 0, lastMonthSpend: 0 }
      };
    }

    // Group Salesforce data by month and IO for calculations
    const salesforceGrouped = groupSalesforceByMonthAndIO(salesforceData);
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const lastMonth = now.getMonth() === 0
      ? `${now.getFullYear() - 1}-12`
      : `${now.getFullYear()}-${String(now.getMonth()).padStart(2, '0')}`;

    // Calculate Salesforce-only totals (current month forecast + last month forecast)
    const salesforceOnly = {
      currentMonthForecast: comparisonData.mismatches.onlyInSalesforce.reduce((sum, io) =>
        sum + (salesforceGrouped[currentMonth]?.[io] || 0), 0),
      lastMonthForecast: comparisonData.mismatches.onlyInSalesforce.reduce((sum, io) =>
        sum + (salesforceGrouped[lastMonth]?.[io] || 0), 0)
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

  // Sort the matched IOs based on current sort configuration
  const sortedMatchedIOs = useMemo(() => {
    if (!sortConfig.key) return comparisonData.matchedIOs;

    return [...comparisonData.matchedIOs].sort((a, b) => {
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
  }, [comparisonData.matchedIOs, sortConfig]);

  // Calculate totals for all columns
  const totals = useMemo(() => {
    return comparisonData.matchedIOs.reduce((acc, io) => ({
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

  // Get MJAA filenames for a specific IO number
  const getMJAAFilenames = (ioNumber: string) => {
    try {
      return [...new Set(
        salesforceData
          .filter(row => row.mjaa_number === ioNumber)
          .map(row => row.mjaa_filename)
          .filter(filename => filename)
          .flatMap(filename => filename?.split(', ') || [])
      )];
    } catch (error) {
      console.error('Error getting MJAA filenames:', error);
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

      // Get IO forecasts to calculate individual campaign forecasts
      const ioForecasts = getIOForecastsForDateRange(campaignData, undefined);
      const ioForecastMap = new Map(ioForecasts.map(io => [io.ioNumber, io]));

      // For each unique campaign, calculate its forecast portion
      const campaignsWithForecast = Array.from(uniqueCampaigns).map(campaignName => {
        // Find the IO forecast that matches this campaign's IO pattern
        const campaignIOPattern = extractIONumber(campaignName) || extractIONumbers(campaignName)[0];
        const forecast = ioForecastMap.get(campaignIOPattern);

        return {
          name: campaignName,
          currentMonthForecast: forecast?.forecastSpend || 0
        };
      });

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
      <div className="mt-6 space-y-6">

        {/* Comparison Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Revenue Comparison - Matched IOs</CardTitle>
              <div className="flex items-center gap-2">
                {comparisonData.matchedIOs.length > 0 && (
                  <span className="text-sm text-gray-600">
                    {comparisonData.matchedIOs.length} matches
                  </span>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowMismatchModal(true)}
                  className="flex items-center gap-2"
                  disabled={comparisonData.mismatches.onlyInSalesforce.length === 0 && comparisonData.mismatches.onlyInDashboard.length === 0}
                >
                  <AlertTriangle className="h-4 w-4" />
                  View Mismatched IOs ({comparisonData.mismatches.onlyInSalesforce.length + comparisonData.mismatches.onlyInDashboard.length})
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
            ) : comparisonData.matchedIOs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No matching IO numbers found between Salesforce and campaign data
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[160px]">
                        <button
                          onClick={() => handleSort('ioNumber')}
                          className="text-left flex items-end justify-start h-full w-full hover:bg-gray-50 py-2 px-1 rounded transition-colors"
                        >
                          <div className="flex items-center gap-1 whitespace-nowrap text-sm">
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
                          </div>
                        </button>
                      </TableHead>
                      <TableHead className="w-[140px]">
                        <button
                          onClick={() => handleSort('advertiser')}
                          className="text-left flex items-end h-full w-full hover:bg-gray-50 py-2 px-1 rounded transition-colors"
                        >
                          <div className="flex items-center gap-1 text-sm">
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
                          </div>
                        </button>
                      </TableHead>
                      <TableHead className="text-center">
                        <div className="text-center text-sm">
                          <div>Current Month</div>
                          <div>Salesforce Forecast</div>
                        </div>
                      </TableHead>
                      <TableHead className="text-center">
                        <div className="text-center text-sm">
                          <div>Current Month</div>
                          <div>Dashboard Spend</div>
                        </div>
                      </TableHead>
                      <TableHead className="text-center">
                        <div className="text-center text-sm">
                          <div>Current Month</div>
                          <div>Dashboard Forecast</div>
                        </div>
                      </TableHead>
                      <TableHead className="text-center">
                        <div className="text-center text-sm">
                          <div>Last Month</div>
                          <div>Salesforce Forecast</div>
                        </div>
                      </TableHead>
                      <TableHead className="text-center">
                        <div className="text-center text-sm">
                          <div>Last Month</div>
                          <div>Dashboard Spend</div>
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedMatchedIOs.map((io) => (
                      <TableRow key={io.ioNumber}>
                        <TableCell className="font-medium text-left text-sm">
                          <button
                            onClick={() => handleIOClick(io.ioNumber)}
                            className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                          >
                            {io.ioNumber}
                          </button>
                        </TableCell>
                        <TableCell className="text-left text-sm">
                          <div className="max-w-[140px] truncate" title={io.advertiser}>
                            {io.advertiser || "—"}
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-sm">${io.currentMonthSF.toLocaleString()}</TableCell>
                        <TableCell className="text-center text-sm">${Math.round(io.currentMonthDashboard).toLocaleString()}</TableCell>
                        <TableCell className="text-center text-sm">${Math.round(io.currentMonthForecast).toLocaleString()}</TableCell>
                        <TableCell className="text-center text-sm">${io.lastMonthSF.toLocaleString()}</TableCell>
                        <TableCell className="text-center text-sm">${Math.round(io.lastMonthDashboard).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    {comparisonData.matchedIOs.length > 0 && (
                      <TableRow className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                        <TableCell className="text-left font-bold text-sm">Total</TableCell>
                        <TableCell className="text-left font-bold text-sm">—</TableCell>
                        <TableCell className="text-center font-bold text-sm">${totals.currentMonthSF.toLocaleString()}</TableCell>
                        <TableCell className="text-center font-bold text-sm">${Math.round(totals.currentMonthDashboard).toLocaleString()}</TableCell>
                        <TableCell className="text-center font-bold text-sm">${Math.round(totals.currentMonthForecast).toLocaleString()}</TableCell>
                        <TableCell className="text-center font-bold text-sm">${totals.lastMonthSF.toLocaleString()}</TableCell>
                        <TableCell className="text-center font-bold text-sm">${Math.round(totals.lastMonthDashboard).toLocaleString()}</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Mismatched IOs Modal */}
      {showMismatchModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Mismatched IOs</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowMismatchModal(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6">
              {/* IOs Only in Salesforce */}
              {comparisonData.mismatches.onlyInSalesforce.length > 0 && (
                <div>
                  <h4 className="font-medium text-red-700 mb-3">
                    IOs in Salesforce but not in Dashboard ({comparisonData.mismatches.onlyInSalesforce.length})
                  </h4>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="grid grid-cols-4 gap-2 text-sm mb-4">
                      {comparisonData.mismatches.onlyInSalesforce.map(io => (
                        <button
                          key={io}
                          onClick={() => handleMismatchIOClick(io, 'salesforce')}
                          className="font-medium text-sm text-red-800 hover:text-red-900 hover:underline cursor-pointer text-left"
                        >
                          {io}
                        </button>
                      ))}
                    </div>
                    <div className="border-t border-red-300 pt-3 mt-3">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium text-red-700">Current Month Forecast:</span>
                          <span className="ml-2 font-bold text-red-800">
                            ${mismatchTotals.salesforceOnly.currentMonthForecast.toLocaleString()}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium text-red-700">Last Month Forecast:</span>
                          <span className="ml-2 font-bold text-red-800">
                            ${mismatchTotals.salesforceOnly.lastMonthForecast.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    These IO numbers exist in your Salesforce data but have no matching campaigns in the dashboard data. Click any IO number for MJAA filenames.
                  </p>
                </div>
              )}

              {/* IOs Only in Dashboard */}
              {comparisonData.mismatches.onlyInDashboard.length > 0 && (
                <div>
                  <h4 className="font-medium text-amber-700 mb-3">
                    IOs in Dashboard but not in Salesforce ({comparisonData.mismatches.onlyInDashboard.length})
                  </h4>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="grid grid-cols-4 gap-2 text-sm mb-4">
                      {comparisonData.mismatches.onlyInDashboard.map(io => (
                        <button
                          key={io}
                          onClick={() => handleMismatchIOClick(io, 'dashboard')}
                          className="font-medium text-sm text-amber-800 hover:text-amber-900 hover:underline cursor-pointer text-left"
                        >
                          {io}
                        </button>
                      ))}
                    </div>
                    <div className="border-t border-amber-300 pt-3 mt-3">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium text-amber-700">Current Month Forecast:</span>
                          <span className="ml-2 font-bold text-amber-800">
                            ${Math.round(mismatchTotals.dashboardOnly.currentMonthForecast).toLocaleString()}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium text-amber-700">Last Month Spend:</span>
                          <span className="ml-2 font-bold text-amber-800">
                            ${Math.round(mismatchTotals.dashboardOnly.lastMonthSpend).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    These IO numbers exist in your dashboard campaign data but have no corresponding Salesforce records. Click any IO number for campaign names.
                  </p>
                </div>
              )}

              {/* Summary */}
              <div className="pt-4 border-t">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-black">{comparisonData.mismatches.matched.length}</div>
                    <div className="text-sm text-gray-600">Total IOs</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-black">{comparisonData.mismatches.onlyInSalesforce.length}</div>
                    <div className="text-sm text-gray-600">Only in SF</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-black">{comparisonData.mismatches.onlyInDashboard.length}</div>
                    <div className="text-sm text-gray-600">Only in Dashboard</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t bg-gray-50">
              <Button onClick={() => setShowMismatchModal(false)} className="w-full">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

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
                    const mjaaFilenames = getMJAAFilenames(mismatchDetailsModal.ioNumber);

                    return mjaaFilenames.length === 0 ? (
                      <p className="text-gray-500 text-sm">No MJAA filenames found for this IO number</p>
                    ) : (
                      <div className="space-y-3">
                        {mjaaFilenames.map((filename, index) => (
                          <div
                            key={index}
                            className="p-4 bg-red-50 border border-red-200 rounded-lg"
                          >
                            <p className="font-mono text-sm text-red-900">
                              {filename}
                            </p>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
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
                      <div className="space-y-3">
                        {campaignsWithForecast.map((campaign, index) => (
                          <div
                            key={index}
                            className="p-4 bg-amber-50 border border-amber-200 rounded-lg"
                          >
                            <div className="flex justify-between items-start">
                              <p className="font-mono text-sm text-amber-900 flex-1 mr-4">
                                {campaign.name}
                              </p>
                              <div className="text-right">
                                <span className="text-xs text-amber-700 block">Current Month Forecast</span>
                                <span className="font-bold text-amber-800">
                                  ${Math.round(campaign.currentMonthForecast).toLocaleString()}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}

                        {/* Total Row */}
                        <div className="p-4 bg-amber-100 border-2 border-amber-300 rounded-lg">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-amber-900">
                              Total ({campaignsWithForecast.length} campaigns)
                            </span>
                            <div className="text-right">
                              <span className="text-xs text-amber-700 block">Total Current Month Forecast</span>
                              <span className="font-bold text-lg text-amber-800">
                                ${Math.round(totalForecast).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
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