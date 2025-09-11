import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import PdfExportModal from "@/components/pdf/PdfExportModal";
import { DateRange } from "react-day-picker";

interface PdfExportButtonProps {
  dateRange?: DateRange;
  appliedFilters?: {
    agencies: string[];
    advertisers: string[];
    campaigns: string[];
  };
  activeTab: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "sm" | "default" | "lg";
}

const PdfExportButton = ({ 
  dateRange, 
  appliedFilters, 
  activeTab,
  variant = "outline",
  size = "sm"
}: PdfExportButtonProps) => {
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

      <PdfExportModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        dateRange={dateRange}
        appliedFilters={appliedFilters}
        activeTab={activeTab}
      />
    </>
  );
};

export default PdfExportButton;