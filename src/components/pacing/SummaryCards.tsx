import React, { useState, useMemo } from 'react';
import type { ProcessedCampaign } from '@/types/pacing';
import { TrendingUp, Target } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { severityLevels, getSeverityLevel, type SeverityLevel } from '@/lib/severityLevels';

interface SummaryCardsProps {
  campaigns: ProcessedCampaign[];
}

type FilterMetric = 'currentPacing' | 'yesterdayRatio';

export const SummaryCards: React.FC<SummaryCardsProps> = ({ campaigns }) => {
  const [filterMetric, setFilterMetric] = useState<FilterMetric>('currentPacing');

  const summaryData = useMemo(() => {
    const totalCampaigns = campaigns.length;
    const counts = {
      'on-target': 0,
      'minor': 0,
      'moderate': 0,
      'major': 0
    };

    campaigns.forEach(campaign => {
      const metricValue = filterMetric === 'currentPacing' 
        ? campaign.metrics.currentPacing 
        : campaign.metrics.yesterdayVsNeeded;
      
      const severity = getSeverityLevel(metricValue);
      counts[severity]++;
    });

    return {
      totalCampaigns,
      counts,
      percentages: {
        'on-target': totalCampaigns > 0 ? (counts['on-target'] / totalCampaigns) * 100 : 0,
        'minor': totalCampaigns > 0 ? (counts['minor'] / totalCampaigns) * 100 : 0,
        'moderate': totalCampaigns > 0 ? (counts['moderate'] / totalCampaigns) * 100 : 0,
        'major': totalCampaigns > 0 ? (counts['major'] / totalCampaigns) * 100 : 0,
      }
    };
  }, [campaigns, filterMetric]);

  if (campaigns.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Metric Toggle */}
      <div className="flex items-center justify-center">
        <div className="bg-white rounded-lg border border-gray-200 p-1">
          <div className="flex items-center">
            <button
              onClick={() => setFilterMetric('currentPacing')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                filterMetric === 'currentPacing' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-600 hover:text-blue-600 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Current Pacing
              </div>
            </button>
            <button
              onClick={() => setFilterMetric('yesterdayRatio')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                filterMetric === 'yesterdayRatio' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-600 hover:text-blue-600 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                Yesterday's Ratio
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {(Object.keys(severityLevels) as SeverityLevel[]).map((level) => {
          const config = severityLevels[level];
          const count = summaryData.counts[level];
          const percentage = summaryData.percentages[level];
          const IconComponent = config.icon;

          return (
            <Card key={level} className="hover:shadow-md transition-shadow duration-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className={`p-2 rounded-lg ${config.color.split(' ')[0]}`}>
                    <IconComponent className={`h-5 w-5 ${config.iconColor}`} />
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-gray-900">{count}</div>
                    <div className="text-xs text-gray-500">campaigns</div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-900">{config.label}</h3>
                    <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${config.color}`}>
                      {percentage.toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">{config.description}</p>
                </div>

                {/* Progress Bar */}
                <div className="mt-3">
                  <div className="bg-gray-200 rounded-full h-1.5">
                    <div 
                      className={`h-1.5 rounded-full transition-all duration-500 ${config.iconColor.replace('text-', 'bg-')}`}
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};