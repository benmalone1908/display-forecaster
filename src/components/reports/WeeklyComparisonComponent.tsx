import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DateRange } from 'react-day-picker';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface WeeklyData {
  periodStart: Date;
  periodEnd: Date;
  IMPRESSIONS: number;
  CLICKS: number;
  REVENUE: number;
  TRANSACTIONS: number;
}

interface WeeklyComparisonComponentProps {
  data: any[];
  period: '7-day' | '14-day' | '30-day';
  dateRange: DateRange;
  title: string;
}

const WeeklyComparisonComponent: React.FC<WeeklyComparisonComponentProps> = ({
  data,
  period,
  dateRange,
  title
}) => {
  const periodDays = parseInt(period.split('-')[0]);

  const weeklyData = useMemo(() => {
    // Filter data by date range
    const filteredData = data.filter(row => {
      if (!row.DATE || row.DATE === 'Totals') return false;
      const rowDate = new Date(row.DATE);
      return (!dateRange.from || rowDate >= dateRange.from) && 
             (!dateRange.to || rowDate <= dateRange.to);
    });

    // Process data with dates
    const rowsWithDates = filteredData.map((row: any) => ({
      ...row,
      parsedDate: new Date(row.DATE)
    })).filter(row => !isNaN(row.parsedDate.getTime()));

    if (rowsWithDates.length === 0) {
      return [];
    }

    const dates = rowsWithDates.map(row => row.parsedDate);
    const mostRecentDate = new Date(Math.max(...dates.map(d => d.getTime())));
    const earliestDate = new Date(Math.min(...dates.map(d => d.getTime())));
    
    const totalDays = Math.floor((mostRecentDate.getTime() - earliestDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const completePeriods = Math.floor(totalDays / periodDays);
    
    if (completePeriods < 1) {
      return [];
    }

    const periods: WeeklyData[] = [];
    
    // Calculate non-overlapping periods
    let currentPeriodEnd = new Date(mostRecentDate);
    for (let i = 0; i < completePeriods; i++) {
      const periodEnd = new Date(currentPeriodEnd);
      const periodStart = new Date(periodEnd);
      periodStart.setDate(periodStart.getDate() - (periodDays - 1));
      
      if (periodStart < earliestDate) {
        continue;
      }
      
      const periodStartStr = periodStart.toISOString().split('T')[0];
      const periodEndStr = periodEnd.toISOString().split('T')[0];
      
      // Filter data for this period
      const periodRows = rowsWithDates.filter(row => {
        const rowDateStr = row.parsedDate.toISOString().split('T')[0];
        return rowDateStr >= periodStartStr && rowDateStr <= periodEndStr;
      });
      
      // Aggregate metrics for this period
      const aggregated = periodRows.reduce((acc, row) => ({
        IMPRESSIONS: acc.IMPRESSIONS + (+(row.IMPRESSIONS) || 0),
        CLICKS: acc.CLICKS + (+(row.CLICKS) || 0),
        REVENUE: acc.REVENUE + (+(row.REVENUE) || 0),
        TRANSACTIONS: acc.TRANSACTIONS + (+(row.TRANSACTIONS) || 0)
      }), {
        IMPRESSIONS: 0,
        CLICKS: 0,
        REVENUE: 0,
        TRANSACTIONS: 0
      });
      
      periods.push({
        periodStart,
        periodEnd,
        ...aggregated
      });
      
      // Move to next period (non-overlapping)
      currentPeriodEnd.setDate(currentPeriodEnd.getDate() - periodDays);
    }
    
    return periods;
  }, [data, dateRange, periodDays]);

  const formatNumber = (value: number): string => value.toLocaleString();
  const formatCurrency = (value: number): string => `$${Math.round(value).toLocaleString()}`;
  const formatPercentage = (value: number): string => `${value.toFixed(2)}%`;
  const formatDate = (date: Date): string => `${date.getMonth() + 1}/${date.getDate()}`;
  
  const calculateCTR = (clicks: number, impressions: number): number => {
    return impressions > 0 ? (clicks / impressions) * 100 : 0;
  };
  
  const calculateAOV = (revenue: number, transactions: number): number => {
    return transactions > 0 ? revenue / transactions : 0;
  };

  const calculatePercentageChange = (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const getTrendIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (change < 0) return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-gray-400" />;
  };

  const getTrendColor = (change: number) => {
    if (change > 0) return "text-green-600";
    if (change < 0) return "text-red-600";
    return "text-gray-400";
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {weeklyData.length >= 1 ? (
          <ScrollArea className={`${weeklyData.length > 3 ? 'h-[400px]' : 'h-auto max-h-[400px]'}`}>
            <div className="grid gap-4 pb-4 pr-4">
              {weeklyData.map((period, index) => {
                const previousPeriod = weeklyData[index + 1];
                const periodLabel = `${formatDate(period.periodStart)} - ${formatDate(period.periodEnd)}`;
                
                const ctr = calculateCTR(period.CLICKS, period.IMPRESSIONS);
                const previousCtr = previousPeriod ? calculateCTR(previousPeriod.CLICKS, previousPeriod.IMPRESSIONS) : 0;
                
                const transactions = period.TRANSACTIONS || Math.round(period.REVENUE / 50);
                const previousTransactions = previousPeriod ? (previousPeriod.TRANSACTIONS || Math.round(previousPeriod.REVENUE / 50)) : 0;
                
                const aov = calculateAOV(period.REVENUE, transactions);
                const previousAov = previousPeriod ? calculateAOV(previousPeriod.REVENUE, previousTransactions) : 0;
                
                const metrics = [
                  {
                    title: "Impressions",
                    current: period.IMPRESSIONS,
                    previous: previousPeriod?.IMPRESSIONS,
                    format: formatNumber
                  },
                  {
                    title: "Clicks",
                    current: period.CLICKS,
                    previous: previousPeriod?.CLICKS,
                    format: formatNumber
                  },
                  {
                    title: "CTR",
                    current: ctr,
                    previous: previousCtr,
                    format: formatPercentage
                  },
                  {
                    title: "Attributed Sales",
                    current: period.REVENUE,
                    previous: previousPeriod?.REVENUE,
                    format: formatCurrency
                  },
                  {
                    title: "Transactions",
                    current: transactions,
                    previous: previousTransactions,
                    format: formatNumber
                  },
                  {
                    title: "AOV",
                    current: aov,
                    previous: previousAov,
                    format: formatCurrency
                  }
                ];

                return (
                  <Card key={index} className="p-4">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-semibold text-base">{periodLabel}</h4>
                      <span className="text-sm text-muted-foreground">
                        Period {index + 1}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                      {metrics.map((metric, metricIndex) => {
                        const change = metric.previous !== undefined 
                          ? calculatePercentageChange(metric.current, metric.previous)
                          : 0;
                        
                        return (
                          <div key={metricIndex} className="text-center">
                            <div className="text-xs text-muted-foreground mb-1">
                              {metric.title}
                            </div>
                            <div className="font-semibold text-sm mb-1">
                              {metric.format(metric.current)}
                            </div>
                            {metric.previous !== undefined && metric.previous > 0 && (
                              <div className={`flex items-center justify-center gap-1 text-xs ${getTrendColor(change)}`}>
                                {getTrendIcon(change)}
                                <span>{Math.abs(change).toFixed(1)}%</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>No periods available for the selected date range.</p>
            <p className="text-sm mt-1">Need at least {periodDays} days of data to show periods.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WeeklyComparisonComponent;