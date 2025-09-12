# Supabase Integration Setup

The Display Forecaster now includes optional Supabase integration for persistent data storage. This allows campaign data to be automatically saved and loaded without requiring CSV re-uploads.

## Features

- **Auto-save**: CSV data is automatically saved to Supabase after processing
- **Auto-load**: Recent data is loaded on app startup if available
- **Graceful fallback**: App works perfectly without Supabase - database features are optional
- **Spend corrections**: Orangellow corrections are preserved in database
- **Session tracking**: Data is associated with user sessions for privacy

## Setup Instructions

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create a new project or use an existing one
3. Note your project URL and anon key from Settings → API

### 2. Configure Environment Variables

Update `.env.local` with your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. Create Database Table

Run this SQL in your Supabase SQL editor:

```sql
CREATE TABLE IF NOT EXISTS campaign_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date TEXT NOT NULL,
  campaign_order_name TEXT NOT NULL,
  impressions BIGINT NOT NULL DEFAULT 0,
  clicks BIGINT NOT NULL DEFAULT 0,
  revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
  spend NUMERIC(12,2) NOT NULL DEFAULT 0,
  transactions BIGINT DEFAULT NULL,
  ctr NUMERIC(10,4) DEFAULT NULL,
  cpm NUMERIC(10,2) DEFAULT NULL,
  cpc NUMERIC(10,2) DEFAULT NULL,
  roas NUMERIC(10,2) DEFAULT NULL,
  data_source TEXT NOT NULL DEFAULT 'csv_upload',
  user_session_id TEXT DEFAULT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL,
  orangellow_corrected BOOLEAN DEFAULT FALSE,
  original_spend NUMERIC(12,2) DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_campaign_data_date ON campaign_data(date);
CREATE INDEX IF NOT EXISTS idx_campaign_data_campaign_name ON campaign_data(campaign_order_name);
CREATE INDEX IF NOT EXISTS idx_campaign_data_uploaded_at ON campaign_data(uploaded_at);
CREATE INDEX IF NOT EXISTS idx_campaign_data_user_session ON campaign_data(user_session_id);

-- Create unique constraint to prevent exact duplicates
CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_data_unique 
ON campaign_data(date, campaign_order_name, data_source, uploaded_at);
```

### 4. Test the Integration

1. Restart your development server: `npm run dev`
2. Upload a CSV file
3. Check the browser console for database save messages
4. Refresh the page - it should auto-load the recent data

## How It Works

### Data Flow
1. **CSV Upload** → **Process & Apply Corrections** → **Save to Database** → **Display Forecast**
2. **App Startup** → **Check for Recent Data** → **Auto-load if Available** → **Display Forecast**

### Database Operations
- **Upsert**: Prevents duplicate data while allowing updates
- **Session tracking**: Associates data with user sessions
- **Automatic cleanup**: Old data can be cleaned up as needed
- **Graceful errors**: Database failures don't break the app

### Console Messages
- ✅ `Database save: Successfully saved N campaign records`
- 📥 `Recent data found in database, attempting to load...`
- ℹ️ `Supabase credentials not configured - running in CSV-only mode`
- ⚠️ `Database save failed: [error message]`

## Troubleshooting

### App Still Works Without Database
The Display Forecaster continues to function perfectly even if:
- Supabase credentials are not configured
- Database connection fails
- Table doesn't exist
- Network issues occur

### Common Issues
1. **"Database not available"**: Check your environment variables
2. **"Connection failed"**: Verify your Supabase project is active
3. **"Table doesn't exist"**: Run the SQL setup commands above
4. **Data not loading**: Check browser console for error messages

### Debugging
Open browser console to see detailed logging:
- Database connection status
- Save/load operations
- Error messages
- Data processing steps

## Data Privacy

- Data is stored in your own Supabase project
- Session IDs are generated locally
- No personal information is transmitted
- Data can be deleted at any time through Supabase dashboard