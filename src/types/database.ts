export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      campaign_data: {
        Row: {
          id: string
          date: string
          campaign_order_name: string
          impressions: number
          clicks: number
          revenue: number
          spend: number
          transactions: number | null
          ctr: number | null
          cpm: number | null
          cpc: number | null
          roas: number | null
          data_source: string
          user_session_id: string | null
          uploaded_at: string
          orangellow_corrected: boolean
          original_spend: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          date: string
          campaign_order_name: string
          impressions: number
          clicks: number
          revenue: number
          spend: number
          transactions?: number | null
          ctr?: number | null
          cpm?: number | null
          cpc?: number | null
          roas?: number | null
          data_source: string
          user_session_id?: string | null
          uploaded_at: string
          orangellow_corrected?: boolean
          original_spend?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          date?: string
          campaign_order_name?: string
          impressions?: number
          clicks?: number
          revenue?: number
          spend?: number
          transactions?: number | null
          ctr?: number | null
          cpm?: number | null
          cpc?: number | null
          roas?: number | null
          data_source?: string
          user_session_id?: string | null
          uploaded_at?: string
          orangellow_corrected?: boolean
          original_spend?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type CampaignDataRow = Database['public']['Tables']['campaign_data']['Row']
export type CampaignDataInsert = Database['public']['Tables']['campaign_data']['Insert']
export type CampaignDataUpdate = Database['public']['Tables']['campaign_data']['Update']

// Interface matching CSV data structure
export interface CampaignCSVRow {
  DATE: string
  'CAMPAIGN ORDER NAME': string
  IMPRESSIONS: number
  CLICKS: number
  REVENUE: number
  SPEND: number
  TRANSACTIONS?: number
  CTR?: number
  CPM?: number
  CPC?: number
  ROAS?: number
  _ORANGELLOW_CORRECTED?: boolean
  _ORIGINAL_SPEND?: number
}

// SQL for creating the table (for reference/documentation)
export const CREATE_TABLE_SQL = `
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
`;