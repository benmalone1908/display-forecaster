
import { useMemo, useState } from "react";
import { CampaignHealthData } from "@/utils/campaignHealthScoring";
import CampaignHealthCard from "./CampaignHealthCard";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Search } from "lucide-react";

interface CampaignHealthTableProps {
  healthData: CampaignHealthData[];
}

const CampaignHealthTable = ({ healthData }: CampaignHealthTableProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "health" | "spend" | "revenue">("health");
  const [filterBy, setFilterBy] = useState<"all" | "healthy" | "warning" | "critical">("all");

  const filteredAndSortedData = useMemo(() => {
    let filtered = healthData.filter(campaign => {
      const matchesSearch = campaign.campaignName.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (!matchesSearch) return false;
      
      if (filterBy === "all") return true;
      if (filterBy === "healthy") return campaign.healthScore >= 7;
      if (filterBy === "warning") return campaign.healthScore >= 4 && campaign.healthScore < 7;
      if (filterBy === "critical") return campaign.healthScore < 4;
      
      return true;
    });

    // Sort the filtered data
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.campaignName.localeCompare(b.campaignName);
        case "health":
          return b.healthScore - a.healthScore; // Descending
        case "spend":
          return b.spend - a.spend; // Descending
        case "revenue":
          return b.revenue - a.revenue; // Descending
        default:
          return 0;
      }
    });

    return filtered;
  }, [healthData, searchTerm, sortBy, filterBy]);

  if (healthData.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No campaign health data available
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters and Controls */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search campaigns..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Sort by..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="health">Health Score</SelectItem>
            <SelectItem value="name">Campaign Name</SelectItem>
            <SelectItem value="spend">Spend</SelectItem>
            <SelectItem value="revenue">Attributed Sales</SelectItem>
          </SelectContent>
        </Select>
        
        <Select value={filterBy} onValueChange={(value: any) => setFilterBy(value)}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Campaigns</SelectItem>
            <SelectItem value="healthy">Healthy (≥7)</SelectItem>
            <SelectItem value="warning">Warning (4-6.9)</SelectItem>
            <SelectItem value="critical">Critical (&lt;4)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results Count */}
      <div className="text-sm text-gray-600">
        Showing {filteredAndSortedData.length} of {healthData.length} campaigns
      </div>

      {/* Campaign Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredAndSortedData.map((campaign) => (
          <CampaignHealthCard 
            key={campaign.campaignName} 
            campaign={campaign} 
          />
        ))}
      </div>

      {filteredAndSortedData.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No campaigns match your current filters
        </div>
      )}
    </div>
  );
};

export default CampaignHealthTable;
