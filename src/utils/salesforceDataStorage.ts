import { supabase } from '../lib/supabase'
import type { SalesforceCSVRow, SalesforceRevenueInsert } from '../types/database'
import { CREATE_SALESFORCE_TABLE_SQL } from '../types/database'
import { parseDateString } from "@/lib/utils";

/**
 * Parse Revenue Date from M/D/YY format and extract month
 */
const parseRevenueDate = (dateStr: string): { fullDate: string; month: string } => {
  try {
    // Parse the M/D/YY format
    const parsed = parseDateString(dateStr);
    if (!parsed) {
      throw new Error(`Invalid date format: ${dateStr}`);
    }

    // Format as YYYY-MM-DD for database storage
    const fullDate = parsed.toISOString().split('T')[0];

    // Extract month as YYYY-MM format
    const month = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;

    return { fullDate, month };
  } catch (error) {
    console.error(`Error parsing date ${dateStr}:`, error);
    throw error;
  }
};

/**
 * Convert Salesforce CSV row to database insert format
 */
export const salesforceCsvRowToDbFormat = (
  csvRow: SalesforceCSVRow,
  uploadTimestamp: string = new Date().toISOString()
): SalesforceRevenueInsert => {
  const mjaaNumber = String(csvRow['MJAA Number']).trim();

  if (!mjaaNumber || mjaaNumber.length !== 7 || !/^\d{7}$/.test(mjaaNumber)) {
    throw new Error(`Invalid MJAA Number: ${mjaaNumber}. Must be 7 digits.`);
  }

  const monthlyRevenue = Number(csvRow['Monthly Revenue']);
  if (isNaN(monthlyRevenue)) {
    throw new Error(`Invalid Monthly Revenue: ${csvRow['Monthly Revenue']}`);
  }

  const { fullDate, month } = parseRevenueDate(csvRow['Revenue Date']);

  return {
    mjaa_number: mjaaNumber,
    revenue_date: fullDate,
    monthly_revenue: monthlyRevenue,
    month: month,
    mjaa_filename: csvRow['MJAA Filename'] ? String(csvRow['MJAA Filename']).trim() : null,
    uploaded_at: uploadTimestamp
  };
};

/**
 * Save Salesforce data to database with upsert functionality
 */
export const saveSalesforceData = async (csvData: SalesforceCSVRow[]): Promise<{
  success: boolean;
  message: string;
  savedCount?: number;
}> => {
  try {
    console.log(`🔄 Processing ${csvData.length} Salesforce records...`);

    const uploadTimestamp = new Date().toISOString();

    // Step 1: Filter for Display Advertising only
    const displayAdvertisingRows = csvData.filter(row => {
      const productCategory = String(row['Product Category'] || '').trim().toLowerCase();
      return productCategory.includes('display advertising');
    });

    console.log(`📊 Filtered to ${displayAdvertisingRows.length} Display Advertising records from ${csvData.length} total`);

    if (displayAdvertisingRows.length === 0) {
      return {
        success: false,
        message: 'No Display Advertising records found in the uploaded data'
      };
    }

    // Step 2: Process and validate each row
    const processedRecords: SalesforceRevenueInsert[] = [];
    for (const csvRow of displayAdvertisingRows) {
      try {
        const dbRecord = salesforceCsvRowToDbFormat(csvRow, uploadTimestamp);
        processedRecords.push(dbRecord);
      } catch (error) {
        console.warn(`Skipping invalid row:`, csvRow, error);
      }
    }

    // Step 3: Aggregate by month and MJAA number (sum revenue for same IO/month combinations)
    const monthlyAggregation = new Map<string, SalesforceRevenueInsert>();

    processedRecords.forEach(record => {
      const key = `${record.mjaa_number}-${record.month}`;
      const existing = monthlyAggregation.get(key);

      if (existing) {
        // Aggregate revenue for the same IO/month combination
        existing.monthly_revenue += record.monthly_revenue;
        // Keep the latest date for the aggregated record
        if (record.revenue_date > existing.revenue_date) {
          existing.revenue_date = record.revenue_date;
        }
        // Combine MJAA filenames (comma-separated if different)
        if (record.mjaa_filename && existing.mjaa_filename !== record.mjaa_filename) {
          const existingFilenames = existing.mjaa_filename ? existing.mjaa_filename.split(', ') : [];
          if (!existingFilenames.includes(record.mjaa_filename)) {
            existing.mjaa_filename = existingFilenames.length > 0
              ? `${existing.mjaa_filename}, ${record.mjaa_filename}`
              : record.mjaa_filename;
          }
        } else if (record.mjaa_filename && !existing.mjaa_filename) {
          existing.mjaa_filename = record.mjaa_filename;
        }
      } else {
        monthlyAggregation.set(key, { ...record });
      }
    });

    const dbRecords = Array.from(monthlyAggregation.values());
    const aggregatedCount = processedRecords.length - dbRecords.length;

    if (aggregatedCount > 0) {
      console.log(`🔄 Aggregated ${aggregatedCount} duplicate IO/month combinations`);
    }

    if (dbRecords.length === 0) {
      return {
        success: false,
        message: 'No valid records found in the uploaded data'
      };
    }

    console.log(`📊 Prepared ${dbRecords.length} valid records for database`);

    // Check if table exists
    const tableCheck = await ensureSalesforceTableExists();
    if (!tableCheck.success) {
      return {
        success: false,
        message: tableCheck.message
      };
    }

    // Remove duplicates from the records before upserting
    const uniqueRecords = new Map();
    dbRecords.forEach(record => {
      const key = `${record.mjaa_number}-${record.revenue_date}`;
      // If duplicate exists, keep the one with the higher revenue (or latest upload)
      const existing = uniqueRecords.get(key);
      if (!existing || record.monthly_revenue > existing.monthly_revenue) {
        uniqueRecords.set(key, record);
      }
    });

    const deduplicatedRecords = Array.from(uniqueRecords.values());

    if (deduplicatedRecords.length < dbRecords.length) {
      console.log(`🔄 Removed ${dbRecords.length - deduplicatedRecords.length} duplicate records from upload`);
    }

    // Use upsert to handle duplicate data
    const { data, error } = await supabase
      .from('salesforce_revenue')
      .upsert(deduplicatedRecords, {
        onConflict: 'mjaa_number,revenue_date',
        ignoreDuplicates: false
      })
      .select();

    if (error) {
      console.error('❌ Supabase upsert error:', error);
      return {
        success: false,
        message: `Database error: ${error.message}`
      };
    }

    console.log(`✅ Successfully saved ${deduplicatedRecords.length} Salesforce records`);

    let message = `Successfully saved ${deduplicatedRecords.length} Display Advertising records`;
    if (aggregatedCount > 0) {
      message += ` (aggregated ${aggregatedCount} duplicate IO/month combinations)`;
    }

    return {
      success: true,
      message,
      savedCount: deduplicatedRecords.length
    };

  } catch (error) {
    console.error('❌ Error saving Salesforce data:', error);
    return {
      success: false,
      message: `Failed to save data: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
};

/**
 * Load all Salesforce data from database
 */
export const loadAllSalesforceData = async (): Promise<{
  success: boolean;
  message: string;
  data: any[];
}> => {
  try {
    console.log('📥 Loading Salesforce data from database...');

    const { data, error } = await supabase
      .from('salesforce_revenue')
      .select('*')
      .order('revenue_date', { ascending: true });

    if (error) {
      console.error('❌ Error loading Salesforce data:', error);
      return {
        success: false,
        message: `Database error: ${error.message}`,
        data: []
      };
    }

    console.log(`✅ Loaded ${data?.length || 0} Salesforce records`);

    return {
      success: true,
      message: `Loaded ${data?.length || 0} records`,
      data: data || []
    };

  } catch (error) {
    console.error('❌ Error loading Salesforce data:', error);
    return {
      success: false,
      message: `Failed to load data: ${error instanceof Error ? error.message : 'Unknown error'}`,
      data: []
    };
  }
};

/**
 * Check if Salesforce table exists and provide setup instructions if not
 */
const ensureSalesforceTableExists = async (): Promise<{ success: boolean; message: string }> => {
  try {
    console.log('🔧 Checking Salesforce table setup...');

    // Try to query the table to see if it exists
    const { error: queryError } = await supabase
      .from('salesforce_revenue')
      .select('count', { count: 'exact', head: true })
      .limit(1);

    // If no error, table exists and we're good
    if (!queryError) {
      console.log('✅ Salesforce table exists and is accessible');
      return {
        success: true,
        message: 'Salesforce table setup verified'
      };
    }

    // If error indicates table doesn't exist, provide setup instructions
    if (queryError.code === 'PGRST116' || queryError.message.includes('does not exist')) {
      console.log('📋 Salesforce table does not exist - manual setup required');
      console.log('🔧 Please run the following SQL in your Supabase SQL Editor:');
      console.log(CREATE_SALESFORCE_TABLE_SQL);

      return {
        success: false,
        message: 'Salesforce table does not exist. Please run the setup SQL in your Supabase dashboard.'
      };
    }

    // Some other error occurred
    console.error('❌ Salesforce table setup error:', queryError);
    return {
      success: false,
      message: `Database error: ${queryError.message}`
    };

  } catch (error) {
    console.error('❌ Error checking Salesforce table setup:', error);
    return {
      success: false,
      message: `Failed to check table setup: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
};

/**
 * Check if any Salesforce data exists
 */
export const hasSalesforceData = async (): Promise<boolean> => {
  try {
    const { count, error } = await supabase
      .from('salesforce_revenue')
      .select('*', { count: 'exact', head: true });

    if (error) return false;
    return (count || 0) > 0;
  } catch {
    return false;
  }
};

/**
 * Group Salesforce data by month and IO number
 */
export const groupSalesforceByMonthAndIO = (salesforceData: any[]): Record<string, Record<string, number>> => {
  const grouped: Record<string, Record<string, number>> = {};

  salesforceData.forEach(row => {
    const month = row.month;
    const ioNumber = row.mjaa_number;
    const revenue = Number(row.monthly_revenue) || 0;

    if (!grouped[month]) {
      grouped[month] = {};
    }

    if (!grouped[month][ioNumber]) {
      grouped[month][ioNumber] = 0;
    }

    grouped[month][ioNumber] += revenue;
  });

  return grouped;
};