export interface ChartSection {
  id: string;
  name: string;
  description: string;
  elementId: string;
  available: boolean;
}

export interface PdfExportSettings {
  orientation: 'portrait' | 'landscape';
  pageSize: 'a4' | 'letter';
  quality: number;
  includeFilters: boolean;
  includeDateRange: boolean;
}

export interface PdfExportOptions {
  selectedCharts: string[];
  settings: PdfExportSettings;
  dateRange?: {
    from: Date;
    to?: Date;
  };
  appliedFilters?: {
    agencies: string[];
    advertisers: string[];
    campaigns: string[];
  };
}