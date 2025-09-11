
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ChartModeSelectorProps {
  mode: "display" | "attribution" | "custom";
  onModeChange: (mode: "display" | "attribution" | "custom") => void;
}

export function ChartModeSelector({ mode, onModeChange }: ChartModeSelectorProps) {
  return (
    <div className="flex items-center space-x-2">
      <span className="text-xs font-medium">Chart Mode:</span>
      <Select value={mode} onValueChange={onModeChange}>
        <SelectTrigger className="w-[140px] h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="display">Display</SelectItem>
          <SelectItem value="attribution">Attribution</SelectItem>
          <SelectItem value="custom">Custom</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
