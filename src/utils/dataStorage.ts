import { supabase, canUseDatabase, ensureDatabaseReady } from '../lib/supabase'
import type { CampaignCSVRow, CampaignDataInsert, CampaignDataRow } from '../types/database'
import { ensureDatabaseSetup, getDatabaseSetupInstructions } from './databaseSetup'

// Generate a session ID for this user session
let userSessionId: string | null = null
const generateSessionId = () => {
  if (!userSessionId) {
    userSessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }
  return userSessionId
}

// Comprehensive string sanitization function
const sanitizeStringForDatabase = (value: any, fieldName: string): string => {
  if (value === null || value === undefined) {
    throw new Error(`${fieldName} cannot be null or undefined`)
  }

  let sanitized = String(value)
    .replace(/\u0000/g, '') // Remove null bytes
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove all control characters
    .replace(/[^\x20-\x7E]/g, '') // Keep only printable ASCII characters
    .replace(/[\r\n\t]/g, ' ') // Replace line breaks and tabs with spaces
    .replace(/\s+/g, ' ') // Normalize multiple spaces
    .trim()

  if (!sanitized) {
    throw new Error(`${fieldName} is empty after sanitization`)
  }

  return sanitized
}

// Convert CSV row to database insert format
export const csvRowToDbFormat = (
  csvRow: CampaignCSVRow,
  uploadTimestamp: string = new Date().toISOString()
): CampaignDataInsert => {
  // Sanitize date field
  if (csvRow.DATE === 'Totals') {
    throw new Error(`Invalid date field: Totals row detected`);
  }
  const cleanDate = sanitizeStringForDatabase(csvRow.DATE, 'date');

  // Sanitize campaign name field
  const campaignName = sanitizeStringForDatabase(csvRow['CAMPAIGN ORDER NAME'], 'campaign_order_name');

  // Sanitize numeric fields with proper validation
  const parseNumericField = (value: any, fieldName: string): number => {
    if (value === null || value === undefined || value === '') return 0;
    const parsed = Number(value);
    if (isNaN(parsed)) {
      console.warn(`Invalid ${fieldName} value: ${value}, defaulting to 0`);
      return 0;
    }
    return parsed;
  };

  const parseOptionalNumericField = (value: any, fieldName: string): number | null => {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    if (isNaN(parsed)) {
      console.warn(`Invalid ${fieldName} value: ${value}, defaulting to null`);
      return null;
    }
    return parsed;
  };

  return {
    date: cleanDate,
    campaign_order_name: campaignName,
    impressions: parseNumericField(csvRow.IMPRESSIONS, 'impressions'),
    clicks: parseNumericField(csvRow.CLICKS, 'clicks'),
    revenue: parseNumericField(csvRow.REVENUE, 'revenue'),
    spend: parseNumericField(csvRow.SPEND, 'spend'),
    transactions: parseOptionalNumericField(csvRow.TRANSACTIONS, 'transactions'),
    ctr: parseOptionalNumericField(csvRow.CTR, 'ctr'),
    cpm: parseOptionalNumericField(csvRow.CPM, 'cpm'),
    cpc: parseOptionalNumericField(csvRow.CPC, 'cpc'),
    roas: parseOptionalNumericField(csvRow.ROAS, 'roas'),
    data_source: sanitizeStringForDatabase('csv_upload', 'data_source'),
    user_session_id: sanitizeStringForDatabase(generateSessionId(), 'user_session_id'),
    uploaded_at: sanitizeStringForDatabase(uploadTimestamp, 'uploaded_at'),
    orangellow_corrected: csvRow._ORANGELLOW_CORRECTED || false,
    original_spend: parseOptionalNumericField(csvRow._ORIGINAL_SPEND, 'original_spend')
  }
}

// Convert database row to CSV format for application use
export const dbRowToCsvFormat = (dbRow: CampaignDataRow): CampaignCSVRow => {
  return {
    DATE: dbRow.date,
    'CAMPAIGN ORDER NAME': dbRow.campaign_order_name,
    IMPRESSIONS: dbRow.impressions,
    CLICKS: dbRow.clicks,
    REVENUE: dbRow.revenue,
    SPEND: dbRow.spend,
    TRANSACTIONS: dbRow.transactions || undefined,
    CTR: dbRow.ctr || undefined,
    CPM: dbRow.cpm || undefined,
    CPC: dbRow.cpc || undefined,
    ROAS: dbRow.roas || undefined,
    _ORANGELLOW_CORRECTED: dbRow.orangellow_corrected || undefined,
    _ORIGINAL_SPEND: dbRow.original_spend || undefined
  }
}

// Save CSV data to database (TRUE upsert operation)
export const saveCampaignData = async (
  csvData: CampaignCSVRow[]
): Promise<{ success: boolean; message: string; savedCount?: number }> => {
  try {
    if (!supabase) {
      return { 
        success: false, 
        message: 'Database not available - Supabase client not initialized' 
      }
    }

    // Skip complex setup checks in production - just try to save data
    console.log('🔍 Attempting direct database save (skipping setup checks)...')

    const uploadTimestamp = new Date().toISOString()

    // Filter and sanitize data, handling invalid rows gracefully
    const validDbRows = []
    const invalidRows = []

    for (let i = 0; i < csvData.length; i++) {
      try {
        const dbRow = csvRowToDbFormat(csvData[i], uploadTimestamp)
        validDbRows.push(dbRow)
      } catch (error) {
        console.warn(`⚠️ Skipping invalid row ${i + 1}:`, error instanceof Error ? error.message : error)
        invalidRows.push({ index: i + 1, row: csvData[i], error: error instanceof Error ? error.message : 'Unknown error' })
      }
    }

    if (validDbRows.length === 0) {
      return {
        success: false,
        message: `No valid rows to save. ${invalidRows.length} rows were invalid.`
      }
    }

    if (invalidRows.length > 0) {
      console.warn(`⚠️ ${invalidRows.length} invalid rows were skipped out of ${csvData.length} total rows`)
    }

    const dbRows = validDbRows

    console.log(`💾 Upserting ${dbRows.length} rows to Supabase...`)

    // Debug: Log sample of data being sent
    if (dbRows.length > 0) {
      console.log('🔍 Sample data being sent to Supabase:', {
        firstRow: dbRows[0],
        totalRows: dbRows.length,
        sampleKeys: Object.keys(dbRows[0])
      })
    }

    // PROPER UPSERT: Only delete/update data for dates that are in the new upload
    const uploadDates = [...new Set(dbRows.map(row => row.date))];
    console.log(`🔄 Upserting data for ${uploadDates.length} unique dates:`, uploadDates.slice(0, 5), uploadDates.length > 5 ? '...' : '');

    // Delete existing data only for the dates we're uploading
    let deletedCount = 0;
    if (uploadDates.length > 0) {
      const { count, error: clearError } = await supabase
        .from('campaign_data')
        .delete({ count: 'exact' })
        .in('date', uploadDates);

      if (clearError) {
        console.warn(`⚠️ Could not clear existing data for upload dates:`, clearError.message);
      } else {
        deletedCount = count || 0;
        console.log(`🗑️ Deleted ${deletedCount} existing records for upload dates`);
      }
    }

    // Now insert the new data for these dates
    let successCount = 0
    const errors = []
    
    // Insert rows in smaller batches with additional validation
    const batchSize = 50 // Smaller batches to isolate issues
    for (let i = 0; i < dbRows.length; i += batchSize) {
      const batch = dbRows.slice(i, i + batchSize)
      const batchNum = Math.floor(i/batchSize) + 1

      console.log(`💾 Inserting batch ${batchNum}/${Math.ceil(dbRows.length/batchSize)}: rows ${i+1}-${Math.min(i+batchSize, dbRows.length)}`)

      // Final validation: ensure all batch data is JSON-serializable and clean
      try {
        const sanitizedBatch = batch.map((row, idx) => {
          // Deep clone and validate each field
          const cleanRow = {
            date: String(row.date).slice(0, 20), // Limit date length
            campaign_order_name: String(row.campaign_order_name).slice(0, 500), // Limit campaign name length
            impressions: Number(row.impressions) || 0,
            clicks: Number(row.clicks) || 0,
            revenue: Number(row.revenue) || 0,
            spend: Number(row.spend) || 0,
            transactions: row.transactions ? Number(row.transactions) : null,
            ctr: row.ctr ? Number(row.ctr) : null,
            cpm: row.cpm ? Number(row.cpm) : null,
            cpc: row.cpc ? Number(row.cpc) : null,
            roas: row.roas ? Number(row.roas) : null,
            data_source: 'csv_upload', // Hardcode to avoid any issues
            user_session_id: `session_${Date.now()}`, // Simplified session ID
            uploaded_at: new Date().toISOString(), // Fresh timestamp
            orangellow_corrected: Boolean(row.orangellow_corrected),
            original_spend: row.original_spend ? Number(row.original_spend) : null
          }

          // Ensure JSON serialization works
          JSON.stringify(cleanRow)
          return cleanRow
        })

        const { data: batchData, error: batchError } = await supabase
          .from('campaign_data')
          .insert(sanitizedBatch)
          .select('id')

        if (batchError) {
          console.error(`❌ Batch ${batchNum} error:`, batchError)
          errors.push(batchError)
        } else {
          const batchCount = batchData?.length || 0
          successCount += batchCount
          console.log(`✅ Batch ${batchNum} inserted ${batchCount} rows successfully`)
        }
      } catch (validationError) {
        console.error(`❌ Batch ${batchNum} validation failed:`, validationError)
        errors.push({ message: `Batch validation failed: ${validationError}` })
      }
    }
    
    if (errors.length > 0) {
      console.error('❌ Supabase upsert had errors:', errors[0])
      return { 
        success: false, 
        message: `Database upsert failed: ${errors[0].message}` 
      }
    }

    console.log(`✅ Successfully upserted ${successCount} rows to Supabase (deleted ${deletedCount} old, inserted ${successCount} new)`)
    
    return { 
      success: true, 
      message: `Successfully upserted ${successCount} campaign records (${deletedCount} replaced, ${successCount - deletedCount} new)`, 
      savedCount: successCount 
    }

  } catch (error) {
    console.error('❌ Unexpected error during upsert:', error)
    return { 
      success: false, 
      message: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }
  }
}

// Load all campaign data from database (not limited by upload date)
export const loadAllCampaignData = async (): Promise<{ success: boolean; data: CampaignCSVRow[]; message: string }> => {
  try {
    if (!supabase) {
      return { 
        success: false, 
        data: [], 
        message: 'Database not available' 
      }
    }

    if (!(await canUseDatabase())) {
      return { 
        success: false, 
        data: [], 
        message: 'Database connection failed' 
      }
    }

    console.log(`📥 Loading all campaign data from database...`)

    // Use pagination to get all data (Supabase has a max limit per query)
    let allData: any[] = []
    let page = 0
    const pageSize = 1000
    let hasMore = true

    while (hasMore) {
      console.log(`📄 Loading page ${page + 1} (${page * pageSize + 1}-${(page + 1) * pageSize})...`)
      
      const { data: pageData, error } = await supabase
        .from('campaign_data')
        .select('*')
        .order('date', { ascending: true })
        .range(page * pageSize, (page + 1) * pageSize - 1)

      if (error) {
        console.error('❌ Supabase load error on page', page + 1, ':', error)
        return { 
          success: false, 
          data: [], 
          message: `Failed to load data: ${error.message}` 
        }
      }

      if (!pageData || pageData.length === 0) {
        hasMore = false
      } else {
        allData.push(...pageData)
        hasMore = pageData.length === pageSize
        page++
        
        if (pageData.length < pageSize) {
          hasMore = false
        }
      }
    }

    console.log(`📦 Loaded ${allData.length} total rows across ${page} pages`)
    const data = allData

    const csvData = data.map(dbRowToCsvFormat)
    console.log(`✅ Loaded ${csvData.length} rows from Supabase`)
    
    // Debug: Show date range of loaded data
    if (csvData.length > 0) {
      const dates = csvData.map(row => row.DATE).filter(Boolean).sort()
      console.log(`📊 Data date range: ${dates[0]} to ${dates[dates.length - 1]}`)
      console.log(`📊 First few dates: ${dates.slice(0, 5).join(', ')}`)
      console.log(`📊 Last few dates: ${dates.slice(-5).join(', ')}`)
    }

    return { 
      success: true, 
      data: csvData, 
      message: `Loaded ${csvData.length} records from database` 
    }

  } catch (error) {
    console.error('❌ Unexpected error loading from database:', error)
    return { 
      success: false, 
      data: [], 
      message: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }
  }
}

// Load recent campaign data from database (kept for backward compatibility)
export const loadRecentCampaignData = async (
  daysBack: number = 30
): Promise<{ success: boolean; data: CampaignCSVRow[]; message: string }> => {
  try {
    if (!supabase) {
      return { 
        success: false, 
        data: [], 
        message: 'Database not available' 
      }
    }

    if (!(await canUseDatabase())) {
      return { 
        success: false, 
        data: [], 
        message: 'Database connection failed' 
      }
    }

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysBack)

    console.log(`📥 Loading campaign data from last ${daysBack} days...`)

    const { data, error } = await supabase
      .from('campaign_data')
      .select('*')
      .gte('uploaded_at', cutoffDate.toISOString())
      .order('date', { ascending: true })
      .limit(50000) // Increased limit for historical data

    if (error) {
      console.error('❌ Supabase load error:', error)
      return { 
        success: false, 
        data: [], 
        message: `Failed to load data: ${error.message}` 
      }
    }

    const csvData = data.map(dbRowToCsvFormat)
    console.log(`✅ Loaded ${csvData.length} rows from Supabase`)

    return { 
      success: true, 
      data: csvData, 
      message: `Loaded ${csvData.length} records from database` 
    }

  } catch (error) {
    console.error('❌ Unexpected error loading from database:', error)
    return { 
      success: false, 
      data: [], 
      message: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }
  }
}

// Check if there's any data available in the database
export const hasAnyData = async (): Promise<boolean> => {
  try {
    if (!supabase || !(await canUseDatabase())) {
      return false
    }

    const { data, error } = await supabase
      .from('campaign_data')
      .select('id')
      .limit(1)

    return !error && data && data.length > 0
  } catch {
    return false
  }
}

// Check if there's recent data available (kept for backward compatibility)
export const hasRecentData = async (): Promise<boolean> => {
  try {
    if (!supabase || !(await canUseDatabase())) {
      return false
    }

    const oneDayAgo = new Date()
    oneDayAgo.setDate(oneDayAgo.getDate() - 1)

    const { data, error } = await supabase
      .from('campaign_data')
      .select('id')
      .gte('uploaded_at', oneDayAgo.toISOString())
      .limit(1)

    return !error && data && data.length > 0
  } catch {
    return false
  }
}

// Clear all data from database
export const clearAllData = async (): Promise<{ success: boolean; message: string }> => {
  try {
    if (!supabase || !(await canUseDatabase())) {
      return { success: false, message: 'Database not available' }
    }

    console.log('🗑️ Clearing all campaign data from database...')

    const { error } = await supabase
      .from('campaign_data')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all rows (using a condition that matches all)

    if (error) {
      console.error('❌ Error clearing database:', error)
      return { success: false, message: `Failed to clear data: ${error.message}` }
    }

    console.log('✅ Database cleared successfully')
    return { success: true, message: 'Successfully cleared all campaign data from database' }
  } catch (error) {
    console.error('❌ Unexpected error clearing database:', error)
    return { 
      success: false, 
      message: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }
  }
}

// Clear old data (optional utility)
export const clearOldData = async (daysToKeep: number = 90): Promise<{ success: boolean; message: string }> => {
  try {
    if (!supabase || !(await canUseDatabase())) {
      return { success: false, message: 'Database not available' }
    }

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

    const { error } = await supabase
      .from('campaign_data')
      .delete()
      .lt('uploaded_at', cutoffDate.toISOString())

    if (error) {
      return { success: false, message: `Failed to clear old data: ${error.message}` }
    }

    return { success: true, message: `Successfully cleared data older than ${daysToKeep} days` }
  } catch (error) {
    return { 
      success: false, 
      message: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }
  }
}


// Fix duplicate records by keeping only the most recent upload for each date/campaign combination
export const fixDuplicateRecords = async (): Promise<{ success: boolean; message: string; removedCount?: number }> => {
  try {
    if (!supabase || !(await canUseDatabase())) {
      return { success: false, message: 'Database not available' }
    }

    console.log('🔧 Scanning for duplicate records...')

    // Get all records ordered by uploaded_at (newest first)
    const { data: allRecords, error: fetchError } = await supabase
      .from('campaign_data')
      .select('id, date, campaign_order_name, uploaded_at')
      .order('uploaded_at', { ascending: false })

    if (fetchError) {
      return { success: false, message: `Failed to fetch records: ${fetchError.message}` }
    }

    // Group records by date+campaign combination
    const recordMap = new Map<string, typeof allRecords>()
    const duplicatesToDelete: string[] = []

    for (const record of allRecords || []) {
      const key = `${record.date}::${record.campaign_order_name}`
      
      if (!recordMap.has(key)) {
        // First (newest) record for this combination - keep it
        recordMap.set(key, [record])
      } else {
        // Duplicate - mark for deletion
        duplicatesToDelete.push(record.id)
      }
    }

    console.log(`🔧 Found ${duplicatesToDelete.length} duplicate records to remove`)

    if (duplicatesToDelete.length === 0) {
      return { success: true, message: 'No duplicate records found', removedCount: 0 }
    }

    // Delete duplicates in batches
    let removedCount = 0
    const batchSize = 100
    for (let i = 0; i < duplicatesToDelete.length; i += batchSize) {
      const batch = duplicatesToDelete.slice(i, i + batchSize)
      
      const { error: deleteError } = await supabase
        .from('campaign_data')
        .delete()
        .in('id', batch)

      if (deleteError) {
        console.error(`❌ Failed to delete batch ${Math.floor(i/batchSize) + 1}:`, deleteError.message)
        return { success: false, message: `Failed to delete duplicates: ${deleteError.message}` }
      }
      
      removedCount += batch.length
      // Batch deleted silently
    }

    console.log(`✅ Successfully removed ${removedCount} duplicate records`)
    return { 
      success: true, 
      message: `Successfully removed ${removedCount} duplicate records`, 
      removedCount 
    }

  } catch (error) {
    console.error('❌ Unexpected error fixing duplicates:', error)
    return { 
      success: false, 
      message: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }
  }
}