// Quick debug script to check if database has duplicates for a specific date range
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://znommdezzgrqbmpluukt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpub21tZGV6emdycWJtcGx1dWt0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2NDg4OTMsImV4cCI6MjA3MzIyNDg5M30.9a_uMi6o0kIP4ALGJf_H71viL680KJRtQvYqBsTpl24';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Get September 2025 data (month 8, since October is current month 9)
const { data, error } = await supabase
  .from('campaign_data')
  .select('date, campaign_order_name, spend, uploaded_at')
  .like('date', '9/%/2025');

if (error) {
  console.error('Error:', error);
} else {
  console.log(`Total September records: ${data.length}`);
  
  // Group by date+campaign
  const groups = {};
  data.forEach(row => {
    const key = `${row.date}|${row.campaign_order_name}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(row);
  });
  
  const duplicates = Object.entries(groups).filter(([k, v]) => v.length > 1);
  console.log(`Duplicates found: ${duplicates.length}`);
  
  if (duplicates.length > 0) {
    console.log('\nSample duplicate:');
    const [key, records] = duplicates[0];
    console.log('Key:', key);
    console.log('Records:', records.map(r => ({ spend: r.spend, uploaded_at: r.uploaded_at })));
  }
  
  // Calculate total spend
  const totalSpend = data.reduce((sum, r) => sum + Number(r.spend), 0);
  console.log(`\nTotal spend (raw sum): $${totalSpend.toLocaleString()}`);
  
  // Calculate unique spend (group by date+campaign, sum each group once)
  const uniqueSpend = Object.values(groups).reduce((sum, records) => {
    // Take only first record from each group
    return sum + Number(records[0].spend);
  }, 0);
  console.log(`Unique spend (deduplicated): $${uniqueSpend.toLocaleString()}`);
}
