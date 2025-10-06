import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://znommdezzgrqbmpluukt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpub21tZGV6emdycWJtcGx1dWt0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2NDg4OTMsImV4cCI6MjA3MzIyNDg5M30.9a_uMi6o0kIP4ALGJf_H71viL680KJRtQvYqBsTpl24'
);

console.log('Checking entire database...\n');

// Get total count
const { count } = await supabase
  .from('campaign_data')
  .select('*', { count: 'exact', head: true });

console.log(`Total records in database: ${count}\n`);

// Load all data with pagination (same as loadAllCampaignData)
let allRecords = [];
let page = 0;
const pageSize = 1000;
let hasMore = true;

while (hasMore) {
  const { data, error } = await supabase
    .from('campaign_data')
    .select('*')
    .order('date', { ascending: true })
    .range(page * pageSize, (page + 1) * pageSize - 1);

  if (error || !data || data.length === 0) {
    hasMore = false;
  } else {
    allRecords.push(...data);
    hasMore = data.length === pageSize;
    page++;
  }
}

console.log(`Loaded ${allRecords.length} records\n`);

// Check for duplicates (same date+campaign)
const groups = {};
allRecords.forEach(row => {
  const key = `${row.date}||${row.campaign_order_name}`;
  if (!groups[key]) groups[key] = [];
  groups[key].push(row);
});

const duplicates = Object.entries(groups).filter(([k, v]) => v.length > 1);
console.log(`Date+Campaign combinations with multiple records: ${duplicates.length}\n`);

if (duplicates.length > 0) {
  console.log('⚠️ DUPLICATES FOUND!\n');
  
  // Show top 5 duplicates
  const topDupes = duplicates.slice(0, 5);
  topDupes.forEach(([key, records]) => {
    const [date, campaign] = key.split('||');
    console.log(`${date} - ${campaign.slice(0, 50)}`);
    console.log(`  ${records.length} records, uploaded at:`);
    records.forEach(r => console.log(`    - ${r.uploaded_at}`));
    console.log('');
  });
  
  // Calculate impact on September
  const septDupes = duplicates.filter(([key]) => key.startsWith('9/'));
  console.log(`September duplicates: ${septDupes.length}`);
  
  if (septDupes.length > 0) {
    const septRawSpend = septDupes.reduce((sum, [k, records]) => {
      return sum + records.reduce((s, r) => s + Number(r.spend), 0);
    }, 0);
    
    const septUniqueSpend = septDupes.reduce((sum, [k, records]) => {
      return sum + Number(records[0].spend);
    }, 0);
    
    console.log(`  Raw spend (with dupes): $${septRawSpend.toLocaleString()}`);
    console.log(`  Unique spend: $${septUniqueSpend.toLocaleString()}`);
    console.log(`  Extra from duplication: $${(septRawSpend - septUniqueSpend).toLocaleString()}`);
  }
}
