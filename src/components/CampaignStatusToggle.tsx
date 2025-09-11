
import { Switch } from "@/components/ui/switch";
import { useCampaignFilter } from "@/contexts/CampaignFilterContext";

export function CampaignStatusToggle() {
  const { showLiveOnly, setShowLiveOnly } = useCampaignFilter();

  return (
    <div className="flex items-center space-x-2">
      <Switch
        checked={showLiveOnly}
        onCheckedChange={setShowLiveOnly}
        className="data-[state=checked]:bg-primary"
      />
      <span className="text-sm font-medium">
        {showLiveOnly ? "Live Campaigns" : "All Campaigns"}
      </span>
    </div>
  );
}
