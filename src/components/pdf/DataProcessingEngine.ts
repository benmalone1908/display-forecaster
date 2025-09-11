import { ChartInstance, ChartFilters, DataProcessingResult, ViewMode } from './enhanced-types';
import { DateRange } from 'react-day-picker';

export class DataProcessingEngine {
  private baseData: any[];
  private pacingData: any[];
  private contractTermsData: any[];
  private cache: Map<string, DataProcessingResult> = new Map();

  constructor(baseData: any[], pacingData: any[] = [], contractTermsData: any[] = []) {
    this.baseData = baseData;
    this.pacingData = pacingData;
    this.contractTermsData = contractTermsData;
  }

  // Update base data and clear cache
  updateData(baseData: any[], pacingData: any[] = [], contractTermsData: any[] = []) {
    this.baseData = baseData;
    this.pacingData = pacingData;
    this.contractTermsData = contractTermsData;
    this.clearCache();
  }

  // Process data for a specific chart instance
  processInstanceData(instance: ChartInstance): DataProcessingResult {
    const cacheKey = this.generateCacheKey(instance);
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // Process data based on template type
    let result: DataProcessingResult;

    if (instance.templateId.startsWith('metric_')) {
      result = this.processMetricData(instance);
    } else if (instance.templateId.startsWith('trend_')) {
      result = this.processTrendData(instance);
    } else if (instance.templateId.startsWith('analysis_')) {
      result = this.processAnalysisData(instance);
    } else if (instance.templateId.startsWith('data_')) {
      result = this.processDataTableData(instance);
    } else {
      result = this.processGenericData(instance);
    }

    // Cache the result
    this.cache.set(cacheKey, result);
    return result;
  }

  // Process metric-specific data (impressions, clicks, etc.)
  private processMetricData(instance: ChartInstance): DataProcessingResult {
    const filteredData = this.applyFilters(this.baseData, instance.filters);
    
    // Get metric type from template ID
    const metricType = instance.templateId.replace('metric_', '').toUpperCase();
    
    // Aggregate by date or day of week
    const aggregatedData = this.aggregateData(filteredData, instance.settings.viewMode || 'date');
    
    // Calculate summary metrics
    const summary = this.calculateSummaryMetrics(filteredData, metricType);

    return {
      data: aggregatedData,
      summary: {
        totalRows: filteredData.length,
        dateRange: this.getDateRange(filteredData),
        metrics: summary
      }
    };
  }

  // Process trend analysis data
  private processTrendData(instance: ChartInstance): DataProcessingResult {
    const filteredData = this.applyFilters(this.baseData, instance.filters);
    
    let processedData: any[] = [];

    if (instance.templateId === 'trend_combined_metrics') {
      processedData = this.aggregateData(filteredData, instance.settings.viewMode || 'date');
    } else if (instance.templateId === 'trend_weekly_comparison') {
      processedData = this.generateWeeklyComparison(filteredData);
    } else if (instance.templateId === 'trend_campaign_sparklines') {
      processedData = this.generateCampaignSparklines(filteredData, instance.settings.viewMode || 'date');
    }

    const summary = this.calculateComprehensiveSummary(filteredData);

    return {
      data: processedData,
      summary: {
        totalRows: filteredData.length,
        dateRange: this.getDateRange(filteredData),
        metrics: summary
      }
    };
  }

  // Process analysis data (health, pacing, etc.)
  private processAnalysisData(instance: ChartInstance): DataProcessingResult {
    let processedData: any[] = [];
    let sourceData: any[] = [];

    if (instance.templateId === 'analysis_health_scatter') {
      sourceData = this.applyFilters(this.baseData, instance.filters);
      processedData = this.generateHealthAnalysis(sourceData, this.pacingData, this.contractTermsData);
    } else if (instance.templateId === 'analysis_pacing_table') {
      sourceData = this.applyFilters(this.pacingData, instance.filters, 'Campaign');
      processedData = sourceData;
    }

    const summary = this.calculateComprehensiveSummary(sourceData);

    return {
      data: processedData,
      summary: {
        totalRows: sourceData.length,
        dateRange: this.getDateRange(sourceData),
        metrics: summary
      }
    };
  }

  // Process raw data table
  private processDataTableData(instance: ChartInstance): DataProcessingResult {
    const filteredData = this.applyFilters(this.baseData, instance.filters);
    const summary = this.calculateComprehensiveSummary(filteredData);

    return {
      data: filteredData,
      summary: {
        totalRows: filteredData.length,
        dateRange: this.getDateRange(filteredData),
        metrics: summary
      }
    };
  }

  // Generic data processing
  private processGenericData(instance: ChartInstance): DataProcessingResult {
    const filteredData = this.applyFilters(this.baseData, instance.filters);
    const summary = this.calculateComprehensiveSummary(filteredData);

    return {
      data: filteredData,
      summary: {
        totalRows: filteredData.length,
        dateRange: this.getDateRange(filteredData),
        metrics: summary
      }
    };
  }

  // Apply filters to data
  private applyFilters(data: any[], filters: ChartFilters, campaignColumn: string = 'CAMPAIGN ORDER NAME'): any[] {
    let filtered = [...data];

    // Date range filter
    if (filters.dateRange?.from) {
      const fromDate = filters.dateRange.from;
      const toDate = filters.dateRange.to || new Date();
      
      filtered = filtered.filter(row => {
        if (!row.DATE || row.DATE === 'Totals') return false;
        const rowDate = this.parseDate(row.DATE);
        return rowDate && rowDate >= fromDate && rowDate <= toDate;
      });
    }

    // Campaign type filter
    if (filters.campaignType !== 'all') {
      filtered = filtered.filter(row => {
        const campaignName = row[campaignColumn] || '';
        // This would need to be implemented based on your campaign naming conventions
        // For now, just return all data
        return true;
      });
    }

    // Agency filter
    if (filters.agencies.length > 0) {
      filtered = filtered.filter(row => {
        const campaignName = row[campaignColumn] || '';
        const agency = this.extractAgency(campaignName);
        return filters.agencies.includes(agency);
      });
    }

    // Advertiser filter
    if (filters.advertisers.length > 0) {
      filtered = filtered.filter(row => {
        const campaignName = row[campaignColumn] || '';
        const advertiser = this.extractAdvertiser(campaignName);
        return filters.advertisers.includes(advertiser);
      });
    }

    // Campaign filter
    if (filters.campaigns.length > 0) {
      filtered = filtered.filter(row => {
        const campaignName = row[campaignColumn] || '';
        return filters.campaigns.includes(campaignName);
      });
    }

    return filtered;
  }

  // Aggregate data by time period
  private aggregateData(data: any[], viewMode: ViewMode): any[] {
    const grouped: Record<string, any> = {};

    data.forEach(row => {
      let key: string;
      
      if (viewMode === 'dayOfWeek') {
        const date = this.parseDate(row.DATE);
        key = date ? this.getDayOfWeek(date) : 'Unknown';
      } else {
        key = row.DATE || 'Unknown';
      }

      if (!grouped[key]) {
        grouped[key] = {
          date: key,
          IMPRESSIONS: 0,
          CLICKS: 0,
          TRANSACTIONS: 0,
          REVENUE: 0,
          SPEND: 0,
          count: 0
        };
      }

      grouped[key].IMPRESSIONS += Number(row.IMPRESSIONS) || 0;
      grouped[key].CLICKS += Number(row.CLICKS) || 0;
      grouped[key].TRANSACTIONS += Number(row.TRANSACTIONS) || 0;
      grouped[key].REVENUE += Number(row.REVENUE) || 0;
      grouped[key].SPEND += Number(row.SPEND) || 0;
      grouped[key].count += 1;
    });

    // Calculate derived metrics
    return Object.values(grouped).map(item => ({
      ...item,
      CTR: item.IMPRESSIONS > 0 ? (item.CLICKS / item.IMPRESSIONS) * 100 : 0,
      ROAS: item.SPEND > 0 ? item.REVENUE / item.SPEND : 0,
      CPA: item.TRANSACTIONS > 0 ? item.SPEND / item.TRANSACTIONS : 0,
      AOV: item.TRANSACTIONS > 0 ? item.REVENUE / item.TRANSACTIONS : 0,
    }));
  }

  // Generate weekly comparison data
  private generateWeeklyComparison(data: any[]): any[] {
    // This would implement the weekly comparison logic
    // For now, return aggregated data
    return this.aggregateData(data, 'date');
  }

  // Generate campaign sparklines data
  private generateCampaignSparklines(data: any[], viewMode: ViewMode): any[] {
    const campaignGroups: Record<string, any[]> = {};

    data.forEach(row => {
      const campaignName = row['CAMPAIGN ORDER NAME'] || 'Unknown';
      if (!campaignGroups[campaignName]) {
        campaignGroups[campaignName] = [];
      }
      campaignGroups[campaignName].push(row);
    });

    return Object.entries(campaignGroups).map(([campaign, rows]) => ({
      campaign,
      data: this.aggregateData(rows, viewMode),
      totalImpressions: rows.reduce((sum, row) => sum + (Number(row.IMPRESSIONS) || 0), 0),
      totalRevenue: rows.reduce((sum, row) => sum + (Number(row.REVENUE) || 0), 0),
    }));
  }

  // Generate health analysis data
  private generateHealthAnalysis(data: any[], pacingData: any[], contractTermsData: any[]): any[] {
    // This would implement health scoring logic
    // For now, return basic campaign data
    return data;
  }

  // Calculate summary metrics for a specific metric type
  private calculateSummaryMetrics(data: any[], metricType: string): Record<string, number> {
    const total = data.reduce((sum, row) => sum + (Number(row[metricType]) || 0), 0);
    const average = data.length > 0 ? total / data.length : 0;
    const max = Math.max(...data.map(row => Number(row[metricType]) || 0));
    const min = Math.min(...data.map(row => Number(row[metricType]) || 0));

    return {
      total,
      average,
      max,
      min,
      count: data.length
    };
  }

  // Calculate comprehensive summary
  private calculateComprehensiveSummary(data: any[]): Record<string, number> {
    const metrics = ['IMPRESSIONS', 'CLICKS', 'TRANSACTIONS', 'REVENUE', 'SPEND'];
    const summary: Record<string, number> = {};

    metrics.forEach(metric => {
      const values = data.map(row => Number(row[metric]) || 0);
      summary[`${metric}_total`] = values.reduce((sum, val) => sum + val, 0);
      summary[`${metric}_average`] = values.length > 0 ? summary[`${metric}_total`] / values.length : 0;
    });

    // Calculate derived metrics
    summary.CTR = summary.IMPRESSIONS_total > 0 ? (summary.CLICKS_total / summary.IMPRESSIONS_total) * 100 : 0;
    summary.ROAS = summary.SPEND_total > 0 ? summary.REVENUE_total / summary.SPEND_total : 0;

    return summary;
  }

  // Get date range from data
  private getDateRange(data: any[]): { from: Date; to: Date } {
    const dates = data
      .map(row => this.parseDate(row.DATE))
      .filter(Boolean) as Date[];
    
    if (dates.length === 0) {
      const now = new Date();
      return { from: now, to: now };
    }

    dates.sort((a, b) => a.getTime() - b.getTime());
    return { from: dates[0], to: dates[dates.length - 1] };
  }

  // Helper methods
  private parseDate(dateStr: string): Date | null {
    if (!dateStr || dateStr === 'Totals') return null;
    
    try {
      // Try parsing MM/DD/YYYY format
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        const month = parseInt(parts[0]) - 1;
        const day = parseInt(parts[1]);
        const year = parseInt(parts[2]);
        return new Date(year, month, day);
      }
      
      // Fallback to Date constructor
      return new Date(dateStr);
    } catch {
      return null;
    }
  }

  private getDayOfWeek(date: Date): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[date.getDay()];
  }

  private extractAgency(campaignName: string): string {
    // Extract agency from campaign name using regex
    const match = campaignName.match(/^\d+[\/\d]*:\s*([A-Z]+):/);
    return match ? match[1] : 'Unknown';
  }

  private extractAdvertiser(campaignName: string): string {
    // Extract advertiser from campaign name using regex
    const match = campaignName.match(/:\s*[A-Z]+:\s*([^-]+)/);
    return match ? match[1].trim() : 'Unknown';
  }

  private generateCacheKey(instance: ChartInstance): string {
    const filterKey = JSON.stringify({
      templateId: instance.templateId,
      filters: instance.filters,
      settings: instance.settings
    });
    return btoa(filterKey).replace(/[/+=]/g, '');
  }

  // Cache management
  clearCache(): void {
    this.cache.clear();
  }

  getCacheSize(): number {
    return this.cache.size;
  }

  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}