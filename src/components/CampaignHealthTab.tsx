
import { useMemo, useState } from "react";
import { calculateCampaignHealth, CampaignHealthData } from "@/utils/campaignHealthScoring";
import CampaignHealthScatterPlot from "./CampaignHealthScatterPlot";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { useCampaignFilter } from "@/contexts/CampaignFilterContext";
import { Alert, AlertDescription } from "./ui/alert";
import { AlertTriangle, HelpCircle } from "lucide-react";
import ContractTermsAlert from "./ContractTermsAlert";
import { validateContractTerms } from "@/utils/contractTermsValidation";
import MetricExplanationModal, { MetricType } from "./MetricExplanationModal";

interface CampaignHealthTabProps {
  data: any[];
  pacingData?: any[];
  contractTermsData?: any[];
}

const CampaignHealthTab = ({ data, pacingData = [], contractTermsData = [] }: CampaignHealthTabProps) => {
  const { isTestCampaign } = useCampaignFilter();
  
  // Modal state for metric explanations
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<MetricType | null>(null);
  
  const handleMetricClick = (metric: MetricType) => {
    setSelectedMetric(metric);
    setModalOpen(true);
  };

  // Debug logging to see what data we're receiving
  console.log("CampaignHealthTab: Received pacing data length:", pacingData.length);
  console.log("CampaignHealthTab: Received contract terms data length:", contractTermsData.length);
  if (pacingData.length > 0) {
    console.log("CampaignHealthTab: Sample pacing data:", pacingData[0]);
    console.log("CampaignHealthTab: Available pacing campaigns:", 
      pacingData.map(row => row["Campaign"]).filter(Boolean).slice(0, 5)
    );
  }
  if (contractTermsData.length > 0) {
    console.log("CampaignHealthTab: Sample contract terms data:", contractTermsData[0]);
    console.log("CampaignHealthTab: Contract terms fields:", Object.keys(contractTermsData[0] || {}));
  }

  const { healthData, missingPacingCampaigns, contractTermsValidation } = useMemo(() => {
    // Validate contract terms for campaigns with impressions
    const contractValidation = validateContractTerms(data, contractTermsData);
    console.log("CampaignHealthTab: Contract terms validation result:", contractValidation);
    
    // Get unique campaigns excluding test campaigns
    const campaigns = Array.from(new Set(
      data
        .filter(row => row["CAMPAIGN ORDER NAME"] && !isTestCampaign(row["CAMPAIGN ORDER NAME"]))
        .map(row => row["CAMPAIGN ORDER NAME"])
    ));

    console.log("CampaignHealthTab: Processing campaigns:", campaigns.slice(0, 3));
    console.log("CampaignHealthTab: Passing pacing data length:", pacingData.length);
    console.log("CampaignHealthTab: Passing contract terms data length:", contractTermsData.length);

    // Get campaigns present in pacing data
    const pacingCampaigns = new Set(
      pacingData.map(row => row["Campaign"]).filter(Boolean)
    );

    // Find campaigns missing from pacing data - only if pacing data was uploaded
    const missingFromPacing = pacingData.length > 0 
      ? campaigns.filter(campaign => !pacingCampaigns.has(campaign))
      : [];

    // Calculate health score for each campaign, now passing contractTermsData
    const healthScores = campaigns
      .map(campaignName => calculateCampaignHealth(data, campaignName, pacingData, contractTermsData))
      .filter(campaign => campaign.healthScore > 0); // Only show campaigns with valid data

    return {
      healthData: healthScores,
      missingPacingCampaigns: missingFromPacing,
      contractTermsValidation: contractValidation
    };
  }, [data, pacingData, contractTermsData, isTestCampaign]);

  const summaryStats = useMemo(() => {
    if (healthData.length === 0) return { total: 0, healthy: 0, warning: 0, critical: 0, avgScore: 0 };

    const healthy = healthData.filter(c => c.healthScore >= 7).length;
    const warning = healthData.filter(c => c.healthScore >= 4 && c.healthScore < 7).length;
    const critical = healthData.filter(c => c.healthScore < 4).length;
    const avgScore = healthData.reduce((sum, c) => sum + c.healthScore, 0) / healthData.length;

    return {
      total: healthData.length,
      healthy,
      warning,
      critical,
      avgScore: Math.round(avgScore * 10) / 10
    };
  }, [healthData]);

  return (
    <div className="space-y-6">
      {/* Missing Contract Terms Alert */}
      <ContractTermsAlert 
        missingCampaigns={contractTermsValidation.missingCampaigns}
      />
      
      {/* Missing Pacing Data Alert - only show if pacing data was uploaded */}
      {pacingData.length > 0 && missingPacingCampaigns.length > 0 && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            <div className="font-medium mb-2">
              {missingPacingCampaigns.length} campaign(s) missing from pacing data:
            </div>
            <div className="text-sm space-y-1">
              {missingPacingCampaigns.slice(0, 5).map(campaign => (
                <div key={campaign} className="truncate">• {campaign}</div>
              ))}
              {missingPacingCampaigns.length > 5 && (
                <div className="text-xs text-yellow-600">
                  ...and {missingPacingCampaigns.length - 5} more
                </div>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="text-2xl font-bold">{summaryStats.total}</div>
          <div className="text-sm text-muted-foreground">Total Campaigns</div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center space-x-2">
            <div className="text-2xl font-bold">{summaryStats.healthy}</div>
            <Badge className="bg-green-100 text-green-800">Healthy</Badge>
          </div>
          <div className="text-sm text-muted-foreground">Score ≥ 7.0</div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center space-x-2">
            <div className="text-2xl font-bold">{summaryStats.warning}</div>
            <Badge className="bg-yellow-100 text-yellow-800">Warning</Badge>
          </div>
          <div className="text-sm text-muted-foreground">Score 4.0-6.9</div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center space-x-2">
            <div className="text-2xl font-bold">{summaryStats.critical}</div>
            <Badge className="bg-red-100 text-red-800">Critical</Badge>
          </div>
          <div className="text-sm text-muted-foreground">Score &lt; 4.0</div>
        </Card>
        
        <Card className="p-4">
          <div className="text-2xl font-bold">{summaryStats.avgScore}</div>
          <div className="text-sm text-muted-foreground">Average Score</div>
        </Card>
      </div>

      {/* Health Scoring Legend */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold mb-3">Health Score Methodology</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Click on any metric below to see detailed scoring explanations and calculation methods.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
          <div 
            className="cursor-pointer p-3 rounded-lg border hover:border-blue-300 hover:bg-blue-50 transition-colors group"
            onClick={() => handleMetricClick('roas')}
          >
            <div className="font-medium flex items-center gap-2">
              ROAS (40%)
              <HelpCircle className="h-3 w-3 text-muted-foreground group-hover:text-blue-500" />
            </div>
            <div className="text-muted-foreground">Return on Ad Spend</div>
          </div>
          <div 
            className="cursor-pointer p-3 rounded-lg border hover:border-blue-300 hover:bg-blue-50 transition-colors group"
            onClick={() => handleMetricClick('pacing')}
          >
            <div className="font-medium flex items-center gap-2">
              Delivery Pacing (30%)
              <HelpCircle className="h-3 w-3 text-muted-foreground group-hover:text-blue-500" />
            </div>
            <div className="text-muted-foreground">Actual vs Expected</div>
          </div>
          <div 
            className="cursor-pointer p-3 rounded-lg border hover:border-blue-300 hover:bg-blue-50 transition-colors group"
            onClick={() => handleMetricClick('burnrate')}
          >
            <div className="font-medium flex items-center gap-2">
              Burn Rate (15%)
              <HelpCircle className="h-3 w-3 text-muted-foreground group-hover:text-blue-500" />
            </div>
            <div className="text-muted-foreground">Recent delivery pace</div>
          </div>
          <div 
            className="cursor-pointer p-3 rounded-lg border hover:border-blue-300 hover:bg-blue-50 transition-colors group"
            onClick={() => handleMetricClick('overspend')}
          >
            <div className="font-medium flex items-center gap-2">
              Overspend Risk (15%)
              <HelpCircle className="h-3 w-3 text-muted-foreground group-hover:text-blue-500" />
            </div>
            <div className="text-muted-foreground">Budget tracking</div>
          </div>
        </div>
      </Card>

      {/* Campaign Health Scatter Plot */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Campaign Health vs Completion</h3>
        <div className="mb-4 text-sm text-muted-foreground">
          This chart shows the relationship between campaign completion percentage and health score. 
          Green dots indicate healthy campaigns (≥7), yellow indicates warning (4-6.9), and red indicates critical (&lt;4).
        </div>
        <CampaignHealthScatterPlot healthData={healthData} />
      </Card>
      
      {/* Metric Explanation Modal */}
      <MetricExplanationModal 
        open={modalOpen}
        onOpenChange={setModalOpen}
        metric={selectedMetric}
      />
    </div>
  );
};

export default CampaignHealthTab;
