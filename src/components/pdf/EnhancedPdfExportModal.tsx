import React, { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Plus, 
  Download, 
  Settings, 
  Eye, 
  MousePointer, 
  Target, 
  ShoppingCart, 
  DollarSign, 
  TrendingUp,
  BarChart3,
  Calendar,
  Activity,
  Zap,
  Clock,
  FileText,
  GripVertical,
  Copy,
  Trash2,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import { DateRange } from "react-day-picker";
import { 
  ChartTemplate, 
  ChartInstance, 
  PdfConfiguration,
  PdfGlobalSettings,
  CHART_TEMPLATES,
  getTemplatesByCategory,
  getTemplateById
} from "./enhanced-types";
import { ChartInstanceManager } from "./ChartInstanceManager";
import { DataProcessingEngine } from "./DataProcessingEngine";
import ChartInstanceConfigPanel from "./ChartInstanceConfigPanel";

const ICON_MAP = {
  Eye, MousePointer, Target, ShoppingCart, DollarSign, TrendingUp,
  BarChart3, Calendar, Activity, Zap, Clock, FileText
};

interface EnhancedPdfExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: any[];
  pacingData?: any[];
  contractTermsData?: any[];
  dateRange?: DateRange;
  appliedFilters?: {
    agencies: string[];
    advertisers: string[];
    campaigns: string[];
  };
  availableOptions?: {
    agencies: string[];
    advertisers: string[];
    campaigns: string[];
  };
}

const EnhancedPdfExportModal = ({
  open,
  onOpenChange,
  data,
  pacingData = [],
  contractTermsData = [],
  dateRange,
  appliedFilters,
  availableOptions
}: EnhancedPdfExportModalProps) => {
  const [instanceManager] = useState(() => new ChartInstanceManager());
  const [dataEngine] = useState(() => new DataProcessingEngine(data, pacingData, contractTermsData));
  const [instances, setInstances] = useState<ChartInstance[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [activeTab, setActiveTab] = useState("builder");
  
  const [globalSettings, setGlobalSettings] = useState<PdfGlobalSettings>({
    orientation: 'portrait',
    pageSize: 'a4',
    quality: 2,
    includeTableOfContents: true,
    includeSummary: true,
    pageBreakBetweenCharts: false,
  });

  // Update data engine when data changes
  useEffect(() => {
    dataEngine.updateData(data, pacingData, contractTermsData);
  }, [data, pacingData, contractTermsData, dataEngine]);

  // Sync instances with manager
  useEffect(() => {
    if (open) {
      setInstances(instanceManager.getAllInstances());
    }
  }, [open, instanceManager]);

  // Group templates by category
  const templatesByCategory = useMemo(() => ({
    metric: getTemplatesByCategory('metric'),
    trend: getTemplatesByCategory('trend'),
    analysis: getTemplatesByCategory('analysis'),
    data: getTemplatesByCategory('data'),
  }), []);

  // Get selected instance
  const selectedInstance = useMemo(() => {
    return selectedInstanceId ? instanceManager.getInstance(selectedInstanceId) : null;
  }, [selectedInstanceId, instanceManager, instances]);

  // Add chart instance
  const handleAddChart = (template: ChartTemplate) => {
    const instance = instanceManager.createInstance(template);
    setInstances(instanceManager.getAllInstances());
    setSelectedInstanceId(instance.id);
    setActiveTab("config");
    toast.success(`Added ${template.name} chart`);
  };

  // Duplicate instance
  const handleDuplicateInstance = (instanceId: string) => {
    const duplicated = instanceManager.duplicateInstance(instanceId);
    if (duplicated) {
      setInstances(instanceManager.getAllInstances());
      setSelectedInstanceId(duplicated.id);
      toast.success("Chart duplicated successfully");
    }
  };

  // Remove instance
  const handleRemoveInstance = (instanceId: string) => {
    const removed = instanceManager.removeInstance(instanceId);
    if (removed) {
      setInstances(instanceManager.getAllInstances());
      if (selectedInstanceId === instanceId) {
        setSelectedInstanceId(null);
      }
      toast.success("Chart removed");
    }
  };

  // Update instance
  const handleUpdateInstance = (instanceId: string, updates: Partial<ChartInstance>) => {
    const success = instanceManager.updateInstance(instanceId, updates);
    if (success) {
      setInstances(instanceManager.getAllInstances());
      toast.success("Chart updated");
    }
  };

  // Reorder instances
  const handleReorderInstances = (newOrder: string[]) => {
    const success = instanceManager.reorderInstances(newOrder);
    if (success) {
      setInstances(instanceManager.getAllInstances());
    }
  };

  // Export to PDF
  const handleExport = async () => {
    if (instances.length === 0) {
      toast.error("Please add at least one chart to export");
      return;
    }

    setIsExporting(true);
    
    try {
      // Here we would integrate with the actual PDF generation
      // For now, just simulate the process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `campaign-analytics-custom-${timestamp}.pdf`;
      
      toast.success("PDF exported successfully!");
      onOpenChange(false);
      
    } catch (error) {
      console.error('Export error:', error);
      toast.error("Failed to export PDF. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  // Clear all instances
  const handleClearAll = () => {
    instanceManager.clearAllInstances();
    setInstances([]);
    setSelectedInstanceId(null);
    toast.success("All charts cleared");
  };

  // Get icon component
  const getIconComponent = (iconName: string) => {
    const IconComponent = ICON_MAP[iconName as keyof typeof ICON_MAP];
    return IconComponent ? <IconComponent className="h-4 w-4" /> : <FileText className="h-4 w-4" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Advanced PDF Export Builder
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="builder">Chart Builder</TabsTrigger>
            <TabsTrigger value="config">Configuration</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="settings">PDF Settings</TabsTrigger>
          </TabsList>

          {/* Chart Builder Tab */}
          <TabsContent value="builder" className="flex-1 overflow-hidden">
            <div className="grid grid-cols-12 gap-4 h-full">
              {/* Template Library */}
              <div className="col-span-7 border-r pr-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Chart Templates</h3>
                  <Badge variant="outline">
                    {Object.values(templatesByCategory).flat().length} available
                  </Badge>
                </div>
                
                <ScrollArea className="h-[500px]">
                  <div className="space-y-6">
                    {Object.entries(templatesByCategory).map(([category, templates]) => (
                      <div key={category}>
                        <h4 className="font-medium mb-3 capitalize text-sm text-muted-foreground">
                          {category} Charts
                        </h4>
                        <div className="grid grid-cols-2 gap-3">
                          {templates.map((template) => (
                            <div
                              key={template.id}
                              className="p-3 border rounded-lg hover:border-blue-300 hover:bg-blue-50 cursor-pointer transition-colors group"
                              onClick={() => handleAddChart(template)}
                            >
                              <div className="flex items-start gap-3">
                                <div className="p-1 rounded bg-gray-100 group-hover:bg-blue-100">
                                  {getIconComponent(template.icon)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h5 className="font-medium text-sm truncate">{template.name}</h5>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {template.description}
                                  </p>
                                  <div className="flex gap-1 mt-2">
                                    {template.supportsViewMode && (
                                      <Badge variant="secondary" className="text-xs">View Mode</Badge>
                                    )}
                                    {template.supportsCampaignType && (
                                      <Badge variant="secondary" className="text-xs">Campaign Filter</Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>

              {/* Instance List */}
              <div className="col-span-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Selected Charts</h3>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{instances.length} charts</Badge>
                    {instances.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClearAll}
                        className="text-red-600 hover:text-red-700"
                      >
                        Clear All
                      </Button>
                    )}
                  </div>
                </div>

                <ScrollArea className="h-[500px]">
                  {instances.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Plus className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No charts added yet</p>
                      <p className="text-sm">Select templates from the left to start building your report</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {instances.map((instance, index) => {
                        const template = getTemplateById(instance.templateId);
                        return (
                          <div
                            key={instance.id}
                            className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                              selectedInstanceId === instance.id
                                ? 'border-blue-300 bg-blue-50'
                                : 'hover:border-gray-300 hover:bg-gray-50'
                            }`}
                            onClick={() => setSelectedInstanceId(instance.id)}
                          >
                            <div className="flex items-center gap-3">
                              <GripVertical className="h-4 w-4 text-muted-foreground" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  {template && getIconComponent(template.icon)}
                                  <span className="font-medium text-sm truncate">{instance.name}</span>
                                  <Badge variant="outline" className="text-xs">#{index + 1}</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {template?.description || 'Custom chart'}
                                </p>
                                {/* Filter summary */}
                                <div className="flex gap-1 mt-2">
                                  {instance.filters.agencies.length > 0 && (
                                    <Badge variant="secondary" className="text-xs">
                                      {instance.filters.agencies.length} agencies
                                    </Badge>
                                  )}
                                  {instance.filters.campaigns.length > 0 && (
                                    <Badge variant="secondary" className="text-xs">
                                      {instance.filters.campaigns.length} campaigns
                                    </Badge>
                                  )}
                                  {instance.filters.dateRange && (
                                    <Badge variant="secondary" className="text-xs">Custom dates</Badge>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-col gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDuplicateInstance(instance.id);
                                  }}
                                  className="h-6 w-6 p-0"
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveInstance(instance.id);
                                  }}
                                  className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </div>
          </TabsContent>

          {/* Configuration Tab */}
          <TabsContent value="config" className="flex-1 overflow-hidden">
            {selectedInstance ? (
              <ChartInstanceConfigPanel
                instance={selectedInstance}
                onUpdate={(updates) => handleUpdateInstance(selectedInstance.id, updates)}
                availableOptions={availableOptions}
                dataEngine={dataEngine}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-center text-muted-foreground">
                <div>
                  <Settings className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Select a chart from the builder to configure it</p>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Preview Tab */}
          <TabsContent value="preview" className="flex-1 overflow-hidden">
            <div className="text-center py-12 text-muted-foreground">
              <Eye className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Chart preview coming soon</p>
              <p className="text-sm">This will show how your PDF will look</p>
            </div>
          </TabsContent>

          {/* PDF Settings Tab */}
          <TabsContent value="settings" className="flex-1 overflow-hidden">
            <div className="max-w-2xl mx-auto py-6">
              <h3 className="text-lg font-semibold mb-6">PDF Export Settings</h3>
              
              {/* Settings content would go here */}
              <div className="space-y-6">
                <div className="text-center py-12 text-muted-foreground">
                  <Settings className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>PDF settings panel coming soon</p>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <Separator />
        <div className="flex items-center justify-between pt-4">
          <div className="text-sm text-muted-foreground">
            {instances.length} charts selected
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleExport} 
              disabled={isExporting || instances.length === 0}
            >
              {isExporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Export PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EnhancedPdfExportModal;