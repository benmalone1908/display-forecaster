import React from 'react';
import { X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import FileUpload from "@/components/FileUpload";

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataLoaded: (data: any[]) => void;
  onProcessFiles: (csvData: any[], pacingData: any[], contractTerms: any[]) => void;
}

const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  onDataLoaded,
  onProcessFiles
}) => {
  const handleDataLoaded = (data: any[]) => {
    onDataLoaded(data);
    onClose(); // Close modal after successful upload
  };

  const handleProcessFiles = (csvData: any[], pacingData: any[], contractTerms: any[]) => {
    onProcessFiles(csvData, pacingData, contractTerms);
    onClose(); // Close modal after successful processing
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">Upload New Campaign Data</DialogTitle>
        </DialogHeader>
        
        <div className="mt-4">
          <FileUpload 
            onDataLoaded={handleDataLoaded}
            onPacingDataLoaded={() => {}} 
            onContractTermsLoaded={() => {}}
            onProcessFiles={handleProcessFiles}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UploadModal;