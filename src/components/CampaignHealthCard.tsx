
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { CampaignHealthData } from "@/utils/campaignHealthScoring";

interface CampaignHealthCardProps {
  campaign: CampaignHealthData;
}

const CampaignHealthCard = ({ campaign }: CampaignHealthCardProps) => {
  const getHealthColor = (score: number) => {
    if (score >= 7) return "text-green-600";
    if (score >= 4) return "text-yellow-600";
    return "text-red-600";
  };

  const getHealthBadgeColor = (score: number) => {
    if (score >= 7) return "bg-green-100 text-green-800";
    if (score >= 4) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  };

  const getScoreColor = (score: number, maxScore: number = 10) => {
    const percentage = (score / maxScore) * 100;
    if (percentage >= 70) return "text-green-600";
    if (percentage >= 40) return "text-yellow-600";
    return "text-red-600";
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value);
  };

  // Calculate angle for needle (0-180 degrees for semicircle)
  const needleAngle = (campaign.healthScore / 10) * 180;

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg font-semibold text-gray-900 leading-tight">
            {campaign.campaignName}
          </CardTitle>
          <Badge className={getHealthBadgeColor(campaign.healthScore)}>
            {campaign.healthScore >= 7 ? 'Healthy' : campaign.healthScore >= 4 ? 'Warning' : 'Critical'}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Semicircle Fuel Gauge for Health Score */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">Health Score</span>
            <span className={`text-xl font-bold ${getHealthColor(campaign.healthScore)}`}>
              {campaign.healthScore}/10
            </span>
          </div>
          
          <div className="relative w-full h-32 flex items-end justify-center">
            <svg width="240" height="120" viewBox="0 0 240 120" className="absolute">
              {/* Background semicircle */}
              <path
                d="M 30 100 A 80 80 0 0 1 210 100"
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="16"
                strokeLinecap="round"
              />
              
              {/* Red zone (0-4) */}
              <path
                d="M 30 100 A 80 80 0 0 1 120 20"
                fill="none"
                stroke="#ef4444"
                strokeWidth="16"
                strokeLinecap="round"
                opacity="0.7"
              />
              
              {/* Yellow zone (4-7) */}
              <path
                d="M 120 20 A 80 80 0 0 1 174 47"
                fill="none"
                stroke="#eab308"
                strokeWidth="16"
                strokeLinecap="round"
                opacity="0.7"
              />
              
              {/* Green zone (7-10) */}
              <path
                d="M 174 47 A 80 80 0 0 1 210 100"
                fill="none"
                stroke="#22c55e"
                strokeWidth="16"
                strokeLinecap="round"
                opacity="0.7"
              />
              
              {/* Progress indicator based on score */}
              <path
                d={`M 30 100 A 80 80 0 ${needleAngle > 90 ? '1' : '0'} 1 ${
                  120 + 80 * Math.cos((needleAngle - 90) * Math.PI / 180)
                } ${
                  100 - 80 * Math.sin((needleAngle - 90) * Math.PI / 180)
                }`}
                fill="none"
                stroke={campaign.healthScore >= 7 ? "#22c55e" : campaign.healthScore >= 4 ? "#eab308" : "#ef4444"}
                strokeWidth="16"
                strokeLinecap="round"
              />
              
              {/* Needle */}
              <line
                x1="120"
                y1="100"
                x2={120 + 65 * Math.cos((needleAngle - 90) * Math.PI / 180)}
                y2={100 - 65 * Math.sin((needleAngle - 90) * Math.PI / 180)}
                stroke="#dc2626"
                strokeWidth="3"
                strokeLinecap="round"
              />
              
              {/* Center circle */}
              <circle cx="120" cy="100" r="6" fill="#374151" />
              <circle cx="120" cy="100" r="3" fill="#dc2626" />
            </svg>
            
            {/* Scale labels */}
            <div className="absolute bottom-0 w-full flex justify-between text-xs text-gray-500 px-4">
              <span>0</span>
              <span>5</span>
              <span>10</span>
            </div>
          </div>
        </div>

        {/* Campaign Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <span className="text-sm text-gray-600">Spend</span>
            <div className="text-lg font-semibold">{formatCurrency(campaign.spend)}</div>
          </div>
          <div className="space-y-1">
            <span className="text-sm text-gray-600">Attributed Sales</span>
            <div className="text-lg font-semibold">{formatCurrency(campaign.revenue)}</div>
          </div>
          <div className="space-y-1">
            <span className="text-sm text-gray-600">Impressions</span>
            <div className="text-lg font-semibold">{formatNumber(campaign.impressions)}</div>
          </div>
          <div className="space-y-1">
            <span className="text-sm text-gray-600">Clicks</span>
            <div className="text-lg font-semibold">{formatNumber(campaign.clicks)}</div>
          </div>
        </div>

        {/* Score Breakdown */}
        <div className="space-y-3 border-t pt-4">
          <h4 className="text-sm font-medium text-gray-700">Score Breakdown</h4>
          
          <div className="grid grid-cols-1 gap-3">
            {/* ROAS Score */}
            <div className="flex justify-between items-center">
              <div className="flex flex-col">
                <span className="text-sm text-gray-600">ROAS (40%)</span>
                <span className="text-xs text-gray-500">{campaign.roas?.toFixed(2)}x</span>
              </div>
              <div className={`text-right ${getScoreColor(campaign.roasScore)}`}>
                <div className="font-semibold">{campaign.roasScore}/10</div>
              </div>
            </div>

            {/* Delivery Pacing Score */}
            <div className="flex justify-between items-center">
              <div className="flex flex-col">
                <span className="text-sm text-gray-600">Delivery Pacing (30%)</span>
                <span className="text-xs text-gray-500">{campaign.pace?.toFixed(1)}%</span>
              </div>
              <div className={`text-right ${getScoreColor(campaign.deliveryPacingScore)}`}>
                <div className="font-semibold">{campaign.deliveryPacingScore}/10</div>
              </div>
            </div>

            {/* Burn Rate Score */}
            <div className="flex justify-between items-center">
              <div className="flex flex-col">
                <span className="text-sm text-gray-600">Burn Rate (15%)</span>
                <span className="text-xs text-gray-500">{campaign.burnRateConfidence}</span>
              </div>
              <div className={`text-right ${getScoreColor(campaign.burnRateScore)}`}>
                <div className="font-semibold">{campaign.burnRateScore}/10</div>
              </div>
            </div>

            {/* CTR Score */}
            <div className="flex justify-between items-center">
              <div className="flex flex-col">
                <span className="text-sm text-gray-600">CTR (10%)</span>
                <span className="text-xs text-gray-500">{campaign.ctr?.toFixed(2)}%</span>
              </div>
              <div className={`text-right ${getScoreColor(campaign.ctrScore)}`}>
                <div className="font-semibold">{campaign.ctrScore}/10</div>
              </div>
            </div>

            {/* Overspend Score */}
            <div className="flex justify-between items-center">
              <div className="flex flex-col">
                <span className="text-sm text-gray-600">Overspend Risk (5%)</span>
                <span className="text-xs text-gray-500">Budget tracking</span>
              </div>
              <div className={`text-right ${getScoreColor(campaign.overspendScore, 5)}`}>
                <div className="font-semibold">{campaign.overspendScore}/5</div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CampaignHealthCard;
