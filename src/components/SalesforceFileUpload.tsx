import React, { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, File, AlertCircle, CheckCircle, X } from "lucide-react";
import { toast } from "sonner";
import { saveSalesforceData } from "@/utils/salesforceDataStorage";
import type { SalesforceCSVRow } from "@/types/database";

interface SalesforceFileUploadProps {
  onDataLoaded: (data: any[]) => void;
}

const SalesforceFileUpload: React.FC<SalesforceFileUploadProps> = ({ onDataLoaded }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const validateSalesforceData = (data: any[]): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (data.length === 0) {
      errors.push("File appears to be empty");
      return { isValid: false, errors };
    }

    // Check for required columns
    const requiredColumns = ["MJAA Number", "Monthly Revenue", "Revenue Date", "Product Category"];
    const headers = Object.keys(data[0] || {});

    const missingColumns = requiredColumns.filter(col =>
      !headers.some(header => header.toLowerCase() === col.toLowerCase())
    );

    if (missingColumns.length > 0) {
      errors.push(`Missing required columns: ${missingColumns.join(", ")}`);
    }

    // Sample a few rows for data validation
    const sampleSize = Math.min(5, data.length);
    for (let i = 0; i < sampleSize; i++) {
      const row = data[i];

      // Validate MJAA Number (should be 7 digits)
      const mjaaNumber = String(row['MJAA Number'] || '').trim();
      if (!/^\d{7}$/.test(mjaaNumber)) {
        errors.push(`Row ${i + 1}: Invalid MJAA Number "${mjaaNumber}" (must be 7 digits)`);
      }

      // Validate Monthly Revenue (should be a number)
      const revenue = row['Monthly Revenue'];
      if (isNaN(Number(revenue)) || revenue === '' || revenue === null || revenue === undefined) {
        errors.push(`Row ${i + 1}: Invalid Monthly Revenue "${revenue}"`);
      }

      // Validate Revenue Date (should be parseable)
      const dateStr = row['Revenue Date'];
      if (!dateStr || typeof dateStr !== 'string') {
        errors.push(`Row ${i + 1}: Invalid Revenue Date "${dateStr}"`);
      }
    }

    return { isValid: errors.length === 0, errors: errors.slice(0, 10) }; // Limit to first 10 errors
  };

  const processFile = useCallback(async (file: File) => {
    setIsUploading(true);
    setUploadedFile(file);

    try {
      const text = await file.text();

      Papa.parse<SalesforceCSVRow>(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header: string) => header.trim(),
        complete: async (results) => {
          console.log('📊 Parsed Salesforce CSV:', results.data.length, 'rows');

          if (results.errors.length > 0) {
            console.warn('CSV parsing errors:', results.errors);
          }

          // Validate the data
          const validation = validateSalesforceData(results.data);

          if (!validation.isValid) {
            toast.error(`Invalid Salesforce data: ${validation.errors.join('; ')}`);
            setIsUploading(false);
            setUploadedFile(null);
            return;
          }

          // Save to database
          console.log('💾 Saving Salesforce data to database...');
          const saveResult = await saveSalesforceData(results.data);

          if (saveResult.success) {
            toast.success(`✅ ${saveResult.message}`);
            onDataLoaded(results.data);
          } else {
            toast.error(`❌ ${saveResult.message}`);
          }

          setIsUploading(false);
        },
        error: (error) => {
          console.error('Error parsing CSV:', error);
          toast.error(`Failed to parse CSV: ${error.message}`);
          setIsUploading(false);
          setUploadedFile(null);
        }
      });
    } catch (error) {
      console.error('Error reading file:', error);
      toast.error('Failed to read the file');
      setIsUploading(false);
      setUploadedFile(null);
    }
  }, [onDataLoaded]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      if (file.type !== 'text/csv' && !file.name.toLowerCase().endsWith('.csv')) {
        toast.error('Please upload a CSV file');
        return;
      }
      processFile(file);
    }
  }, [processFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv']
    },
    multiple: false,
    disabled: isUploading
  });

  const removeFile = () => {
    setUploadedFile(null);
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="text-sm text-gray-600 mb-4">
            <p className="mb-2">
              <strong>Required columns:</strong> MJAA Number, Monthly Revenue, Revenue Date, Product Category
            </p>
            <p className="text-xs text-gray-500">
              • MJAA Number: 7-digit IO number<br />
              • Monthly Revenue: Numeric revenue amount<br />
              • Revenue Date: Date in M/D/YY format<br />
              • Product Category: Must contain "Display Advertising"
            </p>
          </div>

          {!uploadedFile ? (
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                isDragActive
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400'
              } ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <input {...getInputProps()} />
              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />

              {isDragActive ? (
                <p className="text-blue-600">Drop the CSV file here...</p>
              ) : (
                <div>
                  <p className="text-gray-600 mb-2">
                    Drag and drop your Salesforce CSV file here, or click to browse
                  </p>
                  <Button variant="outline" disabled={isUploading}>
                    Choose File
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <File className="h-8 w-8 text-blue-500" />
                  <div>
                    <p className="font-medium">{uploadedFile.name}</p>
                    <p className="text-sm text-gray-500">
                      {(uploadedFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {isUploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                      <span className="text-sm text-blue-600">Processing...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={removeFile}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {isUploading && (
            <div className="flex items-center justify-center space-x-2 text-blue-600">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <span>Uploading and processing Salesforce data...</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default SalesforceFileUpload;