import React, { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MultiSelect, Option } from "@/components/MultiSelect";
import { Calendar, CalendarDays, Filter, Palette, BarChart, Database } from "lucide-react";
import { DateRange } from "react-day-picker";
import DateRangePicker from "@/components/DateRangePicker";
import { ChartInstance, ViewMode, CampaignType, getTemplateById } from "./enhanced-types";
import { DataProcessingEngine } from "./DataProcessingEngine";

interface ChartInstanceConfigPanelProps {
  instance: ChartInstance;
  onUpdate: (updates: Partial<ChartInstance>) => void;
  availableOptions?: {
    agencies: string[];
    advertisers: string[];
    campaigns: string[];
  };
  dataEngine: DataProcessingEngine;
}

const ChartInstanceConfigPanel = ({
  instance,
  onUpdate,
  availableOptions,
  dataEngine
}: ChartInstanceConfigPanelProps) => {
  const [localInstance, setLocalInstance] = useState<ChartInstance>(instance);
  const [dataPreview, setDataPreview] = useState<any>(null);
  const template = getTemplateById(instance.templateId);

  // Sync with parent instance changes
  useEffect(() => {
    setLocalInstance(instance);
  }, [instance]);

  // Generate data preview when configuration changes
  useEffect(() => {
    const generatePreview = async () => {
      try {
        const result = dataEngine.processInstanceData(localInstance);
        setDataPreview({
          rowCount: result.summary.totalRows,
          dateRange: result.summary.dateRange,
          metrics: result.summary.metrics,
        });
      } catch (error) {
        console.error('Error generating preview:', error);
        setDataPreview(null);
      }
    };

    generatePreview();
  }, [localInstance, dataEngine]);

  // Update handlers
  const updateName = (name: string) => {
    const updated = { ...localInstance, name };
    setLocalInstance(updated);
    onUpdate({ name });
  };

  const updateFilters = (filterUpdates: Partial<typeof localInstance.filters>) => {
    const updated = {
      ...localInstance,
      filters: { ...localInstance.filters, ...filterUpdates }
    };
    setLocalInstance(updated);
    onUpdate({ filters: updated.filters });
  };

  const updateSettings = (settingsUpdates: Partial<typeof localInstance.settings>) => {
    const updated = {
      ...localInstance,
      settings: { ...localInstance.settings, ...settingsUpdates }
    };
    setLocalInstance(updated);
    onUpdate({ settings: updated.settings });
  };

  const updateDateRange = (dateRange: DateRange | undefined) => {
    updateFilters({ dateRange });
  };

  // Convert string arrays to Option arrays for MultiSelect
  const getAgencyOptions = (): Option[] => {
    return (availableOptions?.agencies || []).map(agency => ({
      value: agency,
      label: agency
    }));
  };

  const getAdvertiserOptions = (): Option[] => {
    return (availableOptions?.advertisers || []).map(advertiser => ({
      value: advertiser,
      label: advertiser
    }));
  };

  const getCampaignOptions = (): Option[] => {
    return (availableOptions?.campaigns || []).map(campaign => ({
      value: campaign,
      label: campaign
    }));
  };

  return (
    <div className="h-full overflow-hidden">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Chart Configuration</h3>
        </div>
        <Badge variant="secondary">{template?.name || 'Unknown Template'}</Badge>
      </div>

      <Tabs defaultValue="general" className="h-full overflow-hidden">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="filters">Filters</TabsTrigger>
          <TabsTrigger value="settings">Chart Settings</TabsTrigger>
          <TabsTrigger value="preview">Data Preview</TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="space-y-6 h-full overflow-y-auto">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Basic Information</CardTitle>
              <CardDescription>Configure the chart name and description</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="chart-name">Chart Name</Label>
                <Input
                  id="chart-name"
                  value={localInstance.name}
                  onChange={(e) => updateName(e.target.value)}
                  placeholder="Enter chart name..."
                />
              </div>
              
              <div className="space-y-2">
                <Label>Template</Label>
                <div className="text-sm text-muted-foreground">
                  {template?.description || 'No description available'}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Chart ID</Label>
                <div className="text-sm font-mono text-muted-foreground">
                  {localInstance.id}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Filters */}
        <TabsContent value="filters" className="space-y-6 h-full overflow-y-auto">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                Date Range
              </CardTitle>
              <CardDescription>Set a custom date range for this chart</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <Label>Use Custom Date Range</Label>
                <Switch
                  checked={!!localInstance.filters.dateRange}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      updateDateRange({ from: new Date(), to: new Date() });
                    } else {
                      updateDateRange(undefined);
                    }
                  }}
                />
              </div>
              
              {localInstance.filters.dateRange && (
                <DateRangePicker
                  dateRange={localInstance.filters.dateRange}
                  onDateRangeChange={updateDateRange}
                />
              )}
            </CardContent>
          </Card>

          {template?.supportsCampaignType && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Campaign Type</CardTitle>
                <CardDescription>Filter by campaign type</CardDescription>
              </CardHeader>
              <CardContent>
                <Select
                  value={localInstance.filters.campaignType}
                  onValueChange={(value: CampaignType) => updateFilters({ campaignType: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Campaigns</SelectItem>
                    <SelectItem value="display">Display Only</SelectItem>
                    <SelectItem value="attribution">Attribution Only</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Campaign Filters</CardTitle>
              <CardDescription>Filter data by agencies, advertisers, and campaigns</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Agencies</Label>
                <MultiSelect
                  options={getAgencyOptions()}
                  selected={localInstance.filters.agencies}
                  onChange={(values) => updateFilters({ agencies: values })}
                  placeholder="Select agencies..."
                />
              </div>

              <div className="space-y-2">
                <Label>Advertisers</Label>
                <MultiSelect
                  options={getAdvertiserOptions()}
                  selected={localInstance.filters.advertisers}
                  onChange={(values) => updateFilters({ advertisers: values })}
                  placeholder="Select advertisers..."
                />
              </div>

              <div className="space-y-2">
                <Label>Campaigns</Label>
                <MultiSelect
                  options={getCampaignOptions()}
                  selected={localInstance.filters.campaigns}
                  onChange={(values) => updateFilters({ campaigns: values })}
                  placeholder="Select campaigns..."
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Chart Settings */}
        <TabsContent value="settings" className="space-y-6 h-full overflow-y-auto">
          {template?.supportsViewMode && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  View Mode
                </CardTitle>
                <CardDescription>Choose how to group the data</CardDescription>
              </CardHeader>
              <CardContent>
                <Select
                  value={localInstance.settings.viewMode || 'date'}
                  onValueChange={(value: ViewMode) => updateSettings({ viewMode: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">By Date</SelectItem>
                    <SelectItem value="dayOfWeek">By Day of Week</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart className="h-4 w-4" />
                Chart Appearance
              </CardTitle>
              <CardDescription>Customize the visual appearance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Chart Height: {localInstance.settings.chartHeight || 300}px</Label>
                <Slider
                  value={[localInstance.settings.chartHeight || 300]}
                  onValueChange={([value]) => updateSettings({ chartHeight: value })}
                  min={200}
                  max={600}
                  step={50}
                  className="w-full"
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="show-grid">Show Grid Lines</Label>
                <Switch
                  id="show-grid"
                  checked={localInstance.settings.showGrid || false}
                  onCheckedChange={(checked) => updateSettings({ showGrid: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="show-animation">Enable Animation</Label>
                <Switch
                  id="show-animation"
                  checked={localInstance.settings.showAnimation || false}
                  onCheckedChange={(checked) => updateSettings({ showAnimation: checked })}
                />
              </div>

              {localInstance.settings.showTrend !== undefined && (
                <div className="flex items-center justify-between">
                  <Label htmlFor="show-trend">Show Trend Indicator</Label>
                  <Switch
                    id="show-trend"
                    checked={localInstance.settings.showTrend || false}
                    onCheckedChange={(checked) => updateSettings({ showTrend: checked })}
                  />
                </div>
              )}

              {localInstance.settings.precision !== undefined && (
                <div className="space-y-2">
                  <Label>Decimal Precision: {localInstance.settings.precision || 2}</Label>
                  <Slider
                    value={[localInstance.settings.precision || 2]}
                    onValueChange={([value]) => updateSettings({ precision: value })}
                    min={0}
                    max={5}
                    step={1}
                    className="w-full"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Data Preview */}
        <TabsContent value="preview" className="space-y-6 h-full overflow-y-auto">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="h-4 w-4" />
                Data Preview
              </CardTitle>
              <CardDescription>Preview of the data with current filters applied</CardDescription>
            </CardHeader>
            <CardContent>
              {dataPreview ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label>Total Rows</Label>
                      <div className="text-2xl font-semibold">{dataPreview.rowCount.toLocaleString()}</div>
                    </div>
                    <div className="space-y-1">
                      <Label>Date Range</Label>
                      <div className="text-sm text-muted-foreground">
                        {dataPreview.dateRange.from.toLocaleDateString()} - {dataPreview.dateRange.to.toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <Label className="mb-2 block">Key Metrics</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {Object.entries(dataPreview.metrics).slice(0, 6).map(([key, value]) => (
                        <div key={key} className="p-2 bg-gray-50 rounded text-sm">
                          <div className="font-medium">{key.replace(/_/g, ' ').toLowerCase()}</div>
                          <div className="text-muted-foreground">
                            {typeof value === 'number' ? value.toLocaleString() : value}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    Last updated: {new Date().toLocaleTimeString()}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Loading data preview...</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Filter Summary</CardTitle>
              <CardDescription>Current filters applied to this chart</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Label className="min-w-20">Date Range:</Label>
                  <Badge variant={localInstance.filters.dateRange ? "default" : "secondary"}>
                    {localInstance.filters.dateRange ? "Custom" : "Global"}
                  </Badge>
                </div>

                <div className="flex items-center gap-2">
                  <Label className="min-w-20">Campaign Type:</Label>
                  <Badge variant="outline">{localInstance.filters.campaignType}</Badge>
                </div>

                <div className="flex items-center gap-2">
                  <Label className="min-w-20">Agencies:</Label>
                  <Badge variant="outline">
                    {localInstance.filters.agencies.length || "All"}
                  </Badge>
                </div>

                <div className="flex items-center gap-2">
                  <Label className="min-w-20">Advertisers:</Label>
                  <Badge variant="outline">
                    {localInstance.filters.advertisers.length || "All"}
                  </Badge>
                </div>

                <div className="flex items-center gap-2">
                  <Label className="min-w-20">Campaigns:</Label>
                  <Badge variant="outline">
                    {localInstance.filters.campaigns.length || "All"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ChartInstanceConfigPanel;