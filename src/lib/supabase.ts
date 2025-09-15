import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

// Sanitize environment variables to prevent header issues (preserve valid API key characters)
const sanitizeEnvVar = (value: string | undefined): string | undefined => {
  if (!value) return value

  // For API keys/URLs, only remove the most problematic characters
  // Keep alphanumeric, dots, dashes, underscores, and other URL/key-safe characters
  return String(value)
    .replace(/\u0000/g, '') // Remove null bytes only
    .replace(/[\u0000-\u001F]/g, '') // Remove only control characters (not extended ASCII)
    .trim()
}

const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL
const rawSupabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const supabaseUrl = sanitizeEnvVar(rawSupabaseUrl)
const supabaseKey = sanitizeEnvVar(rawSupabaseKey)

// Debug environment variables (without exposing full keys)
console.log('🔍 Supabase environment check:', {
  urlExists: !!rawSupabaseUrl,
  urlLength: rawSupabaseUrl?.length || 0,
  urlSanitized: rawSupabaseUrl !== supabaseUrl,
  keyExists: !!rawSupabaseKey,
  keyLength: rawSupabaseKey?.length || 0,
  keySanitized: rawSupabaseKey !== supabaseKey,
  urlPreview: supabaseUrl?.substring(0, 20) + '...',
  keyPreview: supabaseKey?.substring(0, 10) + '...'
})

// Create Supabase client with graceful fallback if credentials are missing
let supabase: ReturnType<typeof createClient<Database>> | null = null

if (supabaseUrl && supabaseKey && supabaseUrl !== 'your_supabase_url_here' && supabaseKey !== 'your_supabase_anon_key_here') {
  try {
    supabase = createClient<Database>(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false, // Disable session persistence to avoid potential header issues
      }
    })
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

// Enhanced database check that attempts to setup table if needed
export const ensureDatabaseReady = async (): Promise<{ ready: boolean; message: string }> => {
  if (!supabase) {
    return { ready: false, message: 'Supabase client not initialized' }
  }

  try {
    // Check if table exists and is accessible
    const { error } = await supabase.from('campaign_data').select('count', { count: 'exact', head: true }).limit(1)
    
    if (!error) {
      return { ready: true, message: 'Database ready' }
    }
    
    // If table doesn't exist, provide setup instructions
    if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
      return { 
        ready: false, 
        message: 'Database table needs to be created. Please run the setup SQL in your Supabase dashboard.' 
      }
    }
    
    // Some other database error
    return { 
      ready: false, 
      message: `Database error: ${error.message}` 
    }
    
  } catch (err) {
    return { 
      ready: false, 
      message: `Database connection failed: ${err instanceof Error ? err.message : 'Unknown error'}` 
    }
  }
}