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
      salesforce_revenue: {
        Row: {
          id: string
          mjaa_number: string
          revenue_date: string
          monthly_revenue: number
          month: string
          mjaa_filename: string | null
          account_name: string | null
          uploaded_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          mjaa_number: string
          revenue_date: string
          monthly_revenue: number
          month: string
          mjaa_filename?: string | null
          account_name?: string | null
          uploaded_at: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          mjaa_number?: string
          revenue_date?: string
          monthly_revenue?: number
          month?: string
          mjaa_filename?: string | null
          account_name?: string | null
          uploaded_at?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
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

export type SalesforceRevenueRow = Database['public']['Tables']['salesforce_revenue']['Row']
export type SalesforceRevenueInsert = Database['public']['Tables']['salesforce_revenue']['Insert']
export type SalesforceRevenueUpdate = Database['public']['Tables']['salesforce_revenue']['Update']

export type CampaignDataRow = Database['public']['Tables']['campaign_data']['Row']
export type CampaignDataInsert = Database['public']['Tables']['campaign_data']['Insert']
export type CampaignDataUpdate = Database['public']['Tables']['campaign_data']['Update']

// Interface matching Salesforce CSV data structure
export interface SalesforceCSVRow {
  'MJAA Number': string
  'Monthly Revenue': number
  'Revenue Date': string
  'Product Category': string
  'MJAA Filename'?: string
  'Account Name: Account Name'?: string
  // Other columns exist but we only need these six
}

// Interface matching Campaign CSV data structure
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
  // Metadata fields for data tracking
  uploaded_at?: string
  user_session_id?: string
  data_source?: string
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

// SQL for creating the Salesforce revenue table
export const CREATE_SALESFORCE_TABLE_SQL = `
-- Salesforce Revenue Table
CREATE TABLE IF NOT EXISTS salesforce_revenue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mjaa_number TEXT NOT NULL,
  revenue_date DATE NOT NULL,
  monthly_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
  month TEXT NOT NULL,
  mjaa_filename TEXT,
  account_name TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_salesforce_mjaa_number ON salesforce_revenue(mjaa_number);
CREATE INDEX IF NOT EXISTS idx_salesforce_month ON salesforce_revenue(month);
CREATE INDEX IF NOT EXISTS idx_salesforce_revenue_date ON salesforce_revenue(revenue_date);
CREATE INDEX IF NOT EXISTS idx_salesforce_uploaded_at ON salesforce_revenue(uploaded_at);

-- Create unique constraint to prevent duplicates (same IO and date)
CREATE UNIQUE INDEX IF NOT EXISTS idx_salesforce_unique
ON salesforce_revenue(mjaa_number, revenue_date);
`;