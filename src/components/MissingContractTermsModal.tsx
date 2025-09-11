import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Badge } from "./ui/badge";
import { Card } from "./ui/card";
import { AlertTriangle, Download } from "lucide-react";
import { Button } from "./ui/button";
import { MissingContractTermsInfo, formatNumber, formatCurrency } from "@/utils/contractTermsValidation";

interface MissingContractTermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  missingCampaigns: MissingContractTermsInfo[];
}

const MissingContractTermsModal = ({ isOpen, onClose, missingCampaigns }: MissingContractTermsModalProps) => {
  const handleExportCSV = () => {
    const headers = ['Campaign Name', 'Total Impressions', 'Total Spend', 'Total Attributed Sales'];
    const csvContent = [
      headers.join(','),
      ...missingCampaigns.map(campaign => [
        `"${campaign.campaignName}"`,
        campaign.totalImpressions,
        campaign.totalSpend.toFixed(2),
        campaign.totalRevenue.toFixed(2)
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'missing-contract-terms-campaigns.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalMissingImpressions = missingCampaigns.reduce((sum, campaign) => sum + campaign.totalImpressions, 0);
  const totalMissingSpend = missingCampaigns.reduce((sum, campaign) => sum + campaign.totalSpend, 0);
  const totalMissingRevenue = missingCampaigns.reduce((sum, campaign) => sum + campaign.totalRevenue, 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-orange-700">
            <AlertTriangle className="h-5 w-5" />
            Missing Contract Terms - {missingCampaigns.length} Campaign{missingCampaigns.length !== 1 ? 's' : ''}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Summary Cards */}
          <div className="flex-shrink-0 grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <Card className="p-3">
              <div className="text-lg font-semibold">{formatNumber(totalMissingImpressions)}</div>
              <div className="text-sm text-muted-foreground">Total Impressions</div>
            </Card>
            <Card className="p-3">
              <div className="text-lg font-semibold">{formatCurrency(totalMissingSpend)}</div>
              <div className="text-sm text-muted-foreground">Total Spend</div>
            </Card>
            <Card className="p-3">
              <div className="text-lg font-semibold">{formatCurrency(totalMissingRevenue)}</div>
              <div className="text-sm text-muted-foreground">Total Attributed Sales</div>
            </Card>
          </div>

          {/* Action Buttons */}
          <div className="flex-shrink-0 flex items-center justify-between mb-4 p-3 bg-orange-50 rounded-lg border border-orange-200">
            <div className="text-sm text-orange-800">
              <div className="font-medium">Action Required</div>
              <div>Add these campaigns to your contract terms file to enable full health scoring and pacing analysis.</div>
            </div>
            <Button 
              onClick={handleExportCSV}
              variant="outline"
              size="sm"
              className="ml-4 border-orange-300 text-orange-700 hover:bg-orange-100"
            >
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>

          {/* Campaigns List */}
          <div className="flex-1 overflow-auto">
            <div className="space-y-2">
              {missingCampaigns.map((campaign, index) => (
                <Card key={campaign.campaignName} className="p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm mb-1 truncate pr-2">
                        {campaign.campaignName}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{formatNumber(campaign.totalImpressions)} impressions</span>
                        <span>{formatCurrency(campaign.totalSpend)} spend</span>
                        <span>{formatCurrency(campaign.totalRevenue)} attributed sales</span>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <Badge 
                        variant="secondary" 
                        className="bg-orange-100 text-orange-800 border-orange-200"
                      >
                        #{index + 1}
                      </Badge>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MissingContractTermsModal;