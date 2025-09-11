import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateRange } from 'react-day-picker';
import { Plus, FileDown, Trash2, GripVertical, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import DateRangePicker from '@/components/DateRangePicker';

// Chart component imports - we'll create these
import SparkChartComponent from '@/components/reports/SparkChartComponent';
import CampaignPerformanceComponent from '@/components/reports/CampaignPerformanceComponent';
import WeeklyComparisonComponent from '@/components/reports/WeeklyComparisonComponent';

interface CustomReportBuilderProps {
  data: any[];
  dateRange: DateRange;
  pacingData?: any[];
  contractTermsData?: any[];
}

interface ChartConfig {
  id: string;
  category: 'spark-charts' | 'campaign-performance' | 'weekly-comparison';
  type: string;
  subOptions?: Record<string, string>;
  dateRange: DateRange;
  title: string;
}

// Available chart types
const chartTypes = {
  'spark-charts': {
    name: 'Spark Charts',
    options: [
      { value: 'impressions', label: 'Impressions' },
      { value: 'clicks', label: 'Clicks' },
      { value: 'ctr', label: 'CTR' },
      { value: 'transactions', label: 'Transactions' },
      { value: 'revenue', label: 'Attributed Sales' },
      { value: 'roas', label: 'ROAS' }
    ]
  },
  'campaign-performance': {
    name: 'Campaign Performance',
    options: [
      { value: 'combined', label: 'Combined Chart' }
    ],
    subOptions: {
      mode: [
        { value: 'display', label: 'Display' },
        { value: 'attribution', label: 'Attribution' }
      ],
      format: [
        { value: 'by-date', label: 'By Date' },
        { value: 'by-day-of-week', label: 'By Day of Week' }
      ]
    }
  },
  'weekly-comparison': {
    name: 'Weekly Comparison',
    options: [
      { value: '7-day', label: '7-Day Comparison' },
      { value: '14-day', label: '14-Day Comparison' },
      { value: '30-day', label: '30-Day Comparison' }
    ]
  }
};

const CustomReportBuilder: React.FC<CustomReportBuilderProps> = ({
  data,
  dateRange,
  pacingData,
  contractTermsData
}) => {
  const [charts, setCharts] = useState<ChartConfig[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [reportTitle, setReportTitle] = useState('Campaign Performance Report');
  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = useState(false);
  
  // New chart configuration state
  const [newChart, setNewChart] = useState<Partial<ChartConfig>>({
    dateRange: dateRange
  });

  // Get available date range from data
  const availableDateRange = useMemo(() => {
    const dates = data
      .map(row => {
        const dateStr = row.DATE || row.date;
        if (!dateStr) return null;
        return new Date(dateStr);
      })
      .filter(Boolean) as Date[];
    
    if (dates.length === 0) return { min: new Date(), max: new Date() };
    
    return {
      min: new Date(Math.min(...dates.map(d => d.getTime()))),
      max: new Date(Math.max(...dates.map(d => d.getTime())))
    };
  }, [data]);

  const addChart = () => {
    if (!newChart.category || !newChart.type) {
      toast.error('Please select chart category and type');
      return;
    }

    const chartType = chartTypes[newChart.category as keyof typeof chartTypes];
    const typeOption = chartType.options.find(opt => opt.value === newChart.type);
    
    let title = typeOption?.label || '';
    if (newChart.subOptions) {
      Object.entries(newChart.subOptions).forEach(([key, value]) => {
        const subOption = chartType.subOptions?.[key]?.find(opt => opt.value === value);
        if (subOption) {
          title += ` - ${subOption.label}`;
        }
      });
    }

    const chart: ChartConfig = {
      id: Date.now().toString(),
      category: newChart.category as ChartConfig['category'],
      type: newChart.type!,
      subOptions: newChart.subOptions,
      dateRange: newChart.dateRange || dateRange,
      title
    };

    setCharts(prev => [...prev, chart]);
    
    // Reset new chart form
    setNewChart({ dateRange: dateRange });
    
    toast.success('Chart added to report');
  };

  const removeChart = (id: string) => {
    setCharts(prev => prev.filter(chart => chart.id !== id));
    toast.success('Chart removed from report');
  };

  const exportToPDF = async () => {
    if (charts.length === 0) {
      toast.error('Please add at least one chart to export');
      return;
    }

    setIsExporting(true);
    
    try {
      const reportElement = document.getElementById('report-preview');
      if (!reportElement) {
        throw new Error('Report preview not found');
      }

      // Capture the entire report preview area
      const canvas = await html2canvas(reportElement, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        width: reportElement.offsetWidth,
        height: reportElement.offsetHeight
      });

      // Create PDF with custom dimensions to fit content
      const imgWidth = canvas.width / 2; // Scale down from scale: 2
      const imgHeight = canvas.height / 2;
      
      // Convert pixels to mm (assuming 96 DPI)
      const mmWidth = (imgWidth * 25.4) / 96;
      const mmHeight = (imgHeight * 25.4) / 96;

      // Create PDF with custom size to fit the content
      const pdf = new jsPDF({
        orientation: mmWidth > mmHeight ? 'landscape' : 'portrait',
        unit: 'mm',
        format: [mmWidth + 20, mmHeight + 20] // Add 20mm margin (10mm each side)
      });

      // Add the image to fill the page
      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', 10, 10, mmWidth, mmHeight);
      
      // Download the PDF
      const filename = `${reportTitle.toLowerCase().replace(/\s+/g, '-')}.pdf`;
      pdf.save(filename);
      toast.success('PDF exported successfully');
      
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error('Failed to export PDF');
    } finally {
      setIsExporting(false);
    }
  };

  // Group charts by category for better layout
  const groupedCharts = useMemo(() => {
    const groups: { [key: string]: ChartConfig[] } = {};
    charts.forEach(chart => {
      if (!groups[chart.category]) {
        groups[chart.category] = [];
      }
      groups[chart.category].push(chart);
    });
    return groups;
  }, [charts]);

  const renderChart = (chart: ChartConfig) => {
    const chartComponent = (() => {
      switch (chart.category) {
        case 'spark-charts':
          return (
            <SparkChartComponent
              data={data}
              metric={chart.type}
              dateRange={chart.dateRange}
              title={chart.title}
              simplified={true}
            />
          );
        case 'campaign-performance':
          return (
            <CampaignPerformanceComponent
              data={data}
              mode={chart.subOptions?.mode || 'display'}
              format={chart.subOptions?.format || 'by-date'}
              dateRange={chart.dateRange}
              title={chart.title}
            />
          );
        case 'weekly-comparison':
          return (
            <WeeklyComparisonComponent
              data={data}
              period={chart.type}
              dateRange={chart.dateRange}
              title={chart.title}
            />
          );
        default:
          return <div>Unknown chart type</div>;
      }
    })();

    return (
      <div key={chart.id} id={`chart-${chart.id}`} className="w-full overflow-hidden">
        {chartComponent}
      </div>
    );
  };

  const renderSparkChartGrid = (sparkCharts: ChartConfig[]) => {
    const count = sparkCharts.length;
    let gridCols = '';
    
    if (count === 1) gridCols = 'grid-cols-1';
    else if (count === 2) gridCols = 'grid-cols-2';
    else if (count === 3) gridCols = 'grid-cols-3';
    else if (count === 4) gridCols = 'grid-cols-2';
    else if (count >= 5) gridCols = 'grid-cols-3';

    return (
      <div className={`grid ${gridCols} gap-4`}>
        {sparkCharts.map(chart => renderChart(chart))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Custom Report Builder</h2>
          <p className="text-muted-foreground">
            Build your custom report by adding charts and configuring their settings
          </p>
        </div>
        <Button
          onClick={exportToPDF}
          disabled={isExporting || charts.length === 0}
          className="flex items-center gap-2"
        >
          <FileDown className="h-4 w-4" />
          {isExporting ? 'Exporting...' : 'Export PDF'}
        </Button>
      </div>

      <div className={`grid gap-6 relative ${isLeftPanelCollapsed ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-3'}`}>
        {/* Chart Builder Panel */}
        <div className={`transition-all duration-300 space-y-4 ${isLeftPanelCollapsed ? 'hidden' : 'lg:col-span-1'}`}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Report Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Report Title */}
              <div>
                <label className="text-sm font-medium">Report Title</label>
                <Input
                  value={reportTitle}
                  onChange={(e) => setReportTitle(e.target.value)}
                  placeholder="Enter report title..."
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Add Chart</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Category Selection */}
              <div>
                <label className="text-sm font-medium">Chart Category</label>
                <Select
                  value={newChart.category || ''}
                  onValueChange={(value) => setNewChart(prev => ({ 
                    ...prev, 
                    category: value as ChartConfig['category'],
                    type: undefined,
                    subOptions: undefined 
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(chartTypes).map(([key, category]) => (
                      <SelectItem key={key} value={key}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Type Selection */}
              {newChart.category && (
                <div>
                  <label className="text-sm font-medium">Chart Type</label>
                  <Select
                    value={newChart.type || ''}
                    onValueChange={(value) => setNewChart(prev => ({ ...prev, type: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type..." />
                    </SelectTrigger>
                    <SelectContent>
                      {chartTypes[newChart.category].options.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Sub-options */}
              {newChart.category && chartTypes[newChart.category].subOptions && (
                <div className="space-y-3">
                  {Object.entries(chartTypes[newChart.category].subOptions!).map(([key, options]) => (
                    <div key={key}>
                      <label className="text-sm font-medium capitalize">
                        {key.replace('-', ' ')}
                      </label>
                      <Select
                        value={newChart.subOptions?.[key] || ''}
                        onValueChange={(value) => setNewChart(prev => ({
                          ...prev,
                          subOptions: { ...prev.subOptions, [key]: value }
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={`Select ${key.replace('-', ' ')}...`} />
                        </SelectTrigger>
                        <SelectContent>
                          {options.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              )}

              {/* Date Range Selection */}
              <div>
                <label className="text-sm font-medium">Date Range</label>
                <DateRangePicker
                  dateRange={newChart.dateRange || dateRange}
                  onDateRangeChange={(range) => setNewChart(prev => ({ ...prev, dateRange: range }))}
                  minDate={availableDateRange.min}
                  maxDate={availableDateRange.max}
                />
              </div>

              <Button
                onClick={addChart}
                disabled={!newChart.category || !newChart.type}
                className="w-full flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Chart
              </Button>
            </CardContent>
          </Card>

          {/* Charts List */}
          {charts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Report Charts ({charts.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {charts.map((chart, index) => (
                    <div
                      key={chart.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium text-sm">{chart.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {chart.dateRange.from?.toLocaleDateString()} - {chart.dateRange.to?.toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeChart(chart.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Report Preview */}
        <div className={isLeftPanelCollapsed ? 'col-span-1' : 'lg:col-span-2'}>
          <div className="relative">
            {/* Collapse Toggle Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsLeftPanelCollapsed(!isLeftPanelCollapsed)}
              className="absolute -left-3 top-4 z-10 h-8 w-8 p-0 border-2 bg-white shadow-md hover:bg-gray-50"
            >
              {isLeftPanelCollapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Report Preview</CardTitle>
              {charts.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Add charts to see the preview
                </p>
              )}
            </CardHeader>
            <CardContent>
              <div id="report-preview" className="space-y-6 bg-white p-6 rounded-lg border w-full overflow-hidden">
                {charts.length > 0 ? (
                  <>
                    {/* Report Header */}
                    <div className="text-center border-b pb-4">
                      <h1 className="text-2xl font-bold">{reportTitle}</h1>
                      <p className="text-muted-foreground">
                        Generated on {new Date().toLocaleDateString()}
                      </p>
                    </div>

                    {/* Charts */}
                    <div className="space-y-8">
                      {/* Render spark charts in grid layout */}
                      {groupedCharts['spark-charts'] && groupedCharts['spark-charts'].length > 0 && (
                        <div id="section-spark-charts">
                          <h3 className="text-lg font-semibold mb-4">Performance Metrics</h3>
                          {renderSparkChartGrid(groupedCharts['spark-charts'])}
                        </div>
                      )}
                      
                      {/* Render campaign performance charts */}
                      {groupedCharts['campaign-performance'] && groupedCharts['campaign-performance'].map(chart => (
                        <div key={chart.id} id="section-campaign-performance">
                          {renderChart(chart)}
                        </div>
                      ))}
                      
                      {/* Render weekly comparison charts */}
                      {groupedCharts['weekly-comparison'] && groupedCharts['weekly-comparison'].map(chart => (
                        <div key={chart.id} id="section-weekly-comparison">
                          {renderChart(chart)}
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileDown className="mx-auto h-12 w-12 mb-4" />
                    <p>No charts added yet</p>
                    <p className="text-sm">Add charts from the panel on the left to build your report</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomReportBuilder;