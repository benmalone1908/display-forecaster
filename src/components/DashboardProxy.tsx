
import { useState, useEffect } from "react";
import Dashboard from "./Dashboard";
import CombinedMetricsChart from "./CombinedMetricsChart";
import { ChartModeSelector } from "./ChartModeSelector";
import { CustomMetricSelector } from "./CustomMetricSelector";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import { CalendarDays, Calendar } from "lucide-react";

// Define props interface to match Dashboard component
interface DashboardProxyProps {
  data: any[];
  metricsData: any[];
  revenueData: any[];
  selectedMetricsCampaigns: string[];
  selectedRevenueCampaigns: string[];
  selectedRevenueAdvertisers: string[];
  selectedRevenueAgencies: string[];
  selectedMetricsAdvertisers: string[];
  selectedMetricsAgencies: string[];
  onMetricsCampaignsChange: (selected: string[]) => void;
  onRevenueCampaignsChange: (selected: string[]) => void;
  onRevenueAdvertisersChange: (selected: string[]) => void;
  onRevenueAgenciesChange: (selected: string[]) => void;
  onMetricsAdvertisersChange: (selected: string[]) => void;
  onMetricsAgenciesChange: (selected: string[]) => void;
  sortedCampaignOptions: string[];
  sortedAdvertiserOptions: string[];
  sortedAgencyOptions: string[];
  formattedCampaignOptions: any[];
  formattedAdvertiserOptions: any[];
  formattedAgencyOptions: any[];
  aggregatedMetricsData: any[];
  agencyToAdvertisersMap: Record<string, Set<string>>;
  agencyToCampaignsMap: Record<string, Set<string>>;
  advertiserToCampaignsMap: Record<string, Set<string>>;
  selectedWeeklyCampaigns: string[];
  onWeeklyCampaignsChange: (selected: string[]) => void;
  useGlobalFilters?: boolean;
  hideCharts?: string[];
  chartToggleComponent?: React.ReactNode;
  contractTermsData?: any[];
}

// Wrapper component for passing props to Dashboard
const DashboardProxy = (props: DashboardProxyProps) => {
  const [chartMode, setChartMode] = useState<"display" | "attribution" | "custom">("display");
  const [activeTab, setActiveTab] = useState("display");
  const [viewByDate, setViewByDate] = useState(true);
  const [customBarMetric, setCustomBarMetric] = useState("IMPRESSIONS");
  const [customLineMetric, setCustomLineMetric] = useState("CLICKS");

  // Enhanced mode handler that properly updates both the mode and active tab
  const handleModeChange = (mode: "display" | "attribution" | "custom") => {
    console.log(`DashboardProxy: Chart mode changed to ${mode}, setting activeTab to ${mode}`);
    setChartMode(mode);
    setActiveTab(mode);
  };
  
  // Create a DateView component for the date/day toggle
  const DateViewToggle = () => (
    <div className="mr-4">
      <Tabs value={viewByDate ? "date" : "day"} onValueChange={(val) => {
        console.log(`DashboardProxy: Date view changed to ${val}, setting viewByDate to ${val === "date"}`);
        setViewByDate(val === "date");
      }}>
        <TabsList className="h-8">
          <TabsTrigger value="date" className="text-xs px-2">
            <Calendar className="h-3.5 w-3.5 mr-1" />
            Date
          </TabsTrigger>
          <TabsTrigger value="day" className="text-xs px-2">
            <CalendarDays className="h-3.5 w-3.5 mr-1" />
            Day of Week
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );

  // Create our chart controls component with the proper state
  const chartControls = (
    <div className="flex items-center space-x-4">
      <DateViewToggle />
      <ChartModeSelector 
        mode={chartMode} 
        onModeChange={handleModeChange} 
      />
      {chartMode === "custom" && (
        <CustomMetricSelector
          barMetric={customBarMetric}
          lineMetric={customLineMetric}
          onBarMetricChange={setCustomBarMetric}
          onLineMetricChange={setCustomLineMetric}
        />
      )}
    </div>
  );
  
  // Make sure the view mode changes are applied
  useEffect(() => {
    console.log(`DashboardProxy: viewByDate changed to ${viewByDate}`);
  }, [viewByDate]);
  
  return (
    <div className="relative">
      <Dashboard
        data={props.data}
        metricsData={props.metricsData}
        revenueData={props.revenueData}
        selectedMetricsCampaigns={props.selectedMetricsCampaigns}
        selectedRevenueCampaigns={props.selectedRevenueCampaigns}
        selectedRevenueAdvertisers={props.selectedRevenueAdvertisers}
        selectedRevenueAgencies={props.selectedRevenueAgencies}
        selectedMetricsAdvertisers={props.selectedMetricsAdvertisers}
        selectedMetricsAgencies={props.selectedMetricsAgencies}
        onMetricsCampaignsChange={props.onMetricsCampaignsChange}
        onRevenueCampaignsChange={props.onRevenueCampaignsChange}
        onRevenueAdvertisersChange={props.onRevenueAdvertisersChange}
        onRevenueAgenciesChange={props.onRevenueAgenciesChange}
        onMetricsAdvertisersChange={props.onMetricsAdvertisersChange}
        onMetricsAgenciesChange={props.onMetricsAgenciesChange}
        sortedCampaignOptions={props.sortedCampaignOptions}
        sortedAdvertiserOptions={props.sortedAdvertiserOptions}
        sortedAgencyOptions={props.sortedAgencyOptions}
        formattedCampaignOptions={props.formattedCampaignOptions}
        formattedAdvertiserOptions={props.formattedAdvertiserOptions}
        formattedAgencyOptions={props.formattedAgencyOptions}
        aggregatedMetricsData={props.aggregatedMetricsData}
        agencyToAdvertisersMap={props.agencyToAdvertisersMap}
        agencyToCampaignsMap={props.agencyToCampaignsMap}
        advertiserToCampaignsMap={props.advertiserToCampaignsMap}
        selectedWeeklyCampaigns={props.selectedWeeklyCampaigns}
        onWeeklyCampaignsChange={props.onWeeklyCampaignsChange}
        useGlobalFilters={props.useGlobalFilters}
        hideCharts={props.hideCharts}
        chartToggleComponent={chartControls}
        activeTab={activeTab}
        onChartTabChange={(tab) => setActiveTab(tab)}
        viewByDate={viewByDate}
        hideChartTitle={true}
        contractTermsData={props.contractTermsData}
        customBarMetric={customBarMetric}
        customLineMetric={customLineMetric}
      />
    </div>
  );
};

export default DashboardProxy;
