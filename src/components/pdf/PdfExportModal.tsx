import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Loader2, Download, Settings } from "lucide-react";
import { toast } from "sonner";
import ChartSelector from "./ChartSelector";
import { PdfGenerator } from "./PdfGenerator";
import { ChartSection, PdfExportOptions, PdfExportSettings } from "./types";
import { DateRange } from "react-day-picker";

interface PdfExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dateRange?: DateRange;
  appliedFilters?: {
    agencies: string[];
    advertisers: string[];
    campaigns: string[];
  };
  activeTab: string;
}

const PdfExportModal = ({ 
  open, 
  onOpenChange, 
  dateRange,
  appliedFilters,
  activeTab 
}: PdfExportModalProps) => {
  const [selectedCharts, setSelectedCharts] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [settings, setSettings] = useState<PdfExportSettings>({
    orientation: 'portrait',
    pageSize: 'a4',
    quality: 2,
    includeFilters: true,
    includeDateRange: true,
  });

  // Define available charts based on what's currently visible/available
  const getAvailableCharts = (): ChartSection[] => {
    const charts: ChartSection[] = [
      {
        id: 'dashboard-metrics',
        name: 'Dashboard Metrics',
        description: 'Combined metrics charts and performance overview',
        elementId: 'dashboard-metrics-section',
        available: activeTab === 'dashboard' || document.getElementById('dashboard-metrics-section') !== null,
      },
      {
        id: 'dashboard-weekly',
        name: 'Weekly Comparison',
        description: 'Weekly performance comparison chart',
        elementId: 'weekly-comparison-section',
        available: activeTab === 'dashboard' || document.getElementById('weekly-comparison-section') !== null,
      },
      {
        id: 'spark-charts',
        name: 'Campaign Trends',
        description: 'Individual campaign trend analysis',
        elementId: 'spark-charts-section',
        available: activeTab === 'sparks' || document.getElementById('spark-charts-section') !== null,
      },
      {
        id: 'health-scatter',
        name: 'Health Analysis',
        description: 'Campaign health scatter plot and analysis',
        elementId: 'health-scatter-section',
        available: activeTab === 'health' || document.getElementById('health-scatter-section') !== null,
      },
      {
        id: 'health-methodology',
        name: 'Health Methodology',
        description: 'Health scoring methodology and legend',
        elementId: 'health-methodology-section',
        available: activeTab === 'health' || document.getElementById('health-methodology-section') !== null,
      },
      {
        id: 'pacing-table',
        name: 'Pacing Analysis',
        description: 'Campaign pacing table and metrics',
        elementId: 'pacing-table-section',
        available: activeTab === 'pacing' || document.getElementById('pacing-table-section') !== null,
      },
      {
        id: 'pacing-metrics',
        name: 'Pacing Metrics',
        description: 'Pacing performance metrics overview',
        elementId: 'pacing-metrics-section',
        available: activeTab === 'pacing' || document.getElementById('pacing-metrics-section') !== null,
      },
      {
        id: 'raw-data-table',
        name: 'Raw Data Table',
        description: 'Current raw data table with applied filters',
        elementId: 'raw-data-table-section',
        available: activeTab === 'raw-data' || document.getElementById('raw-data-table-section') !== null,
      },
    ];

    return charts;
  };

  const availableCharts = getAvailableCharts();

  // Auto-select charts from current tab when modal opens
  useEffect(() => {
    if (open) {
      const currentTabCharts = availableCharts
        .filter(chart => chart.available && chart.elementId.includes(activeTab))
        .map(chart => chart.id);
      
      if (currentTabCharts.length > 0) {
        setSelectedCharts(currentTabCharts);
      }
    }
  }, [open, activeTab]);

  const handleExport = async () => {
    if (selectedCharts.length === 0) {
      toast.error("Please select at least one chart to export");
      return;
    }

    setIsExporting(true);
    
    try {
      const generator = new PdfGenerator(settings);
      
      const exportOptions: PdfExportOptions = {
        selectedCharts,
        settings,
        dateRange: dateRange && dateRange.from ? {
          from: dateRange.from,
          to: dateRange.to,
        } : undefined,
        appliedFilters,
      };

      await generator.generatePdf(exportOptions);
      
      // Generate filename
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `campaign-analytics-${timestamp}.pdf`;
      
      generator.save(filename);
      
      toast.success("PDF exported successfully!");
      onOpenChange(false);
      
    } catch (error) {
      console.error('Export error:', error);
      toast.error("Failed to export PDF. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const updateSettings = (key: keyof PdfExportSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export to PDF
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 pr-2">
          {/* Chart Selection */}
          <ChartSelector
            availableCharts={availableCharts}
            selectedCharts={selectedCharts}
            onSelectionChange={setSelectedCharts}
          />

          {/* Export Settings */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <h3 className="text-lg font-semibold">Export Settings</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Orientation</Label>
                <Select value={settings.orientation} onValueChange={(value: 'portrait' | 'landscape') => updateSettings('orientation', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="portrait">Portrait</SelectItem>
                    <SelectItem value="landscape">Landscape</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Page Size</Label>
                <Select value={settings.pageSize} onValueChange={(value: 'a4' | 'letter') => updateSettings('pageSize', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="a4">A4</SelectItem>
                    <SelectItem value="letter">Letter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Image Quality: {settings.quality}x</Label>
              <Slider
                value={[settings.quality]}
                onValueChange={([value]) => updateSettings('quality', value)}
                min={1}
                max={3}
                step={0.5}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>Lower file size</span>
                <span>Higher quality</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="include-date-range">Include Date Range</Label>
                <Switch
                  id="include-date-range"
                  checked={settings.includeDateRange}
                  onCheckedChange={(checked) => updateSettings('includeDateRange', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="include-filters">Include Applied Filters</Label>
                <Switch
                  id="include-filters"
                  checked={settings.includeFilters}
                  onCheckedChange={(checked) => updateSettings('includeFilters', checked)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleExport} 
            disabled={isExporting || selectedCharts.length === 0}
          >
            {isExporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Export PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PdfExportModal;