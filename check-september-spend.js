// Check September 2025 total spend in database
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://znommdezzgrqbmpluukt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpub21tZGV6emdycWJtcGx1dWt0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2NDg4OTMsImV4cCI6MjA3MzIyNDg5M30.9a_uMi6o0kIP4ALGJf_H71viL680KJRtQvYqBsTpl24';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

console.log('Fetching all September 2025 data...\n');

// Get all September data with pagination
let allData = [];
let page = 0;
const pageSize = 1000;
let hasMore = true;

while (hasMore) {
  const { data, error } = await supabase
    .from('campaign_data')
    .select('*')
    .like('date', '9/%/2025')
    .range(page * pageSize, (page + 1) * pageSize - 1);

  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  if (!data || data.length === 0) {
    hasMore = false;
  } else {
    allData.push(...data);
    hasMore = data.length === pageSize;
    page++;
  }
}

console.log(`Total September records: ${allData.length}\n`);

// Calculate total spend (raw sum - might have duplicates)
const rawTotalSpend = allData.reduce((sum, r) => sum + Number(r.spend), 0);
console.log(`Raw total spend: $${rawTotalSpend.toLocaleString()}`);

// Group by date+campaign and check for duplicates
const groups = {};
allData.forEach(row => {
  const key = `${row.date}||${row.campaign_order_name}`;
  if (!groups[key]) {
    groups[key] = [];
  }
  groups[key].push(row);
});

const duplicateGroups = Object.entries(groups).filter(([k, v]) => v.length > 1);
console.log(`\nDate+Campaign combinations with multiple records: ${duplicateGroups.length}`);

if (duplicateGroups.length > 0) {
  console.log('\n⚠️ DUPLICATES FOUND! Sample:');
  const [key, records] = duplicateGroups[0];
  const [date, campaign] = key.split('||');
  console.log(`  Date: ${date}`);
  console.log(`  Campaign: ${campaign.substring(0, 60)}...`);
  console.log(`  Record count: ${records.length}`);
  console.log(`  Uploaded timestamps:`);
  records.forEach(r => {
    console.log(`    - ${r.uploaded_at} (spend: $${r.spend})`);
  });
  
  // Calculate spend with duplicates
  const duplicateSpend = duplicateGroups.reduce((sum, [k, records]) => {
    return sum + records.reduce((s, r) => s + Number(r.spend), 0);
  }, 0);
  
  const uniqueSpend = duplicateGroups.reduce((sum, [k, records]) => {
    return sum + Number(records[0].spend);
  }, 0);
  
  console.log(`\n  Total spend in duplicate groups (with dupes): $${duplicateSpend.toLocaleString()}`);
  console.log(`  Total spend in duplicate groups (unique): $${uniqueSpend.toLocaleString()}`);
  console.log(`  Extra spend from duplication: $${(duplicateSpend - uniqueSpend).toLocaleString()}`);
}

// Calculate deduplicated spend (take first record from each group)
const deduplicatedSpend = Object.values(groups).reduce((sum, records) => {
  return sum + Number(records[0].spend);
}, 0);

console.log(`\nDeduplicated spend (unique date+campaign): $${deduplicatedSpend.toLocaleString()}`);
console.log(`Difference from raw: $${(rawTotalSpend - deduplicatedSpend).toLocaleString()}`);

// Show unique upload timestamps
const uploadTimestamps = [...new Set(allData.map(r => r.uploaded_at))];
console.log(`\nUnique upload timestamps: ${uploadTimestamps.length}`);
uploadTimestamps.slice(0, 5).forEach(ts => {
  const count = allData.filter(r => r.uploaded_at === ts).length;
  console.log(`  ${ts}: ${count} records`);
});
