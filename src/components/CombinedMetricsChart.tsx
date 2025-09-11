import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ResponsiveContainer, 
  ComposedChart, 
  Line, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from "recharts";
import { formatNumber, parseDateString } from "@/lib/utils";
import SparkChartModal from "./SparkChartModal";

interface CombinedMetricsChartProps {
  data: any[];
  title?: string;
  chartToggleComponent?: React.ReactNode;
  onTabChange?: (tab: string) => void;
  initialTab?: string;
  // New props for custom metrics
  customBarMetric?: string;
  customLineMetric?: string;
}

// Helper function to get complete date range from data
const getCompleteDateRange = (data: any[]): Date[] => {
  const dates = data
    .map(row => row.DATE || row.DAY_OF_WEEK)
    .filter(date => date)
    .map(dateStr => {
      // Handle day of week data differently
      if (/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)/i.test(dateStr)) {
        return null; // Don't process day of week data for date ranges
      }
      return parseDateString(dateStr);
    })
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

// Helper function to fill missing dates with zero values for combo chart
const fillMissingDatesForCombo = (processedData: any[], allDates: Date[]): any[] => {
  
  // Check if we're dealing with day of week data
  const isDayOfWeekData = processedData.some(item => item.date && /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)/i.test(item.date));
  
  // Don't fill gaps for day of week data
  if (isDayOfWeekData) {
    return processedData;
  }
  
  // If no data, return empty array
  if (processedData.length === 0 || allDates.length === 0) return processedData;
  
  // Create a map of existing data by date string - use the same format as the data
  const dataByDate = new Map();
  processedData.forEach(item => {
    if (item.date) {
      dataByDate.set(item.date, item);
    }
  });
  
  
  // Find the actual range of dates that have data
  const datesWithData = processedData
    .map(item => parseDateString(item.date))
    .filter(Boolean)
    .sort((a, b) => a!.getTime() - b!.getTime());
    
  if (datesWithData.length === 0) return processedData;
  
  const firstDataDate = datesWithData[0]!;
  const lastDataDate = datesWithData[datesWithData.length - 1]!;
  
  // Generate complete time series only within the data range
  // Use the same date format as the input data (M/D/YYYY)
  const result = [];
  for (const date of allDates) {
    if (date >= firstDataDate && date <= lastDataDate) {
      // Format date as M/D/YYYY to match input data format
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
          TRANSACTIONS: 0,
          REVENUE: 0
        });
      }
    }
  }
  
    
  return result;
};

const CombinedMetricsChart = ({ 
  data, 
  title = "Campaign Performance", 
  chartToggleComponent,
  onTabChange,
  initialTab = "display",
  customBarMetric = "IMPRESSIONS",
  customLineMetric = "CLICKS"
}: CombinedMetricsChartProps) => {
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  
  console.log(`CombinedMetricsChart: Rendering with data length: ${data?.length}, activeTab: ${activeTab}, initialTab: ${initialTab}`);
  
  // Format functions for different metrics
  const getMetricFormatter = (metric: string) => {
    switch (metric) {
      case "IMPRESSIONS":
      case "CLICKS":
      case "TRANSACTIONS":
        return (value: number) => formatNumber(value);
      case "REVENUE":
        return (value: number) => `$${formatNumber(value)}`;
      default:
        return (value: number) => formatNumber(value);
    }
  };

  const getMetricLabel = (metric: string) => {
    switch (metric) {
      case "IMPRESSIONS":
        return "Impressions";
      case "CLICKS":
        return "Clicks";
      case "TRANSACTIONS":
        return "Transactions";
      case "REVENUE":
        return "Attributed Sales";
      default:
        return metric;
    }
  };

  // Custom tooltip formatter function
  const formatTooltipValue = (value: any, name: string) => {
    const numValue = Number(value);
    if (isNaN(numValue)) return [value, name];
    
    // Handle revenue formatting with dollar signs and cents
    if (name === "REVENUE" || name === "Revenue" || name.toLowerCase().includes("revenue")) {
      return [`$${numValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, "Attributed Sales"];
    }
    
    // Handle other metrics with comma formatting
    switch (name) {
      case "IMPRESSIONS":
      case "Impressions":
        return [numValue.toLocaleString(), "Impressions"];
      case "CLICKS":
      case "Clicks":
        return [numValue.toLocaleString(), "Clicks"];
      case "TRANSACTIONS":
      case "Transactions":
        return [numValue.toLocaleString(), "Transactions"];
      default:
        return [numValue.toLocaleString(), name];
    }
  };

  // Effect to sync with initialTab prop changes
  useEffect(() => {
    if (initialTab !== activeTab) {
      console.log(`CombinedMetricsChart: Syncing tab from props: ${initialTab}`);
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    console.log(`CombinedMetricsChart: Tab changed to ${value}`);
    
    // Notify parent component about tab change
    if (onTabChange) {
      onTabChange(value);
    }
  };

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="h-[400px] flex items-center justify-center">
          No data available
        </CardContent>
      </Card>
    );
  }

  // Get complete date range for filling gaps
  const completeDateRange = getCompleteDateRange(data);

  // Process data to ensure we have all required fields
  const processedData = data
    .filter(item => item && (item.DATE || item.DAY_OF_WEEK))
    .map(item => ({
      date: item.DATE || item.DAY_OF_WEEK,
      IMPRESSIONS: Number(item.IMPRESSIONS || 0),
      CLICKS: Number(item.CLICKS || 0),
      TRANSACTIONS: Number(item.TRANSACTIONS || 0),
      REVENUE: Number(item.REVENUE || 0),
    }));

  // Check if we're dealing with day of week data
  const isDayOfWeekData = processedData.some(item => item.date && /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)/i.test(item.date));
  
  // Fill missing dates with zero values for continuous trend lines (only for date-based data)
  const filledData = fillMissingDatesForCombo(processedData, completeDateRange);
  
  // Only sort if we're dealing with dates, not days of week
  const sortedData = !isDayOfWeekData && filledData.some(item => item.date && !isNaN(new Date(item.date).getTime()))
    ? filledData.sort((a, b) => {
        try {
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        } catch (e) {
          return 0;
        }
      })
    : filledData;

  console.log(`CombinedMetricsChart: Processed data length: ${sortedData.length}, isDayOfWeekData: ${isDayOfWeekData}`);

  // Calculate bar size based on data type
  const barSize = isDayOfWeekData ? 120 : 80;

  // Render different chart configurations based on active tab
  const renderChart = () => {
    if (activeTab === "display") {
      return (
        <ComposedChart data={sortedData}>
          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
          <YAxis yAxisId="left" tickFormatter={(value) => formatNumber(value)} tick={{ fontSize: 10 }} />
          <YAxis yAxisId="right" orientation="right" tickFormatter={(value) => formatNumber(value)} tick={{ fontSize: 10 }} />
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <Tooltip 
            formatter={formatTooltipValue}
            contentStyle={{ 
              backgroundColor: "rgba(255, 255, 255, 0.95)", 
              border: "1px solid #eee",
              borderRadius: "4px",
              padding: "8px 12px",
              boxShadow: "0 2px 10px rgba(0, 0, 0, 0.1)"
            }}
          />
          <Legend />
          <Bar
            dataKey="IMPRESSIONS"
            fill="#4ade80"
            yAxisId="left"
            name="Impressions"
            barSize={barSize}
            opacity={0.8}
          />
          <Line
            type="monotone"
            dataKey="CLICKS"
            stroke="#f59e0b"
            strokeWidth={2}
            yAxisId="right"
            name="Clicks"
            dot={false}
            connectNulls={true}
          />
        </ComposedChart>
      );
    } else if (activeTab === "attribution") {
      return (
        <ComposedChart data={sortedData}>
          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
          <YAxis yAxisId="left" tickFormatter={(value) => formatNumber(value)} tick={{ fontSize: 10 }} />
          <YAxis yAxisId="right" orientation="right" tickFormatter={(value) => `$${formatNumber(value)}`} tick={{ fontSize: 10 }} />
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <Tooltip 
            formatter={formatTooltipValue}
            contentStyle={{ 
              backgroundColor: "rgba(255, 255, 255, 0.95)", 
              border: "1px solid #eee",
              borderRadius: "4px",
              padding: "8px 12px",
              boxShadow: "0 2px 10px rgba(0, 0, 0, 0.1)"
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="TRANSACTIONS"
            stroke="#ef4444"
            strokeWidth={2}
            yAxisId="left"
            name="Transactions"
            dot={false}
            connectNulls={true}
          />
          <Bar
            dataKey="REVENUE"
            fill="#8b5cf6"
            yAxisId="right"
            name="Attributed Sales"
            barSize={barSize}
            opacity={0.8}
          />
        </ComposedChart>
      );
    } else if (activeTab === "custom") {
      const barFormatter = getMetricFormatter(customBarMetric);
      const lineFormatter = getMetricFormatter(customLineMetric);
      const barLabel = getMetricLabel(customBarMetric);
      const lineLabel = getMetricLabel(customLineMetric);
      
      return (
        <ComposedChart data={sortedData}>
          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
          <YAxis yAxisId="left" tickFormatter={(value) => barFormatter(value)} tick={{ fontSize: 10 }} />
          <YAxis yAxisId="right" orientation="right" tickFormatter={(value) => lineFormatter(value)} tick={{ fontSize: 10 }} />
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <Tooltip 
            formatter={formatTooltipValue}
            contentStyle={{ 
              backgroundColor: "rgba(255, 255, 255, 0.95)", 
              border: "1px solid #eee",
              borderRadius: "4px",
              padding: "8px 12px",
              boxShadow: "0 2px 10px rgba(0, 0, 0, 0.1)"
            }}
          />
          <Legend />
          <Bar
            dataKey={customBarMetric}
            fill="#3b82f6"
            yAxisId="left"
            name={barLabel}
            barSize={barSize}
            opacity={0.8}
          />
          <Line
            type="monotone"
            dataKey={customLineMetric}
            stroke="#eab308"
            strokeWidth={2}
            yAxisId="right"
            name={lineLabel}
            dot={false}
            connectNulls={true}
          />
        </ComposedChart>
      );
    }
    
    return null;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>{title}</CardTitle>
          <div className="flex items-center space-x-2">
            {chartToggleComponent && (
              <div>{chartToggleComponent}</div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        </div>
        
        {/* Modal for expanded view (hidden as per requirement) */}
        <SparkChartModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          title={activeTab === "display" ? "Display Metrics Over Time" : activeTab === "attribution" ? "Attribution Metrics Over Time" : "Custom Metrics Over Time"}
          data={sortedData}
          dataKey={activeTab === "display" ? "CLICKS" : activeTab === "attribution" ? "TRANSACTIONS" : customLineMetric}
          color={activeTab === "display" ? "#f59e0b" : activeTab === "attribution" ? "#ef4444" : "#eab308"}
          gradientId={activeTab === "display" ? "impressions-clicks" : activeTab === "attribution" ? "transactions-revenue" : "custom-metrics"}
          valueFormatter={activeTab === "display" 
            ? (value) => formatNumber(value)
            : activeTab === "attribution" 
            ? (value) => formatNumber(value)
            : (value) => getMetricFormatter(customLineMetric)(value)
          }
        />
      </CardContent>
    </Card>
  );
};

export default CombinedMetricsChart;
