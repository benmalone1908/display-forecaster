import { useState } from "react";
import { Alert, AlertDescription } from "./ui/alert";
import { Button } from "./ui/button";
import { AlertTriangle, ExternalLink } from "lucide-react";
import MissingContractTermsModal from "./MissingContractTermsModal";
import { MissingContractTermsInfo } from "@/utils/contractTermsValidation";

interface ContractTermsAlertProps {
  missingCampaigns: MissingContractTermsInfo[];
  className?: string;
}

const ContractTermsAlert = ({ missingCampaigns, className = "" }: ContractTermsAlertProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (missingCampaigns.length === 0) {
    return null;
  }

  const totalImpressions = missingCampaigns.reduce((sum, campaign) => sum + campaign.totalImpressions, 0);
  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toLocaleString();
  };

  return (
    <>
      <Alert className={`border-orange-200 bg-orange-50 ${className}`}>
        <AlertTriangle className="h-4 w-4 text-orange-600" />
        <AlertDescription className="text-orange-800">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium mb-1">
                {missingCampaigns.length} campaign{missingCampaigns.length !== 1 ? 's' : ''} missing contract terms
              </div>
              <div className="text-sm">
                {formatNumber(totalImpressions)} impressions cannot be fully analyzed without contract terms data.
              </div>
            </div>
            <Button 
              onClick={() => setIsModalOpen(true)}
              variant="outline"
              size="sm"
              className="ml-4 border-orange-300 text-orange-700 hover:bg-orange-100 whitespace-nowrap"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              View Details
            </Button>
          </div>
        </AlertDescription>
      </Alert>

      <MissingContractTermsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        missingCampaigns={missingCampaigns}
      />
    </>
  );
};

export default ContractTermsAlert;