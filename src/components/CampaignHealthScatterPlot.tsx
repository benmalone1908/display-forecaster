import { useMemo, useState, useRef, useEffect } from "react";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, ResponsiveContainer, ReferenceLine, ReferenceArea, Cell } from "recharts";
import { CampaignHealthData } from "@/utils/campaignHealthScoring";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "./ui/chart";
import { Button } from "./ui/button";
import { ZoomIn, ZoomOut, RotateCcw, X } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/accordion";
import QuadrantZoomModal from "./QuadrantZoomModal";
import { calculateTooltipPosition, getTooltipZIndex, createScrollHandler } from "@/utils/tooltipPositioning";

interface CampaignHealthScatterPlotProps {
  healthData: CampaignHealthData[];
}

interface ZoomState {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  level: number;
}

interface ModalState {
  open: boolean;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

interface TooltipState {
  visible: boolean;
  campaigns: CampaignHealthData[];
  x: number;
  y: number;
}

const CampaignHealthScatterPlot = ({ healthData }: CampaignHealthScatterPlotProps) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  
  const [zoomState, setZoomState] = useState<ZoomState>({
    xMin: 0,
    xMax: 100,
    yMin: 0,
    yMax: 10,
    level: 0
  });

  const [modalState, setModalState] = useState<ModalState>({
    open: false,
    xMin: 0,
    xMax: 0,
    yMin: 0,
    yMax: 0
  });

  const [tooltipState, setTooltipState] = useState<TooltipState>({
    visible: false,
    campaigns: [],
    x: 0,
    y: 0
  });

  const chartData = useMemo(() => {
    // Group campaigns by their coordinates to detect overlaps
    const coordinateGroups = new Map<string, CampaignHealthData[]>();
    
    healthData.forEach(campaign => {
      const key = `${campaign.completionPercentage.toFixed(1)}-${campaign.healthScore.toFixed(1)}`;
      if (!coordinateGroups.has(key)) {
        coordinateGroups.set(key, []);
      }
      coordinateGroups.get(key)!.push(campaign);
    });

    return healthData.map(campaign => {
      const key = `${campaign.completionPercentage.toFixed(1)}-${campaign.healthScore.toFixed(1)}`;
      const groupSize = coordinateGroups.get(key)?.length || 1;
      
      return {
        x: campaign.completionPercentage,
        y: campaign.healthScore,
        name: campaign.campaignName,
        fill: getHealthColor(campaign.healthScore),
        campaignData: campaign,
        groupSize,
        isMultiple: groupSize > 1
      };
    });
  }, [healthData]);

  const chartConfig = {
    healthScore: {
      label: "Health Score",
    },
    completionPercentage: {
      label: "Completion %",
    },
  };

  // Generate custom tick arrays based on current zoom level
  const xTicks = useMemo(() => {
    const ticks = [];
    const increment = zoomState.level === 0 ? 20 : (zoomState.xMax - zoomState.xMin) / 5;
    for (let i = zoomState.xMin; i <= zoomState.xMax; i += increment) {
      ticks.push(Math.round(i));
    }
    return ticks;
  }, [zoomState]);

  const yTicks = useMemo(() => {
    const ticks = [];
    const increment = zoomState.level === 0 ? 2 : (zoomState.yMax - zoomState.yMin) / 5;
    for (let i = zoomState.yMin; i <= zoomState.yMax; i += increment) {
      ticks.push(Math.round(i * 10) / 10); // Round to 1 decimal place
    }
    return ticks;
  }, [zoomState]);

  const handleQuadrantClick = (xStart: number, xEnd: number, yStart: number, yEnd: number) => {
    setModalState({
      open: true,
      xMin: xStart,
      xMax: xEnd,
      yMin: yStart,
      yMax: yEnd
    });
  };

  const handleReset = () => {
    setZoomState({
      xMin: 0,
      xMax: 100,
      yMin: 0,
      yMax: 10,
      level: 0
    });
  };

  const handleZoomOut = () => {
    if (zoomState.level > 0) {
      const xRange = zoomState.xMax - zoomState.xMin;
      const yRange = zoomState.yMax - zoomState.yMin;
      const newXMin = Math.max(0, zoomState.xMin - xRange * 0.5);
      const newXMax = Math.min(100, zoomState.xMax + xRange * 0.5);
      const newYMin = Math.max(0, zoomState.yMin - yRange * 0.5);
      const newYMax = Math.min(10, zoomState.yMax + yRange * 0.5);
      
      setZoomState({
        xMin: newXMin,
        xMax: newXMax,
        yMin: newYMin,
        yMax: newYMax,
        level: Math.max(0, zoomState.level - 1)
      });
    }
  };

  const handleScatterClick = (data: any, event: any) => {
    console.log('Scatter clicked:', data, event);
    event?.stopPropagation?.();
    
    if (event) {
      const clientX = event.clientX || event.nativeEvent?.clientX || 100;
      const clientY = event.clientY || event.nativeEvent?.clientY || 100;
      
      // Find matching campaigns
      const tolerance = 0.5;
      const matchingCampaigns = healthData.filter(campaign => {
        const xMatch = Math.abs(campaign.completionPercentage - data.x) <= tolerance;
        const yMatch = Math.abs(campaign.healthScore - data.y) <= tolerance;
        return xMatch && yMatch;
      });
      
      // Calculate optimal tooltip position with expanded dimensions to match modal
      const tooltipDimensions = {
        width: 480, // Larger width to match quadrant modal
        height: matchingCampaigns.length === 1 ? 250 : Math.min(300, matchingCampaigns.length * 50 + 80)
      };
      
      const position = calculateTooltipPosition(clientX, clientY, tooltipDimensions);
      
      setTooltipState({
        visible: true,
        campaigns: matchingCampaigns,
        x: position.x,
        y: position.y
      });
    }
  };

  const closeTooltip = () => {
    setTooltipState({
      visible: false,
      campaigns: [],
      x: 0,
      y: 0
    });
  };

  // Hide tooltip on scroll, but not when scrolling within the tooltip or modal
  useEffect(() => {
    if (!tooltipState.visible) return;
    
    const scrollHandler = (event: Event) => {
      // Don't close tooltip if scrolling within the tooltip itself
      const target = event.target as Element;
      const tooltipElement = document.querySelector('[data-tooltip-content]');
      
      // Check if the scroll event is coming from within the tooltip
      if (tooltipElement && (tooltipElement === target || tooltipElement.contains(target))) {
        return; // Don't close tooltip for internal scrolling
      }
      
      // Check if the scroll event is coming from within a modal dialog
      const modalDialog = document.querySelector('[role="dialog"]');
      if (modalDialog && (modalDialog === target || modalDialog.contains(target))) {
        return; // Don't close tooltip for modal scrolling
      }
      
      closeTooltip();
    };
    
    // Add scroll listeners to window and potential modal containers
    window.addEventListener('scroll', scrollHandler, true);
    
    return () => {
      window.removeEventListener('scroll', scrollHandler, true);
    };
  }, [tooltipState.visible]);

  // Generate clickable ReferenceArea components for quadrants
  const generateQuadrantAreas = () => {
    const areas = [];
    
    if (zoomState.level === 0) {
      // Use actual axis increments: 20% for x-axis, 2 points for y-axis
      const xIncrements = [0, 20, 40, 60, 80, 100];
      const yIncrements = [0, 2, 4, 6, 8, 10];

      for (let i = 0; i < xIncrements.length - 1; i++) {
        for (let j = 0; j < yIncrements.length - 1; j++) {
          const xStart = xIncrements[i];
          const xEnd = xIncrements[i + 1];
          const yStart = yIncrements[j];
          const yEnd = yIncrements[j + 1];

          areas.push(
            <ReferenceArea
              key={`quadrant-${i}-${j}`}
              x1={xStart}
              x2={xEnd}
              y1={yStart}
              y2={yEnd}
              fill="transparent"
              stroke="rgba(59, 130, 246, 0.2)"
              strokeWidth={1}
              className="cursor-pointer hover:fill-blue-50 hover:fill-opacity-20 transition-all"
              onClick={() => handleQuadrantClick(xStart, xEnd, yStart, yEnd)}
            />
          );
        }
      }
    } else {
      // For zoomed views, create 5x5 sub-quadrants
      const xStep = (zoomState.xMax - zoomState.xMin) / 5;
      const yStep = (zoomState.yMax - zoomState.yMin) / 5;

      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 5; j++) {
          const xStart = zoomState.xMin + i * xStep;
          const xEnd = zoomState.xMin + (i + 1) * xStep;
          const yStart = zoomState.yMin + j * yStep;
          const yEnd = zoomState.yMin + (j + 1) * yStep;

          areas.push(
            <ReferenceArea
              key={`quadrant-${i}-${j}`}
              x1={xStart}
              x2={xEnd}
              y1={yStart}
              y2={yEnd}
              fill="transparent"
              stroke="rgba(59, 130, 246, 0.2)"
              strokeWidth={1}
              className="cursor-pointer hover:fill-blue-50 hover:fill-opacity-20 transition-all"
              onClick={() => handleQuadrantClick(xStart, xEnd, yStart, yEnd)}
            />
          );
        }
      }
    }
    return areas;
  };

  const renderBurnRateDetails = (campaign: CampaignHealthData) => {
    if (!campaign.burnRateData) return null;

    const { oneDayRate, threeDayRate, sevenDayRate, oneDayPercentage, threeDayPercentage, sevenDayPercentage, confidence } = campaign.burnRateData;

    return (
      <div className="border-t pt-2 mt-2">
        <div className="text-xs font-medium mb-1">Burn Rate Details:</div>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className={confidence === 'high' ? 'font-medium text-green-700' : ''}>1-Day Rate:</span>
            <span className={confidence === 'high' ? 'font-medium text-green-700' : ''}>{oneDayRate.toLocaleString()} impressions ({oneDayPercentage.toFixed(1)}%)</span>
          </div>
          <div className="flex justify-between">
            <span className={confidence === 'medium' ? 'font-medium text-yellow-700' : ''}>3-Day Rate:</span>
            <span className={confidence === 'medium' ? 'font-medium text-yellow-700' : ''}>{threeDayRate.toLocaleString()} impressions ({threeDayPercentage.toFixed(1)}%)</span>
          </div>
          <div className="flex justify-between">
            <span className={confidence === 'low' ? 'font-medium text-red-700' : ''}>7-Day Rate:</span>
            <span className={confidence === 'low' ? 'font-medium text-red-700' : ''}>{sevenDayRate.toLocaleString()} impressions ({sevenDayPercentage.toFixed(1)}%)</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Confidence:</span>
            <span className="capitalize">{confidence}</span>
          </div>
        </div>
      </div>
    );
  };

  if (healthData.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No campaign health data available for plotting
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Zoom Controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">
            {zoomState.level === 0 ? "Full View" : `Zoom Level ${zoomState.level}`}
          </span>
          {zoomState.level > 0 && (
            <span className="text-xs text-gray-500">
              ({zoomState.xMin.toFixed(0)}-{zoomState.xMax.toFixed(0)}%, {zoomState.yMin.toFixed(1)}-{zoomState.yMax.toFixed(1)})
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleZoomOut}
            disabled={zoomState.level === 0}
            className="flex items-center gap-1"
          >
            <ZoomOut className="h-3 w-3" />
            Zoom Out
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={zoomState.level === 0}
            className="flex items-center gap-1"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </Button>
        </div>
      </div>

      <div className="w-full border border-gray-200 rounded-lg p-4" ref={chartContainerRef}>
        <ChartContainer config={chartConfig} className="w-full min-h-[400px]">
          <ScatterChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
          >
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            
            {/* Quadrant Grid Lines */}
            {zoomState.level === 0 && (
              <>
                <ReferenceLine x={20} stroke="#e5e7eb" strokeDasharray="2 2" opacity={0.5} />
                <ReferenceLine x={40} stroke="#e5e7eb" strokeDasharray="2 2" opacity={0.5} />
                <ReferenceLine x={60} stroke="#e5e7eb" strokeDasharray="2 2" opacity={0.5} />
                <ReferenceLine x={80} stroke="#e5e7eb" strokeDasharray="2 2" opacity={0.5} />
                <ReferenceLine y={2} stroke="#e5e7eb" strokeDasharray="2 2" opacity={0.5} />
                <ReferenceLine y={4} stroke="#e5e7eb" strokeDasharray="2 2" opacity={0.5} />
                <ReferenceLine y={6} stroke="#e5e7eb" strokeDasharray="2 2" opacity={0.5} />
                <ReferenceLine y={8} stroke="#e5e7eb" strokeDasharray="2 2" opacity={0.5} />
              </>
            )}
            
            {/* Clickable Quadrant Areas */}
            {generateQuadrantAreas()}
            
            <XAxis 
              type="number" 
              dataKey="x" 
              name="Completion %"
              domain={[zoomState.xMin, zoomState.xMax]}
              tick={{ fontSize: 12 }}
              label={{ value: 'Campaign Completion (%)', position: 'insideBottom', offset: -10 }}
            />
            <YAxis 
              type="number" 
              dataKey="y" 
              name="Health Score"
              domain={[zoomState.yMin, zoomState.yMax]}
              tick={{ fontSize: 12 }}
              label={{ value: 'Health Score', angle: -90, position: 'insideLeft' }}
            />
            
            <Scatter 
              dataKey="y"
              className="cursor-pointer"
            >
              {chartData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.fill}
                  onClick={(event) => handleScatterClick(entry, event)}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ChartContainer>
      </div>
      
      {/* Multi-Campaign Tooltip with Accordion */}
      {tooltipState.visible && tooltipState.campaigns.length > 0 && (
        <div 
          data-tooltip-content
          className={`fixed bg-white border rounded shadow-lg ${getTooltipZIndex()} max-h-80 overflow-y-auto`}
          style={{ 
            left: tooltipState.x,
            top: tooltipState.y,
            width: '480px',
            maxWidth: '480px'
          }}
        >
          <div className="flex justify-between items-center p-3 border-b">
            <h4 className="font-medium text-sm">
              {tooltipState.campaigns.length === 1 
                ? 'Campaign Details' 
                : `${tooltipState.campaigns.length} Campaigns at this Point`
              }
            </h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={closeTooltip}
              className="h-6 w-6 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          
          {tooltipState.campaigns.length === 1 ? (
            // Single campaign - show full details directly
            <div className="p-3">
              <p className="font-medium text-sm mb-2">{tooltipState.campaigns[0].campaignName}</p>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span>Overall Health:</span>
                  <span className="font-medium">{tooltipState.campaigns[0].healthScore}</span>
                </div>
                <div className="flex justify-between">
                  <span>ROAS:</span>
                  <span className="font-medium">{tooltipState.campaigns[0].roas.toFixed(1)}x (Score: {tooltipState.campaigns[0].roasScore})</span>
                </div>
                <div className="flex justify-between">
                  <span>Delivery Pacing:</span>
                  <span className="font-medium">{tooltipState.campaigns[0].deliveryPacing.toFixed(1)}% (Score: {tooltipState.campaigns[0].deliveryPacingScore})</span>
                </div>
                <div className="flex justify-between">
                  <span>Burn Rate:</span>
                  <span className="font-medium">{tooltipState.campaigns[0].burnRatePercentage.toFixed(1)}% (Score: {tooltipState.campaigns[0].burnRateScore})</span>
                </div>
                <div className="flex justify-between">
                  <span>CTR:</span>
                  <span className="font-medium">{tooltipState.campaigns[0].ctr.toFixed(3)}% (Score: {tooltipState.campaigns[0].ctrScore})</span>
                </div>
                <div className="flex justify-between">
                  <span>Overspend:</span>
                  <span className="font-medium">${tooltipState.campaigns[0].overspend.toFixed(2)} (Score: {tooltipState.campaigns[0].overspendScore})</span>
                </div>
                <div className="border-t pt-1 mt-1">
                  <div className="flex justify-between">
                    <span>Completion:</span>
                    <span className="font-medium">{tooltipState.campaigns[0].completionPercentage.toFixed(1)}%</span>
                  </div>
                </div>
                {renderBurnRateDetails(tooltipState.campaigns[0])}
              </div>
            </div>
          ) : (
            // Multiple campaigns - show accordion
            <Accordion type="single" collapsible className="w-full">
              {tooltipState.campaigns.map((campaign, index) => (
                <AccordionItem key={`${campaign.campaignName}-${index}`} value={`campaign-${index}`}>
                  <AccordionTrigger className="px-3 py-2 text-left">
                    <div className="flex justify-between items-start w-full mr-2 gap-2">
                      <span className="font-medium text-sm break-words flex-1">{campaign.campaignName}</span>
                      <div className="flex items-center gap-2 text-xs flex-shrink-0">
                        <span>Score: {campaign.healthScore}</span>
                        <span>Complete: {campaign.completionPercentage.toFixed(1)}%</span>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-3 pb-3">
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span>ROAS:</span>
                        <span className="font-medium">{campaign.roas.toFixed(1)}x (Score: {campaign.roasScore})</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Delivery Pacing:</span>
                        <span className="font-medium">{campaign.deliveryPacing.toFixed(1)}% (Score: {campaign.deliveryPacingScore})</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Burn Rate:</span>
                        <span className="font-medium">{campaign.burnRatePercentage.toFixed(1)}% (Score: {campaign.burnRateScore})</span>
                      </div>
                      <div className="flex justify-between">
                        <span>CTR:</span>
                        <span className="font-medium">{campaign.ctr.toFixed(3)}% (Score: {campaign.ctrScore})</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Overspend:</span>
                        <span className="font-medium">${campaign.overspend.toFixed(2)} (Score: {campaign.overspendScore})</span>
                      </div>
                      {renderBurnRateDetails(campaign)}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>
      )}
      
      {/* Help text */}
      {zoomState.level === 0 && (
        <div className="mt-2 text-center">
          <p className="text-sm text-gray-500">
            Click on any point to view campaign details • Click on quadrants to zoom in
          </p>
        </div>
      )}

      {/* Quadrant Zoom Modal */}
      <QuadrantZoomModal
        open={modalState.open}
        onOpenChange={(open) => setModalState(prev => ({ ...prev, open }))}
        healthData={healthData}
        xMin={modalState.xMin}
        xMax={modalState.xMax}
        yMin={modalState.yMin}
        yMax={modalState.yMax}
      />
    </div>
  );
};

function getHealthColor(healthScore: number): string {
  if (healthScore >= 7) return "#22c55e"; // Green for healthy
  if (healthScore >= 4) return "#f59e0b"; // Yellow/Orange for warning
  return "#ef4444"; // Red for critical
}

export default CampaignHealthScatterPlot;
