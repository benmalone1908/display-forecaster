import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { AlertCircle, TrendingUp, TrendingDown, Target, Calendar, Eye } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { processCampaigns } from '@/lib/pacingCalculations';
import type { ContractTerms, PacingDeliveryData, ProcessedCampaign } from '@/types/pacing';
import { parseDateString } from '@/lib/utils';

// Import new components
import { SummaryCards } from './pacing/SummaryCards';
import { CampaignOverviewTable } from './pacing/CampaignOverviewTable';
import { Modal } from './pacing/Modal';
import { useCampaignUtils, formatCurrency, formatNumber, formatPercentage, getPacingColor } from '@/lib/pacingUtils';
import { useCampaignFilter } from '@/contexts/CampaignFilterContext';

// Helper function for pacing icons
const getPacingIcon = (pacing: number) => {
  if (pacing > 1) return <TrendingUp className="h-4 w-4" />;
  return <TrendingDown className="h-4 w-4" />;
};


// Detailed campaign view component (used in modal)
const DetailedCampaignView: React.FC<{ campaign: ProcessedCampaign }> = ({ campaign }) => {
  const { metrics } = campaign;

  return (
    <div className="space-y-6">
      {/* Campaign Timeline */}
      <Card className="bg-gradient-to-r from-gray-50 to-blue-50 border border-gray-200">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-600 uppercase tracking-wide mb-1">
                <Calendar className="h-4 w-4" />
                Flight Dates
              </div>
              <div className="text-lg font-semibold text-gray-900">
                {format(metrics.startDate, 'MMM dd')} - {format(metrics.endDate, 'MMM dd, yyyy')}
              </div>
            </div>
            
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-600 uppercase tracking-wide mb-1">
                <Calendar className="h-4 w-4" />
                Days Into Campaign
              </div>
              <div className="text-lg font-semibold text-gray-900">
                {metrics.daysIntoCampaign}
              </div>
            </div>
            
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-600 uppercase tracking-wide mb-1">
                <Calendar className="h-4 w-4" />
                Days Until End
              </div>
              <div className="text-lg font-semibold text-gray-900">
                {metrics.daysUntilEnd}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Expected Impressions</h3>
              <div className="p-2 bg-indigo-100 rounded-lg">
                <Eye className="h-4 w-4 text-indigo-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{formatNumber(metrics.expectedImpressions)}</div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Actual Impressions</h3>
              <div className="p-2 bg-green-100 rounded-lg">
                <Eye className="h-4 w-4 text-green-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{formatNumber(metrics.actualImpressions)}</div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Current Pacing</h3>
              <div className={`p-2 rounded-lg ${
                metrics.currentPacing >= 0.95 && metrics.currentPacing <= 1.05 
                  ? 'bg-green-100' 
                  : metrics.currentPacing >= 0.85 && metrics.currentPacing <= 1.15
                  ? 'bg-yellow-100'
                  : 'bg-red-100'
              }`}>
                <div className={getPacingColor(metrics.currentPacing)}>
                  {metrics.currentPacing > 1 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                </div>
              </div>
            </div>
            <div className={`text-2xl font-bold ${getPacingColor(metrics.currentPacing)}`}>
              {formatPercentage(metrics.currentPacing)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {metrics.currentPacing > 1 ? 'Ahead of pace' : 'Behind pace'}
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Remaining Impressions</h3>
              <div className="p-2 bg-orange-100 rounded-lg">
                <Target className="h-4 w-4 text-orange-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{formatNumber(metrics.remainingImpressions)}</div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Daily Average Needed</h3>
              <div className="p-2 bg-purple-100 rounded-lg">
                <Target className="h-4 w-4 text-purple-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{formatNumber(metrics.remainingAverageNeeded)}</div>
            <p className="text-xs text-gray-500 mt-1">per remaining day</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Yesterday's Impressions</h3>
              <div className="p-2 bg-cyan-100 rounded-lg">
                <Eye className="h-4 w-4 text-cyan-600" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-bold text-gray-900">{formatNumber(metrics.yesterdayImpressions)}</div>
              <div className={`text-sm font-semibold ${getPacingColor(metrics.yesterdayVsNeeded)}`}>
                {formatPercentage(metrics.yesterdayVsNeeded)}
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">of daily target</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

interface DetailedViewProps {
  campaign: ProcessedCampaign;
}

const DetailedView: React.FC<DetailedViewProps> = ({ campaign }) => {
  const { metrics } = campaign;

  return (
    <div className="space-y-6">
      {/* Campaign Timeline */}
      <Card className="bg-gradient-to-r from-gray-50 to-blue-50 border border-gray-200">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-600 uppercase tracking-wide mb-1">
                <Calendar className="h-4 w-4" />
                Flight Dates
              </div>
              <div className="text-lg font-semibold text-gray-900">
                {format(metrics.startDate, 'MMM dd')} - {format(metrics.endDate, 'MMM dd, yyyy')}
              </div>
            </div>
            
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-600 uppercase tracking-wide mb-1">
                <Calendar className="h-4 w-4" />
                Days Into Campaign
              </div>
              <div className="text-lg font-semibold text-gray-900">
                {metrics.daysIntoCampaign}
              </div>
            </div>
            
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-600 uppercase tracking-wide mb-1">
                <Calendar className="h-4 w-4" />
                Days Until End
              </div>
              <div className="text-lg font-semibold text-gray-900">
                {metrics.daysUntilEnd}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Expected Impressions</h3>
              <div className="p-2 bg-indigo-100 rounded-lg">
                <Eye className="h-4 w-4 text-indigo-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{formatNumber(metrics.expectedImpressions)}</div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Actual Impressions</h3>
              <div className="p-2 bg-green-100 rounded-lg">
                <Eye className="h-4 w-4 text-green-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{formatNumber(metrics.actualImpressions)}</div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Current Pacing</h3>
              <div className={`p-2 rounded-lg ${
                metrics.currentPacing >= 0.95 && metrics.currentPacing <= 1.05 
                  ? 'bg-green-100' 
                  : metrics.currentPacing >= 0.85 && metrics.currentPacing <= 1.15
                  ? 'bg-yellow-100'
                  : 'bg-red-100'
              }`}>
                <div className={getPacingColor(metrics.currentPacing)}>
                  {getPacingIcon(metrics.currentPacing)}
                </div>
              </div>
            </div>
            <div className={`text-2xl font-bold ${getPacingColor(metrics.currentPacing)}`}>
              {formatPercentage(metrics.currentPacing)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {metrics.currentPacing > 1 ? 'Ahead of pace' : 'Behind pace'}
            </p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Remaining Impressions</h3>
              <div className="p-2 bg-orange-100 rounded-lg">
                <Target className="h-4 w-4 text-orange-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{formatNumber(metrics.remainingImpressions)}</div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Daily Average Needed</h3>
              <div className="p-2 bg-purple-100 rounded-lg">
                <Target className="h-4 w-4 text-purple-600" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{formatNumber(metrics.remainingAverageNeeded)}</div>
            <p className="text-xs text-gray-500 mt-1">per remaining day</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Yesterday's Impressions</h3>
              <div className="p-2 bg-cyan-100 rounded-lg">
                <Eye className="h-4 w-4 text-cyan-600" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-bold text-gray-900">{formatNumber(metrics.yesterdayImpressions)}</div>
              <div className={`text-sm font-semibold ${getPacingColor(metrics.yesterdayVsNeeded)}`}>
                {formatPercentage(metrics.yesterdayVsNeeded)}
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1">of daily target</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

interface Pacing2Props {
  data: any[];
  unfilteredData: any[];
  pacingData: any[];
  contractTermsData: any[];
}

export const Pacing2: React.FC<Pacing2Props> = ({ data, unfilteredData, pacingData, contractTermsData }) => {
  const [selectedCampaign, setSelectedCampaign] = useState<ProcessedCampaign | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { selectedAgencies, selectedAdvertisers, selectedCampaigns } = useCampaignFilter();

  // Transform existing data to pacing format
  const campaigns = useMemo(() => {
    try {
      if (data.length === 0) {
        return [];
      }

      // If we have contractTermsData, use it; otherwise try to derive from existing data
      let contractTerms: ContractTerms[] = [];
      
      if (contractTermsData.length > 0) {
        // Use existing contract terms data
        contractTerms = contractTermsData.map((row: any) => ({
          Name: row.Name || row['Campaign Name'] || row.CAMPAIGN_ORDER_NAME || row['CAMPAIGN ORDER NAME'] || '',
          'Start Date': row['Start Date'] || row.START_DATE || '',
          'End Date': row['End Date'] || row.END_DATE || '',
          Budget: row.Budget || row.BUDGET || '',
          CPM: row.CPM || row.cpm || '',
          'Impressions Goal': row['Impressions Goal'] || row.IMPRESSIONS_GOAL || row['GOAL IMPRESSIONS'] || ''
        }));
      } else {
        // Try to derive contract terms from campaign data
        const campaignNames = Array.from(new Set(data.map(row => row['CAMPAIGN ORDER NAME'])));
        contractTerms = campaignNames.map(name => {
          // Find all rows for this campaign to determine date range and totals
          const campaignRows = data.filter(row => row['CAMPAIGN ORDER NAME'] === name);
          
          const dates = campaignRows
            .map(row => parseDateString(row.DATE))
            .filter(Boolean) as Date[];
          dates.sort((a, b) => a.getTime() - b.getTime());
          const startDate = dates[0];
          const endDate = dates[dates.length - 1];
          
          // Calculate totals for this campaign
          const totalImpressions = campaignRows.reduce((sum, row) => sum + (parseInt(row.IMPRESSIONS?.toString().replace(/,/g, '') || '0') || 0), 0);
          const totalSpend = campaignRows.reduce((sum, row) => sum + (parseFloat(row.SPEND?.toString().replace(/[$,]/g, '') || '0') || 0), 0);
          
          // Estimate CPM from spend and impressions
          const estimatedCPM = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;
          
          return {
            Name: name,
            'Start Date': startDate ? startDate.toISOString().split('T')[0] : '',
            'End Date': endDate ? endDate.toISOString().split('T')[0] : '',
            Budget: totalSpend.toString(),
            CPM: estimatedCPM.toFixed(2),
            'Impressions Goal': Math.round(totalImpressions * 1.1).toString() // Assume 10% buffer over actual
          };
        });
      }

      // Transform delivery data (use filtered data for display/calculations)
      const deliveryData: PacingDeliveryData[] = data.map((row: any) => ({
        DATE: row.DATE || '',
        'CAMPAIGN ORDER NAME': row['CAMPAIGN ORDER NAME'] || '',
        IMPRESSIONS: row.IMPRESSIONS?.toString() || '0',
        SPEND: row.SPEND?.toString() || '0'
      }));

      // Transform unfiltered data for global date calculation (use all data)
      const unfilteredDeliveryData: PacingDeliveryData[] = unfilteredData.map((row: any) => ({
        DATE: row.DATE || '',
        'CAMPAIGN ORDER NAME': row['CAMPAIGN ORDER NAME'] || '',
        IMPRESSIONS: row.IMPRESSIONS?.toString() || '0',
        SPEND: row.SPEND?.toString() || '0'
      }));

      const processedCampaigns = processCampaigns(contractTerms, deliveryData, unfilteredDeliveryData);
      
      if (processedCampaigns.length === 0) {
        setError('No campaigns could be processed from existing data. Contract terms may be missing.');
      } else if (processedCampaigns.length < contractTerms.length) {
        const skippedCount = contractTerms.length - processedCampaigns.length;
        setError(`Successfully processed ${processedCampaigns.length} campaigns. ${skippedCount} campaigns were skipped due to missing or invalid data.`);
      } else {
        setError(null);
      }

      return processedCampaigns;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error processing campaign data');
      return [];
    }
  }, [data, unfilteredData, pacingData, contractTermsData]);

  // Modal handlers
  const handleCampaignClick = (campaign: ProcessedCampaign) => {
    setSelectedCampaign(campaign);
  };

  const handleModalClose = () => {
    setSelectedCampaign(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Target className="h-5 w-5 text-gray-600" />
        <h2 className="text-xl font-semibold text-gray-900">Pacing 2 Report</h2>
      </div>

      {campaigns.length === 0 ? (
        <Card className="p-6">
          <div className="text-center py-8">
            <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Campaign Data Available</h3>
            <p className="text-gray-600">
              {data.length === 0 
                ? "Please upload campaign data in the main dashboard first."
                : "Processing campaign data for pacing analysis..."
              }
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Summary Cards */}
          <SummaryCards campaigns={campaigns} />

          {/* Campaign Overview Table */}
          <CampaignOverviewTable 
            campaigns={campaigns}
            onCampaignClick={handleCampaignClick}
            selectedAgencies={selectedAgencies}
            selectedAdvertisers={selectedAdvertisers}
            selectedCampaigns={selectedCampaigns}
          />
        </div>
      )}

      {/* Modal for detailed campaign view */}
      <Modal 
        isOpen={!!selectedCampaign}
        onClose={handleModalClose}
        title={selectedCampaign?.name}
      >
        {selectedCampaign && <DetailedCampaignView campaign={selectedCampaign} />}
      </Modal>

      {error && (
        <Card className="border-yellow-200 bg-yellow-50 p-4">
          <div className="flex items-start gap-2 text-yellow-800">
            <AlertCircle className="h-4 w-4 mt-0.5" />
            <p className="text-sm">{error}</p>
          </div>
        </Card>
      )}
    </div>
  );
};