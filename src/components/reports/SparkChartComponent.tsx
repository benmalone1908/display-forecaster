import React, { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { LineChart, Line, Area, AreaChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { DateRange } from 'react-day-picker';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface SparkChartComponentProps {
  data: any[];
  metric: string;
  dateRange: DateRange;
  title: string;
  simplified?: boolean;
}

const SparkChartComponent: React.FC<SparkChartComponentProps> = ({
  data,
  metric,
  dateRange,
  title,
  simplified = false
}) => {
  // Process data for the specific metric
  const processedData = useMemo(() => {
    const dateGroups = new Map<string, any>();
    
    // Filter data by date range
    const filteredData = data.filter(row => {
      if (!row.DATE || row.DATE === 'Totals') return false;
      const rowDate = new Date(row.DATE);
      return (!dateRange.from || rowDate >= dateRange.from) && 
             (!dateRange.to || rowDate <= dateRange.to);
    });

    // Group by date
    filteredData.forEach(row => {
      const dateStr = String(row.DATE).trim();
      if (!dateGroups.has(dateStr)) {
        dateGroups.set(dateStr, {
          date: dateStr,
          IMPRESSIONS: 0,
          CLICKS: 0,
          REVENUE: 0,
          TRANSACTIONS: 0,
          SPEND: 0
        });
      }
      
      const group = dateGroups.get(dateStr)!;
      group.IMPRESSIONS += +(row.IMPRESSIONS) || 0;
      group.CLICKS += +(row.CLICKS) || 0;
      group.REVENUE += +(row.REVENUE) || 0;
      group.TRANSACTIONS += +(row.TRANSACTIONS) || 0;
      group.SPEND += +(row.SPEND) || 0;
    });

    // Convert to array and calculate derived metrics
    return Array.from(dateGroups.values())
      .map(d => ({
        ...d,
        CTR: d.IMPRESSIONS > 0 ? (d.CLICKS / d.IMPRESSIONS) * 100 : 0,
        ROAS: d.SPEND > 0 ? d.REVENUE / d.SPEND : 0
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [data, dateRange]);

  // Calculate totals and trends
  const stats = useMemo(() => {
    if (processedData.length === 0) {
      return { total: 0, trend: 0, color: '#4ade80', formatter: (v: number) => v.toString() };
    }

    let total = 0;
    let trend = 0;
    let color = '#4ade80';
    let formatter = (v: number) => v.toLocaleString();

    switch (metric) {
      case 'impressions':
        total = processedData.reduce((sum, d) => sum + d.IMPRESSIONS, 0);
        if (processedData.length >= 2) {
          const last = processedData[processedData.length - 1].IMPRESSIONS;
          const prev = processedData[processedData.length - 2].IMPRESSIONS;
          trend = prev > 0 ? ((last - prev) / prev) * 100 : 0;
        }
        color = '#4ade80';
        break;

      case 'clicks':
        total = processedData.reduce((sum, d) => sum + d.CLICKS, 0);
        if (processedData.length >= 2) {
          const last = processedData[processedData.length - 1].CLICKS;
          const prev = processedData[processedData.length - 2].CLICKS;
          trend = prev > 0 ? ((last - prev) / prev) * 100 : 0;
        }
        color = '#f59e0b';
        break;

      case 'ctr':
        total = processedData.length > 0 ? 
          processedData.reduce((sum, d) => sum + d.CTR, 0) / processedData.length : 0;
        if (processedData.length >= 2) {
          const last = processedData[processedData.length - 1].CTR;
          const prev = processedData[processedData.length - 2].CTR;
          trend = prev > 0 ? ((last - prev) / prev) * 100 : 0;
        }
        color = '#0ea5e9';
        formatter = (v: number) => `${v.toFixed(2)}%`;
        break;

      case 'transactions':
        total = processedData.reduce((sum, d) => sum + d.TRANSACTIONS, 0);
        if (processedData.length >= 2) {
          const last = processedData[processedData.length - 1].TRANSACTIONS;
          const prev = processedData[processedData.length - 2].TRANSACTIONS;
          trend = prev > 0 ? ((last - prev) / prev) * 100 : 0;
        }
        color = '#8b5cf6';
        break;

      case 'revenue':
        total = processedData.reduce((sum, d) => sum + d.REVENUE, 0);
        if (processedData.length >= 2) {
          const last = processedData[processedData.length - 1].REVENUE;
          const prev = processedData[processedData.length - 2].REVENUE;
          trend = prev > 0 ? ((last - prev) / prev) * 100 : 0;
        }
        color = '#ef4444';
        formatter = (v: number) => `$${Math.round(v).toLocaleString()}`;
        break;

      case 'roas':
        const totalRevenue = processedData.reduce((sum, d) => sum + d.REVENUE, 0);
        const totalSpend = processedData.reduce((sum, d) => sum + d.SPEND, 0);
        total = totalSpend > 0 ? totalRevenue / totalSpend : 0;
        if (processedData.length >= 2) {
          const last = processedData[processedData.length - 1].ROAS;
          const prev = processedData[processedData.length - 2].ROAS;
          trend = prev > 0 ? ((last - prev) / prev) * 100 : 0;
        }
        color = '#d946ef';
        formatter = (v: number) => v.toFixed(2);
        break;
    }

    return { total, trend, color, formatter };
  }, [processedData, metric]);

  const dataKey = metric.toUpperCase();
  const gradientId = `gradient-${metric}-${Math.random().toString(36).substr(2, 9)}`;

  const getMetricDisplayName = (metric: string) => {
    const upperMetric = metric.toUpperCase();
    if (upperMetric === 'CTR' || upperMetric === 'ROAS') {
      return upperMetric;
    }
    return metric.charAt(0).toUpperCase() + metric.slice(1);
  };

  if (simplified) {
    return (
      <Card className="p-4 pb-2">
        <div className="mb-3">
          <h4 className="text-sm font-semibold">{getMetricDisplayName(metric)}</h4>
          <p className="text-xs text-muted-foreground">
            {dateRange.from?.toLocaleDateString()} - {dateRange.to?.toLocaleDateString()}
          </p>
        </div>

        <div className="h-[120px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={processedData} margin={{ top: 2, right: 5, left: 5, bottom: -15 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={stats.color} stopOpacity={0.8}/>
                  <stop offset="95%" stopColor={stats.color} stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="date" 
                axisLine={false}
                tickLine={false}
                tick={false}
              />
              <YAxis hide />
              <Area
                type="monotone"
                dataKey={dataKey}
                stroke={stats.color}
                strokeWidth={2}
                fill={`url(#${gradientId})`}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">
          {dateRange.from?.toLocaleDateString()} - {dateRange.to?.toLocaleDateString()}
        </p>
      </div>

      <div className="flex justify-between items-start mb-4">
        <div>
          <h4 className="text-sm font-medium">{getMetricDisplayName(metric)}</h4>
          <div className="text-2xl font-bold mt-1">
            {stats.formatter(stats.total)}
          </div>
        </div>
        
        <div className="flex items-center text-sm">
          {stats.trend > 0 ? (
            <TrendingUp className="h-4 w-4 text-green-600 mr-1" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-600 mr-1" />
          )}
          <span className={stats.trend > 0 ? "text-green-600" : "text-red-600"}>
            {Math.abs(stats.trend).toFixed(1)}%
          </span>
        </div>
      </div>

      <div className="h-[120px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={processedData}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={stats.color} stopOpacity={0.8}/>
                <stop offset="95%" stopColor={stats.color} stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="date" 
              axisLine={false}
              tickLine={false}
              tick={false}
            />
            <YAxis hide />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={stats.color}
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};

export default SparkChartComponent;