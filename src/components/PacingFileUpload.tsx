
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileText, X } from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";

interface PacingFileUploadProps {
  onDataLoaded: (data: any[]) => void;
  isOpen: boolean;
  onClose: () => void;
}

const PacingFileUpload = ({ onDataLoaded, isOpen, onClose }: PacingFileUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    
    if (file) {
      try {
        toast.info("Processing pacing CSV file...");
        
        Papa.parse(file, {
          complete: (results) => {
            try {
              if (!results.data || !Array.isArray(results.data) || results.data.length < 2) {
                toast.error("Invalid CSV format or empty file");
                return;
              }
              
              const headers = results.data[0] as string[];
              if (!Array.isArray(headers) || headers.length === 0) {
                toast.error("Invalid or missing headers in CSV");
                return;
              }
              
              // Required headers for pacing data
              const requiredHeaders = [
                "CAMPAIGN",
                "DAYS INTO FLIGHT",
                "DAYS LEFT", 
                "EXPECTED IMPS",
                "ACTUAL IMPS",
                "IMPS LEFT",
                "IMPS YESTERDAY",
                "DAILY AVG LEFT"
              ];

              const upperHeaders = headers.map(header => String(header).toUpperCase());
              const missingHeaders = requiredHeaders.filter(
                (header) => !upperHeaders.includes(header)
              );

              if (missingHeaders.length > 0) {
                toast.error(`Missing required pacing headers: ${missingHeaders.join(", ")}`);
                return;
              }

              const processedData = results.data.slice(1).map((row, rowIndex) => {
                if (!Array.isArray(row)) {
                  console.warn(`Pacing row ${rowIndex + 1} is not an array:`, row);
                  return null;
                }
                
                if (row.every(cell => cell === null || cell === undefined || cell === "")) {
                  return null;
                }
                
                const processed: Record<string, any> = {};
                
                headers.forEach((header, index) => {
                  const value = row[index];
                  const upperHeader = header.toUpperCase();
                  
                  if (upperHeader === "CAMPAIGN") {
                    processed[header] = String(value || "");
                  } 
                  else if (["DAYS INTO FLIGHT", "DAYS LEFT", "EXPECTED IMPS", "ACTUAL IMPS", "IMPS LEFT", "IMPS YESTERDAY", "DAILY AVG LEFT"].includes(upperHeader)) {
                    processed[header] = Number(value) || 0;
                  } 
                  else {
                    processed[header] = String(value || "");
                  }
                });
                
                return processed;
              }).filter((row): row is Record<string, any> => row !== null);
              
              if (processedData.length === 0) {
                toast.error("No valid pacing data rows found in CSV");
                return;
              }

              console.log(`Processed ${processedData.length} pacing rows`);
              onDataLoaded(processedData);
              onClose();
              toast.success(`Successfully loaded ${processedData.length} pacing campaigns from ${file.name}`);
            } catch (err) {
              console.error("Error processing pacing CSV data:", err);
              toast.error("Error processing pacing CSV data. Check console for details.");
            }
          },
          error: (error) => {
            console.error("Pacing CSV parsing error:", error);
            toast.error(`Pacing CSV parsing error: ${error.message}`);
          },
          header: false,
          skipEmptyLines: true,
          transformHeader: (header) => header.trim()
        });
      } catch (err) {
        console.error("Error parsing pacing CSV:", err);
        toast.error("Failed to parse pacing CSV file");
      }
    }
  }, [onDataLoaded, onClose]);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
    },
    multiple: false,
    onDragEnter: () => setIsDragging(true),
    onDragLeave: () => setIsDragging(false),
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            Upload Pacing Data
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>
        
        <div
          {...getRootProps()}
          className={`relative flex flex-col items-center justify-center w-full p-12 transition-all duration-300 border-2 border-dashed rounded-lg cursor-pointer bg-background/50 backdrop-blur-sm ${
            isDragging
              ? "border-primary/50 bg-primary/5"
              : "border-border hover:border-primary/30 hover:bg-accent/5"
          }`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center space-y-4 text-center animate-fade-in">
            <div className="p-4 rounded-full bg-primary/5">
              <Upload className="w-8 h-8 text-primary/50" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Upload your pacing data</h3>
              <p className="text-sm text-muted-foreground">
                Drag and drop your pacing CSV file here, or click to browse
              </p>
              <p className="text-xs text-muted-foreground">
                Required columns: Campaign, Days into Flight, Days Left, Expected Imps, Actual Imps, Imps Left, Imps Yesterday, Daily Avg Left
              </p>
            </div>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <FileText className="w-4 h-4" />
              <span>Accepts CSV files only</span>
            </div>
          </div>
        </div>
        
        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose}>Skip for now</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PacingFileUpload;
