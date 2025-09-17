import { useMemo, useState } from "react";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { TrendingUp, DollarSign, Eye, X, ChevronUp, ChevronDown } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine } from "recharts";
import { useCampaignFilter } from "@/contexts/CampaignFilterContext";
import { 
  generateDailyBreakdown, 
  generateForecastSummary, 
  DailyForecastData, 
  ForecastSummary,
  getAgencyType 
} from "@/utils/forecastCalculations";
import { formatNumber, parseDateString } from "@/lib/utils";

interface ForecastTabProps {
  data: any[];
}


const ForecastTab = ({ data }: ForecastTabProps) => {
  const { extractAgencyInfo } = useCampaignFilter();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedAgencyType, setSelectedAgencyType] = useState<'Direct' | 'Channel Partner' | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'change' | 'changeDollar'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Use today's date for forecast calculations so current month = September, previous = August
  const currentDate = useMemo(() => {
    return new Date(); // Use today's date (September 2025)
  }, []);

  // Generate forecast data
  const forecastData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    return generateDailyBreakdown(data, currentDate, extractAgencyInfo);
  }, [data, currentDate, extractAgencyInfo]);

  // Generate summary data
  const summaryData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    return generateForecastSummary(data, currentDate, extractAgencyInfo);
  }, [data, currentDate, extractAgencyInfo]);

  // Separate data by agency type
  const { directData, channelData } = useMemo(() => {
    const direct = forecastData
      .filter(row => row.agencyType === 'Direct')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    const channel = forecastData
      .filter(row => row.agencyType === 'Channel Partner')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    return { directData: direct, channelData: channel };
  }, [forecastData]);

  const formatCurrency = (value: number) => `$${formatNumber(value, { decimals: 0, abbreviate: false })}`;

  // Handle sorting
  const handleSort = (column: 'name' | 'change' | 'changeDollar') => {
    if (sortBy === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDirection('asc');
    }
  };

  // Calculate campaign-level details for modal
  const campaignDetails = useMemo(() => {
    if (!selectedAgencyType || !data || data.length === 0) return [];

    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    const previousMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    const previousMonthYear = previousMonth.getFullYear();
    const previousMonthNum = previousMonth.getMonth();

    // Group data by campaign
    const campaignGroups: Record<string, { 
      currentMonthSpend: number, 
      previousMonthSpend: number, 
      campaignName: string,
      agencyType: 'Direct' | 'Channel Partner'
    }> = {};

    data.forEach(row => {
      if (!row.DATE || row.DATE === 'Totals') return;
      
      const rowDate = parseDateString(row.DATE);
      if (!rowDate) return;

      const campaignName = row["CAMPAIGN ORDER NAME"] || "";
      const { abbreviation } = extractAgencyInfo(campaignName);
      const agencyType = getAgencyType(abbreviation);
      
      if (agencyType !== selectedAgencyType) return;

      const spend = Number(row.SPEND) || 0;

      if (!campaignGroups[campaignName]) {
        campaignGroups[campaignName] = {
          currentMonthSpend: 0,
          previousMonthSpend: 0,
          campaignName,
          agencyType
        };
      }

      // Current month data
      if (rowDate.getMonth() === currentMonth && rowDate.getFullYear() === currentYear) {
        campaignGroups[campaignName].currentMonthSpend += spend;
      }
      
      // Previous month data
      if (rowDate.getMonth() === previousMonthNum && rowDate.getFullYear() === previousMonthYear) {
        campaignGroups[campaignName].previousMonthSpend += spend;
      }
    });

    // Calculate forecasts for each campaign using the same logic as overall forecast
    const campaigns = Object.values(campaignGroups)
      .filter(campaign => campaign.currentMonthSpend > 0 || campaign.previousMonthSpend > 0)
      .map(campaign => {
        // Simple forecast: current MTD spend * (days in month / current day)
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const currentDayOfMonth = currentDate.getDate();
        const forecast = campaign.currentMonthSpend * (daysInMonth / currentDayOfMonth);
        
        return {
          ...campaign,
          forecast: forecast
        };
      });

    // Apply sorting
    return campaigns.sort((a, b) => {
      if (sortBy === 'name') {
        const nameA = a.campaignName.toLowerCase();
        const nameB = b.campaignName.toLowerCase();
        if (sortDirection === 'asc') {
          return nameA.localeCompare(nameB);
        } else {
          return nameB.localeCompare(nameA);
        }
      } else if (sortBy === 'change') {
        const changeA = a.previousMonthSpend > 0 ? ((a.forecast - a.previousMonthSpend) / a.previousMonthSpend) * 100 : 0;
        const changeB = b.previousMonthSpend > 0 ? ((b.forecast - b.previousMonthSpend) / b.previousMonthSpend) * 100 : 0;
        if (sortDirection === 'asc') {
          return changeA - changeB;
        } else {
          return changeB - changeA;
        }
      } else if (sortBy === 'changeDollar') {
        const changeDollarA = a.forecast - a.previousMonthSpend;
        const changeDollarB = b.forecast - b.previousMonthSpend;
        if (sortDirection === 'asc') {
          return changeDollarA - changeDollarB;
        } else {
          return changeDollarB - changeDollarA;
        }
      }
      return 0;
    });
  }, [data, selectedAgencyType, currentDate, extractAgencyInfo, sortBy, sortDirection]);

  // Render individual table for agency type
  const renderAgencyTable = (data: DailyForecastData[], agencyType: 'Direct' | 'Channel Partner', forecast: number) => (
    <Card>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center space-x-2">
            <Badge 
              variant={agencyType === 'Direct' ? 'default' : 'secondary'}
              className={agencyType === 'Direct' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}
            >
              {agencyType === 'Direct' ? 'MediaJel Direct' : 'Channel Partners'}
            </Badge>
            <span>({data.length} days)</span>
          </h3>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Month Forecast</div>
            <div className="text-xl font-bold">{formatCurrency(forecast)}</div>
          </div>
        </div>
        
        <div className="mb-3 text-xs text-muted-foreground">
          <strong>Daily Forecast</strong>: What the month forecast would have been on each day based on data available at that time
        </div>
        
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs py-2">Date</TableHead>
                <TableHead className="text-xs text-right py-2">Impressions</TableHead>
                <TableHead className="text-xs text-right py-2">Spend</TableHead>
                <TableHead className="text-xs text-right py-2">Daily Forecast</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row, index) => (
                <TableRow 
                  key={`${row.date}-${row.agencyType}`}
                  className={row.isProjection ? 'bg-muted/50' : ''}
                >
                  <TableCell className="font-medium py-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm">
                        {new Date(row.date).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </span>
                      {row.isProjection && (
                        <Badge variant="outline" className="text-xs">
                          Projected
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-sm py-1">
                    {row.impressions > 0 ? formatNumber(row.impressions, { decimals: 0, abbreviate: false }) : '-'}
                  </TableCell>
                  <TableCell className="text-right text-sm py-1">
                    {row.spend > 0 ? formatCurrency(row.spend) : '-'}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium py-1">
                    {formatCurrency(row.dailyForecast)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        
        {data.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No data available for {agencyType === 'Direct' ? 'MediaJel Direct' : 'Channel Partners'}
          </div>
        )}
      </div>
    </Card>
  );

  // Calculate total forecasts for display and previous month comparisons
  const totalForecasts = useMemo(() => {
    const directSummary = summaryData.find(s => s.agencyType === 'Direct');
    const channelSummary = summaryData.find(s => s.agencyType === 'Channel Partner');
    
    // Calculate previous month's actuals
    const previousMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    const previousMonthYear = previousMonth.getFullYear();
    const previousMonthNum = previousMonth.getMonth();
    
    const previousMonthData = data.filter(row => {
      if (!row.DATE || row.DATE === 'Totals') return false;
      const rowDate = parseDateString(row.DATE);
      if (!rowDate) return false;
      const isMatch = rowDate.getMonth() === previousMonthNum && rowDate.getFullYear() === previousMonthYear;
      return isMatch;
    });

    console.log('🔍 Month-over-month debug info:');
    console.log('Current date:', currentDate.toDateString());
    console.log('Current month:', currentDate.getMonth(), 'Year:', currentDate.getFullYear());
    console.log('Previous month:', previousMonthNum, 'Year:', previousMonthYear);
    console.log('Previous month data rows:', previousMonthData.length);

    // Debug: Show some sample dates from data
    const sampleDates = data.slice(0, 5).map(row => ({ date: row.DATE, parsed: parseDateString(row.DATE) }));
    console.log('Sample data dates:', sampleDates);
    
    // Calculate previous month totals by agency type
    let prevDirectSpend = 0;
    let prevChannelSpend = 0;
    
    previousMonthData.forEach(row => {
      const campaignName = row["CAMPAIGN ORDER NAME"] || "";
      const { abbreviation } = extractAgencyInfo(campaignName);
      const agencyType = getAgencyType(abbreviation);
      const spend = Number(row.SPEND) || 0;

      if (agencyType === 'Direct') {
        prevDirectSpend += spend;
      } else {
        prevChannelSpend += spend;
      }
    });

    console.log('🔍 Previous month spend totals:');
    console.log('Previous Direct spend:', prevDirectSpend);
    console.log('Previous Channel spend:', prevChannelSpend);
    
    const prevTotal = prevDirectSpend + prevChannelSpend;
    const currentDirect = directSummary?.forecastSpend || 0;
    const currentChannel = channelSummary?.forecastSpend || 0;
    const currentTotal = currentDirect + currentChannel;

    console.log('🔍 Current month forecast totals:');
    console.log('Current Direct forecast:', currentDirect);
    console.log('Current Channel forecast:', currentChannel);
    console.log('Current Total forecast:', currentTotal);
    
    // Debug the final calculation results
    const result = {
      direct: currentDirect,
      channel: currentChannel,
      total: currentTotal,
      prevDirect: prevDirectSpend,
      prevChannel: prevChannelSpend,
      prevTotal: prevTotal,
      directChange: prevDirectSpend > 0 ? ((currentDirect - prevDirectSpend) / prevDirectSpend) * 100 : 0,
      channelChange: prevChannelSpend > 0 ? ((currentChannel - prevChannelSpend) / prevChannelSpend) * 100 : 0,
      totalChange: prevTotal > 0 ? ((currentTotal - prevTotal) / prevTotal) * 100 : 0
    };

    console.log('🔍 Final month-over-month calculation results:');
    console.log('Direct change calculation:', {
      current: currentDirect,
      previous: prevDirectSpend,
      change: result.directChange,
      formula: `((${currentDirect} - ${prevDirectSpend}) / ${prevDirectSpend}) * 100`
    });
    console.log('Channel change calculation:', {
      current: currentChannel,
      previous: prevChannelSpend,
      change: result.channelChange,
      formula: `((${currentChannel} - ${prevChannelSpend}) / ${prevChannelSpend}) * 100`
    });

    return result;
  }, [summaryData, data, currentDate, extractAgencyInfo]);

  // Prepare chart data - forecast line showing daily forecast values (same as tables)
  const chartData = useMemo(() => {
    if (!forecastData || forecastData.length === 0) return [];
    
    // Group by date and aggregate the daily forecast values by agency type
    const dateGroups = forecastData.reduce((acc, row) => {
      if (!acc[row.date]) {
        acc[row.date] = {
          date: row.date,
          dayOfMonth: new Date(row.date).getDate(),
          directForecast: null,
          channelForecast: null,
          directForecastProjected: null,
          channelForecastProjected: null,
          isProjection: row.isProjection
        };
      }
      
      if (row.agencyType === 'Direct') {
        if (row.isProjection) {
          acc[row.date].directForecastProjected = row.dailyForecast;
        } else {
          acc[row.date].directForecast = row.dailyForecast;
        }
      } else {
        if (row.isProjection) {
          acc[row.date].channelForecastProjected = row.dailyForecast;
        } else {
          acc[row.date].channelForecast = row.dailyForecast;
        }
      }
      
      return acc;
    }, {} as Record<string, any>);
    
    return Object.values(dateGroups).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [forecastData]);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card 
          className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => {
            setSelectedAgencyType('Direct');
            setModalOpen(true);
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              <div>
                <div className="text-sm text-muted-foreground">Direct Forecast</div>
                <div className="text-2xl font-bold text-blue-600">
                  {formatCurrency(totalForecasts.direct)}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">vs Last Month</div>
              <div className={`text-sm font-medium ${totalForecasts.directChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {totalForecasts.directChange >= 0 ? '+' : ''}{totalForecasts.directChange.toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground">
                ({formatCurrency(totalForecasts.prevDirect)})
              </div>
            </div>
          </div>
        </Card>

        <Card 
          className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => {
            setSelectedAgencyType('Channel Partner');
            setModalOpen(true);
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <div>
                <div className="text-sm text-muted-foreground">Channel Forecast</div>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(totalForecasts.channel)}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">vs Last Month</div>
              <div className={`text-sm font-medium ${totalForecasts.channelChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {totalForecasts.channelChange >= 0 ? '+' : ''}{totalForecasts.channelChange.toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground">
                ({formatCurrency(totalForecasts.prevChannel)})
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-5 w-5 text-purple-600" />
              <div>
                <div className="text-sm text-muted-foreground">Total Forecast</div>
                <div className="text-2xl font-bold text-purple-600">
                  {formatCurrency(totalForecasts.total)}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">vs Last Month</div>
              <div className={`text-sm font-medium ${totalForecasts.totalChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {totalForecasts.totalChange >= 0 ? '+' : ''}{totalForecasts.totalChange.toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground">
                ({formatCurrency(totalForecasts.prevTotal)})
              </div>
            </div>
          </div>
        </Card>
      </div>


      {/* Forecast Chart */}
      {chartData.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Monthly Forecast</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis 
                  dataKey="dayOfMonth" 
                  type="number"
                  scale="linear"
                  domain={['dataMin', 'dataMax']}
                  tickCount={Math.min(chartData.length, 15)}
                />
                <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`} />
                <Tooltip 
                  formatter={(value: number, name: string) => {
                    if (!value) return ['--', name];
                    return [
                      formatCurrency(value),
                      name.includes('directForecast') ? 'MediaJel Direct' : 'Channel Partners'
                    ];
                  }}
                  labelFormatter={(label) => `Day ${label}`}
                />
                <Legend />
                
                {/* Current date reference line */}
                <ReferenceLine 
                  x={currentDate.getDate()} 
                  stroke="#666" 
                  strokeDasharray="2 2"
                  label={{ value: "Today", position: "top" }}
                />
                
                {/* Actual data lines (solid) */}
                <Line 
                  type="monotone" 
                  dataKey="directForecast" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  name="MediaJel Direct"
                  connectNulls={false}
                  dot={false}
                />
                <Line 
                  type="monotone" 
                  dataKey="channelForecast" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  name="Channel Partners"
                  connectNulls={false}
                  dot={false}
                />
                
                {/* Projected data lines (dotted) */}
                <Line 
                  type="monotone" 
                  dataKey="directForecastProjected" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="MediaJel Direct"
                  connectNulls={false}
                  dot={false}
                />
                <Line 
                  type="monotone" 
                  dataKey="channelForecastProjected" 
                  stroke="#10b981" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="Channel Partners"
                  connectNulls={false}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 text-sm text-muted-foreground">
            * Chart shows actual spend through today, with remaining days projected based on current trends
          </div>
        </Card>
      )}

      {/* Side-by-Side Forecast Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* MediaJel Direct Table */}
        {renderAgencyTable(directData, 'Direct', totalForecasts.direct)}
        
        {/* Channel Partners Table */}
        {renderAgencyTable(channelData, 'Channel Partner', totalForecasts.channel)}
      </div>
      
      {directData.length === 0 && channelData.length === 0 && (
        <div className="text-center py-8">
          <Card className="p-8">
            <div className="text-muted-foreground">
              No forecast data available. Please ensure you have uploaded campaign data.
            </div>
          </Card>
        </div>
      )}

      {/* Campaign Details Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-[1000px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Badge 
                variant={selectedAgencyType === 'Direct' ? 'default' : 'secondary'}
                className={selectedAgencyType === 'Direct' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}
              >
                {selectedAgencyType === 'Direct' ? 'MediaJel Direct' : 'Channel Partners'}
              </Badge>
              <span>Campaign Forecast Details</span>
            </DialogTitle>
          </DialogHeader>
          
          <div className="mt-4">
            {campaignDetails.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <Button
                        variant="ghost"
                        className="h-auto p-0 font-semibold hover:bg-transparent"
                        onClick={() => handleSort('name')}
                      >
                        <span className="flex items-center space-x-1">
                          <span>Campaign Name</span>
                          {sortBy === 'name' && (
                            sortDirection === 'asc' ? 
                              <ChevronUp className="h-4 w-4" /> : 
                              <ChevronDown className="h-4 w-4" />
                          )}
                        </span>
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">Current Month Forecast</TableHead>
                    <TableHead className="text-right">Last Month Actual</TableHead>
                    <TableHead className="text-right">
                      <Button
                        variant="ghost"
                        className="h-auto p-0 font-semibold hover:bg-transparent ml-auto flex"
                        onClick={() => handleSort('changeDollar')}
                      >
                        <span className="flex items-center space-x-1">
                          <span>Change $</span>
                          {sortBy === 'changeDollar' && (
                            sortDirection === 'asc' ? 
                              <ChevronUp className="h-4 w-4" /> : 
                              <ChevronDown className="h-4 w-4" />
                          )}
                        </span>
                      </Button>
                    </TableHead>
                    <TableHead className="text-right">
                      <Button
                        variant="ghost"
                        className="h-auto p-0 font-semibold hover:bg-transparent ml-auto flex"
                        onClick={() => handleSort('change')}
                      >
                        <span className="flex items-center space-x-1">
                          <span>Change %</span>
                          {sortBy === 'change' && (
                            sortDirection === 'asc' ? 
                              <ChevronUp className="h-4 w-4" /> : 
                              <ChevronDown className="h-4 w-4" />
                          )}
                        </span>
                      </Button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaignDetails.map((campaign, index) => {
                    const changeDollar = campaign.forecast - campaign.previousMonthSpend;
                    const changePercent = campaign.previousMonthSpend > 0 
                      ? ((campaign.forecast - campaign.previousMonthSpend) / campaign.previousMonthSpend) * 100 
                      : 0;
                    
                    return (
                      <TableRow key={index}>
                        <TableCell className="font-medium max-w-xs">
                          <div className="truncate" title={campaign.campaignName}>
                            {campaign.campaignName}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(campaign.forecast)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(campaign.previousMonthSpend)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`font-medium ${changeDollar >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {changeDollar >= 0 ? '+' : ''}{formatCurrency(Math.abs(changeDollar))}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`font-medium ${changePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {changePercent >= 0 ? '+' : ''}{changePercent.toFixed(1)}%
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No campaign data available for {selectedAgencyType === 'Direct' ? 'MediaJel Direct' : 'Channel Partners'}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default ForecastTab;