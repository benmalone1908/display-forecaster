import { useMemo, useState, useEffect } from "react";
import { 
  ResponsiveContainer,
  Tooltip,
  Area,
  AreaChart
} from "recharts";
import {
  Card,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Eye, MousePointer, ShoppingCart, DollarSign, ChevronRight, Percent, TrendingUp, FilterIcon, Maximize, Building } from "lucide-react";
import { formatNumber, setToEndOfDay, setToStartOfDay, parseDateString } from "@/lib/utils";
import { DateRange } from "react-day-picker";
import { MultiSelect } from "./MultiSelect";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import SparkChartModal from "./SparkChartModal";
import { useCampaignFilter, AGENCY_MAPPING } from "@/contexts/CampaignFilterContext";

interface CampaignSparkChartsProps {
  data: any[];
  dateRange?: DateRange;
  useGlobalFilters?: boolean;
}

type ViewMode = "campaign" | "advertiser";

type MetricType = 
  | "impressions" 
  | "clicks" 
  | "ctr" 
  | "transactions" 
  | "revenue" 
  | "roas";

interface ModalData {
  isOpen: boolean;
  itemName: string;
  metricType: MetricType;
  data: any[];
}

// Helper function to generate all dates in a range
const generateDateRange = (startDate: Date, endDate: Date): Date[] => {
  const dates: Date[] = [];
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    dates.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return dates;
};

// FIXED: Helper function to fill missing dates with zero values to show trend line going to zero
// Creates a continuous line that drops to zero during gaps and runs along x-axis
const fillMissingDates = (timeSeriesData: any[], allDates: Date[]): any[] => {
  const dateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
  const dataByDate = new Map();
  
  // Create a map of existing data by date string (using consistent format)
  timeSeriesData.forEach(item => {
    if (item.rawDate) {
      // Use a consistent date key format
      const year = item.rawDate.getFullYear();
      const month = String(item.rawDate.getMonth() + 1).padStart(2, '0');
      const day = String(item.rawDate.getDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${day}`;
      dataByDate.set(dateKey, item);
    }
  });
  
  
  // Find the first and last dates with actual data
  const actualDataDates = timeSeriesData
    .map(item => item.rawDate)
    .filter(Boolean)
    .sort((a, b) => a.getTime() - b.getTime());
  
  if (actualDataDates.length === 0) {
    return [];
  }
  
  const firstDataDate = actualDataDates[0];
  const lastDataDate = actualDataDates[actualDataDates.length - 1];
  
  console.log(`FIXED: Campaign data range: ${firstDataDate.toISOString()} to ${lastDataDate.toISOString()}`);
  
  // Generate complete time series, filling gaps with zero values between first and last data points
  const result = allDates
    .filter(date => date >= firstDataDate && date <= lastDataDate) // Only include dates within campaign range
    .map(date => {
      // Use the same consistent date key format
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${day}`;
      
      const existingData = dataByDate.get(dateKey);
      
      if (existingData) {
        return existingData;
      } else {
        // Return zero values for missing dates to create trend line that goes to zero
        // CTR and ROAS should be null for days with no data to avoid showing 0% or 0x in charts
        return {
          date: dateFormat.format(date),
          rawDate: date,
          impressions: 0,
          clicks: 0,
          transactions: 0,
          revenue: 0,
          spend: 0,
          ctr: null,
          roas: null
        };
      }
    });
  
  return result;
};

const CampaignSparkCharts = ({ data, dateRange, useGlobalFilters = false }: CampaignSparkChartsProps) => {
  const [selectedAgencies, setSelectedAgencies] = useState<string[]>([]);
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]);
  const [selectedAdvertisers, setSelectedAdvertisers] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("campaign");
  const [modalData, setModalData] = useState<ModalData>({
    isOpen: false,
    itemName: "",
    metricType: "impressions",
    data: []
  });
  
  // Get filter functions from context
  const { extractAdvertiserName, extractAgencyInfo, isTestCampaign } = useCampaignFilter();

  const agencyOptions = useMemo(() => {
    const agencies = new Set<string>();
    
    // Extract agencies from campaign names
    data.forEach(row => {
      const campaignName = row["CAMPAIGN ORDER NAME"] || "";
      
      // Skip test/demo/draft campaigns
      if (isTestCampaign(campaignName)) {
        return;
      }
      
      const { agency } = extractAgencyInfo(campaignName);
      if (agency) {
        agencies.add(agency);
      }
    });
    
    console.log('Agencies found:', Array.from(agencies).sort());
    
    return Array.from(agencies)
      .sort((a, b) => a.localeCompare(b))
      .map(agency => ({
        value: agency,
        label: agency
      }));
  }, [data, extractAgencyInfo, isTestCampaign]);

  const advertiserOptions = useMemo(() => {
    const advertisers = new Set<string>();
    
    // Filter by selected agencies if any
    let filteredData = data;
    if (selectedAgencies.length > 0) {
      filteredData = data.filter(row => {
        const campaignName = row["CAMPAIGN ORDER NAME"] || "";
        const { agency } = extractAgencyInfo(campaignName);
        return selectedAgencies.includes(agency);
      });
    }
    
    // Add debug logging
    console.log('-------- Extracting advertisers in CampaignSparkCharts --------');
    console.log('Total data rows:', filteredData.length);
    
    // Skip test campaigns and extract advertisers from valid campaigns
    filteredData.forEach(row => {
      const campaignName = row["CAMPAIGN ORDER NAME"] || "";
      
      // Skip test/demo/draft campaigns
      if (isTestCampaign(campaignName)) {
        return;
      }
      
      const advertiser = extractAdvertiserName(campaignName);
      if (advertiser) {
        advertisers.add(advertiser);
      }
    });
    
    console.log('Final unique advertisers found:', advertisers.size);
    console.log('Advertiser list:', Array.from(advertisers).sort());
    
    return Array.from(advertisers)
      .sort((a, b) => a.localeCompare(b))
      .map(advertiser => ({
        value: advertiser,
        label: advertiser,
        group: 'Advertisers'
      }));
  }, [data, selectedAgencies, extractAdvertiserName, extractAgencyInfo, isTestCampaign]);

  const campaignOptions = useMemo(() => {
    let filteredData = data;
    
    // First filter out test campaigns
    filteredData = filteredData.filter(row => {
      const campaignName = row["CAMPAIGN ORDER NAME"] || "";
      return !isTestCampaign(campaignName);
    });
    
    // Filter by selected agencies if any
    if (selectedAgencies.length > 0) {
      filteredData = filteredData.filter(row => {
        const campaignName = row["CAMPAIGN ORDER NAME"] || "";
        const { agency } = extractAgencyInfo(campaignName);
        return selectedAgencies.includes(agency);
      });
    }
    
    // Filter by selected advertisers if any
    if (selectedAdvertisers.length > 0) {
      filteredData = filteredData.filter(row => {
        const campaignName = row["CAMPAIGN ORDER NAME"] || "";
        const advertiser = extractAdvertiserName(campaignName);
        return selectedAdvertisers.includes(advertiser);
      });
    }
    
    const uniqueCampaigns = Array.from(new Set(filteredData.map(row => row["CAMPAIGN ORDER NAME"])));
    return uniqueCampaigns
      .sort((a, b) => a.localeCompare(b))
      .map(campaign => ({
        value: campaign,
        label: campaign,
        group: 'Campaigns'
      }));
  }, [data, selectedAgencies, selectedAdvertisers, extractAdvertiserName, extractAgencyInfo, isTestCampaign]);

  // Reset filters when dependencies change
  useEffect(() => {
    // Reset campaign selection when agencies change
    if (selectedAgencies.length > 0) {
      setSelectedCampaigns(prev => {
        return prev.filter(campaign => {
          const campaignRows = data.filter(row => row["CAMPAIGN ORDER NAME"] === campaign);
          if (campaignRows.length === 0) return false;
          
          const campaignName = campaignRows[0]["CAMPAIGN ORDER NAME"] || "";
          const { agency } = extractAgencyInfo(campaignName);
          return selectedAgencies.includes(agency);
        });
      });
      
      // Reset advertiser selection when agencies change
      setSelectedAdvertisers(prev => {
        return prev.filter(advertiser => {
          // Check if there are any campaigns for this advertiser in the selected agencies
          return data.some(row => {
            const campaignName = row["CAMPAIGN ORDER NAME"] || "";
            const rowAdvertiser = extractAdvertiserName(campaignName);
            const { agency } = extractAgencyInfo(campaignName);
            return rowAdvertiser === advertiser && selectedAgencies.includes(agency);
          });
        });
      });
    }
    
    // Reset campaign selection when advertisers change
    if (selectedAdvertisers.length > 0) {
      setSelectedCampaigns(prev => {
        return prev.filter(campaign => {
          const campaignRows = data.filter(row => row["CAMPAIGN ORDER NAME"] === campaign);
          if (campaignRows.length === 0) return false;
          
          const campaignName = campaignRows[0]["CAMPAIGN ORDER NAME"] || "";
          const advertiser = extractAdvertiserName(campaignName);
          return selectedAdvertisers.includes(advertiser);
        });
      });
    }
  }, [selectedAgencies, selectedAdvertisers, data, extractAdvertiserName, extractAgencyInfo]);

  const filteredDataByDate = useMemo(() => {
    if (!data || data.length === 0) {
      console.log('No data provided to CampaignSparkCharts');
      return [];
    }
    
    console.log(`CampaignSparkCharts filtering ${data.length} rows with dateRange:`, dateRange);
    
    if (!dateRange?.from) {
      return data;
    }
    
    const fromDate = setToStartOfDay(dateRange.from);
    const toDate = dateRange.to ? setToEndOfDay(dateRange.to) : setToEndOfDay(new Date());
    
    console.log(`Filtering between ${fromDate.toISOString()} and ${toDate.toISOString()}`);
    
    return data.filter(row => {
      if (!row.DATE || row.DATE === 'Totals') {
        return true;
      }
      
      try {
        const dateStr = String(row.DATE).trim();
        const rowDate = parseDateString(dateStr);
        
        if (!rowDate) {
          console.warn(`Could not parse date in CampaignSparkCharts filtering: ${dateStr}`);
          return false;
        }
        
        const isInRange = rowDate >= fromDate && rowDate <= toDate;
        if (dateStr.includes('4/9/') || dateStr.includes('4/8/')) {
          console.log(`Date comparison for ${dateStr}: rowDate=${rowDate.toISOString()}, fromDate=${fromDate.toISOString()}, toDate=${toDate.toISOString()}, isInRange=${isInRange}`);
        }
        
        return isInRange;
      } catch (error) {
        console.error(`Error in date filtering for row ${JSON.stringify(row)}:`, error);
        return false;
      }
    });
  }, [data, dateRange]);

  const filteredData = useMemo(() => {
    // If using global filters, we don't need to filter here as data is already filtered
    if (useGlobalFilters) {
      return filteredDataByDate.filter(row => {
        const campaignName = row["CAMPAIGN ORDER NAME"] || "";
        return !isTestCampaign(campaignName);
      });
    }
    
    let result = filteredDataByDate;
    console.log('CampaignSparkCharts received data length:', data.length);
    console.log('CampaignSparkCharts filtered by date length:', filteredDataByDate.length);
    
    // First filter out test campaigns
    result = result.filter(row => {
      const campaignName = row["CAMPAIGN ORDER NAME"] || "";
      return !isTestCampaign(campaignName);
    });
    
    // Filter by selected agencies if any
    if (selectedAgencies.length > 0) {
      result = result.filter(row => {
        const campaignName = row["CAMPAIGN ORDER NAME"] || "";
        const { agency } = extractAgencyInfo(campaignName);
        return selectedAgencies.includes(agency);
      });
    }
    
    // Filter by selected advertisers if any
    if (selectedAdvertisers.length > 0) {
      result = result.filter(row => {
        const campaignName = row["CAMPAIGN ORDER NAME"] || "";
        const advertiser = extractAdvertiserName(campaignName);
        return selectedAdvertisers.includes(advertiser);
      });
    }
    
    // Filter by selected campaigns if any
    if (selectedCampaigns.length > 0) {
      result = result.filter(row => selectedCampaigns.includes(row["CAMPAIGN ORDER NAME"]));
    }
    
    console.log('CampaignSparkCharts final filtered data length:', result.length);
    return result;
  }, [filteredDataByDate, selectedAgencies, selectedAdvertisers, selectedCampaigns, isTestCampaign, extractAdvertiserName, extractAgencyInfo, useGlobalFilters]);

  const getAdvertiserFromCampaign = (campaignName: string): string => {
    // Updated regex to correctly capture advertiser names before hyphens
    const match = campaignName.match(/SM:\s+(.*?)(?=-)/);
    return match ? match[1].trim() : "";
  };

  const chartData = useMemo(() => {
    if (!filteredData || filteredData.length === 0) {
      console.log('No filtered data available for chart data generation');
      return [];
    }

    console.log(`Generating chart data from ${filteredData.length} rows`);
    
    // FIXED: Calculate the date range for filling missing dates
    // Always use the dateRange filter if available to ensure gaps are filled
    let completeDateRange: Date[] = [];
    
    if (dateRange?.from) {
      const fromDate = setToStartOfDay(dateRange.from);
      const toDate = dateRange.to ? setToEndOfDay(dateRange.to) : setToEndOfDay(new Date());
      completeDateRange = generateDateRange(fromDate, toDate);
      console.log(`FIXED: Using dateRange filter for completeDateRange: ${fromDate.toISOString()} to ${toDate.toISOString()} (${completeDateRange.length} days)`);
    } else {
      // Fallback: use the full data range from ALL campaigns, not just filtered data
      const allValidDates = data
        .filter(row => row.DATE !== 'Totals' && !isTestCampaign(row["CAMPAIGN ORDER NAME"] || ""))
        .map(row => parseDateString(row.DATE))
        .filter(Boolean)
        .sort((a, b) => a.getTime() - b.getTime());
      
      if (allValidDates.length === 0) {
        console.log('No valid dates found in data');
        return [];
      }
      
      const startDate = allValidDates[0];
      const endDate = allValidDates[allValidDates.length - 1];
      completeDateRange = generateDateRange(startDate, endDate);
      console.log(`FIXED: Using full data range for completeDateRange: ${startDate.toISOString()} to ${endDate.toISOString()} (${completeDateRange.length} days)`);
    }
    
    if (viewMode === "campaign") {
      const campaigns = Array.from(new Set(filteredData
        .filter(row => row.DATE !== 'Totals')
        .map(row => row["CAMPAIGN ORDER NAME"])))
        .sort();
      
      console.log(`Found ${campaigns.length} unique campaigns for charts`);
      
      return campaigns.map(campaign => {
        // Use ALL data for this campaign, not just the date-filtered data
        // This allows us to detect gaps properly
        const allCampaignRows = data.filter(row => 
          row["CAMPAIGN ORDER NAME"] === campaign && 
          row.DATE !== 'Totals' &&
          !isTestCampaign(row["CAMPAIGN ORDER NAME"] || "")
        );
        
        if (allCampaignRows.length === 0) {
          return null;
        }
        
        allCampaignRows.sort((a, b) => {
          try {
            const dateA = parseDateString(a.DATE);
            const dateB = parseDateString(b.DATE);
            
            if (!dateA || !dateB) return 0;
            return dateA.getTime() - dateB.getTime();
          } catch (error) {
            console.error(`Error sorting dates: ${a.DATE} vs ${b.DATE}`, error);
            return 0;
          }
        });
        
        const dateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
        
        const rawTimeSeriesData = allCampaignRows.map(row => {
          try {
            const parsedDate = parseDateString(row.DATE);
            if (!parsedDate) {
              console.warn(`Invalid date while creating time series: ${row.DATE}`);
              return null;
            }
            
            const impressions = Number(row.IMPRESSIONS) || 0;
            const clicks = Number(row.CLICKS) || 0;
            const transactions = Number(row.TRANSACTIONS) || 0;
            const revenue = Number(row.REVENUE) || 0;
            const spend = Number(row.SPEND) || 0;
            const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
            const roas = spend > 0 ? revenue / spend : 0;
            
            return {
              date: dateFormat.format(parsedDate),
              rawDate: parsedDate,
              impressions,
              clicks,
              transactions,
              revenue,
              spend,
              ctr,
              roas
            };
          } catch (error) {
            console.error(`Error processing row for time series: ${row.DATE}`, error);
            return null;
          }
        }).filter(Boolean);

        if (rawTimeSeriesData.length === 0) {
          return null;
        }

        // FIXED: Fill missing dates with zero values to show trend line going to zero
        // This ensures gaps are properly filled with zero values
        console.log(`FIXED: Filling missing dates for ${campaign} with ${completeDateRange.length} total dates`);
        console.log(`FIXED: ${campaign} has ${rawTimeSeriesData.length} actual data points`);
        
        const fullTimeSeriesData = fillMissingDates(rawTimeSeriesData, completeDateRange);
        
        // Now filter to only show the selected date range if one is specified
        const timeSeriesData = dateRange?.from ? 
          fullTimeSeriesData.filter(item => {
            const fromDate = setToStartOfDay(dateRange.from!);
            const toDate = dateRange.to ? setToEndOfDay(dateRange.to) : setToEndOfDay(new Date());
            return item.rawDate >= fromDate && item.rawDate <= toDate;
          }) : fullTimeSeriesData;

        console.log(`FIXED: ${campaign} final timeSeriesData length: ${timeSeriesData.length}`);
        console.log(`FIXED: ${campaign} zero-value entries: ${timeSeriesData.filter(item => item.impressions === 0).length}`);
        
        // Calculate totals only from the visible time series data
        const totals = {
          impressions: timeSeriesData.reduce((sum, row) => sum + row.impressions, 0),
          clicks: timeSeriesData.reduce((sum, row) => sum + row.clicks, 0),
          transactions: timeSeriesData.reduce((sum, row) => sum + row.transactions, 0),
          revenue: timeSeriesData.reduce((sum, row) => sum + row.revenue, 0),
          spend: timeSeriesData.reduce((sum, row) => sum + row.spend, 0),
        };
        
        const avgCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
        const avgRoas = totals.spend > 0 ? totals.revenue / totals.spend : 0;

        return {
          name: campaign,
          timeSeriesData,
          totals,
          avgCtr,
          avgRoas
        };
      }).filter(Boolean);
    } else {
      const advertisersMap = new Map<string, any[]>();
      
      filteredData.forEach(row => {
        if (row.DATE === 'Totals') return;
        
        const campaignName = row["CAMPAIGN ORDER NAME"] || "";
        const advertiser = extractAdvertiserName(campaignName);
        if (!advertiser) return;
        
        if (!advertisersMap.has(advertiser)) {
          advertisersMap.set(advertiser, []);
        }
        advertisersMap.get(advertiser)?.push(row);
      });
      
      const advertisers = Array.from(advertisersMap.keys()).sort((a, b) => a.localeCompare(b));
      
      return advertisers.map(advertiser => {
        const advertiserRows = advertisersMap.get(advertiser) || [];
        
        const dateGroups = new Map<string, any[]>();
        advertiserRows.forEach(row => {
          try {
            const parsedDate = parseDateString(row.DATE);
            if (!parsedDate) {
              console.warn(`Invalid date in advertiser aggregation: ${row.DATE}`);
              return;
            }
            
            const dateString = parsedDate.toISOString().split('T')[0];
            
            if (!dateGroups.has(dateString)) {
              dateGroups.set(dateString, []);
            }
            dateGroups.get(dateString)?.push(row);
          } catch (error) {
            console.error(`Error processing advertiser row by date: ${row.DATE}`, error);
          }
        });
        
        const dateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
        const dates = Array.from(dateGroups.keys()).sort();
        
        const rawTimeSeriesData = dates.map(dateString => {
          try {
            const dateRows = dateGroups.get(dateString) || [];
            const date = new Date(`${dateString}T12:00:00Z`);
            
            const impressions = dateRows.reduce((sum, row) => sum + (Number(row.IMPRESSIONS) || 0), 0);
            const clicks = dateRows.reduce((sum, row) => sum + (Number(row.CLICKS) || 0), 0);
            const transactions = dateRows.reduce((sum, row) => sum + (Number(row.TRANSACTIONS) || 0), 0);
            const revenue = dateRows.reduce((sum, row) => sum + (Number(row.REVENUE) || 0), 0);
            const spend = dateRows.reduce((sum, row) => sum + (Number(row.SPEND) || 0), 0);
            const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
            const roas = spend > 0 ? revenue / spend : 0;
            
            return {
              date: dateFormat.format(date),
              rawDate: date,
              impressions,
              clicks,
              transactions,
              revenue,
              spend,
              ctr,
              roas
            };
          } catch (error) {
            console.error(`Error creating time series for date ${dateString}`, error);
            return null;
          }
        }).filter(Boolean);
        
        if (rawTimeSeriesData.length === 0) {
          return null;
        }
        
        // Fill missing dates with zero values for advertiser view too
        const timeSeriesData = fillMissingDates(rawTimeSeriesData, completeDateRange);
        
        const totals = {
          impressions: rawTimeSeriesData.reduce((sum, row) => sum + row.impressions, 0),
          clicks: rawTimeSeriesData.reduce((sum, row) => sum + row.clicks, 0),
          transactions: rawTimeSeriesData.reduce((sum, row) => sum + row.transactions, 0),
          revenue: rawTimeSeriesData.reduce((sum, row) => sum + row.revenue, 0),
          spend: rawTimeSeriesData.reduce((sum, row) => sum + row.spend, 0),
        };
        
        const avgCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
        const avgRoas = totals.spend > 0 ? totals.revenue / totals.spend : 0;
        
        return {
          name: advertiser,
          timeSeriesData,
          totals,
          avgCtr,
          avgRoas
        };
      }).filter(Boolean);
    }
  }, [filteredData, viewMode, extractAdvertiserName, dateRange, data, isTestCampaign]);

  useEffect(() => {
    console.log(`CampaignSparkCharts generated ${chartData.length} chart items`);
    if (chartData.length === 0) {
      console.log('No chart data available. Check date filtering and campaign selection.');
    }
  }, [chartData]);

  const getSafeId = (name: string) => {
    return `gradient-${name.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-')}`;
  };

  const handleChartClick = (itemName: string, metricType: MetricType, timeSeriesData: any[]) => {
    console.log(`handleChartClick - ${itemName} - ${metricType}:`, {
      dataLength: timeSeriesData.length,
      sampleData: timeSeriesData.slice(0, 5),
      metricValues: timeSeriesData.map(d => d[metricType]).slice(0, 10),
      nullCount: timeSeriesData.filter(d => d[metricType] === null).length,
      zeroCount: timeSeriesData.filter(d => d[metricType] === 0).length
    });
    
    setModalData({
      isOpen: true,
      itemName,
      metricType,
      data: timeSeriesData
    });
  };
  
  const getMetricDetails = (metricType: MetricType) => {
    switch(metricType) {
      case "impressions":
        return {
          title: "Impressions",
          color: "#0EA5E9",
          formatter: (value: number) => formatNumber(value, { abbreviate: false })
        };
      case "clicks":
        return {
          title: "Clicks",
          color: "#8B5CF6",
          formatter: (value: number) => formatNumber(value, { abbreviate: false })
        };
      case "ctr":
        return {
          title: "CTR",
          color: "#6366F1",
          formatter: (value: number) => formatNumber(value, { decimals: 2, suffix: '%' })
        };
      case "transactions":
        return {
          title: "Transactions",
          color: "#F97316",
          formatter: (value: number) => formatNumber(value, { abbreviate: false })
        };
      case "revenue":
        return {
          title: "Attributed Sales",
          color: "#10B981",
          formatter: (value: number) => `$${formatNumber(value, { abbreviate: false })}`
        };
      case "roas":
        return {
          title: "ROAS",
          color: "#F59E0B",
          formatter: (value: number) => formatNumber(value, { decimals: 2, suffix: 'x' })
        };
    }
  };

  if (!data || data.length === 0) {
    return <div className="text-center py-8">No data available</div>;
  }

  if (chartData.length === 0) {
    return (
      <div className="space-y-4">
        {!useGlobalFilters && (
          <div className="flex justify-between items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">View by:</span>
              <Select
                value={viewMode}
                onValueChange={(value: ViewMode) => setViewMode(value)}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Select view" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="campaign">Campaign</SelectItem>
                  <SelectItem value="advertiser">Advertiser</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-muted-foreground">Filter by:</span>
              
              <div className="flex items-center gap-2">
                <MultiSelect
                  options={agencyOptions}
                  selected={selectedAgencies}
                  onChange={setSelectedAgencies}
                  placeholder="Agency"
                  className="w-[180px]"
                />
                
                <MultiSelect
                  options={advertiserOptions}
                  selected={selectedAdvertisers}
                  onChange={setSelectedAdvertisers}
                  placeholder="Advertiser"
                  className="w-[180px]"
                />
                
                <MultiSelect
                  options={campaignOptions}
                  selected={selectedCampaigns}
                  onChange={setSelectedCampaigns}
                  placeholder="Campaign"
                  className="w-[180px]"
                  popoverClassName="w-[400px]"
                />
              </div>
            </div>
          </div>
        )}
        
        <div className="text-center py-20 bg-muted/30 rounded-lg">
          <p className="text-muted-foreground">No data available for the selected date range</p>
          <p className="text-sm text-muted-foreground mt-2">Try adjusting the date filter or campaign selection</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Only show filter UI when NOT using global filters */}
      {!useGlobalFilters && (
        <div className="flex justify-between items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">View by:</span>
            <Select
              value={viewMode}
              onValueChange={(value: ViewMode) => setViewMode(value)}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Select view" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="campaign">Campaign</SelectItem>
                <SelectItem value="advertiser">Advertiser</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-muted-foreground">Filter by:</span>
            
            <div className="flex items-center gap-2">
              <MultiSelect
                options={agencyOptions}
                selected={selectedAgencies}
                onChange={setSelectedAgencies}
                placeholder="Agency"
                className="w-[180px]"
              />
              
              <MultiSelect
                options={advertiserOptions}
                selected={selectedAdvertisers}
                onChange={setSelectedAdvertisers}
                placeholder="Advertiser"
                className="w-[180px]"
              />
              
              <MultiSelect
                options={campaignOptions}
                selected={selectedCampaigns}
                onChange={setSelectedCampaigns}
                placeholder="Campaign"
                className="w-[180px]"
                popoverClassName="w-[400px]"
              />
            </div>
          </div>
        </div>
      )}
      
      {chartData.map((item) => {
        const impressionsId = `impressions-${getSafeId(item.name)}`;
        const clicksId = `clicks-${getSafeId(item.name)}`;
        const transactionsId = `transactions-${getSafeId(item.name)}`;
        const revenueId = `revenue-${getSafeId(item.name)}`;
        const ctrId = `ctr-${getSafeId(item.name)}`;
        const roasId = `roas-${getSafeId(item.name)}`;
        
        return (
          <Card key={item.name} className="overflow-hidden">
            <div className="p-4 sm:p-6">
              <div className="flex flex-col space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium truncate" title={item.name}>
                      {item.name}
                    </h3>
                    <div className="flex items-center mt-1">
                      <p className="text-sm text-muted-foreground mr-3">
                        {item.timeSeriesData.length} days of data
                      </p>
                      <div className="flex items-center text-sm font-medium">
                        <DollarSign className="h-3.5 w-3.5 text-muted-foreground mr-1" />
                        <span>Total Spend: ${formatNumber(item.totals.spend, { abbreviate: false })}</span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-6 gap-4 border-t pt-4">
                  <div className="flex items-center space-x-2">
                    <div className="bg-sky-100 p-2 rounded-full">
                      <Eye className="h-4 w-4 text-sky-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{formatNumber(item.totals.impressions, { abbreviate: false })}</p>
                      <p className="text-xs text-muted-foreground">Impressions</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <div className="bg-violet-100 p-2 rounded-full">
                      <MousePointer className="h-4 w-4 text-violet-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{formatNumber(item.totals.clicks, { abbreviate: false })}</p>
                      <p className="text-xs text-muted-foreground">Clicks</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <div className="bg-indigo-100 p-2 rounded-full">
                      <Percent className="h-4 w-4 text-indigo-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{formatNumber(item.avgCtr, { decimals: 2, suffix: '%' })}</p>
                      <p className="text-xs text-muted-foreground">CTR</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <div className="bg-orange-100 p-2 rounded-full">
                      <ShoppingCart className="h-4 w-4 text-orange-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{formatNumber(item.totals.transactions, { abbreviate: false })}</p>
                      <p className="text-xs text-muted-foreground">Transactions</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <div className="bg-green-100 p-2 rounded-full">
                      <DollarSign className="h-4 w-4 text-green-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">${formatNumber(item.totals.revenue, { abbreviate: false })}</p>
                      <p className="text-xs text-muted-foreground">Attributed Sales</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <div className="bg-amber-100 p-2 rounded-full">
                      <TrendingUp className="h-4 w-4 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{formatNumber(item.avgRoas, { decimals: 2, suffix: 'x' })}</p>
                      <p className="text-xs text-muted-foreground">ROAS</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-6 gap-4 h-24">
                  <div className="hidden sm:block cursor-pointer relative group" 
                       onClick={() => handleChartClick(item.name, "impressions", item.timeSeriesData)}>
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Maximize className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={item.timeSeriesData}>
                        <defs>
                          <linearGradient id={impressionsId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#0EA5E9" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#0EA5E9" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <Area
                          type="monotone"
                          dataKey="impressions"
                          stroke="#0EA5E9"
                          strokeWidth={1.5}
                          fill={`url(#${impressionsId})`}
                          dot={false}
                          isAnimationActive={false}
                          connectNulls={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="hidden sm:block cursor-pointer relative group" 
                       onClick={() => handleChartClick(item.name, "clicks", item.timeSeriesData)}>
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Maximize className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={item.timeSeriesData}>
                        <defs>
                          <linearGradient id={clicksId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <Area
                          type="monotone"
                          dataKey="clicks"
                          stroke="#8B5CF6"
                          strokeWidth={1.5}
                          fill={`url(#${clicksId})`}
                          dot={false}
                          isAnimationActive={false}
                          connectNulls={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="hidden sm:block cursor-pointer relative group" 
                       onClick={() => handleChartClick(item.name, "ctr", item.timeSeriesData)}>
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Maximize className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={item.timeSeriesData}>
                        <defs>
                          <linearGradient id={ctrId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366F1" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <Area
                          type="monotone"
                          dataKey="ctr"
                          stroke="#6366F1"
                          strokeWidth={1.5}
                          fill={`url(#${ctrId})`}
                          dot={false}
                          isAnimationActive={false}
                          connectNulls={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="hidden sm:block cursor-pointer relative group" 
                       onClick={() => handleChartClick(item.name, "transactions", item.timeSeriesData)}>
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Maximize className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={item.timeSeriesData}>
                        <defs>
                          <linearGradient id={transactionsId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#F97316" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#F97316" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <Area
                          type="monotone"
                          dataKey="transactions"
                          stroke="#F97316"
                          strokeWidth={1.5}
                          fill={`url(#${transactionsId})`}
                          dot={false}
                          isAnimationActive={false}
                          connectNulls={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="hidden sm:block cursor-pointer relative group" 
                       onClick={() => handleChartClick(item.name, "revenue", item.timeSeriesData)}>
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Maximize className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={item.timeSeriesData}>
                        <defs>
                          <linearGradient id={revenueId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <Area
                          type="monotone"
                          dataKey="revenue"
                          stroke="#10B981"
                          strokeWidth={1.5}
                          fill={`url(#${revenueId})`}
                          dot={false}
                          isAnimationActive={false}
                          connectNulls={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="hidden sm:block cursor-pointer relative group" 
                       onClick={() => handleChartClick(item.name, "roas", item.timeSeriesData)}>
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Maximize className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={item.timeSeriesData}>
                        <defs>
                          <linearGradient id={roasId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#F59E0B" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <Area
                          type="monotone"
                          dataKey="roas"
                          stroke="#F59E0B"
                          strokeWidth={1.5}
                          fill={`url(#${roasId})`}
                          dot={false}
                          isAnimationActive={false}
                          connectNulls={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        );
      })}

      {/* Modal for expanded chart view */}
      {modalData.isOpen && (
        <SparkChartModal
          open={modalData.isOpen}
          onOpenChange={(open) => setModalData({ ...modalData, isOpen: open })}
          title={`${modalData.itemName} - ${getMetricDetails(modalData.metricType).title}`}
          data={modalData.data}
          dataKey={modalData.metricType}
          color={getMetricDetails(modalData.metricType).color}
          gradientId={`${modalData.itemName}-${modalData.metricType}`.replace(/[^a-zA-Z0-9]/g, '-')}
          valueFormatter={getMetricDetails(modalData.metricType).formatter}
        />
      )}
    </div>
  );
};

export default CampaignSparkCharts;
