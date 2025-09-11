
import { Switch } from "@/components/ui/switch";

interface ChartToggleProps {
  isAttributionChart: boolean;
  setIsAttributionChart: (value: boolean) => void;
}

export function ChartToggle({ isAttributionChart, setIsAttributionChart }: ChartToggleProps) {
  return (
    <div className="flex items-center space-x-2 mr-4">
      <span className={`text-xs font-medium ${!isAttributionChart ? "text-primary" : "text-muted-foreground"}`}>
        Display
      </span>
      <Switch
        checked={isAttributionChart}
        onCheckedChange={setIsAttributionChart}
        className="data-[state=checked]:bg-primary"
      />
      <span className={`text-xs font-medium ${isAttributionChart ? "text-primary" : "text-muted-foreground"}`}>
        Attribution
      </span>
    </div>
  );
}
