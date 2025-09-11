
import { useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";

interface PacingTableProps {
  data: any[];
}

const PacingTable = ({ data }: PacingTableProps) => {
  const processedData = useMemo(() => {
    console.log("Processing pacing data:", data);
    
    return data.map((row, index) => {
      // Debug: log the first few rows to see column names and values
      if (index < 3) {
        console.log(`Row ${index + 1} keys:`, Object.keys(row));
        console.log(`Row ${index + 1} data:`, row);
      }
      
      // Get campaign name from various possible column names
      const campaign = row.Campaign || row.CAMPAIGN || row["CAMPAIGN ORDER NAME"] || "";
      
      // Get pacing metrics - add more flexible column name matching
      const daysIntoFlightRaw = row["Days into Flight"] || row["DAYS INTO FLIGHT"] || row["Days Into Flight"] || row["DAYS_INTO_FLIGHT"] || "";
      const daysLeftRaw = row["Days Left"] || row["DAYS LEFT"] || row["DAYS_LEFT"] || "";
      const expectedImpsRaw = row["Expected Imps"] || row["EXPECTED IMPS"] || row["EXPECTED_IMPS"] || "";
      const actualImpsRaw = row["Actual Imps"] || row["ACTUAL IMPS"] || row["ACTUAL_IMPS"] || "";
      const impsLeftRaw = row["Imps Left"] || row["IMPS LEFT"] || row["IMPS_LEFT"] || "";
      const impsYesterdayRaw = row["Imps Yesterday"] || row["IMPS YESTERDAY"] || row["IMPS_YESTERDAY"] || "";
      const dailyAvgLeftRaw = row["Daily Avg Left"] || row["DAILY AVG LEFT"] || row["DAILY_AVG_LEFT"] || "";
      
      // Debug: log the raw values for the first few rows
      if (index < 3) {
        console.log(`Row ${index + 1} Days into Flight raw:`, daysIntoFlightRaw);
        console.log(`Row ${index + 1} Days Left raw:`, daysLeftRaw);
      }
      
      // Convert to numbers
      const daysIntoFlight = Number(daysIntoFlightRaw) || 0;
      const daysLeft = Number(daysLeftRaw) || 0;
      const expectedImps = Number(expectedImpsRaw) || 0;
      const actualImps = Number(actualImpsRaw) || 0;
      const impsLeft = Number(impsLeftRaw) || 0;
      const impsYesterday = Number(impsYesterdayRaw) || 0;
      const dailyAvgLeft = Number(dailyAvgLeftRaw) || 0;
      
      // Calculate delivery rate
      const deliveryRate = expectedImps > 0 ? (actualImps / expectedImps) * 100 : 0;
      
      // Calculate yesterday's delivery
      const yesterdayDelivery = dailyAvgLeft > 0 ? (impsYesterday / dailyAvgLeft) * 100 : 0;
      
      return {
        campaign,
        daysIntoFlight,
        daysLeft,
        expectedImps,
        actualImps,
        impsLeft,
        impsYesterday,
        dailyAvgLeft,
        deliveryRate,
        yesterdayDelivery
      };
    });
  }, [data]);

  const getStatusColor = (percentage: number) => {
    const deviation = Math.abs(percentage - 100);
    if (deviation <= 2) return "bg-green-100 text-green-800";
    if (deviation <= 10) return "bg-orange-100 text-orange-800";
    return "bg-red-100 text-red-800";
  };

  const getStatusBadge = (percentage: number) => {
    const deviation = Math.abs(percentage - 100);
    if (deviation <= 2) return <Badge className="bg-green-500">On Pace</Badge>;
    if (deviation <= 10) return <Badge className="bg-orange-500">Caution</Badge>;
    return <Badge className="bg-red-500">Off Pace</Badge>;
  };

  const formatNumber = (num: number) => num.toLocaleString();
  const formatPercentage = (num: number) => `${num.toFixed(1)}%`;

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-muted-foreground">No pacing data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Campaign Pacing Analysis</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead className="text-right">Days Into Flight</TableHead>
                <TableHead className="text-right">Days Left</TableHead>
                <TableHead className="text-right">Expected Imps</TableHead>
                <TableHead className="text-right">Actual Imps</TableHead>
                <TableHead className="text-right">Imps Left</TableHead>
                <TableHead className="text-right">Imps Yesterday</TableHead>
                <TableHead className="text-right">Daily Avg Left</TableHead>
                <TableHead className="text-right">Delivery Rate</TableHead>
                <TableHead className="text-right">Yesterday's Delivery</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {processedData.map((row, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium max-w-xs truncate" title={row.campaign}>
                    {row.campaign}
                  </TableCell>
                  <TableCell className="text-right">{row.daysIntoFlight}</TableCell>
                  <TableCell className="text-right">{row.daysLeft}</TableCell>
                  <TableCell className="text-right">{formatNumber(row.expectedImps)}</TableCell>
                  <TableCell className="text-right">{formatNumber(row.actualImps)}</TableCell>
                  <TableCell className="text-right">{formatNumber(row.impsLeft)}</TableCell>
                  <TableCell className="text-right">{formatNumber(row.impsYesterday)}</TableCell>
                  <TableCell className="text-right">{formatNumber(row.dailyAvgLeft)}</TableCell>
                  <TableCell className={`text-right font-semibold ${getStatusColor(row.deliveryRate)}`}>
                    {formatPercentage(row.deliveryRate)}
                  </TableCell>
                  <TableCell className={`text-right font-semibold ${getStatusColor(row.yesterdayDelivery)}`}>
                    {formatPercentage(row.yesterdayDelivery)}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(row.deliveryRate)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default PacingTable;
