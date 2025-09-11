import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import StreamlinedPdfExportModal from "@/components/pdf/StreamlinedPdfExportModal";
import { DateRange } from "react-day-picker";

interface StreamlinedPdfExportButtonProps {
  data: any[];
  pacingData?: any[];
  contractTermsData?: any[];
  dateRange?: DateRange;
  appliedFilters?: {
    agencies: string[];
    advertisers: string[];
    campaigns: string[];
  };
  showLiveOnly?: boolean;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "sm" | "default" | "lg";
}

const StreamlinedPdfExportButton = ({ 
  data,
  pacingData = [],
  contractTermsData = [],
  dateRange, 
  appliedFilters, 
  showLiveOnly = false,
  variant = "outline",
  size = "sm"
}: StreamlinedPdfExportButtonProps) => {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div>
      <Button 
        variant={variant} 
        size={size}
        onClick={() => setModalOpen(true)}
        className="flex items-center gap-2"
      >
        <Download className="h-4 w-4" />
        Export PDF (Streamlined)
      </Button>

      <StreamlinedPdfExportModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        data={data}
        pacingData={pacingData}
        contractTermsData={contractTermsData}
        dateRange={dateRange}
        appliedFilters={appliedFilters}
        showLiveOnly={showLiveOnly}
      />
    </div>
  );
};

export default StreamlinedPdfExportButton;