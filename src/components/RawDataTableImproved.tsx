import { useState, useMemo } from "react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { FileDown, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  Pagination, 
  PaginationContent, 
  PaginationEllipsis, 
  PaginationItem, 
  PaginationLink, 
  PaginationNext, 
  PaginationPrevious 
} from "@/components/ui/pagination";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { parseDateString } from "@/lib/utils";
import { useCampaignFilter } from "@/contexts/CampaignFilterContext";

interface RawDataTableProps {
  data: any[];
  useGlobalFilters?: boolean;
}

type GroupingLevel = "campaign" | "advertiser" | "agency";
type TimeAggregation = "daily" | "weekly" | "monthly" | "total";

const RawDataTableImproved = ({ data, useGlobalFilters = false }: RawDataTableProps) => {
  const { isTestCampaign, extractAdvertiserName, extractAgencyInfo } = useCampaignFilter();
  const [groupingLevel, setGroupingLevel] = useState<GroupingLevel>("campaign");
  const [timeAggregation, setTimeAggregation] = useState<TimeAggregation>("daily");
  const [showComparisons, setShowComparisons] = useState(false);
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [sortColumn, setSortColumn] = useState<string>("groupKey");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [includeAttributionOnly, setIncludeAttributionOnly] = useState(true);
  
  // Filter out 'Totals' rows, test campaigns, and optionally attribution-only campaigns
  const filteredData = useMemo(() => {
    return data.filter(row => {
      if (row.DATE === 'Totals') return false;
      const campaignName = row["CAMPAIGN ORDER NAME"];
      if (!campaignName) return true;
      
      // Filter out test campaigns
      if (isTestCampaign(campaignName)) return false;
      
      // Filter out attribution-only campaigns if toggle is off
      if (!includeAttributionOnly) {
        const impressions = Number(row.IMPRESSIONS) || 0;
        const revenue = Number(row.REVENUE) || 0;
        const transactions = Number(row.TRANSACTIONS) || 0;
        
        // If campaign has zero impressions but has attribution data (revenue or transactions)
        if (impressions === 0 && (revenue > 0 || transactions > 0)) {
          return false;
        }
      }
      
      return true;
    });
  }, [data, isTestCampaign, includeAttributionOnly]);

  // Helper function to get rolling period key for a date
  const getRollingPeriodKey = (date: Date, periodDays: number, mostRecentDate: Date) => {
    // Calculate which rolling period this date belongs to
    const daysDiff = Math.floor((mostRecentDate.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    const periodIndex = Math.floor(daysDiff / periodDays);
    
    // Calculate the start and end dates for this period
    const periodEnd = new Date(mostRecentDate);
    periodEnd.setDate(periodEnd.getDate() - (periodIndex * periodDays));
    
    const periodStart = new Date(periodEnd);
    periodStart.setDate(periodStart.getDate() - (periodDays - 1));
    
    // Format the period key as a date range
    const formatDate = (date: Date) => {
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      const year = date.getFullYear().toString().slice(-2);
      return `${month}/${day}/${year}`;
    };
    
    return `${formatDate(periodStart)} - ${formatDate(periodEnd)}`;
  };

  // Helper function to get calendar month key (keeping for reference)
  const getMonthKey = (date: Date) => {
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
  };

  // Process data with new 2-axis methodology
  const processedData = useMemo(() => {
    const groups: Record<string, any> = {};
    
    // Calculate most recent date for rolling periods
    let mostRecentDate: Date | null = null;
    if (timeAggregation === 'weekly' || timeAggregation === 'monthly') {
      const dates = filteredData
        .map(row => parseDateString(row.DATE))
        .filter((date): date is Date => date !== null);
      
      if (dates.length > 0) {
        mostRecentDate = new Date(Math.max(...dates.map(d => d.getTime())));
      }
    }
    
    // Step 1: Group data based on grouping level and time aggregation
    filteredData.forEach(row => {
      const campaignName = row["CAMPAIGN ORDER NAME"] || "";
      const dateStr = row.DATE;
      const date = parseDateString(dateStr);
      
      if (!date) return;
      
      let groupKey = "";
      let timeKey = "";
      
      // Determine grouping key based on level
      switch (groupingLevel) {
        case "campaign":
          groupKey = campaignName;
          break;
        case "advertiser":
          const advertiser = extractAdvertiserName(campaignName);
          const { agency } = extractAgencyInfo(campaignName);
          // Create a normalized key for aggregation but preserve original for display
          const normalizedAdvertiser = advertiser
            .trim()
            .replace(/\s+/g, ' ')
            .toLowerCase();
          groupKey = `${normalizedAdvertiser} (${agency})`;
          break;
        case "agency":
          const agencyInfo = extractAgencyInfo(campaignName);
          groupKey = agencyInfo.agency;
          break;
      }
      
      // Determine time key based on aggregation
      switch (timeAggregation) {
        case "daily":
          timeKey = dateStr;
          break;
        case "weekly":
          if (mostRecentDate) {
            timeKey = getRollingPeriodKey(date, 7, mostRecentDate);
          } else {
            timeKey = dateStr; // fallback to daily if no recent date
          }
          break;
        case "monthly":
          if (mostRecentDate) {
            timeKey = getRollingPeriodKey(date, 30, mostRecentDate);
          } else {
            timeKey = getMonthKey(date); // fallback to calendar month
          }
          break;
        case "total":
          timeKey = "total";
          break;
      }
      
      const fullKey = timeAggregation === "total" ? groupKey : `${groupKey}|${timeKey}`;
      
      if (!groups[fullKey]) {
        // Store the original advertiser name for display when grouping by advertiser
        let displayName = groupKey;
        if (groupingLevel === "advertiser") {
          const advertiser = extractAdvertiserName(campaignName);
          const { agency } = extractAgencyInfo(campaignName);
          displayName = `${advertiser.trim()} (${agency})`;
        }
        
        groups[fullKey] = {
          groupKey,
          displayName,
          timeKey,
          IMPRESSIONS: 0,
          CLICKS: 0,
          TRANSACTIONS: 0,
          REVENUE: 0,
          SPEND: 0
        };
      }
      
      groups[fullKey].IMPRESSIONS += Number(row.IMPRESSIONS) || 0;
      groups[fullKey].CLICKS += Number(row.CLICKS) || 0;
      groups[fullKey].TRANSACTIONS += Number(row.TRANSACTIONS) || 0;
      groups[fullKey].REVENUE += Number(row.REVENUE) || 0;
      groups[fullKey].SPEND += Number(row.SPEND) || 0;
    });
    
    // Step 2: Convert to array and calculate metrics
    let result = Object.values(groups).map(group => {
      const ctr = group.IMPRESSIONS > 0 ? (group.CLICKS / group.IMPRESSIONS) * 100 : 0;
      const roas = group.SPEND > 0 ? group.REVENUE / group.SPEND : 0;
      
      return {
        ...group,
        CTR: ctr,
        ROAS: roas
      };
    });

    // Step 3: Add period-over-period comparison data if enabled and not total aggregation
    if (showComparisons && timeAggregation !== 'total') {
      result = result.map(currentPeriod => {
        // Find the previous period for the same group
        let previousPeriod = null;
        
        if (timeAggregation === 'daily') {
          // For daily, find the previous day
          const currentDate = new Date(currentPeriod.timeKey);
          const previousDate = new Date(currentDate);
          previousDate.setDate(previousDate.getDate() - 1);
          const previousDateStr = `${(previousDate.getMonth() + 1).toString().padStart(2, '0')}/${previousDate.getDate().toString().padStart(2, '0')}/${previousDate.getFullYear().toString().slice(-2)}`;
          
          previousPeriod = result.find(p => 
            p.groupKey === currentPeriod.groupKey && 
            p.timeKey === previousDateStr
          );
        } else if (timeAggregation === 'weekly' || timeAggregation === 'monthly') {
          // For rolling periods, find the previous period by parsing the date range
          const timeKeyParts = currentPeriod.timeKey.split(' - ');
          if (timeKeyParts.length === 2) {
            const currentStart = new Date(timeKeyParts[0]);
            const periodDays = timeAggregation === 'weekly' ? 7 : 30;
            
            const previousStart = new Date(currentStart);
            previousStart.setDate(previousStart.getDate() - periodDays);
            
            const previousEnd = new Date(previousStart);
            previousEnd.setDate(previousEnd.getDate() + (periodDays - 1));
            
            const formatDate = (date: Date) => {
              const month = (date.getMonth() + 1).toString().padStart(2, '0');
              const day = date.getDate().toString().padStart(2, '0');
              const year = date.getFullYear().toString().slice(-2);
              return `${month}/${day}/${year}`;
            };
            
            const previousTimeKey = `${formatDate(previousStart)} - ${formatDate(previousEnd)}`;
            
            previousPeriod = result.find(p => 
              p.groupKey === currentPeriod.groupKey && 
              p.timeKey === previousTimeKey
            );
          }
        }
        
        return {
          ...currentPeriod,
          previousPeriod: previousPeriod || null
        };
      });
    }
    
    return result;
  }, [filteredData, groupingLevel, timeAggregation, showComparisons, extractAdvertiserName, extractAgencyInfo]);
  
  // Sort function
  const sortedData = useMemo(() => {
    if (!processedData) return [];
    
    return [...processedData].sort((a, b) => {
      // Primary sort by selected column
      const aValue = a[sortColumn];
      const bValue = b[sortColumn];
      
      // Handle numeric values
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        if (sortDirection === 'asc') {
          if (aValue !== bValue) return aValue - bValue;
        } else {
          if (aValue !== bValue) return bValue - aValue;
        }
      } 
      // Handle string values
      else if (typeof aValue === 'string' && typeof bValue === 'string') {
        if (sortDirection === 'asc') {
          if (aValue !== bValue) return aValue.localeCompare(bValue);
        } else {
          if (aValue !== bValue) return bValue.localeCompare(aValue);
        }
      }
      
      // Secondary sort by groupKey then timeKey
      if (sortColumn !== "groupKey") {
        const aGroup = a.groupKey;
        const bGroup = b.groupKey;
        if (aGroup !== bGroup) return aGroup.localeCompare(bGroup);
        
        // If grouping is the same, sort by time key
        if (timeAggregation !== "total") {
          const aTime = a.timeKey;
          const bTime = b.timeKey;
          return aTime.localeCompare(bTime);
        }
      }
      
      return 0;
    });
  }, [processedData, sortColumn, sortDirection, groupingLevel, timeAggregation]);

  // Paginate the data
  const paginatedData = useMemo(() => {
    const startIndex = (page - 1) * rowsPerPage;
    return sortedData.slice(startIndex, startIndex + rowsPerPage);
  }, [sortedData, page, rowsPerPage]);
  
  // Total number of pages
  const totalPages = useMemo(() => {
    return Math.ceil(sortedData.length / rowsPerPage);
  }, [sortedData, rowsPerPage]);

  // Handle column header click for sorting
  const handleSort = (column: string) => {
    if (column === sortColumn) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
    setPage(1);
  };
  
  // Handle grouping level change
  const handleGroupingChange = (newGrouping: GroupingLevel) => {
    setGroupingLevel(newGrouping);
    setPage(1);
    setSortColumn("groupKey");
  };
  
  // Handle time aggregation change
  const handleTimeAggregationChange = (newTime: TimeAggregation) => {
    setTimeAggregation(newTime);
    setPage(1);
  };
  
  // Export CSV
  const exportToCsv = () => {
    try {
      const csvData = sortedData;
      
      // Define columns based on grouping level and time aggregation
      let columns: string[] = ['groupKey'];
      
      // Add time column if not total aggregation
      if (timeAggregation !== 'total') {
        columns.push('timeKey');
      }
      
      // Add metric columns
      columns.push('IMPRESSIONS', 'CLICKS', 'CTR', 'TRANSACTIONS', 'REVENUE', 'SPEND', 'ROAS');
      
      // Generate CSV header row
      let csv = columns.join(',') + '\n';
      
      // Generate CSV data rows
      csvData.forEach(row => {
        const csvRow = columns.map(column => {
          let value = row[column];
          
          // Use displayName for groupKey when available (preserves original formatting)
          if (column === 'groupKey' && row.displayName) {
            value = row.displayName;
          }
          
          // Format values appropriately
          if (column === 'CTR') {
            return typeof value === 'number' ? `${value.toFixed(3)}%` : '0.000%';
          } else if (column === 'ROAS') {
            return typeof value === 'number' ? `${value.toFixed(1)}x` : '0.0x';
          } else if (column === 'REVENUE' || column === 'SPEND') {
            return typeof value === 'number' ? `$${value.toFixed(2)}` : '$0.00';
          } else if (typeof value === 'number') {
            return value.toString();
          } else if (typeof value === 'string' && value.includes(',')) {
            return `"${value}"`;
          }
          return value || '';
        }).join(',');
        
        csv += csvRow + '\n';
      });
      
      // Create downloadable blob
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      
      // Create download link and click it
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `campaign-data-${groupingLevel}-${timeAggregation}-${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error exporting CSV:", error);
    }
  };
  
  // Format value based on column type
  // Helper function to calculate period-over-period comparison
  const calculateComparison = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  // Format value with optional period comparison
  const formatColumnValue = (row: any, column: string, showComparison: boolean = false) => {
    if (!row) return '';
    
    const value = row[column];
    let formattedValue = '';
    
    switch (column) {
      case 'groupKey':
        return row.displayName || value || 'N/A';
      case 'timeKey':
        return value || 'N/A';
      case 'CTR':
        formattedValue = `${typeof value === 'number' ? value.toFixed(3) : '0.000'}%`;
        break;
      case 'ROAS':
        formattedValue = `${typeof value === 'number' ? value.toFixed(1) : '0.0'}x`;
        break;
      case 'REVENUE':
      case 'SPEND':
        formattedValue = `$${typeof value === 'number' ? value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}`;
        break;
      case 'IMPRESSIONS':
      case 'CLICKS':
      case 'TRANSACTIONS':
        formattedValue = typeof value === 'number' ? value.toLocaleString('en-US') : '0';
        break;
      default:
        return value || '';
    }
    
    // Add period comparison if enabled and data available
    if (showComparison && row.previousPeriod && row.previousPeriod[column] !== undefined) {
      const current = typeof value === 'number' ? value : 0;
      const previous = typeof row.previousPeriod[column] === 'number' ? row.previousPeriod[column] : 0;
      const change = calculateComparison(current, previous);
      
      let icon = <Minus className="h-3 w-3" />;
      let colorClass = 'text-gray-500';
      
      if (change > 0) {
        icon = <TrendingUp className="h-3 w-3" />;
        colorClass = 'text-green-600';
      } else if (change < 0) {
        icon = <TrendingDown className="h-3 w-3" />;
        colorClass = 'text-red-600';
      }
      
      return (
        <div className="flex flex-col items-end gap-1">
          <span>{formattedValue}</span>
          <div className={`flex items-center gap-1 text-xs ${colorClass}`}>
            {icon}
            <span>{change > 0 ? '+' : ''}{change.toFixed(1)}%</span>
          </div>
        </div>
      );
    }
    
    return formattedValue;
  };

  // Generate pagination items
  const renderPaginationItems = () => {
    const items = [];
    
    // Show first page
    items.push(
      <PaginationItem key="first">
        <PaginationLink 
          onClick={() => setPage(1)} 
          isActive={page === 1}
        >
          1
        </PaginationLink>
      </PaginationItem>
    );
    
    // Add ellipsis if needed
    if (page > 3) {
      items.push(
        <PaginationItem key="ellipsis-start">
          <PaginationEllipsis />
        </PaginationItem>
      );
    }
    
    // Add pages around current page
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      if (i <= totalPages && i >= 2) {
        items.push(
          <PaginationItem key={i}>
            <PaginationLink 
              onClick={() => setPage(i)} 
              isActive={page === i}
            >
              {i}
            </PaginationLink>
          </PaginationItem>
        );
      }
    }
    
    // Add ellipsis if needed
    if (page < totalPages - 2 && totalPages > 4) {
      items.push(
        <PaginationItem key="ellipsis-end">
          <PaginationEllipsis />
        </PaginationItem>
      );
    }
    
    // Show last page if it's not the only page
    if (totalPages > 1) {
      items.push(
        <PaginationItem key="last">
          <PaginationLink 
            onClick={() => setPage(totalPages)} 
            isActive={page === totalPages}
          >
            {totalPages}
          </PaginationLink>
        </PaginationItem>
      );
    }
    
    return items;
  };

  return (
    <div className="space-y-4">
      {/* Main Controls Row */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Primary Controls */}
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Group by:</Label>
            <Select value={groupingLevel} onValueChange={handleGroupingChange}>
              <SelectTrigger className="h-8 w-[120px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="campaign" className="text-xs">Campaign</SelectItem>
                <SelectItem value="advertiser" className="text-xs">Advertiser</SelectItem>
                <SelectItem value="agency" className="text-xs">Agency</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Time:</Label>
            <Select value={timeAggregation} onValueChange={handleTimeAggregationChange}>
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily" className="text-xs">Daily</SelectItem>
                <SelectItem value="weekly" className="text-xs">7-Day Rolling</SelectItem>
                <SelectItem value="monthly" className="text-xs">30-Day Rolling</SelectItem>
                <SelectItem value="total" className="text-xs">Total</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Secondary Controls */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              checked={showComparisons}
              onCheckedChange={setShowComparisons}
              disabled={timeAggregation === 'total'}
              id="show-comparisons"
            />
            <Label htmlFor="show-comparisons" className="text-xs text-muted-foreground">
              Show Comparisons
            </Label>
          </div>
          
          <div className="flex items-center gap-2">
            <Switch
              checked={includeAttributionOnly}
              onCheckedChange={setIncludeAttributionOnly}
              id="include-attribution"
            />
            <Label htmlFor="include-attribution" className="text-xs text-muted-foreground">
              Include attribution-only
            </Label>
          </div>
          
          <Button
            onClick={exportToCsv}
            variant="outline"
            size="sm"
            className="ml-2 text-xs"
          >
            <FileDown className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>
      
      <div className="w-full overflow-x-auto">
        <Table className="w-full table-fixed">
          <TableHeader>
            <TableRow className="text-xs">
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 py-1 px-3 w-[25%]"
                onClick={() => handleSort("groupKey")}
              >
                {groupingLevel === "campaign" ? "Campaign" : 
                 groupingLevel === "advertiser" ? "Advertiser" : "Agency"}
                {sortColumn === "groupKey" && (
                  <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                )}
              </TableHead>
              
              {timeAggregation !== "total" && (
                <TableHead 
                  className="cursor-pointer hover:bg-muted/50 py-1 px-3 text-right w-[15%]"
                  onClick={() => handleSort("timeKey")}
                >
                  {timeAggregation === "daily" ? "Date" :
                   timeAggregation === "weekly" ? "7-Day Period" :
                   timeAggregation === "monthly" ? "30-Day Period" : "Period"}
                  {sortColumn === "timeKey" && (
                    <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </TableHead>
              )}
              
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 text-right py-1 px-3 w-[10%]"
                onClick={() => handleSort("IMPRESSIONS")}
              >
                Impressions
                {sortColumn === "IMPRESSIONS" && (
                  <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                )}
              </TableHead>
              
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 text-right py-1 px-3 w-[8%]"
                onClick={() => handleSort("CLICKS")}
              >
                Clicks
                {sortColumn === "CLICKS" && (
                  <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                )}
              </TableHead>
              
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 text-right py-1 px-3 w-[8%]"
                onClick={() => handleSort("CTR")}
              >
                CTR
                {sortColumn === "CTR" && (
                  <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                )}
              </TableHead>
              
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 text-right py-1 px-3 w-[8%]"
                onClick={() => handleSort("TRANSACTIONS")}
              >
                Transactions
                {sortColumn === "TRANSACTIONS" && (
                  <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                )}
              </TableHead>
              
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 text-right py-1 px-3 w-[10%]"
                onClick={() => handleSort("REVENUE")}
              >
                Attributed Sales
                {sortColumn === "REVENUE" && (
                  <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                )}
              </TableHead>
              
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 text-right py-1 px-3 w-[10%]"
                onClick={() => handleSort("SPEND")}
              >
                Spend
                {sortColumn === "SPEND" && (
                  <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                )}
              </TableHead>
              
              <TableHead 
                className="cursor-pointer hover:bg-muted/50 text-right py-1 px-3 w-[8%]"
                onClick={() => handleSort("ROAS")}
              >
                ROAS
                {sortColumn === "ROAS" && (
                  <span className="ml-1">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                )}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.length > 0 ? (
              paginatedData.map((row, index) => (
                <TableRow key={`${row.groupKey}-${row.timeKey || 'total'}-${index}`} className="text-xs">
                  <TableCell className="font-medium py-1 px-3 truncate" title={row.displayName || row.groupKey}>
                    {row.displayName || row.groupKey}
                  </TableCell>
                  
                  {timeAggregation !== "total" && (
                    <TableCell className="py-1 px-3 text-right">{formatColumnValue(row, "timeKey")}</TableCell>
                  )}
                  
                  <TableCell className="text-right py-1 px-3">{formatColumnValue(row, "IMPRESSIONS", showComparisons)}</TableCell>
                  <TableCell className="text-right py-1 px-3">{formatColumnValue(row, "CLICKS", showComparisons)}</TableCell>
                  <TableCell className="text-right py-1 px-3">{formatColumnValue(row, "CTR", showComparisons)}</TableCell>
                  <TableCell className="text-right py-1 px-3">{formatColumnValue(row, "TRANSACTIONS", showComparisons)}</TableCell>
                  <TableCell className="text-right py-1 px-3">{formatColumnValue(row, "REVENUE", showComparisons)}</TableCell>
                  <TableCell className="text-right py-1 px-3">{formatColumnValue(row, "SPEND", showComparisons)}</TableCell>
                  <TableCell className="text-right py-1 px-3">{formatColumnValue(row, "ROAS", showComparisons)}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={timeAggregation === "total" ? 8 : 9} className="text-center py-1">
                  No data available
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      
      {/* Pagination */}
      {totalPages > 1 && (
        <Pagination className="mx-auto flex justify-center">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious 
                onClick={() => setPage(page > 1 ? page - 1 : 1)}
                className={page === 1 ? 'pointer-events-none opacity-50' : ''}
              />
            </PaginationItem>
            
            {renderPaginationItems()}
            
            <PaginationItem>
              <PaginationNext 
                onClick={() => setPage(page < totalPages ? page + 1 : totalPages)}
                className={page === totalPages ? 'pointer-events-none opacity-50' : ''}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
      
      {/* Bottom Controls */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 pt-2 border-t">
        <div className="text-sm text-muted-foreground">
          Showing {paginatedData.length} of {sortedData.length} results
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Rows per page:</span>
          <Select 
            value={rowsPerPage.toString()} 
            onValueChange={(value) => {
              setRowsPerPage(Number(value));
              setPage(1);
            }}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};

export default RawDataTableImproved;