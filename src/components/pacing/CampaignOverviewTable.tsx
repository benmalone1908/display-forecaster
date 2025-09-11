import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import type { ProcessedCampaign } from '@/types/pacing';
import { Calendar, TrendingUp, TrendingDown, Target, ChevronUp, ChevronDown, ChevronsUpDown, Filter } from 'lucide-react';
import { useCampaignFilter } from '@/contexts/CampaignFilterContext';
import { formatPercentage, getPacingColor } from '@/lib/pacingUtils';
import { severityLevels, getSeverityLevel, getSeverityBadge, type SeverityLevel } from '@/lib/severityLevels';

interface CampaignOverviewTableProps {
  campaigns: ProcessedCampaign[];
  onCampaignClick: (campaign: ProcessedCampaign) => void;
  selectedAgencies?: string[];
  selectedAdvertisers?: string[];
  selectedCampaigns?: string[];
}

type SortField = 'name' | 'daysInto' | 'daysUntil' | 'pacing' | 'yesterday';
type SortDirection = 'asc' | 'desc' | null;
type SeverityFilterLevel = 'all' | SeverityLevel;
type FilterMetric = 'currentPacing' | 'yesterdayRatio';

const getPacingIcon = (pacing: number) => {
  if (pacing > 1) return <TrendingUp className="h-4 w-4" />;
  return <TrendingDown className="h-4 w-4" />;
};

export const CampaignOverviewTable: React.FC<CampaignOverviewTableProps> = ({
  campaigns,
  onCampaignClick,
  selectedAgencies = [],
  selectedAdvertisers = [],
  selectedCampaigns = []
}) => {
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilterLevel>('all');
  const [filterMetric, setFilterMetric] = useState<FilterMetric>('currentPacing');
  
  const { extractAgencyInfo, extractAdvertiserName } = useCampaignFilter();

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Cycle through: asc -> desc -> null -> asc
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortDirection(null);
        setSortField(null);
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredAndSortedCampaigns = useMemo(() => {
    // Apply global filters first (these come from props, already filtered from parent component)
    let filtered = campaigns;

    // Apply severity filter
    if (severityFilter !== 'all') {
      filtered = filtered.filter(campaign => {
        const metricValue = filterMetric === 'currentPacing' 
          ? campaign.metrics.currentPacing 
          : campaign.metrics.yesterdayVsNeeded;
        
        const campaignSeverity = getSeverityLevel(metricValue);
        return campaignSeverity === severityFilter;
      });
    }

    // Then apply sorting
    if (!sortField || !sortDirection) {
      return filtered;
    }

    return [...filtered].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'daysInto':
          aValue = a.metrics.daysIntoCampaign;
          bValue = b.metrics.daysIntoCampaign;
          break;
        case 'daysUntil':
          aValue = a.metrics.daysUntilEnd;
          bValue = b.metrics.daysUntilEnd;
          break;
        case 'pacing':
          aValue = a.metrics.currentPacing;
          bValue = b.metrics.currentPacing;
          break;
        case 'yesterday':
          aValue = a.metrics.yesterdayVsNeeded;
          bValue = b.metrics.yesterdayVsNeeded;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) {
        return sortDirection === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortDirection === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }, [campaigns, sortField, sortDirection, severityFilter, filterMetric]);

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ChevronsUpDown className="h-4 w-4 text-gray-400" />;
    }
    if (sortDirection === 'asc') {
      return <ChevronUp className="h-4 w-4 text-blue-600" />;
    }
    if (sortDirection === 'desc') {
      return <ChevronDown className="h-4 w-4 text-blue-600" />;
    }
    return <ChevronsUpDown className="h-4 w-4 text-gray-400" />;
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="border-b border-gray-200 bg-gray-50/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Target className="h-5 w-5 text-gray-600" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Campaign Overview</h3>
              <p className="text-sm text-gray-600">Click on any campaign name to view detailed metrics</p>
            </div>
          </div>
          
          {/* Filter Controls */}
          <div className="flex items-center gap-4">
            {/* Metric Toggle */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Filter by:</span>
              <div className="bg-white rounded-lg border border-gray-200 p-1 flex">
                <button
                  onClick={() => setFilterMetric('currentPacing')}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    filterMetric === 'currentPacing' 
                      ? 'bg-blue-600 text-white' 
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Current Pacing
                </button>
                <button
                  onClick={() => setFilterMetric('yesterdayRatio')}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    filterMetric === 'yesterdayRatio' 
                      ? 'bg-blue-600 text-white' 
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Yesterday's Ratio
                </button>
              </div>
            </div>

            {/* Severity Filter */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value as SeverityFilterLevel)}
                className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">Show All Campaigns</option>
                <option value="on-target">On Target (±1%)</option>
                <option value="minor">Minor Deviation (±1-10%)</option>
                <option value="moderate">Moderate Deviation (±10-25%)</option>
                <option value="major">Major Deviation (±25%+)</option>
              </select>
            </div>
          </div>
        </div>

      </div>

      {/* Table */}
      <div className="max-h-[60vh] overflow-auto">
        <table className="w-full">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th className="px-6 py-4 text-left">
                <button
                  onClick={() => handleSort('name')}
                  className="flex items-center gap-2 text-sm font-semibold text-gray-700 uppercase tracking-wide hover:text-blue-600 transition-colors duration-200"
                >
                  Campaign Name
                  {getSortIcon('name')}
                </button>
              </th>
              <th className="px-6 py-4 text-center">
                <button
                  onClick={() => handleSort('daysInto')}
                  className="flex items-center justify-center gap-2 text-sm font-semibold text-gray-700 uppercase tracking-wide hover:text-blue-600 transition-colors duration-200 w-full"
                >
                  <Calendar className="h-4 w-4" />
                  Days Into
                  {getSortIcon('daysInto')}
                </button>
              </th>
              <th className="px-6 py-4 text-center">
                <button
                  onClick={() => handleSort('daysUntil')}
                  className="flex items-center justify-center gap-2 text-sm font-semibold text-gray-700 uppercase tracking-wide hover:text-blue-600 transition-colors duration-200 w-full"
                >
                  <Calendar className="h-4 w-4" />
                  Days Until End
                  {getSortIcon('daysUntil')}
                </button>
              </th>
              <th className="px-6 py-4 text-center">
                <button
                  onClick={() => handleSort('pacing')}
                  className="flex items-center justify-center gap-2 text-sm font-semibold text-gray-700 uppercase tracking-wide hover:text-blue-600 transition-colors duration-200 w-full"
                >
                  Current Pacing
                  {getSortIcon('pacing')}
                </button>
              </th>
              <th className="px-6 py-4 text-center">
                <button
                  onClick={() => handleSort('yesterday')}
                  className="flex items-center justify-center gap-2 text-sm font-semibold text-gray-700 uppercase tracking-wide hover:text-blue-600 transition-colors duration-200 w-full"
                >
                  Yesterday's Ratio
                  {getSortIcon('yesterday')}
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredAndSortedCampaigns.map((campaign) => (
              <tr
                key={campaign.name}
                className="hover:bg-blue-50 transition-colors duration-200 cursor-pointer group"
                onClick={() => onCampaignClick(campaign)}
              >
                <td className="px-6 py-5">
                  <div className="flex flex-col">
                    <span className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors duration-200">
                      {campaign.name}
                    </span>
                    <span className="text-sm text-gray-500">
                      {format(campaign.metrics.startDate, 'MMM dd')} - {format(campaign.metrics.endDate, 'MMM dd, yyyy')}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-5 text-center">
                  <div className="flex items-center justify-center">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                      {campaign.metrics.daysIntoCampaign}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-5 text-center">
                  <div className="flex items-center justify-center">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                      {campaign.metrics.daysUntilEnd}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-5 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <div className={getPacingColor(campaign.metrics.currentPacing)}>
                      {getPacingIcon(campaign.metrics.currentPacing)}
                    </div>
                    <span className={`font-semibold ${getPacingColor(campaign.metrics.currentPacing)}`}>
                      {formatPercentage(campaign.metrics.currentPacing)}
                    </span>
                    <span className={getSeverityBadge(getSeverityLevel(campaign.metrics.currentPacing)).className}>
                      {getSeverityBadge(getSeverityLevel(campaign.metrics.currentPacing)).symbol}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-5 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <div className={getPacingColor(campaign.metrics.yesterdayVsNeeded)}>
                      {getPacingIcon(campaign.metrics.yesterdayVsNeeded)}
                    </div>
                    <span className={`font-semibold ${getPacingColor(campaign.metrics.yesterdayVsNeeded)}`}>
                      {formatPercentage(campaign.metrics.yesterdayVsNeeded)}
                    </span>
                    <span className={getSeverityBadge(getSeverityLevel(campaign.metrics.yesterdayVsNeeded)).className}>
                      {getSeverityBadge(getSeverityLevel(campaign.metrics.yesterdayVsNeeded)).symbol}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="bg-gray-50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <p className="text-sm text-gray-600">
              Showing {filteredAndSortedCampaigns.length} of {campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''}
            </p>
            {severityFilter !== 'all' && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Filtered by:</span>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${severityLevels[severityFilter].color}`}>
                  {severityLevels[severityFilter].label}
                </span>
                <span className="text-sm text-gray-500">({filterMetric === 'currentPacing' ? 'Current Pacing' : 'Yesterday\'s Ratio'})</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            {sortField && (
              <p className="text-sm text-blue-600 font-medium">
                Sorted by {sortField === 'name' ? 'Campaign Name' : 
                          sortField === 'daysInto' ? 'Days Into Campaign' :
                          sortField === 'daysUntil' ? 'Days Until End' :
                          sortField === 'pacing' ? 'Current Pacing' : 'Yesterday\'s Ratio'} 
                ({sortDirection === 'asc' ? 'ascending' : 'descending'})
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};