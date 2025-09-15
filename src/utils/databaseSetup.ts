import { supabase } from '../lib/supabase'
import { CREATE_TABLE_SQL } from '../types/database'

// Setup the database table and indexes
export const ensureDatabaseSetup = async (): Promise<{ success: boolean; message: string }> => {
  if (!supabase) {
    return { 
      success: false, 
      message: 'Supabase client not available' 
    }
  }

  try {
    console.log('🔧 Checking database setup...')
    
    // First, try to check if table exists by querying it
    const { error: queryError } = await supabase
      .from('campaign_data')
      .select('count', { count: 'exact', head: true })
      .limit(1)

    // If no error, table exists and we're good
    if (!queryError) {
      console.log('✅ Database table exists and is accessible')
      return { 
        success: true, 
        message: 'Database setup verified' 
      }
    }

    // If error indicates table doesn't exist, provide setup instructions
    if (queryError.code === 'PGRST116' || queryError.message.includes('does not exist')) {
      console.log('📋 Table does not exist - manual setup required')
      console.log('🔧 Please run the following SQL in your Supabase SQL Editor:')
      console.log(CREATE_TABLE_SQL)
      
      return { 
        success: false, 
        message: 'Database table does not exist. Please run the setup SQL in your Supabase dashboard.' 
      }
    }

    // Some other error occurred
    console.error('❌ Database setup error:', queryError)
    return { 
      success: false, 
      message: `Database error: ${queryError.message}` 
    }

  } catch (error) {
    console.error('❌ Database setup exception:', error)
    return { 
      success: false, 
      message: `Setup failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }
  }
}

// Helper to provide user-friendly instructions if automated setup fails
export const getDatabaseSetupInstructions = (): string => {
  return `
📋 Manual Database Setup Required

Please run this SQL in your Supabase SQL Editor (https://supabase.com/dashboard):

${CREATE_TABLE_SQL}

After running this SQL:
1. Refresh the page
2. Try uploading your CSV file again
3. Data should now persist between dev and production

The table creation is a one-time setup step.
`
}