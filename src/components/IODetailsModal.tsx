import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, FileText, Target } from "lucide-react";
import { extractIONumber, extractIONumbers, getIODisplayFormat } from "@/utils/ioNumberExtraction";
import { parseDateString } from "@/lib/utils";

interface IODetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ioNumber: string;
  campaignData: any[];
  salesforceData: any[];
}

const IODetailsModal: React.FC<IODetailsModalProps> = ({
  open,
  onOpenChange,
  ioNumber,
  campaignData,
  salesforceData
}) => {
  if (!open) return null;

  // Calculate current month forecast for campaigns
  const calculateForecastForCampaign = (campaignName: string): number => {
    const campaignRows = campaignData.filter(row => {
      const rowCampaignName = row["CAMPAIGN ORDER NAME"] || row.campaign_order_name || "";
      return rowCampaignName === campaignName;
    });

    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    const currentMonthStart = new Date(currentYear, currentMonth, 1);
    const daysElapsed = currentDate.getDate();
    const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    let mtdSpend = 0;
    campaignRows.forEach(row => {
      if (!row.DATE || row.DATE === 'Totals') return;
      const rowDate = parseDateString(row.DATE);
      if (!rowDate) return;

      if (rowDate >= currentMonthStart && rowDate <= currentDate) {
        mtdSpend += Number(row.SPEND) || 0;
      }
    });

    if (daysElapsed === 0 || mtdSpend === 0) return mtdSpend;

    const dailyAvgSpend = mtdSpend / daysElapsed;
    const remainingDays = totalDaysInMonth - daysElapsed;
    const projectedSpend = dailyAvgSpend * remainingDays;

    return mtdSpend + projectedSpend;
  };

  // Find campaigns that match this IO display format with forecasts
  const matchingCampaigns = campaignData
    .filter(row => {
      const campaignName = row["CAMPAIGN ORDER NAME"] || row.campaign_order_name || "";
      const displayFormat = getIODisplayFormat(campaignName);
      return displayFormat === ioNumber; // ioNumber is actually the display format now
    })
    .reduce((unique, campaign) => {
      const campaignName = campaign["CAMPAIGN ORDER NAME"] || campaign.campaign_order_name || "";
      if (!unique.some(c => c.name === campaignName)) {
        const forecast = calculateForecastForCampaign(campaignName);
        unique.push({ name: campaignName, currentMonthForecast: forecast });
      }
      return unique;
    }, [] as { name: string; currentMonthForecast: number }[]);

  // Calculate total forecast for all campaigns
  const totalCampaignForecast = matchingCampaigns.reduce(
    (sum, campaign) => sum + campaign.currentMonthForecast, 0
  );

  // Get the individual IO numbers from the display format
  const individualIONumbers = matchingCampaigns.length > 0
    ? extractIONumbers(matchingCampaigns[0].name)
    : ioNumber.includes('/')
      ? ioNumber.split('/')
      : [ioNumber];

  // Find Salesforce records that match any of the individual IO numbers
  const matchingSalesforceRecords = salesforceData.filter(row =>
    individualIONumbers.includes(row.mjaa_number)
  );

  // Get current month for filtering Salesforce data
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Filter Salesforce records to current month only
  const currentMonthSalesforceRecords = matchingSalesforceRecords.filter(row =>
    row.month === currentMonth
  );

  console.log(`Debug - IO: ${ioNumber}, Current Month: ${currentMonth}`);
  console.log(`Debug - All matching Salesforce records:`, matchingSalesforceRecords);
  console.log(`Debug - Current month Salesforce records:`, currentMonthSalesforceRecords);

  // Get MJAA filenames with their current month forecasts
  const mjaaFilenamesWithForecast = [...new Set(
    currentMonthSalesforceRecords
      .map(row => row.mjaa_filename)
      .filter(filename => filename)
      .flatMap(filename => filename?.split(', ') || [])
  )].map(filename => {
    // Find the record that contains this filename to get the current month revenue
    const record = currentMonthSalesforceRecords.find(row =>
      row.mjaa_filename?.includes(filename)
    );
    const revenue = record?.monthly_revenue || 0;
    console.log(`Debug - Filename: ${filename}, Record:`, record, `Revenue: ${revenue}, Current Month: ${currentMonth}`);
    return {
      filename,
      currentMonthForecast: revenue
    };
  });

  // Calculate total forecast for all MJAA filenames
  const totalMjaaForecast = mjaaFilenamesWithForecast.reduce(
    (sum, item) => sum + item.currentMonthForecast, 0
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">IO Details: {ioNumber}</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6">
          {/* Campaign Names from Dashboard */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="h-5 w-5" />
                Campaign Names from Dashboard ({matchingCampaigns.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {matchingCampaigns.length === 0 ? (
                <p className="text-gray-500 text-sm">No campaigns found for this IO number</p>
              ) : (
                <>
                  <div className="space-y-2">
                    {matchingCampaigns.map((campaign, index) => (
                      <div
                        key={index}
                        className="p-3 bg-blue-50 border border-blue-200 rounded-lg flex justify-between items-center"
                      >
                        <p className="font-mono text-xs text-blue-900 flex-1 mr-4 truncate">
                          {campaign.name}
                        </p>
                        <p className="font-semibold text-sm text-blue-700 whitespace-nowrap">
                          ${campaign.currentMonthForecast.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                    ))}
                  </div>
                  {matchingCampaigns.length > 1 && (
                    <div className="mt-4 pt-3 border-t border-blue-200">
                      <div className="flex justify-between items-center p-3 bg-blue-100 border border-blue-300 rounded-lg">
                        <p className="font-semibold text-sm text-blue-800">Total Current Month Forecast:</p>
                        <p className="font-bold text-base text-blue-700">
                          ${totalCampaignForecast.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>


          {/* MJAA Filenames from Salesforce */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-5 w-5" />
                MJAA Filenames from Salesforce ({mjaaFilenamesWithForecast.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {mjaaFilenamesWithForecast.length === 0 ? (
                <p className="text-gray-500 text-sm">No MJAA filenames found for these IO numbers</p>
              ) : (
                <>
                  <div className="space-y-2">
                    {mjaaFilenamesWithForecast.map((item, index) => (
                      <div
                        key={index}
                        className="p-3 bg-green-50 border border-green-200 rounded-lg flex justify-between items-center"
                      >
                        <p className="text-sm text-green-900 flex-1 mr-4 truncate" style={{fontFamily: 'inherit', fontWeight: '500'}}>
                          {item.filename}
                        </p>
                        <p className="font-semibold text-sm text-green-700 whitespace-nowrap">
                          ${item.currentMonthForecast.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                    ))}
                  </div>
                  {mjaaFilenamesWithForecast.length > 1 && (
                    <div className="mt-4 pt-3 border-t border-green-200">
                      <div className="flex justify-between items-center p-3 bg-green-100 border border-green-300 rounded-lg">
                        <p className="font-semibold text-sm text-green-800">Total Revenue:</p>
                        <p className="font-bold text-base text-green-700">
                          ${totalMjaaForecast.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Summary */}
          <div className="pt-4 border-t">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">{matchingCampaigns.length}</div>
                <div className="text-sm text-gray-600">Dashboard Campaigns</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{mjaaFilenamesWithForecast.length}</div>
                <div className="text-sm text-gray-600">Salesforce Filenames</div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t bg-gray-50">
          <Button onClick={() => onOpenChange(false)} className="w-full">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

export default IODetailsModal;