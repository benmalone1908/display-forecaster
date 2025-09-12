import { supabase, canUseDatabase } from '../lib/supabase'
import type { CampaignCSVRow, CampaignDataInsert, CampaignDataRow } from '../types/database'

// Generate a session ID for this user session
let userSessionId: string | null = null
const generateSessionId = () => {
  if (!userSessionId) {
    userSessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }
  return userSessionId
}

// Convert CSV row to database insert format
export const csvRowToDbFormat = (
  csvRow: CampaignCSVRow, 
  uploadTimestamp: string = new Date().toISOString()
): CampaignDataInsert => {
  return {
    date: csvRow.DATE,
    campaign_order_name: csvRow['CAMPAIGN ORDER NAME'],
    impressions: Number(csvRow.IMPRESSIONS) || 0,
    clicks: Number(csvRow.CLICKS) || 0,
    revenue: Number(csvRow.REVENUE) || 0,
    spend: Number(csvRow.SPEND) || 0,
    transactions: csvRow.TRANSACTIONS ? Number(csvRow.TRANSACTIONS) : null,
    ctr: csvRow.CTR ? Number(csvRow.CTR) : null,
    cpm: csvRow.CPM ? Number(csvRow.CPM) : null,
    cpc: csvRow.CPC ? Number(csvRow.CPC) : null,
    roas: csvRow.ROAS ? Number(csvRow.ROAS) : null,
    data_source: 'csv_upload',
    user_session_id: generateSessionId(),
    uploaded_at: uploadTimestamp,
    orangellow_corrected: csvRow._ORANGELLOW_CORRECTED || false,
    original_spend: csvRow._ORIGINAL_SPEND ? Number(csvRow._ORIGINAL_SPEND) : null
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

// Save CSV data to database (upsert operation)
export const saveCampaignData = async (
  csvData: CampaignCSVRow[]
): Promise<{ success: boolean; message: string; savedCount?: number }> => {
  try {
    if (!supabase) {
      return { success: false, message: 'Database not available - data saved locally only' }
    }

    if (!(await canUseDatabase())) {
      return { success: false, message: 'Database connection failed - data saved locally only' }
    }

    const uploadTimestamp = new Date().toISOString()
    const dbRows = csvData.map(row => csvRowToDbFormat(row, uploadTimestamp))

    console.log(`💾 Saving ${dbRows.length} rows to Supabase...`)

    // Try to insert data, handle duplicates gracefully
    let successCount = 0
    const errors = []
    
    // Insert rows in smaller batches to handle partial failures
    const batchSize = 100
    for (let i = 0; i < dbRows.length; i += batchSize) {
      const batch = dbRows.slice(i, i + batchSize)
      const batchNum = Math.floor(i/batchSize) + 1
      
      console.log(`💾 Processing batch ${batchNum}/${Math.ceil(dbRows.length/batchSize)}: rows ${i+1}-${Math.min(i+batchSize, dbRows.length)}`)
      
      const { data: batchData, error: batchError } = await supabase
        .from('campaign_data')
        .insert(batch)
        .select('id')
      
      if (batchError) {
        console.error(`❌ Batch ${batchNum} error:`, batchError)
        if (batchError.code === '23505') { // Unique constraint violation
          console.log(`⚠️ Batch ${batchNum}: Some rows were duplicates, trying individual insertion...`)
          // Try inserting rows one by one for this batch
          for (let j = 0; j < batch.length; j++) {
            const row = batch[j]
            const { data: rowData, error: rowError } = await supabase
              .from('campaign_data')
              .insert(row)
              .select('id')
            
            if (!rowError) {
              successCount++
            } else if (rowError.code !== '23505') {
              console.error(`❌ Row ${i+j+1} error:`, rowError)
              errors.push(rowError)
            } else {
              console.log(`⚠️ Row ${i+j+1} was duplicate, skipped`)
            }
          }
        } else {
          console.error(`❌ Non-duplicate error in batch ${batchNum}:`, batchError)
          errors.push(batchError)
          // Skip this entire batch - don't process individual rows
        }
      } else {
        const batchCount = batchData?.length || 0
        successCount += batchCount
        console.log(`✅ Batch ${batchNum} saved ${batchCount} rows successfully`)
      }
    }
    
    const data = [{ count: successCount }] // Mock the data structure
    const error = errors.length > 0 ? errors[0] : null

    if (error) {
      console.error('❌ Supabase save error:', error)
      return { 
        success: false, 
        message: `Database save failed: ${error.message}` 
      }
    }

    console.log(`✅ Successfully saved ${successCount} rows to Supabase`)
    
    return { 
      success: true, 
      message: `Successfully saved ${successCount} campaign records to database`, 
      savedCount: successCount 
    }

  } catch (error) {
    console.error('❌ Unexpected error saving to database:', error)
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