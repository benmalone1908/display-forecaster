
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileText } from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";

interface PacingFileUploadSimpleProps {
  onDataLoaded: (data: any[]) => void;
}

const PacingFileUploadSimple = ({ onDataLoaded }: PacingFileUploadSimpleProps) => {
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
  }, [onDataLoaded]);

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
    <div
      {...getRootProps()}
      className={`relative flex flex-col items-center justify-center w-full p-8 transition-all duration-300 border-2 border-dashed rounded-lg cursor-pointer bg-background/50 backdrop-blur-sm ${
        isDragging
          ? "border-primary/50 bg-primary/5"
          : "border-border hover:border-primary/30 hover:bg-accent/5"
      }`}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center space-y-3 text-center animate-fade-in">
        <div className="p-3 rounded-full bg-primary/5">
          <Upload className="w-6 h-6 text-primary/50" />
        </div>
        <div className="space-y-2">
          <h3 className="text-base font-semibold">Pacing Data (Optional)</h3>
          <p className="text-sm text-muted-foreground">
            Upload campaign pacing data
          </p>
          <p className="text-xs text-muted-foreground">
            Required: Campaign, Days into Flight, Days Left, Expected Imps, Actual Imps, Imps Left, Imps Yesterday, Daily Avg Left
          </p>
        </div>
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <FileText className="w-4 h-4" />
          <span>CSV files only</span>
        </div>
      </div>
    </div>
  );
};

export default PacingFileUploadSimple;
