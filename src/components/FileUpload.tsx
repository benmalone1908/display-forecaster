import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileText, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";
import { normalizeDate, logDateDetails, parseDateString } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface FileUploadProps {
  onDataLoaded: (data: any[]) => void;
  onPacingDataLoaded?: (data: any[]) => void;
  onContractTermsLoaded?: (data: any[]) => void;
  onProcessFiles: () => void;
}

interface FileStatus {
  campaign: boolean;
  pacing: boolean;
  contractTerms: boolean;
}

const FileUpload = ({ onDataLoaded, onPacingDataLoaded, onContractTermsLoaded, onProcessFiles }: FileUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<FileStatus>({
    campaign: false,
    pacing: false,
    contractTerms: false
  });

  const identifyFileType = (filename: string): 'campaign' | 'pacing' | 'contractTerms' | 'unknown' => {
    const lowerName = filename.toLowerCase();
    
    if (lowerName.includes('performancereport')) {
      return 'campaign';
    } else if (lowerName.includes('pacing-report') || lowerName.includes('pacing_report')) {
      return 'pacing';
    } else if (lowerName.includes('campaign_order_contract_terms') || lowerName.includes('contract_terms')) {
      return 'contractTerms';
    }
    
    return 'unknown';
  };

  const processCampaignData = (file: File) => {
    return new Promise<void>((resolve, reject) => {
      Papa.parse(file, {
        complete: (results) => {
          try {
            // ... keep existing code (campaign data processing logic)
            if (!results.data || !Array.isArray(results.data) || results.data.length < 2) {
              toast.error("Invalid CSV format or empty file");
              reject(new Error("Invalid CSV format"));
              return;
            }
            
            console.log("CSV parse results:", results);
            
            const headers = results.data[0] as string[];
            if (!Array.isArray(headers) || headers.length === 0) {
              toast.error("Invalid or missing headers in CSV");
              reject(new Error("Invalid headers"));
              return;
            }
            
            const requiredHeaders = [
              "DATE",
              "CAMPAIGN ORDER NAME",
              "IMPRESSIONS",
              "CLICKS",
              "TRANSACTIONS",
              "REVENUE",
              "SPEND"
            ];

            const upperHeaders = headers.map(header => String(header).toUpperCase());
            
            const missingHeaders = requiredHeaders.filter(
              (header) => !upperHeaders.includes(header)
            );

            if (missingHeaders.length > 0) {
              toast.error(`Missing required headers: ${missingHeaders.join(", ")}`);
              reject(new Error("Missing headers"));
              return;
            }

            const headerIndexMap = headers.reduce((map, header, index) => {
              map[header.toUpperCase()] = index;
              return map;
            }, {} as Record<string, number>);

            const processedData = results.data.slice(1).map((row, rowIndex) => {
              if (!Array.isArray(row)) {
                console.warn(`Row ${rowIndex + 1} is not an array:`, row);
                return null;
              }
              
              if (row.length !== headers.length) {
                console.warn(`Row ${rowIndex + 1} has ${row.length} values, expected ${headers.length}`);
                return null;
              }
              
              if (row.every(cell => cell === null || cell === undefined || cell === "")) {
                console.warn(`Row ${rowIndex + 1} is empty`);
                return null;
              }
              
              const processed: Record<string, any> = {};
              
              headers.forEach((header, index) => {
                const value = row[index];
                
                if (header.toUpperCase() === "DATE") {
                  try {
                    const dateStr = String(value).trim();
                    // Processing date silently
                    
                    processed[header] = dateStr;
                    
                    const parsedDate = parseDateString(dateStr);
                    if (!parsedDate) {
                      console.warn(`Invalid date in row ${rowIndex + 1}: "${dateStr}"`);
                      return null;
                    }
                    
                    // Date processed successfully
                  } catch (e) {
                    console.error(`Error parsing date in row ${rowIndex + 1}:`, e);
                    return null;
                  }
                } 
                else if (["IMPRESSIONS", "CLICKS", "TRANSACTIONS", "REVENUE", "SPEND"].includes(header.toUpperCase())) {
                  processed[header] = Number(value) || 0;
                } 
                else {
                  processed[header] = String(value || "");
                }
              });
              
              return processed;
            }).filter((row): row is Record<string, any> => row !== null);
            
            if (processedData.length === 0) {
              toast.error("No valid data rows found in CSV");
              reject(new Error("No valid data"));
              return;
            }

            console.log(`Processed ${processedData.length} valid rows`);
            
            const dates = processedData
              .map(row => row.DATE)
              .filter(Boolean)
              .sort();
            
            if (dates.length > 0) {
              console.log(`Processed date range: ${dates[0]} to ${dates[dates.length - 1]}`);
              console.log(`Total unique dates: ${new Set(dates).size}`);
            }
            
            const dateCounts: Record<string, number> = {};
            processedData.forEach(row => {
              const date = row.DATE;
              dateCounts[date] = (dateCounts[date] || 0) + 1;
            });
            
            console.log("Rows per date:", dateCounts);
            
            if (dates.length > 0) {
              const mostRecentDate = dates[dates.length - 1];
              console.log(`Most recent date: ${mostRecentDate}, rows: ${dateCounts[mostRecentDate]}`);
              
              const recentDateRows = processedData.filter(row => row.DATE === mostRecentDate);
              console.log(`Sample rows from ${mostRecentDate} (${recentDateRows.length} total):`, 
                recentDateRows.slice(0, 5));
            }
            
            processedData.sort((a, b) => {
              try {
                const dateA = parseDateString(a.DATE);
                const dateB = parseDateString(b.DATE);
                
                if (!dateA || !dateB) {
                  console.warn(`Failed to parse date for sorting: ${a.DATE} or ${b.DATE}`);
                  return 0;
                }
                
                return dateA.getTime() - dateB.getTime();
              } catch (e) {
                console.error("Error comparing dates for sorting:", e);
                return 0;
              }
            });
            
            onDataLoaded(processedData);
            toast.success(`Successfully loaded campaign data from ${file.name}`);
            resolve();
          } catch (err) {
            console.error("Error processing CSV data:", err);
            toast.error("Error processing CSV data. Check console for details.");
            reject(err);
          }
        },
        error: (error) => {
          console.error("CSV parsing error:", error);
          toast.error(`CSV parsing error: ${error.message}`);
          reject(error);
        },
        header: false,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim()
      });
    });
  };

  const processPacingData = (file: File) => {
    return new Promise<void>((resolve, reject) => {
      Papa.parse(file, {
        complete: (results) => {
          try {
            if (!results.data || !Array.isArray(results.data) || results.data.length < 2) {
              toast.error("Invalid pacing CSV format or empty file");
              reject(new Error("Invalid pacing CSV format"));
              return;
            }

            const headers = results.data[0] as string[];
            const processedData = results.data.slice(1).map((row: any) => {
              const processed: Record<string, any> = {};
              headers.forEach((header, index) => {
                processed[header] = row[index];
              });
              return processed;
            });

            if (onPacingDataLoaded) {
              onPacingDataLoaded(processedData);
            }
            toast.success(`Successfully loaded pacing data from ${file.name}`);
            resolve();
          } catch (err) {
            console.error("Error processing pacing data:", err);
            toast.error("Error processing pacing data");
            reject(err);
          }
        },
        error: (error) => {
          console.error("Pacing CSV parsing error:", error);
          toast.error(`Pacing CSV parsing error: ${error.message}`);
          reject(error);
        },
        header: false,
        skipEmptyLines: true
      });
    });
  };

  const processContractTermsData = (file: File) => {
    return new Promise<void>((resolve, reject) => {
      Papa.parse(file, {
        complete: (results) => {
          try {
            if (!results.data || !Array.isArray(results.data) || results.data.length < 2) {
              toast.error("Invalid contract terms CSV format or empty file");
              reject(new Error("Invalid contract terms CSV format"));
              return;
            }

            const headers = results.data[0] as string[];
            
            // Create header mapping to normalize to StatusTab expected format
            const headerMapping: Record<string, string> = {
              "NAME": "Name",
              "START DATE": "Start Date", 
              "END DATE": "End Date",
              "BUDGET": "Budget",
              "CPM": "CPM",
              "IMPRESSIONS GOAL": "Impressions Goal"
            };
            
            const processedData = results.data.slice(1).map((row: any) => {
              const processed: Record<string, any> = {};
              headers.forEach((header, index) => {
                const upperHeader = header.toUpperCase();
                const normalizedHeader = headerMapping[upperHeader] || header;
                processed[normalizedHeader] = row[index];
              });
              return processed;
            });

            if (onContractTermsLoaded) {
              onContractTermsLoaded(processedData);
            }
            toast.success(`Successfully loaded contract terms from ${file.name}`);
            resolve();
          } catch (err) {
            console.error("Error processing contract terms data:", err);
            toast.error("Error processing contract terms data");
            reject(err);
          }
        },
        error: (error) => {
          console.error("Contract terms CSV parsing error:", error);
          toast.error(`Contract terms CSV parsing error: ${error.message}`);
          reject(error);
        },
        header: false,
        skipEmptyLines: true
      });
    });
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    toast.info(`Processing ${acceptedFiles.length} file(s)...`);
    
    const newFileStatus = { ...uploadedFiles };
    const processPromises: Promise<void>[] = [];

    for (const file of acceptedFiles) {
      const fileType = identifyFileType(file.name);
      
      switch (fileType) {
        case 'campaign':
          processPromises.push(
            processCampaignData(file).then(() => {
              newFileStatus.campaign = true;
            })
          );
          break;
        case 'pacing':
          if (onPacingDataLoaded) {
            processPromises.push(
              processPacingData(file).then(() => {
                newFileStatus.pacing = true;
              })
            );
          }
          break;
        case 'contractTerms':
          if (onContractTermsLoaded) {
            processPromises.push(
              processContractTermsData(file).then(() => {
                newFileStatus.contractTerms = true;
              })
            );
          }
          break;
        default:
          toast.warning(`Unrecognized file: ${file.name}. Expected PerformanceReport.csv, Pacing-Report.csv, or Campaign_Order_Contract_Terms.csv`);
      }
    }

    try {
      await Promise.all(processPromises);
      setUploadedFiles(newFileStatus);
    } catch (error) {
      console.error("Error processing files:", error);
    }
  }, [onDataLoaded, onPacingDataLoaded, onContractTermsLoaded, uploadedFiles]);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
    },
    multiple: true,
    onDragEnter: () => setIsDragging(true),
    onDragLeave: () => setIsDragging(false),
  });

  const getUploadedFilesList = () => {
    const files = [];
    if (uploadedFiles.campaign) files.push("Campaign Data");
    if (uploadedFiles.pacing) files.push("Pacing Data");
    if (uploadedFiles.contractTerms) files.push("Contract Terms");
    return files;
  };

  const uploadedFilesList = getUploadedFilesList();

  return (
    <div className="space-y-6">
      {/* Single Multi-File Upload */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Upload CSV Files</h2>
        <div
          {...getRootProps()}
          className={`relative flex flex-col items-center justify-center w-full p-12 transition-all duration-300 border-2 border-dashed rounded-lg cursor-pointer bg-background/50 backdrop-blur-sm ${
            uploadedFiles.campaign 
              ? "border-green-500/50 bg-green-50/50"
              : isDragging
              ? "border-primary/50 bg-primary/5"
              : "border-border hover:border-primary/30 hover:bg-accent/5"
          }`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center space-y-4 text-center animate-fade-in">
            <div className="p-4 rounded-full bg-primary/5">
              <Upload className={`w-8 h-8 ${uploadedFiles.campaign ? 'text-green-500' : 'text-primary/50'}`} />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">
                {uploadedFilesList.length > 0 ? "Files uploaded successfully!" : "Upload your CSV files"}
              </h3>
              <p className="text-sm text-muted-foreground">
                {uploadedFilesList.length > 0 
                  ? "Click to add more files or replace existing ones" 
                  : "Drag and drop your CSV files here, or click to browse"
                }
              </p>
              <div className="text-xs text-muted-foreground space-y-1">
                <p><strong>Expected files:</strong></p>
                <p>• PerformanceReport.csv (required)</p>
                <p>• Pacing-Report.csv (optional)</p>
                <p>• Campaign_Order_Contract_Terms.csv (optional)</p>
              </div>
            </div>
            
            {uploadedFilesList.length > 0 && (
              <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center space-x-2 text-sm text-green-700 font-medium mb-2">
                  <CheckCircle className="w-4 h-4" />
                  <span>Uploaded files:</span>
                </div>
                <ul className="text-sm text-green-600 space-y-1">
                  {uploadedFilesList.map((file, index) => (
                    <li key={index} className="flex items-center space-x-2">
                      <CheckCircle className="w-3 h-3" />
                      <span>{file}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <FileText className="w-4 h-4" />
              <span>Accepts CSV files only</span>
            </div>
          </div>
        </div>
      </div>

      {/* Process Files Button */}
      {uploadedFiles.campaign && (
        <div className="flex justify-center pt-6">
          <Button 
            onClick={onProcessFiles}
            size="lg"
            className="px-8 py-3 text-lg"
          >
            Process Files & View Dashboard
          </Button>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
