import { DateRange } from "react-day-picker";

export type ViewMode = "date" | "dayOfWeek";
export type CampaignType = "all" | "display" | "attribution";

export interface ChartFilters {
  dateRange?: DateRange;
  agencies: string[];
  advertisers: string[];
  campaigns: string[];
  campaignType: CampaignType;
}

export interface ChartTemplate {
  id: string;
  name: string;
  description: string;
  category: 'metric' | 'trend' | 'analysis' | 'data';
  icon: string; // Lucide icon name
  supportsViewMode: boolean;
  supportsCampaignType: boolean;
  defaultSettings: ChartInstanceSettings;
}

export interface ChartInstanceSettings {
  viewMode?: ViewMode;
  colors?: string[];
  showGrid?: boolean;
  showAnimation?: boolean;
  chartHeight?: number;
  orientation?: 'horizontal' | 'vertical';
  // Chart-specific settings
  showTrend?: boolean;
  showPercentage?: boolean;
  precision?: number;
  aggregationType?: 'sum' | 'average' | 'max' | 'min';
}

export interface ChartInstance {
  id: string;
  templateId: string;
  name: string;
  filters: ChartFilters;
  settings: ChartInstanceSettings;
  order: number;
  createdAt: Date;
}

export interface PdfConfiguration {
  instances: ChartInstance[];
  globalSettings: PdfGlobalSettings;
  metadata: PdfMetadata;
}

export interface PdfGlobalSettings {
  orientation: 'portrait' | 'landscape';
  pageSize: 'a4' | 'letter';
  quality: number;
  includeTableOfContents: boolean;
  includeSummary: boolean;
  pageBreakBetweenCharts: boolean;
}

export interface PdfMetadata {
  title: string;
  description?: string;
  author: string;
  tags: string[];
  generatedAt: Date;
}

export interface DataProcessingResult {
  data: any[];
  summary: {
    totalRows: number;
    dateRange: { from: Date; to: Date };
    metrics: Record<string, number>;
  };
}

// Chart template definitions
export const CHART_TEMPLATES: ChartTemplate[] = [
  // Individual Metric Cards
  {
    id: 'metric_impressions',
    name: 'Impressions',
    description: 'Total impressions with trend sparkline',
    category: 'metric',
    icon: 'Eye',
    supportsViewMode: true,
    supportsCampaignType: true,
    defaultSettings: {
      showTrend: true,
      showPercentage: true,
      chartHeight: 120,
    }
  },
  {
    id: 'metric_clicks',
    name: 'Clicks',
    description: 'Total clicks with trend sparkline',
    category: 'metric',
    icon: 'MousePointer',
    supportsViewMode: true,
    supportsCampaignType: true,
    defaultSettings: {
      showTrend: true,
      showPercentage: true,
      chartHeight: 120,
    }
  },
  {
    id: 'metric_ctr',
    name: 'Click-Through Rate',
    description: 'CTR percentage with trend analysis',
    category: 'metric',
    icon: 'Target',
    supportsViewMode: true,
    supportsCampaignType: true,
    defaultSettings: {
      showTrend: true,
      showPercentage: true,
      precision: 3,
      chartHeight: 120,
    }
  },
  {
    id: 'metric_transactions',
    name: 'Transactions',
    description: 'Total transactions with conversion tracking',
    category: 'metric',
    icon: 'ShoppingCart',
    supportsViewMode: true,
    supportsCampaignType: true,
    defaultSettings: {
      showTrend: true,
      showPercentage: true,
      chartHeight: 120,
    }
  },
  {
    id: 'metric_revenue',
    name: 'Attributed Sales',
    description: 'Total revenue with financial tracking',
    category: 'metric',
    icon: 'DollarSign',
    supportsViewMode: true,
    supportsCampaignType: true,
    defaultSettings: {
      showTrend: true,
      showPercentage: true,
      precision: 2,
      chartHeight: 120,
    }
  },
  {
    id: 'metric_roas',
    name: 'Return on Ad Spend',
    description: 'ROAS calculation with efficiency metrics',
    category: 'metric',
    icon: 'TrendingUp',
    supportsViewMode: true,
    supportsCampaignType: true,
    defaultSettings: {
      showTrend: true,
      showPercentage: true,
      precision: 2,
      chartHeight: 120,
    }
  },
  
  // Trend Analysis Charts
  {
    id: 'trend_combined_metrics',
    name: 'Combined Metrics Chart',
    description: 'Multi-metric line chart with dual axes',
    category: 'trend',
    icon: 'BarChart3',
    supportsViewMode: true,
    supportsCampaignType: true,
    defaultSettings: {
      viewMode: 'date',
      showGrid: true,
      showAnimation: false,
      chartHeight: 300,
    }
  },
  {
    id: 'trend_weekly_comparison',
    name: 'Weekly Performance Comparison',
    description: 'Period-over-period comparison chart',
    category: 'trend',
    icon: 'Calendar',
    supportsViewMode: false,
    supportsCampaignType: true,
    defaultSettings: {
      chartHeight: 250,
      showGrid: true,
    }
  },
  {
    id: 'trend_campaign_sparklines',
    name: 'Campaign Trend Analysis',
    description: 'Individual campaign performance sparklines',
    category: 'trend',
    icon: 'Activity',
    supportsViewMode: true,
    supportsCampaignType: true,
    defaultSettings: {
      viewMode: 'date',
      chartHeight: 400,
      showAnimation: false,
    }
  },
  
  // Analysis Charts
  {
    id: 'analysis_health_scatter',
    name: 'Campaign Health Analysis',
    description: 'Health score vs completion scatter plot',
    category: 'analysis',
    icon: 'Zap',
    supportsViewMode: false,
    supportsCampaignType: true,
    defaultSettings: {
      chartHeight: 400,
      showGrid: true,
    }
  },
  {
    id: 'analysis_pacing_table',
    name: 'Campaign Pacing Analysis',
    description: 'Detailed pacing performance table',
    category: 'analysis',
    icon: 'Clock',
    supportsViewMode: false,
    supportsCampaignType: true,
    defaultSettings: {
      chartHeight: 300,
    }
  },
  
  // Raw Data
  {
    id: 'data_raw_table',
    name: 'Raw Data Table',
    description: 'Filtered campaign data in table format',
    category: 'data',
    icon: 'FileText',
    supportsViewMode: false,
    supportsCampaignType: true,
    defaultSettings: {
      chartHeight: 400,
    }
  }
];

// Helper functions
export const getTemplateById = (id: string): ChartTemplate | undefined => {
  return CHART_TEMPLATES.find(template => template.id === id);
};

export const getTemplatesByCategory = (category: ChartTemplate['category']): ChartTemplate[] => {
  return CHART_TEMPLATES.filter(template => template.category === category);
};

export const createDefaultInstance = (template: ChartTemplate, name?: string): Omit<ChartInstance, 'id' | 'createdAt'> => {
  return {
    templateId: template.id,
    name: name || template.name,
    filters: {
      agencies: [],
      advertisers: [],
      campaigns: [],
      campaignType: 'all',
    },
    settings: { ...template.defaultSettings },
    order: 0,
  };
};