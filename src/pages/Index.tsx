import React, { useState, useEffect, useMemo, useCallback } from "react";
import { DateRange } from "react-day-picker";
import FileUpload from "@/components/FileUpload";
import DateRangePicker from "@/components/DateRangePicker";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CampaignSparkCharts from "@/components/CampaignSparkCharts";
import { LayoutDashboard, ChartLine, FileText, Target, Plus, Activity, FileDown, Clock, TrendingUp } from "lucide-react";
import DashboardWrapper from "@/components/DashboardWrapper";
import { setToStartOfDay, setToEndOfDay, logDateDetails, normalizeDate, parseDateString } from "@/lib/utils";
import { CampaignFilterProvider, useCampaignFilter, AGENCY_MAPPING } from "@/contexts/CampaignFilterContext";
import { CampaignStatusToggle } from "@/components/CampaignStatusToggle";
import { ChartToggle } from "@/components/ChartToggle";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ResponsiveContainer, LineChart, Line, Tooltip, AreaChart, Area, XAxis, YAxis } from "recharts";
import { getColorClasses } from "@/utils/anomalyColors";
import { TrendingDown, Maximize, Eye, MousePointer, ShoppingCart, DollarSign, Percent, X } from "lucide-react";
import SparkChartModal from "@/components/SparkChartModal";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import GlobalFilters from "@/components/GlobalFilters";
import RawDataTableImproved from "@/components/RawDataTableImproved";
import PacingFileUpload from "@/components/PacingFileUpload";
import PacingTable from "@/components/PacingTable";
import PacingMetrics from "@/components/PacingMetrics";
import CampaignHealthTab from "@/components/CampaignHealthTab";
import { Pacing2 } from "@/components/Pacing2";
import EnhancedPdfExportButton from "@/components/ui/enhanced-pdf-export-button";
import CustomReportBuilder from "@/components/CustomReportBuilder";
import StatusTab from "@/components/StatusTab";
import ForecastTab from "@/components/ForecastTab";
import { applySpendCorrections, getSpendCorrectionSummary } from "@/utils/orangellowSpendCorrection";

type MetricType = 
  | "impressions" 
  | "clicks" 
  | "ctr" 
  | "transactions" 
  | "revenue" 
  | "roas";

interface ModalData {
  isOpen: boolean;
  title: string;
  metricType: MetricType;
  data: any[];
}

// Helper function to get complete date range from data
const getCompleteDateRange = (data: any[]): Date[] => {
  const dates = data
    .map(row => row.DATE)
    .filter(date => date && date !== 'Totals')
    .map(dateStr => parseDateString(dateStr))
    .filter(Boolean) as Date[];
    
  if (dates.length === 0) return [];
  
  dates.sort((a, b) => a.getTime() - b.getTime());
  const minDate = dates[0];
  const maxDate = dates[dates.length - 1];
  
  const result = [];
  const current = new Date(minDate);
  
  while (current <= maxDate) {
    result.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  
  return result;
};

// Helper function to fill missing dates with zero values for aggregated data
const fillMissingDatesForAggregated = (timeSeriesData: any[], allDates: Date[]): any[] => {
  
  // If no data, return empty array
  if (timeSeriesData.length === 0 || allDates.length === 0) return timeSeriesData;
  
  // Create a map of existing data by date string - use the same format as aggregated data
  const dataByDate = new Map();
  timeSeriesData.forEach(item => {
    if (item.date) {
      dataByDate.set(item.date, item);
    }
  });
  
  
  // Find the actual range of dates that have data
  const datesWithData = timeSeriesData
    .map(item => parseDateString(item.date))
    .filter(Boolean)
    .sort((a, b) => a!.getTime() - b!.getTime());
    
  if (datesWithData.length === 0) return timeSeriesData;
  
  const firstDataDate = datesWithData[0]!;
  const lastDataDate = datesWithData[datesWithData.length - 1]!;
  
  // Generate complete time series only within the data range
  // Use the same date format as the aggregated data (M/D/YYYY)
  const result = [];
  for (const date of allDates) {
    if (date >= firstDataDate && date <= lastDataDate) {
      // Format date as M/D/YYYY to match aggregated data format
      const dateStr = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
      
      const existingData = dataByDate.get(dateStr);
      
      if (existingData) {
        // Use existing data as-is
        result.push(existingData);
      } else {
        // Fill gap with zero values
        result.push({
          date: dateStr,
          IMPRESSIONS: 0,
          CLICKS: 0,
          REVENUE: 0,
          TRANSACTIONS: 0,
          SPEND: 0,
          CTR: 0,
          ROAS: 0
        });
      }
    }
  }
  
    
  return result;
};

// Improved Aggregated Spark Charts component that matches the campaign row style
const AggregatedSparkCharts = ({ data }: { data: any[] }) => {
  const { showAggregatedSparkCharts, showDebugInfo } = useCampaignFilter();
  const [modalData, setModalData] = useState<ModalData>({
    isOpen: false,
    title: "",
    metricType: "impressions",
    data: []
  });
  
  if (!showAggregatedSparkCharts || !data || data.length === 0) {
    return null;
  }

  console.log('AggregatedSparkCharts: Raw data received:', data.length, 'rows');
  console.log('AggregatedSparkCharts: Sample raw data:', data.slice(0, 3));

  // Get complete date range for filling gaps
  const completeDateRange = useMemo(() => getCompleteDateRange(data), [data]);

  // Group data by date for time series with optimization
  const timeSeriesData = useMemo(() => {
    if (showDebugInfo) {
      console.log('AggregatedSparkCharts: Starting time series aggregation...');
    }
    
    const dateGroups = new Map<string, any>();
    
    // Single pass aggregation
    for (let index = 0; index < data.length; index++) {
      const row = data[index];
      if (!row?.DATE || row.DATE === 'Totals') {
        if (showDebugInfo && index < 5) {
          console.log('AggregatedSparkCharts: Skipping row:', row);
        }
        continue;
      }
      
      const dateStr = String(row.DATE).trim();
      let dateGroup = dateGroups.get(dateStr);
      
      if (!dateGroup) {
        dateGroup = {
          date: dateStr,
          IMPRESSIONS: 0,
          CLICKS: 0,
          REVENUE: 0,
          TRANSACTIONS: 0,
          SPEND: 0
        };
        dateGroups.set(dateStr, dateGroup);
      }
      
      // Fast numeric conversion and accumulation
      dateGroup.IMPRESSIONS += +(row.IMPRESSIONS) || 0;
      dateGroup.CLICKS += +(row.CLICKS) || 0;
      dateGroup.REVENUE += +(row.REVENUE) || 0;
      dateGroup.TRANSACTIONS += +(row.TRANSACTIONS) || 0;
      dateGroup.SPEND += +(row.SPEND) || 0;
    }
    
    if (showDebugInfo) {
      console.log('AggregatedSparkCharts: Date groups created:', dateGroups.size);
    }
    
    // Convert Map to array and sort
    const rawData = Array.from(dateGroups.values()).sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return dateA - dateB;
    });
    
    if (showDebugInfo) {
      console.log('AggregatedSparkCharts: Raw aggregated data:', rawData.length, 'entries');
    }
    
    // Fill missing dates with zero values for continuous trend lines
    const filledData = fillMissingDatesForAggregated(rawData, completeDateRange);
    
    if (showDebugInfo) {
      console.log('AggregatedSparkCharts: Final filled data:', filledData.length, 'entries');
    }
    
    return filledData;
  }, [data, completeDateRange, showDebugInfo]);
  
  // Calculate totals with optimization
  const totals = useMemo(() => {
    if (showDebugInfo) {
      console.log('AggregatedSparkCharts: Calculating totals from timeSeriesData:', timeSeriesData.length, 'entries');
    }
    
    let impressions = 0;
    let clicks = 0;
    let revenue = 0;
    let transactions = 0;
    let spend = 0;
    
    // Fast accumulation without forEach
    for (let i = 0; i < timeSeriesData.length; i++) {
      const day = timeSeriesData[i];
      impressions += day.IMPRESSIONS;
      clicks += day.CLICKS;
      revenue += day.REVENUE;
      transactions += day.TRANSACTIONS;
      spend += day.SPEND;
    }
    
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const roas = spend > 0 ? revenue / spend : 0;
    
    const calculatedTotals = { impressions, clicks, ctr, revenue, transactions, spend, roas };
    
    if (showDebugInfo) {
      console.log('AggregatedSparkCharts: Final totals:', calculatedTotals);
    }
    
    return calculatedTotals;
  }, [timeSeriesData, showDebugInfo]);
  
  // Calculate trends (comparing last two data points)
  const trends = useMemo(() => {
    if (timeSeriesData.length < 2) return {
      impressions: 0,
      clicks: 0,
      ctr: 0,
      revenue: 0,
      transactions: 0,
      roas: 0
    };
    
    const last = timeSeriesData[timeSeriesData.length - 1];
    const secondLast = timeSeriesData[timeSeriesData.length - 2];
    
    const lastCTR = last.IMPRESSIONS > 0 ? (last.CLICKS / last.IMPRESSIONS) * 100 : 0;
    const secondLastCTR = secondLast.IMPRESSIONS > 0 ? (secondLast.CLICKS / secondLast.IMPRESSIONS) * 100 : 0;
    
    const lastROAS = last.SPEND > 0 ? last.REVENUE / last.SPEND : 0;
    const secondLastROAS = secondLast.SPEND > 0 ? secondLast.REVENUE / secondLast.SPEND : 0;
    
    return {
      impressions: calculatePercentChange(last.IMPRESSIONS, secondLast.IMPRESSIONS),
      clicks: calculatePercentChange(last.CLICKS, secondLast.CLICKS),
      ctr: calculatePercentChange(lastCTR, secondLastCTR),
      revenue: calculatePercentChange(last.REVENUE, secondLast.REVENUE),
      transactions: calculatePercentChange(last.TRANSACTIONS, secondLast.TRANSACTIONS),
      roas: calculatePercentChange(lastROAS, secondLastROAS)
    };
  }, [timeSeriesData]);
  
  function calculatePercentChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }

  // Format functions
  const formatNumber = (value: number): string => value.toLocaleString();
  const formatRevenue = (value: number): string => `$${Math.round(value).toLocaleString()}`;
  const formatCTR = (value: number): string => `${value.toFixed(2)}%`;
  const formatROAS = (value: number): string => value.toFixed(2);
  
  const handleChartClick = (metricType: MetricType, title: string) => {
    // Transform the data to include calculated CTR and ROAS fields
    let transformedData = timeSeriesData;
    
    if (metricType === "ctr") {
      transformedData = timeSeriesData.map(d => ({
        ...d, 
        CTR: d.IMPRESSIONS > 0 ? (d.CLICKS / d.IMPRESSIONS) * 100 : 0
      }));
    } else if (metricType === "roas") {
      transformedData = timeSeriesData.map(d => ({
        ...d, 
        ROAS: d.SPEND > 0 ? d.REVENUE / d.SPEND : 0
      }));
    }
    
    console.log(`handleChartClick for ${metricType}:`, {
      metricType,
      originalDataLength: timeSeriesData.length,
      transformedDataLength: transformedData.length,
      sampleOriginal: timeSeriesData.slice(0, 2),
      sampleTransformed: transformedData.slice(0, 2)
    });
    
    setModalData({
      isOpen: true,
      title: `All Campaigns - ${title}`,
      metricType,
      data: transformedData
    });
  };

  const getMetricDetails = (metricType: MetricType) => {
    switch(metricType) {
      case "impressions":
        return {
          title: "Impressions",
          color: "#4ade80",
          formatter: (value: number) => formatNumber(value)
        };
      case "clicks":
        return {
          title: "Clicks",
          color: "#f59e0b",
          formatter: (value: number) => formatNumber(value)
        };
      case "ctr":
        return {
          title: "CTR",
          color: "#0ea5e9",
          formatter: (value: number) => formatCTR(value)
        };
      case "transactions":
        return {
          title: "Transactions",
          color: "#8b5cf6",
          formatter: (value: number) => formatNumber(value)
        };
      case "revenue":
        return {
          title: "Attributed Sales",
          color: "#ef4444",
          formatter: (value: number) => formatRevenue(value)
        };
      case "roas":
        return {
          title: "ROAS",
          color: "#d946ef",
          formatter: (value: number) => formatROAS(value)
        };
    }
  };
  
  // Render a metric card with chart
  const renderMetricCard = (title: string, value: number, trend: number, formatter: (val: number) => string, data: any[], dataKey: string, color: string, metricType: MetricType) => {
    const colorClass = getColorClasses(trend).split(' ').find(c => c.startsWith('text-')) || '';
    const gradientId = `gradient-${title.toLowerCase().replace(/\s+/g, '-')}`;
    
    return (
      <Card className="p-4">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h4 className="text-sm font-medium">{title}</h4>
            <div className="text-base font-bold mt-1">
              {formatter(value)}
            </div>
          </div>
          
          <div className={`flex items-center text-xs ${colorClass} mt-1`}>
            {trend > 0 ? (
              <TrendingUp className="mr-1 h-3 w-3" />
            ) : (
              <TrendingDown className="mr-1 h-3 w-3" />
            )}
            <span>
              {trend > 0 ? "+" : ""}
              {trend.toFixed(1)}%
            </span>
          </div>
        </div>
        
        <div className="h-16 mt-1 cursor-pointer relative group" onClick={() => handleChartClick(metricType, title)}>
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Maximize className="h-5 w-5 text-muted-foreground" />
          </div>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.8}/>
                  <stop offset="95%" stopColor={color} stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <Area 
                type="monotone" 
                dataKey={dataKey} 
                stroke={color} 
                fillOpacity={1}
                fill={`url(#${gradientId})`} 
                dot={false}
                isAnimationActive={false}
                connectNulls={true}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
    );
  };
  
  return (
    <div className="mb-8 animate-fade-in">
      <div className="flex items-center mb-4">
        &nbsp;
      </div>
      {/* Updated to use two rows of three charts */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {renderMetricCard(
          "Impressions", 
          totals.impressions, 
          trends.impressions, 
          formatNumber, 
          timeSeriesData, 
          "IMPRESSIONS", 
          "#4ade80",
          "impressions"
        )}
        
        {renderMetricCard(
          "Clicks", 
          totals.clicks, 
          trends.clicks, 
          formatNumber, 
          timeSeriesData, 
          "CLICKS", 
          "#f59e0b",
          "clicks"
        )}
        
        {renderMetricCard(
          "CTR", 
          totals.ctr, 
          trends.ctr, 
          formatCTR, 
          timeSeriesData.map(d => ({...d, CTR: d.IMPRESSIONS > 0 ? (d.CLICKS / d.IMPRESSIONS) * 100 : 0})), 
          "CTR", 
          "#0ea5e9",
          "ctr"
        )}
        
        {renderMetricCard(
          "Transactions", 
          totals.transactions, 
          trends.transactions, 
          formatNumber, 
          timeSeriesData, 
          "TRANSACTIONS", 
          "#8b5cf6",
          "transactions"
        )}
        
        {renderMetricCard(
          "Attributed Sales", 
          totals.revenue, 
          trends.revenue, 
          formatRevenue, 
          timeSeriesData, 
          "REVENUE", 
          "#ef4444",
          "revenue"
        )}
        
        {renderMetricCard(
          "ROAS", 
          totals.roas, 
          trends.roas, 
          formatROAS, 
          timeSeriesData.map(d => {
            return {...d, ROAS: d.SPEND > 0 ? d.REVENUE / d.SPEND : 0};
          }), 
          "ROAS", 
          "#d946ef",
          "roas"
        )}
      </div>
      
      {/* Modal for expanded chart view */}
      {modalData.isOpen && (
        <SparkChartModal
          open={modalData.isOpen}
          onOpenChange={(open) => setModalData({ ...modalData, isOpen: open })}
          title={modalData.title}
          data={modalData.data}
          dataKey={modalData.metricType === "ctr" ? "CTR" : 
                  modalData.metricType === "roas" ? "ROAS" : 
                  modalData.metricType.toUpperCase()}
          color={getMetricDetails(modalData.metricType).color}
          gradientId={`aggregated-${modalData.metricType}`}
          valueFormatter={(value) => getMetricDetails(modalData.metricType).formatter(value)}
        />
      )}
    </div>
  );
};

const ForecastContent = ({ 
  data, 
  dateRange, 
  onDateRangeChange,
  onReset
}: { 
  data: any[]; 
  dateRange: DateRange | undefined; 
  onDateRangeChange: (range: DateRange | undefined) => void;
  onReset: () => void;
}) => {
  // Calculate available date range from data to constrain date picker
  const availableDateRange = useMemo(() => {
    if (!data || data.length === 0) {
      return { min: undefined, max: undefined };
    }
    
    const rawDates = data
      .map(row => row.DATE)
      .filter(date => date && date !== 'Totals');
    
    const dates = rawDates
      .map(dateStr => {
        const parsed = parseDateString(dateStr);
        return parsed;
      })
      .filter(Boolean) as Date[];
      
    if (dates.length === 0) {
      return { min: undefined, max: undefined };
    }
    
    dates.sort((a, b) => a.getTime() - b.getTime());
    const result = {
      min: dates[0],
      max: dates[dates.length - 1]
    };
    
    return result;
  }, [data]);

  const getFilteredData = () => {
    let filtered = data;
    
    if (!dateRange || !dateRange.from) {
      return filtered;
    }

    const fromDate = setToStartOfDay(dateRange.from);
    const toDate = dateRange.to ? setToEndOfDay(dateRange.to) : setToEndOfDay(new Date());
    
    filtered = data.filter(row => {
      try {
        if (!row.DATE) {
          return false;
        }
        
        if (row.DATE === 'Totals') return true;
        
        const dateStr = String(row.DATE).trim();
        const rowDate = parseDateString(dateStr);
        if (!rowDate) {
          return false;
        }
        
        // Normalize row date to start of day for comparison
        const normalizedRowDate = setToStartOfDay(rowDate);
        const isAfterFrom = normalizedRowDate >= fromDate;
        const isBeforeTo = normalizedRowDate <= toDate;
        
        return isAfterFrom && isBeforeTo;
      } catch (error) {
        console.error(`Error filtering by date for row ${JSON.stringify(row)}:`, error);
        return false;
      }
    });

    return filtered;
  };

  const filteredData = getFilteredData();

  return (
    <>
      {/* Simplified header with just title, date picker and reset button */}
      <div className="border-b animate-fade-in">
        <div className="flex items-center justify-between px-1 py-4">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">Display Forecaster</h1>
          </div>
          
          <div className="flex items-center gap-2">
            <DateRangePicker 
              dateRange={dateRange}
              onDateRangeChange={onDateRangeChange}
              displayDateRangeSummary={false}
              minDate={availableDateRange.min}
              maxDate={availableDateRange.max}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={onReset}
              className="flex items-center gap-2"
            >
              <X className="h-4 w-4" />
              Upload New File
            </Button>
          </div>
        </div>
      </div>
      
      {/* Direct forecast display - no tabs */}
      <div className="mt-6 animate-fade-in" id="forecast-section">
        <ForecastTab data={filteredData} />
      </div>
    </>
  );
};

const Index = () => {
  const [data, setData] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [showDashboard, setShowDashboard] = useState(false);

  useEffect(() => {
    if (data.length > 0) {
      const uniqueDates = Array.from(new Set(data.map(row => row.DATE))).filter(date => date !== 'Totals').sort();
      console.log(`Dataset has ${uniqueDates.length} unique dates:`, uniqueDates);
      
      if (uniqueDates.length > 0) {
        console.log(`Date range in dataset: ${uniqueDates[0]} to ${uniqueDates[uniqueDates.length - 1]}`);
        const dateCounts: Record<string, number> = {};
        data.forEach(row => {
          dateCounts[row.DATE] = (dateCounts[row.DATE] || 0) + 1;
        });
        console.log("Rows per date:", dateCounts);
        
        if (!dateRange || !dateRange.from) {
          try {
            // Parse dates and create proper Date objects
            const parsedDates = uniqueDates
              .map(dateStr => parseDateString(dateStr))
              .filter(Boolean) as Date[];
              
            if (parsedDates.length > 0) {
              // Sort dates chronologically
              parsedDates.sort((a, b) => a.getTime() - b.getTime());
              
              const minDate = parsedDates[0];
              const maxDate = parsedDates[parsedDates.length - 1];
              
              if (!isNaN(minDate.getTime()) && !isNaN(maxDate.getTime())) {
                // Check if the dataset spans more than 90 days
                const daysDifference = (maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24);
                
                let fromDate = minDate;
                let toDate = maxDate;
                
                // If dataset spans more than 90 days, default to last 30 days of data
                if (daysDifference > 90) {
                  // Set to last 30 days of available data using proper date arithmetic
                  fromDate = new Date(maxDate.getTime() - (30 * 24 * 60 * 60 * 1000));
                  
                  // Make sure fromDate doesn't go before the actual data start
                  if (fromDate < minDate) {
                    fromDate = minDate;
                  }
                  
                  console.log(`🔍 Dataset spans ${Math.round(daysDifference)} days - defaulting to last 30 days`);
                  console.log(`🔍 Date range will be: ${fromDate.toLocaleDateString()} to ${maxDate.toLocaleDateString()}`);
                  console.log(`🔍 Sample data dates:`, uniqueDates.slice(-5));
                } else {
                  console.log(`🔍 Dataset spans ${Math.round(daysDifference)} days - using full range`);
                  console.log(`🔍 Date range will be: ${minDate.toLocaleDateString()} to ${maxDate.toLocaleDateString()}`);
                }
                
                setDateRange({ from: fromDate, to: toDate });
              }
            }
          } catch (e) {
            console.error("Error auto-setting date range:", e);
          }
        }
      }
    }
  }, [data]);

  const handleDataLoaded = (uploadedData: any[]) => {
    try {
      if (!Array.isArray(uploadedData) || uploadedData.length === 0) {
        toast.error("Invalid data format received");
        return;
      }
      
      console.log(`Loaded ${uploadedData.length} rows of data`);
      
      const requiredFields = ["DATE", "CAMPAIGN ORDER NAME", "IMPRESSIONS", "CLICKS", "REVENUE", "SPEND"];
      
      if (uploadedData[0]) {
        const missingFields = requiredFields.filter(field => 
          !Object.keys(uploadedData[0]).some(key => key.toUpperCase() === field)
        );
        
        if (missingFields.length > 0) {
          toast.error(`Missing required fields: ${missingFields.join(", ")}`);
          return;
        }
      }
      
      const processedData = uploadedData.map(row => {
        const newRow = { ...row };
        
        if (newRow.DATE) {
          try {
            const date = parseDateString(newRow.DATE);
            if (date) {
              newRow.DATE = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
              if (newRow.DATE.includes('4/9/') || newRow.DATE.includes('4/8/')) {
                logDateDetails(`Processed date for row:`, date, `-> ${newRow.DATE} (original: ${row.DATE})`);
              }
            } else {
              console.error(`Invalid date format: ${newRow.DATE}`);
            }
          } catch (e) {
            console.error("Error parsing date:", e);
          }
        }
        
        ["IMPRESSIONS", "CLICKS", "TRANSACTIONS", "REVENUE", "SPEND"].forEach(field => {
          const normalizedField = Object.keys(newRow).find(key => key.toUpperCase() === field);
          if (normalizedField) {
            newRow[normalizedField] = Number(newRow[normalizedField]) || 0;
          }
        });
        
        return newRow;
      });
      
      // Apply Orangellow spend corrections (SM and OG campaigns using $7 CPM)
      const correctedData = applySpendCorrections(processedData);
      
      // Log spend correction summary
      const correctionSummary = getSpendCorrectionSummary(correctedData);
      if (correctionSummary.correctedRows > 0) {
        console.log(`Orangellow spend corrections applied:`, correctionSummary);
        toast.success(`Applied spend corrections to ${correctionSummary.correctedRows} Orangellow campaigns using $7 CPM`);
      }
      
      setData(correctedData);
      
      const dates = correctedData.map(row => row.DATE).filter(date => date && date !== 'Totals').sort();
      if (dates.length > 0) {
        console.log(`Data date range: ${dates[0]} to ${dates[dates.length-1]}`);
        console.log(`Total unique dates: ${new Set(dates).size}`);
        
        const dateCounts: Record<string, number> = {};
        correctedData.forEach(row => {
          dateCounts[row.DATE] = (dateCounts[row.DATE] || 0) + 1;
        });
        console.log("Rows per date:", dateCounts);
      }
      
      toast.success(`Successfully loaded ${correctedData.length} rows of data`);
    } catch (error) {
      console.error("Error processing uploaded data:", error);
      toast.error("Failed to process the uploaded data");
    }
  };


  const handleProcessFiles = () => {
    if (data.length === 0) {
      toast.error("Please upload campaign data first");
      return;
    }
    setShowDashboard(true);
  };

  const handleReset = () => {
    setData([]);
    setDateRange(undefined);
    setShowDashboard(false);
  };

  return (
    <CampaignFilterProvider>
      <div className="container py-8">
        {!showDashboard ? (
          <>
            <div className="space-y-2 text-center animate-fade-in">
              <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl">
                Display Forecaster
              </h1>
              <p className="text-muted-foreground">
                Upload your campaign data to generate forecasts and trend analysis
              </p>
            </div>

            <div className="max-w-4xl mx-auto">
              <FileUpload 
                onDataLoaded={handleDataLoaded} 
                onPacingDataLoaded={() => {}} 
                onContractTermsLoaded={() => {}}
                onProcessFiles={handleProcessFiles}
              />
            </div>
          </>
        ) : (
          <ForecastContent 
            data={data} 
            dateRange={dateRange} 
            onDateRangeChange={setDateRange}
            onReset={handleReset}
          />
        )}
      </div>
    </CampaignFilterProvider>
  );
};

export default Index;
