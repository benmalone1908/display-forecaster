
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface CustomMetricSelectorProps {
  barMetric: string;
  lineMetric: string;
  onBarMetricChange: (metric: string) => void;
  onLineMetricChange: (metric: string) => void;
}

const METRICS = [
  { value: "IMPRESSIONS", label: "Impressions" },
  { value: "CLICKS", label: "Clicks" },
  { value: "TRANSACTIONS", label: "Transactions" },
  { value: "REVENUE", label: "Attributed Sales" }
];

export function CustomMetricSelector({ 
  barMetric, 
  lineMetric, 
  onBarMetricChange, 
  onLineMetricChange 
}: CustomMetricSelectorProps) {
  return (
    <div className="flex items-center space-x-2">
      <span className="text-xs font-medium">Bar:</span>
      <Select value={barMetric} onValueChange={onBarMetricChange}>
        <SelectTrigger className="w-[120px] h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {METRICS.filter(metric => metric.value !== lineMetric).map(metric => (
            <SelectItem key={metric.value} value={metric.value}>
              {metric.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      
      <span className="text-xs font-medium">Line:</span>
      <Select value={lineMetric} onValueChange={onLineMetricChange}>
        <SelectTrigger className="w-[120px] h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {METRICS.filter(metric => metric.value !== barMetric).map(metric => (
            <SelectItem key={metric.value} value={metric.value}>
              {metric.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
