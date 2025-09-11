import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

export type MetricType = 'roas' | 'pacing' | 'burnrate' | 'overspend';

interface MetricExplanationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metric: MetricType | null;
}

const getMetricDetails = (metric: MetricType | null) => {
  switch (metric) {
    case 'roas':
      return {
        title: 'ROAS (Return on Ad Spend) Scoring',
        weight: '40%',
        description: 'Measures revenue efficiency by calculating how much revenue is generated for each dollar spent on advertising.',
        calculation: 'ROAS = Total Attributed Sales ÷ Total Spend',
        scoringBands: [
          { range: 'ROAS ≥ 4.0', score: 10, color: 'text-green-600', description: 'Excellent - Strong revenue performance' },
          { range: '3.0 ≤ ROAS < 4.0', score: 7.5, color: 'text-green-500', description: 'Good - Above average returns' },
          { range: '2.0 ≤ ROAS < 3.0', score: 5, color: 'text-yellow-600', description: 'Fair - Breaking even or modest profit' },
          { range: '1.0 ≤ ROAS < 2.0', score: 2.5, color: 'text-orange-600', description: 'Poor - Below breakeven' },
          { range: '0 < ROAS < 1.0', score: 1, color: 'text-red-600', description: 'Critical - Losing money' },
          { range: 'ROAS = 0', score: 0, color: 'text-red-700', description: 'No revenue generated' }
        ],
        notes: [
          'ROAS is the primary indicator of campaign profitability',
          'Higher ROAS indicates more efficient ad spend',
          'Industry benchmarks vary, but 4:1 is generally considered strong performance'
        ]
      };
    
    case 'pacing':
      return {
        title: 'Delivery Pacing Scoring',
        weight: '30%',
        description: 'Evaluates how well campaign delivery aligns with expected impression goals based on flight duration.',
        calculation: 'Pacing = (Actual Impressions ÷ Expected Impressions) × 100%',
        scoringBands: [
          { range: '95% ≤ Pacing ≤ 105%', score: 10, color: 'text-green-600', description: 'Perfect - On target delivery' },
          { range: '90-95% or 105-110%', score: 8, color: 'text-green-500', description: 'Good - Minor deviation from target' },
          { range: '80-90% or 110-120%', score: 6, color: 'text-yellow-600', description: 'Fair - Moderate pacing issues' },
          { range: '< 80% or > 120%', score: 3, color: 'text-red-600', description: 'Poor - Significant under/over delivery' }
        ],
        notes: [
          'Expected impressions are calculated based on campaign flight dates',
          'Under-pacing may indicate targeting or budget constraints',
          'Over-pacing could lead to early budget exhaustion',
          'Optimal pacing ensures even delivery throughout campaign flight'
        ]
      };
    
    case 'burnrate':
      return {
        title: 'Burn Rate Scoring',
        weight: '15%',
        description: 'Analyzes recent impression delivery patterns to predict future performance and identify delivery trends.',
        calculation: 'Uses 1-day, 3-day, or 7-day average impressions compared to required daily impressions',
        scoringBands: [
          { range: '95-105% of Required Daily', score: 10, color: 'text-green-600', description: 'Perfect - Optimal delivery rate' },
          { range: '85-95% or 105-115%', score: 8, color: 'text-green-500', description: 'Good - Minor rate variance' },
          { range: '< 85% or > 115%', score: 5, color: 'text-red-600', description: 'Poor - Significant rate deviation' }
        ],
        confidenceLevels: [
          { level: '7-day', description: 'High confidence - Uses 7-day average (most reliable)' },
          { level: '3-day', description: 'Medium confidence - Uses 3-day average' },
          { level: '1-day', description: 'Low confidence - Uses most recent day only' },
          { level: 'no-data', description: 'No confidence - Insufficient data available' }
        ],
        notes: [
          'Excludes most recent day to avoid incomplete data',
          'Higher confidence levels (7-day) are weighted more heavily',
          'Helps predict whether campaign will meet impression goals',
          'Required daily impressions calculated from contract terms'
        ]
      };
    
    case 'overspend':
      return {
        title: 'Overspend Risk Scoring',
        weight: '15%',
        description: 'Predicts potential budget overrun by analyzing current spend patterns and remaining flight duration.',
        calculation: 'Projected Total = Current Spend + (Daily Spend Rate × Days Remaining)',
        scoringBands: [
          { range: 'No Projected Overspend', score: 10, color: 'text-green-600', description: 'Perfect - On budget track' },
          { range: '≤ 5% Overspend Risk', score: 8, color: 'text-green-500', description: 'Good - Minor risk' },
          { range: '5-10% Overspend Risk', score: 6, color: 'text-yellow-600', description: 'Fair - Moderate risk' },
          { range: '10-20% Overspend Risk', score: 3, color: 'text-orange-600', description: 'High - Significant risk' },
          { range: '> 20% Overspend Risk', score: 0, color: 'text-red-600', description: 'Critical - Major overrun risk' }
        ],
        confidenceFactors: [
          { factor: '7-day spend data', multiplier: '100%', description: 'Full confidence in projection' },
          { factor: '3-day spend data', multiplier: '80%', description: 'Reduced confidence' },
          { factor: '1-day spend data', multiplier: '60%', description: 'Low confidence' },
          { factor: 'Capped anomalous data', multiplier: '70%', description: 'Additional reduction for data anomalies' }
        ],
        notes: [
          'Uses recent spend patterns to project future spending',
          'Accounts for data quality when calculating confidence',
          'Helps identify campaigns needing budget adjustments',
          'Early warning system for budget management'
        ]
      };
    
    default:
      return null;
  }
};

const MetricExplanationModal = ({ open, onOpenChange, metric }: MetricExplanationModalProps) => {
  const details = getMetricDetails(metric);

  if (!details) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-full max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {details.title}
            <span className="text-sm font-normal text-muted-foreground">
              (Weight: {details.weight} of total health score)
            </span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 mt-4">
          {/* Description */}
          <Card className="p-4">
            <h3 className="font-semibold mb-2">Description</h3>
            <p className="text-muted-foreground">{details.description}</p>
          </Card>

          {/* Calculation */}
          <Card className="p-4">
            <h3 className="font-semibold mb-2">Calculation Method</h3>
            <div className="bg-gray-50 p-3 rounded font-mono text-sm">
              {details.calculation}
            </div>
          </Card>

          {/* Scoring Bands */}
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Scoring Bands</h3>
            <div className="space-y-2">
              {details.scoringBands.map((band, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm min-w-[140px]">{band.range}</span>
                    <span className={`font-semibold ${band.color}`}>Score: {band.score}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">{band.description}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Confidence Levels (for burn rate) */}
          {details.confidenceLevels && (
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Confidence Levels</h3>
              <div className="space-y-2">
                {details.confidenceLevels.map((level, index) => (
                  <div key={index} className="flex items-center gap-3 p-2 bg-gray-50 rounded">
                    <span className="font-semibold text-sm min-w-[80px]">{level.level}</span>
                    <span className="text-sm text-muted-foreground">{level.description}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Confidence Factors (for overspend) */}
          {details.confidenceFactors && (
            <Card className="p-4">
              <h3 className="font-semibold mb-3">Confidence Adjustments</h3>
              <div className="space-y-2">
                {details.confidenceFactors.map((factor, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div className="flex items-center gap-3">
                      <span className="text-sm">{factor.factor}</span>
                      <span className="font-semibold text-sm text-blue-600">{factor.multiplier}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">{factor.description}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Notes */}
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Important Notes</h3>
            <ul className="space-y-1">
              {details.notes.map((note, index) => (
                <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-blue-500 mt-1">•</span>
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MetricExplanationModal;