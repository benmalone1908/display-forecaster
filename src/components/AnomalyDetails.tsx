
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getColorClasses } from "@/utils/anomalyColors";
import { useState, useEffect } from "react";

interface AnomalyDetailsProps {
  anomalies: any[];
  metric: string;
  anomalyPeriod: "daily" | "weekly";
  initialIndex?: number;
  onClose?: () => void;
}

const AnomalyDetails = ({ anomalies, metric, anomalyPeriod, initialIndex, onClose }: AnomalyDetailsProps) => {
  const [selectedAnomaly, setSelectedAnomaly] = useState<any | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showAllAnomalies, setShowAllAnomalies] = useState(false);

  useEffect(() => {
    if (initialIndex !== undefined) {
      if (initialIndex === -1) {
        // Special case: -1 means show all anomalies list view
        setShowAllAnomalies(true);
        setDialogOpen(true);
      } else if (anomalies && anomalies[initialIndex]) {
        setSelectedAnomaly(anomalies[initialIndex]);
        setDialogOpen(true);
      }
    }
  }, [initialIndex, anomalies]);

  if (!anomalies || anomalies.length === 0) {
    return null;
  }

  const openDetails = (anomaly: any) => {
    setSelectedAnomaly(anomaly);
    setShowAllAnomalies(false);
    setDialogOpen(true);
  };

  const closeDetails = () => {
    setSelectedAnomaly(null);
    setShowAllAnomalies(false);
    setDialogOpen(false);
    if (onClose) {
      onClose();
    }
  };

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open && onClose) {
      onClose();
    }
  };

  const renderAnomalyDetail = (anomaly: any) => {
    const colorClasses = getColorClasses(anomaly.deviation);
    const colorClass = colorClasses.split(' ').find(c => c.startsWith('text-'));
    
    const hasDetails = anomalyPeriod === "weekly" && 
                      Array.isArray(anomaly.rows) && 
                      anomaly.rows.length > 0;
    
    let dateRangeInfo = "";
    if (hasDetails) {
      try {
        const dates = anomaly.rows.map((row: any) => new Date(row.DATE));
        
        const firstDate = new Date(Math.min(...dates.map(d => d.getTime())));
        const lastDate = new Date(Math.max(...dates.map(d => d.getTime())));
        
        const formatDate = (date: Date) => {
          return `${date.getMonth() + 1}/${date.getDate()}`;
        };
        
        dateRangeInfo = `(${formatDate(firstDate)} - ${formatDate(lastDate)})`;
      } catch (error) {
        console.error("Error formatting date range:", error);
      }
    }
    
    return (
      <div className="p-3 border rounded-lg text-xs">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-medium text-sm">{anomaly.campaign}</h3>
            <p className="text-muted-foreground text-xs">
              {anomaly.DATE}
              {dateRangeInfo && <span className="ml-1 text-xs">{dateRangeInfo}</span>}
            </p>
          </div>
          <div className={`px-2 py-0.5 rounded-full ${colorClasses}`}>
            <span className="text-xs font-medium">
              {anomaly.deviation > 0 ? "+" : ""}{anomaly.deviation.toFixed(1)}%
            </span>
          </div>
        </div>
        
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Actual Value</p>
            <p className="text-sm font-bold">{Math.round(anomaly.actualValue).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Expected (Mean)</p>
            <p className="text-sm font-bold">{Math.round(anomaly.mean).toLocaleString()}</p>
          </div>
        </div>
        
        {hasDetails && (
          <div className="mt-3">
            <p className="text-xs font-medium mb-1">Daily breakdown:</p>
            <div className="bg-muted/50 p-1.5 rounded text-xs">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-muted">
                    <th className="text-left py-1 font-medium">Date</th>
                    <th className="text-right py-1 font-medium">Actual</th>
                    <th className="text-right py-1 font-medium">Expected</th>
                    <th className="text-right py-1 font-medium">Deviation</th>
                  </tr>
                </thead>
                <tbody>
                  {anomaly.rows.map((row: any, idx: number) => {
                    const actualValue = Number(row[metric]);
                    
                    let expectedValue;
                    
                    if (anomaly.dailyExpectedValues && anomaly.dailyExpectedValues[idx]) {
                      expectedValue = anomaly.dailyExpectedValues[idx];
                    } 
                    else {
                      expectedValue = anomaly.mean / anomaly.rows.length;
                    }
                    
                    const dailyDeviation = expectedValue !== 0 
                      ? ((actualValue - expectedValue) / expectedValue) * 100 
                      : 0;
                    
                    const dailyColorClass = getColorClasses(dailyDeviation).split(' ').find(c => c.startsWith('text-'));
                    
                    return (
                      <tr key={idx} className="border-b last:border-b-0 border-muted">
                        <td className="py-1 text-left font-medium">{row.DATE}</td>
                        <td className="py-1 text-right">{Math.round(actualValue).toLocaleString()}</td>
                        <td className="py-1 text-right">{Math.round(expectedValue).toLocaleString()}</td>
                        <td className={`py-1 text-right ${dailyColorClass}`}>
                          {dailyDeviation > 0 ? "+" : ""}{dailyDeviation.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Show all anomalies dialog
  if (showAllAnomalies) {
    return (
      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent 
          className="max-w-3xl max-h-[80vh] overflow-hidden text-sm"
          style={{ 
            width: "1000px", 
            maxWidth: "1000px !important",
            minWidth: "1000px",
            transform: "translate(-50%, -50%)"
          }}
        >
          <DialogHeader className="sticky top-0 bg-background z-10 pb-3">
            <DialogTitle className="text-base">
              {metric.charAt(0) + metric.slice(1).toLowerCase()} Anomalies
            </DialogTitle>
            <DialogDescription className="text-xs">
              Showing all {anomalies.length} {anomalyPeriod} anomalies detected in the data
            </DialogDescription>
          </DialogHeader>
          
          <div className="overflow-y-auto" style={{ maxHeight: "calc(80vh - 140px)" }}>
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="text-xs">Campaign</TableHead>
                  <TableHead className="whitespace-nowrap text-xs">{anomalyPeriod === "daily" ? "Date" : "Week"}</TableHead>
                  <TableHead className="text-xs">Value</TableHead>
                  <TableHead className="text-xs">Expected</TableHead>
                  <TableHead className="text-xs">Deviation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {anomalies.map((anomaly, index) => {
                  const colorClass = getColorClasses(anomaly.deviation).split(' ').find(c => c.startsWith('text-'));
                  
                  // Determine if campaign name should be clickable
                  const isCampaignClickable = anomalyPeriod === "weekly";
                  
                  return (
                    <TableRow key={index}>
                      <TableCell 
                        className={`font-medium text-xs ${isCampaignClickable ? 'cursor-pointer hover:underline hover:text-primary' : ''}`}
                        onClick={isCampaignClickable ? () => openDetails(anomaly) : undefined}
                      >
                        {anomaly.campaign}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">{anomaly.DATE}</TableCell>
                      <TableCell className="text-xs">{Math.round(anomaly.actualValue).toLocaleString()}</TableCell>
                      <TableCell className="text-xs">{Math.round(anomaly.mean).toLocaleString()}</TableCell>
                      <TableCell className={`text-xs ${colorClass}`}>
                        {anomaly.deviation > 0 ? "+" : ""}{anomaly.deviation.toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // View single anomaly dialog
  return (
    <>
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="ghost" className="h-7 px-2">View all</Button>
        </DialogTrigger>
        <DialogContent 
          className="max-w-3xl max-h-[80vh] overflow-hidden text-sm"
          style={{ 
            width: "1000px", 
            maxWidth: "1000px !important",
            minWidth: "1000px",
            transform: "translate(-50%, -50%)"
          }}
        >
          <DialogHeader className="sticky top-0 bg-background z-10 pb-3">
            <DialogTitle className="text-base">
              {metric.charAt(0) + metric.slice(1).toLowerCase()} Anomalies
            </DialogTitle>
            <DialogDescription className="text-xs">
              Showing {anomalies.length} {anomalyPeriod} anomalies detected in the data
            </DialogDescription>
          </DialogHeader>
          
          <div className="overflow-y-auto" style={{ maxHeight: "calc(80vh - 140px)" }}>
            <Table>
              <TableHeader className="sticky top-0 bg-background z-10">
                <TableRow>
                  <TableHead className="text-xs">Campaign</TableHead>
                  <TableHead className="whitespace-nowrap text-xs">{anomalyPeriod === "daily" ? "Date" : "Week"}</TableHead>
                  <TableHead className="text-xs">Value</TableHead>
                  <TableHead className="text-xs">Expected</TableHead>
                  <TableHead className="text-xs">Deviation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {anomalies.map((anomaly, index) => {
                  const colorClass = getColorClasses(anomaly.deviation).split(' ').find(c => c.startsWith('text-'));
                  
                  // Determine if campaign name should be clickable
                  const isCampaignClickable = anomalyPeriod === "weekly";
                  
                  return (
                    <TableRow key={index}>
                      <TableCell 
                        className={`font-medium text-xs ${isCampaignClickable ? 'cursor-pointer hover:underline hover:text-primary' : ''}`}
                        onClick={isCampaignClickable ? () => openDetails(anomaly) : undefined}
                      >
                        {anomaly.campaign}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">{anomaly.DATE}</TableCell>
                      <TableCell className="text-xs">{Math.round(anomaly.actualValue).toLocaleString()}</TableCell>
                      <TableCell className="text-xs">{Math.round(anomaly.mean).toLocaleString()}</TableCell>
                      <TableCell className={`text-xs ${colorClass}`}>
                        {anomaly.deviation > 0 ? "+" : ""}{anomaly.deviation.toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {selectedAnomaly && (
        <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
          <DialogContent 
            className="max-h-[80vh] overflow-y-auto text-xs" 
            style={{ 
              width: "700px", 
              maxWidth: "700px !important",
              minWidth: "700px",
              transform: "translate(-50%, -50%)"
            }}
          >
            <DialogHeader>
              <DialogTitle className="text-base">Anomaly Details</DialogTitle>
              <DialogDescription className="text-xs">
                Detailed view for {selectedAnomaly.campaign}
              </DialogDescription>
            </DialogHeader>
            {renderAnomalyDetail(selectedAnomaly)}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default AnomalyDetails;
