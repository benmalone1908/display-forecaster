import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
} from 'recharts';
import { DateRange } from 'react-day-picker';
import { formatNumber, parseDateString } from '@/lib/utils';

interface CampaignPerformanceComponentProps {
  data: any[];
  mode: 'display' | 'attribution';
  format: 'by-date' | 'by-day-of-week';
  dateRange: DateRange;
  title: string;
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

// Helper function to fill missing dates
const fillMissingDates = (data: any[], completeDateRange: Date[]) => {
  if (data.length === 0 || completeDateRange.length === 0) return data;
  
  const dataByDate = new Map();
  
  data.forEach(item => {
    const dateStr = item.date;
    dataByDate.set(dateStr, item);
  });
  
  const result = [];
  
  for (const date of completeDateRange) {
    const dateStr = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
    
    const existingData = dataByDate.get(dateStr);
    
    if (existingData) {
      result.push(existingData);
    } else {
      result.push({
        date: dateStr,
        IMPRESSIONS: 0,
        CLICKS: 0,
        TRANSACTIONS: 0,
        REVENUE: 0
      });
    }
  }
  
  return result;
};

const CampaignPerformanceComponent: React.FC<CampaignPerformanceComponentProps> = ({
  data,
  mode,
  format,
  dateRange,
  title
}) => {
  const processedData = useMemo(() => {
    // Filter data by date range
    const filteredData = data.filter(row => {
      if (!row.DATE || row.DATE === 'Totals') return false;
      const rowDate = new Date(row.DATE);
      return (!dateRange.from || rowDate >= dateRange.from) && 
             (!dateRange.to || rowDate <= dateRange.to);
    });

    if (format === 'by-day-of-week') {
      // Group by day of week
      const dayGroups: Record<string, any> = {};
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      
      filteredData.forEach(row => {
        const date = new Date(row.DATE);
        const dayName = days[date.getDay()];
        
        if (!dayGroups[dayName]) {
          dayGroups[dayName] = {
            date: dayName,
            IMPRESSIONS: 0,
            CLICKS: 0,
            TRANSACTIONS: 0,
            REVENUE: 0
          };
        }
        
        dayGroups[dayName].IMPRESSIONS += +(row.IMPRESSIONS) || 0;
        dayGroups[dayName].CLICKS += +(row.CLICKS) || 0;
        dayGroups[dayName].TRANSACTIONS += +(row.TRANSACTIONS) || 0;
        dayGroups[dayName].REVENUE += +(row.REVENUE) || 0;
      });
      
      return days.map(day => dayGroups[day] || {
        date: day,
        IMPRESSIONS: 0,
        CLICKS: 0,
        TRANSACTIONS: 0,
        REVENUE: 0
      });
    } else {
      // Group by date
      const dateGroups: Record<string, any> = {};
      
      filteredData.forEach(row => {
        const dateStr = String(row.DATE).trim();
        
        if (!dateGroups[dateStr]) {
          dateGroups[dateStr] = {
            date: dateStr,
            IMPRESSIONS: 0,
            CLICKS: 0,
            TRANSACTIONS: 0,
            REVENUE: 0
          };
        }
        
        dateGroups[dateStr].IMPRESSIONS += +(row.IMPRESSIONS) || 0;
        dateGroups[dateStr].CLICKS += +(row.CLICKS) || 0;
        dateGroups[dateStr].TRANSACTIONS += +(row.TRANSACTIONS) || 0;
        dateGroups[dateStr].REVENUE += +(row.REVENUE) || 0;
      });
      
      const aggregatedData = Object.values(dateGroups);
      const completeDateRange = getCompleteDateRange(filteredData);
      return fillMissingDates(aggregatedData, completeDateRange);
    }
  }, [data, dateRange, format]);

  // Sort the data
  const sortedData = useMemo(() => {
    if (format === 'by-day-of-week') {
      return processedData; // Already in correct order
    }
    
    return processedData.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateA.getTime() - dateB.getTime();
    });
  }, [processedData, format]);

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

  const barSize = format === 'by-day-of-week' ? 120 : 80;

  const renderChart = () => {
    if (mode === "display") {
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
            fill="#3b82f6"
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
    } else if (mode === "attribution") {
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
    }
    
    return null;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div>
          <CardTitle>Campaign Performance: {mode.charAt(0).toUpperCase() + mode.slice(1)}</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {dateRange.from?.toLocaleDateString()} - {dateRange.to?.toLocaleDateString()}
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default CampaignPerformanceComponent;