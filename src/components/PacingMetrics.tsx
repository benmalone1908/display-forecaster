
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { TrendingUp, TrendingDown, Target, AlertTriangle } from "lucide-react";

interface PacingMetricsProps {
  data: any[];
}

const PacingMetrics = ({ data }: PacingMetricsProps) => {
  const metrics = useMemo(() => {
    if (!data || data.length === 0) {
      return {
        totalCampaigns: 0,
        onPace: 0,
        caution: 0,
        offPace: 0,
        avgDeliveryRate: 0,
        avgYesterdayDelivery: 0
      };
    }

    let totalExpected = 0;
    let totalActual = 0;
    let totalYesterday = 0;
    let totalDailyAvg = 0;
    let onPace = 0;
    let caution = 0;
    let offPace = 0;

    data.forEach(row => {
      const expectedImps = Number(row["Expected Imps"] || row["EXPECTED IMPS"]) || 0;
      const actualImps = Number(row["Actual Imps"] || row["ACTUAL IMPS"]) || 0;
      const impsYesterday = Number(row["Imps Yesterday"] || row["IMPS YESTERDAY"]) || 0;
      const dailyAvgLeft = Number(row["Daily Avg Left"] || row["DAILY AVG LEFT"]) || 0;

      totalExpected += expectedImps;
      totalActual += actualImps;
      totalYesterday += impsYesterday;
      totalDailyAvg += dailyAvgLeft;

      // Calculate delivery rate for this campaign
      const deliveryRate = expectedImps > 0 ? (actualImps / expectedImps) * 100 : 0;
      const deviation = Math.abs(deliveryRate - 100);

      if (deviation <= 2) onPace++;
      else if (deviation <= 10) caution++;
      else offPace++;
    });

    const avgDeliveryRate = totalExpected > 0 ? (totalActual / totalExpected) * 100 : 0;
    const avgYesterdayDelivery = totalDailyAvg > 0 ? (totalYesterday / totalDailyAvg) * 100 : 0;

    return {
      totalCampaigns: data.length,
      onPace,
      caution,
      offPace,
      avgDeliveryRate,
      avgYesterdayDelivery
    };
  }, [data]);

  const getStatusIcon = (rate: number) => {
    const deviation = Math.abs(rate - 100);
    if (deviation <= 2) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (deviation <= 10) return <AlertTriangle className="h-4 w-4 text-orange-600" />;
    return <TrendingDown className="h-4 w-4 text-red-600" />;
  };

  const formatPercentage = (num: number) => `${num.toFixed(1)}%`;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Campaigns</CardTitle>
          <Target className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{metrics.totalCampaigns}</div>
          <div className="flex gap-2 mt-2">
            <Badge className="bg-green-500 text-xs">{metrics.onPace} On Pace</Badge>
            <Badge className="bg-orange-500 text-xs">{metrics.caution} Caution</Badge>
            <Badge className="bg-red-500 text-xs">{metrics.offPace} Off Pace</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Overall Delivery Rate</CardTitle>
          {getStatusIcon(metrics.avgDeliveryRate)}
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatPercentage(metrics.avgDeliveryRate)}</div>
          <p className="text-xs text-muted-foreground">
            Portfolio average delivery vs expected
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Yesterday's Performance</CardTitle>
          {getStatusIcon(metrics.avgYesterdayDelivery)}
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatPercentage(metrics.avgYesterdayDelivery)}</div>
          <p className="text-xs text-muted-foreground">
            Yesterday vs daily average needed
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Campaigns at Risk</CardTitle>
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">{metrics.offPace}</div>
          <p className="text-xs text-muted-foreground">
            {metrics.totalCampaigns > 0 ? ((metrics.offPace / metrics.totalCampaigns) * 100).toFixed(1) : 0}% of total campaigns
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default PacingMetrics;
