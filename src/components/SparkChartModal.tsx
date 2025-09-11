
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

interface SparkChartModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  data: any[];
  dataKey: string;
  color: string;
  gradientId: string;
  valueFormatter: (value: any) => string;
}

const SparkChartModal = ({
  open,
  onOpenChange,
  title,
  data,
  dataKey,
  color,
  gradientId,
  valueFormatter
}: SparkChartModalProps) => {
  // Debug: Log the data being passed to the modal
  console.log(`SparkChartModal - ${title}:`, {
    dataLength: data.length,
    dataKey,
    sampleData: data.slice(0, 3),
    nullValues: data.filter(d => d[dataKey] === null).length,
    zeroValues: data.filter(d => d[dataKey] === 0).length
  });

  const formatTooltipValue = (value: any) => {
    if (value === null || value === undefined) return "No data";
    if (value === 0) return "0 (Campaign paused)";
    return valueFormatter(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[900px] w-full max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        
        <div className="w-full h-[400px] mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.8}/>
                  <stop offset="95%" stopColor={color} stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => {
                  try {
                    return new Date(value).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric' 
                    });
                  } catch {
                    return value;
                  }
                }}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => {
                  if (typeof value === 'number') {
                    if (value >= 1000000) {
                      return `${(value / 1000000).toFixed(1)}M`;
                    } else if (value >= 1000) {
                      return `${(value / 1000).toFixed(1)}K`;
                    }
                    return value.toLocaleString();
                  }
                  return value;
                }}
              />
              <Tooltip 
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const value = payload[0].value;
                    return (
                      <div className="bg-white p-3 border rounded shadow-lg">
                        <p className="text-sm font-medium">{label}</p>
                        <p className="text-sm" style={{ color: payload[0].color }}>
                          {`${title}: ${formatTooltipValue(value)}`}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area 
                type="monotone" 
                dataKey={dataKey} 
                stroke={color} 
                fillOpacity={1}
                fill={`url(#${gradientId})`}
                strokeWidth={2}
                connectNulls={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SparkChartModal;
