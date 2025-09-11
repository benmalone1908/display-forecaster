
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileText } from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";

interface ContractTermsFileUploadProps {
  onDataLoaded: (data: any[]) => void;
}

const ContractTermsFileUpload = ({ onDataLoaded }: ContractTermsFileUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    
    if (file) {
      try {
        toast.info("Processing contract terms CSV file...");
        
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
              
              // Required headers for contract terms data
              const requiredHeaders = [
                "NAME",
                "START DATE",
                "END DATE", 
                "BUDGET",
                "CPM"
              ];

              const upperHeaders = headers.map(header => String(header).toUpperCase());
              const missingHeaders = requiredHeaders.filter(
                (header) => !upperHeaders.includes(header)
              );

              if (missingHeaders.length > 0) {
                toast.error(`Missing required contract terms headers: ${missingHeaders.join(", ")}`);
                return;
              }

              // Create header mapping to normalize to StatusTab expected format
              const headerMapping: Record<string, string> = {
                "NAME": "Name",
                "START DATE": "Start Date", 
                "END DATE": "End Date",
                "BUDGET": "Budget",
                "CPM": "CPM",
                "IMPRESSIONS GOAL": "Impressions Goal"
              };

              const processedData = results.data.slice(1).map((row, rowIndex) => {
                if (!Array.isArray(row)) {
                  console.warn(`Contract terms row ${rowIndex + 1} is not an array:`, row);
                  return null;
                }
                
                if (row.every(cell => cell === null || cell === undefined || cell === "")) {
                  return null;
                }
                
                const processed: Record<string, any> = {};
                
                headers.forEach((header, index) => {
                  const value = row[index];
                  const upperHeader = header.toUpperCase();
                  
                  // Use normalized header name that matches StatusTab expectations
                  const normalizedHeader = headerMapping[upperHeader] || header;
                  
                  if (upperHeader === "NAME") {
                    processed[normalizedHeader] = String(value || "");
                  } 
                  else if (["START DATE", "END DATE"].includes(upperHeader)) {
                    processed[normalizedHeader] = String(value || "");
                  }
                  else if (["BUDGET", "CPM"].includes(upperHeader)) {
                    processed[normalizedHeader] = Number(value) || 0;
                  } 
                  else {
                    processed[normalizedHeader] = String(value || "");
                  }
                });
                
                return processed;
              }).filter((row): row is Record<string, any> => row !== null);
              
              if (processedData.length === 0) {
                toast.error("No valid contract terms data rows found in CSV");
                return;
              }

              console.log(`Processed ${processedData.length} contract terms rows`);
              onDataLoaded(processedData);
              toast.success(`Successfully loaded ${processedData.length} contract terms from ${file.name}`);
            } catch (err) {
              console.error("Error processing contract terms CSV data:", err);
              toast.error("Error processing contract terms CSV data. Check console for details.");
            }
          },
          error: (error) => {
            console.error("Contract terms CSV parsing error:", error);
            toast.error(`Contract terms CSV parsing error: ${error.message}`);
          },
          header: false,
          skipEmptyLines: true,
          transformHeader: (header) => header.trim()
        });
      } catch (err) {
        console.error("Error parsing contract terms CSV:", err);
        toast.error("Failed to parse contract terms CSV file");
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
          <h3 className="text-base font-semibold">Contract Terms (Optional)</h3>
          <p className="text-sm text-muted-foreground">
            Upload contract terms data
          </p>
          <p className="text-xs text-muted-foreground">
            Required: Name, Start Date, End Date, Budget, CPM
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

export default ContractTermsFileUpload;
