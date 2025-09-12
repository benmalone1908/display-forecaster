import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Create Supabase client with graceful fallback if credentials are missing
let supabase: ReturnType<typeof createClient<Database>> | null = null

if (supabaseUrl && supabaseKey && supabaseUrl !== 'your_supabase_url_here' && supabaseKey !== 'your_supabase_anon_key_here') {
  try {
    supabase = createClient<Database>(supabaseUrl, supabaseKey)
    console.log('✅ Supabase client initialized successfully')
  } catch (error) {
    console.warn('⚠️ Failed to initialize Supabase client:', error)
    supabase = null
  }
} else {
  console.log('ℹ️ Supabase credentials not configured - running in CSV-only mode')
}

export { supabase }
export const isSupabaseEnabled = () => supabase !== null

// Helper function to check if we can use database features
export const canUseDatabase = async (): Promise<boolean> => {
  if (!supabase) return false
  
  try {
    // Simple health check
    const { error } = await supabase.from('campaign_data').select('count', { count: 'exact', head: true })
    return error === null || error.code === 'PGRST116' // Table might not exist yet, but connection works
  } catch {
    return false
  }
}