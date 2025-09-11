
import { useState } from "react";
import { MultiSelect } from "./MultiSelect";
import { useCampaignFilter } from "@/contexts/CampaignFilterContext";

interface GlobalFiltersProps {
  agencyOptions: any[];
  advertiserOptions: any[];
  campaignOptions: any[];
  selectedAgencies: string[];
  selectedAdvertisers: string[];
  selectedCampaigns: string[];
  onAgenciesChange: (selected: string[]) => void;
  onAdvertisersChange: (selected: string[]) => void;
  onCampaignsChange: (selected: string[]) => void;
}

const GlobalFilters = ({
  agencyOptions,
  advertiserOptions,
  campaignOptions,
  selectedAgencies,
  selectedAdvertisers,
  selectedCampaigns,
  onAgenciesChange,
  onAdvertisersChange,
  onCampaignsChange
}: GlobalFiltersProps) => {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="py-[5px] bg-muted/30 rounded-md">
      {isExpanded && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Agency</div>
            <MultiSelect
              options={agencyOptions}
              selected={selectedAgencies}
              onChange={onAgenciesChange}
              placeholder="Select agencies"
              className="w-full"
            />
          </div>
          
          <div>
            <div className="text-xs text-muted-foreground mb-1">Advertiser</div>
            <MultiSelect
              options={advertiserOptions}
              selected={selectedAdvertisers}
              onChange={onAdvertisersChange}
              placeholder="Select advertisers"
              className="w-full"
            />
          </div>
          
          <div>
            <div className="text-xs text-muted-foreground mb-1">Campaign</div>
            <MultiSelect
              options={campaignOptions}
              selected={selectedCampaigns}
              onChange={onCampaignsChange}
              placeholder="Select campaigns"
              className="w-full"
              popoverClassName="w-[400px]"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default GlobalFilters;
