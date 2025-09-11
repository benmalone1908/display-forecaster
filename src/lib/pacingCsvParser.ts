import Papa from 'papaparse';
import type { ContractTerms, PacingDeliveryData } from '../types/pacing';

// Helper function to find column with case-insensitive matching
const findColumn = (headers: string[], targetColumn: string): string | null => {
  return headers.find(header => header.toLowerCase() === targetColumn.toLowerCase()) || null;
};

// Helper function to normalize data with case-insensitive column mapping
const normalizeContractTermsData = (data: any[]): ContractTerms[] => {
  if (data.length === 0) return [];
  
  const headers = Object.keys(data[0]);
  const columnMap: { [key: string]: string } = {};
  
  // Map required columns to actual headers (case-insensitive)
  const requiredColumns = ['Name', 'Start Date', 'End Date', 'Budget', 'CPM', 'Impressions Goal'];
  
  for (const requiredCol of requiredColumns) {
    const actualCol = findColumn(headers, requiredCol);
    if (actualCol) {
      columnMap[requiredCol] = actualCol;
    }
  }
  
  // Transform data to use normalized column names
  return data.map(row => {
    const normalizedRow: any = {};
    for (const [standardName, actualName] of Object.entries(columnMap)) {
      normalizedRow[standardName] = row[actualName];
    }
    return normalizedRow as ContractTerms;
  });
};

export const parseContractTermsCSV = (file: File): Promise<ContractTerms[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          reject(new Error(`CSV parsing errors: ${results.errors.map(e => e.message).join(', ')}`));
          return;
        }
        
        const rawData = results.data as any[];
        
        // Validate required columns (case-insensitive)
        if (rawData.length > 0) {
          const headers = Object.keys(rawData[0]);
          const requiredColumns = ['Name', 'Start Date', 'End Date', 'Budget', 'CPM', 'Impressions Goal'];
          const missingColumns = requiredColumns.filter(col => !findColumn(headers, col));
          
          if (missingColumns.length > 0) {
            reject(new Error(`Missing required columns: ${missingColumns.join(', ')}. Available columns: ${headers.join(', ')}`));
            return;
          }
        }
        
        const normalizedData = normalizeContractTermsData(rawData);
        resolve(normalizedData);
      },
      error: (error) => {
        reject(error);
      }
    });
  });
};

// Helper function to normalize delivery data with case-insensitive column mapping
const normalizeDeliveryData = (data: any[]): PacingDeliveryData[] => {
  if (data.length === 0) return [];
  
  const headers = Object.keys(data[0]);
  const columnMap: { [key: string]: string } = {};
  
  // Map required columns to actual headers (case-insensitive)
  const requiredColumns = ['DATE', 'CAMPAIGN ORDER NAME', 'IMPRESSIONS', 'SPEND'];
  
  for (const requiredCol of requiredColumns) {
    const actualCol = findColumn(headers, requiredCol);
    if (actualCol) {
      columnMap[requiredCol] = actualCol;
    }
  }
  
  // Transform data to use normalized column names
  return data.map(row => {
    const normalizedRow: any = {};
    for (const [standardName, actualName] of Object.entries(columnMap)) {
      normalizedRow[standardName] = row[actualName];
    }
    return normalizedRow as PacingDeliveryData;
  });
};

export const parsePacingDeliveryDataCSV = (file: File): Promise<PacingDeliveryData[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          reject(new Error(`CSV parsing errors: ${results.errors.map(e => e.message).join(', ')}`));
          return;
        }
        
        const rawData = results.data as any[];
        
        // Validate required columns (case-insensitive)
        if (rawData.length > 0) {
          const headers = Object.keys(rawData[0]);
          const requiredColumns = ['DATE', 'CAMPAIGN ORDER NAME', 'IMPRESSIONS', 'SPEND'];
          const missingColumns = requiredColumns.filter(col => !findColumn(headers, col));
          
          if (missingColumns.length > 0) {
            reject(new Error(`Missing required columns: ${missingColumns.join(', ')}. Available columns: ${headers.join(', ')}`));
            return;
          }
        }
        
        const normalizedData = normalizeDeliveryData(rawData);
        resolve(normalizedData);
      },
      error: (error) => {
        reject(error);
      }
    });
  });
};