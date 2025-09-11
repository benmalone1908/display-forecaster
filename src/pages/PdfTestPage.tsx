import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import StreamlinedPdfExportButton from '@/components/ui/streamlined-pdf-export-button';

// Sample test data
const sampleData = [
  {
    DATE: '1/1/2024',
    'CAMPAIGN ORDER NAME': '2001367: HRB: District Cannabis-241217',
    IMPRESSIONS: 10000,
    CLICKS: 200,
    REVENUE: 500,
    SPEND: 300,
    TRANSACTIONS: 10
  },
  {
    DATE: '1/2/2024', 
    'CAMPAIGN ORDER NAME': '2001569: MJ: Test Client-Campaign Name-250101',
    IMPRESSIONS: 15000,
    CLICKS: 300,
    REVENUE: 750,
    SPEND: 450,
    TRANSACTIONS: 15
  },
  {
    DATE: '1/3/2024',
    'CAMPAIGN ORDER NAME': '2001367: HRB: District Cannabis-241217',
    IMPRESSIONS: 12000,
    CLICKS: 240,
    REVENUE: 600,
    SPEND: 360,
    TRANSACTIONS: 12
  }
];

const samplePacingData = [
  {
    Campaign: '2001367: HRB: District Cannabis-241217',
    'Pacing Status': 'On Track',
    'Budget Remaining': 5000,
    'Days Remaining': 15
  }
];

const PdfTestPage: React.FC = () => {
  return (
    <div className="container mx-auto py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Enhanced PDF Export Test</h1>
        
        <div className="bg-white p-6 border rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Test Streamlined PDF Export</h2>
          <p className="text-gray-600 mb-6">
            Click the button below to test the new streamlined PDF export system that inherits filters from the master tool.
          </p>
          
          <StreamlinedPdfExportButton
            data={sampleData}
            pacingData={samplePacingData}
            contractTermsData={[]}
            dateRange={{
              from: new Date('2024-01-01'),
              to: new Date('2024-01-31')
            }}
            appliedFilters={{
              agencies: ['HRB'],
              advertisers: ['District Cannabis'],
              campaigns: []
            }}
            showLiveOnly={false}
            variant="default"
            size="default"
          />
          
          <div className="mt-6 p-4 bg-gray-50 rounded">
            <h3 className="font-semibold mb-2">New Streamlined Workflow:</h3>
            <ol className="list-decimal list-inside text-sm space-y-1">
              <li>Click "Export PDF" button - it inherits current filters from master tool</li>
              <li>Step 1: Select chart category, then specific chart type, then sub-options</li>
              <li>Step 2: Choose date range for your selected chart</li>
              <li>Step 3: Preview your report configuration</li>
              <li>Export your focused PDF report with just the chart you need</li>
            </ol>
            <div className="mt-4 p-3 bg-blue-50 rounded text-sm">
              <strong>Key Features:</strong>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Inherits Agency/Advertiser/Campaign filters from main dashboard</li>
                <li>Inherits Live/All Campaigns toggle setting</li>
                <li>Only includes charts from Dashboard tab</li>
                <li>Dropdown-based chart selection (Spark Charts, Campaign Performance, Weekly Comparison)</li>
                <li>Individual date ranges per chart</li>
                <li>Simple 3-step workflow</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PdfTestPage;