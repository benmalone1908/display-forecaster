
import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DateRangePickerProps {
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  className?: string;
  displayDateRangeSummary?: boolean;
  dateRangeSummaryText?: string | null;
  chartToggle?: React.ReactNode;
  minDate?: Date;
  maxDate?: Date;
}

export default function DateRangePicker({
  dateRange,
  onDateRangeChange,
  className,
  chartToggle,
  minDate,
  maxDate,
}: DateRangePickerProps) {
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);

  const handleStartDateSelect = (date: Date | undefined) => {
    const newRange: DateRange = {
      from: date,
      to: dateRange?.to
    };
    
    // If we're setting a start date later than the end date, adjust the end date
    if (date && dateRange?.to && date > dateRange.to) {
      newRange.to = date;
    }
    
    onDateRangeChange(date ? newRange : undefined);
    setStartOpen(false);
    
    // If there's no end date yet, open the end date picker
    if (date && !dateRange?.to) {
      setTimeout(() => setEndOpen(true), 100);
    }
  };

  const handleEndDateSelect = (date: Date | undefined) => {
    // Only set the end date if there's a start date
    if (!dateRange?.from && date) {
      const newRange: DateRange = {
        from: date,
        to: date
      };
      onDateRangeChange(newRange);
    } else if (date) {
      const newRange: DateRange = {
        from: dateRange?.from,
        to: date
      };
      onDateRangeChange(newRange);
    } else {
      // If end date is cleared, keep just the start date
      onDateRangeChange(dateRange?.from ? { from: dateRange.from } : undefined);
    }
    
    setEndOpen(false);
  };

  const handleReset = () => {
    onDateRangeChange(undefined);
    setStartOpen(false);
    setEndOpen(false);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2">
        {/* Chart Toggle */}
        {chartToggle}
        
        {/* Start Date Picker */}
        <Popover open={startOpen} onOpenChange={setStartOpen}>
          <PopoverTrigger asChild>
            <Button
              id="start-date"
              variant={"outline"}
              className={cn(
                "w-full justify-start text-left font-normal",
                !dateRange?.from && "text-muted-foreground"
              )}
              size="sm"
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange?.from ? (
                format(dateRange.from, "LLL dd, y")
              ) : (
                <span>Start Date</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="single"
              defaultMonth={dateRange?.from}
              selected={dateRange?.from}
              onSelect={handleStartDateSelect}
              disabled={(date) => {
                // Normalize dates to start of day for proper comparison
                const normalizedDate = new Date(date);
                normalizedDate.setHours(0, 0, 0, 0);
                
                const normalizedMinDate = minDate ? new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate()) : null;
                const normalizedMaxDate = maxDate ? new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate()) : null;
                
                if (normalizedMinDate && normalizedDate < normalizedMinDate) return true;
                if (normalizedMaxDate && normalizedDate > normalizedMaxDate) return true;
                return false;
              }}
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>

        {/* End Date Picker */}
        <Popover open={endOpen} onOpenChange={setEndOpen}>
          <PopoverTrigger asChild>
            <Button
              id="end-date"
              variant={"outline"}
              className={cn(
                "w-full justify-start text-left font-normal",
                !dateRange?.to && "text-muted-foreground"
              )}
              size="sm"
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange?.to ? (
                format(dateRange.to, "LLL dd, y")
              ) : (
                <span>End Date</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="single"
              defaultMonth={dateRange?.to || dateRange?.from}
              selected={dateRange?.to}
              onSelect={handleEndDateSelect}
              disabled={(date) => {
                // Normalize dates to start of day for proper comparison
                const normalizedDate = new Date(date);
                normalizedDate.setHours(0, 0, 0, 0);
                
                const normalizedFromDate = dateRange?.from ? new Date(dateRange.from.getFullYear(), dateRange.from.getMonth(), dateRange.from.getDate()) : null;
                const normalizedMinDate = minDate ? new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate()) : null;
                const normalizedMaxDate = maxDate ? new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate()) : null;
                
                // End date must be after start date
                if (normalizedFromDate && normalizedDate < normalizedFromDate) return true;
                // End date must be within available range
                if (normalizedMinDate && normalizedDate < normalizedMinDate) return true;
                if (normalizedMaxDate && normalizedDate > normalizedMaxDate) return true;
                return false;
              }}
              className="pointer-events-auto"
            />
          </PopoverContent>
        </Popover>

        {/* Reset Button */}
        <Button 
          variant="ghost" 
          size="sm"
          onClick={handleReset}
          className="text-xs h-7 px-2"
        >
          Reset
        </Button>
      </div>
    </div>
  );
}
