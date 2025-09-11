import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import EnhancedPdfExportModal from "@/components/pdf/EnhancedPdfExportModal";
import { DateRange } from "react-day-picker";

interface EnhancedPdfExportButtonProps {
  data: any[];
  pacingData?: any[];
  contractTermsData?: any[];
  dateRange?: DateRange;
  appliedFilters?: {
    agencies: string[];
    advertisers: string[];
    campaigns: string[];
  };
  availableOptions?: {
    agencies: string[];
    advertisers: string[];
    campaigns: string[];
  };
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "sm" | "default" | "lg";
}

const EnhancedPdfExportButton = ({ 
  data,
  pacingData = [],
  contractTermsData = [],
  dateRange, 
  appliedFilters, 
  availableOptions,
  variant = "outline",
  size = "sm"
}: EnhancedPdfExportButtonProps) => {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <Button 
        variant={variant} 
        size={size}
        onClick={() => setModalOpen(true)}
        className="flex items-center gap-2"
      >
        <Download className="h-4 w-4" />
        Export PDF
      </Button>

      <EnhancedPdfExportModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        data={data}
        pacingData={pacingData}
        contractTermsData={contractTermsData}
        dateRange={dateRange}
        appliedFilters={appliedFilters}
        availableOptions={availableOptions}
      />
    </>
  );
};

export default EnhancedPdfExportButton;