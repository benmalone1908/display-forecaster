
import * as React from "react";
import { Check, ChevronsUpDown, Square, CheckSquare, ListChecks, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

export interface Option {
  value: string;
  label: string;
  group?: string;
}

interface MultiSelectProps {
  options: Option[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  className?: string;
  popoverClassName?: string;
  containerClassName?: string;
  showGroups?: boolean;
  singleSelect?: boolean;
  disabled?: boolean;
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Select options",
  className,
  popoverClassName,
  containerClassName,
  showGroups = false,
  singleSelect = false,
  disabled = false,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  const handleSelect = (value: string) => {
    if (singleSelect) {
      // If single select mode, just replace the selection
      onChange([value]);
      setOpen(false); // Close dropdown after selection in single select mode
    } else {
      // Original multi-select behavior
      if (selected.includes(value)) {
        onChange(selected.filter((item) => item !== value));
      } else {
        onChange([...selected, value]);
      }
    }
  };

  // Filter out options with empty values or labels first
  const validOptions = React.useMemo(() => {
    console.log("MultiSelect received options:", options);
    return options.filter(option => 
      option && option.value?.trim() && option.label?.trim()
    );
  }, [options]);
  
  // Then apply search filtering on valid options
  const filteredOptions = React.useMemo(() => {
    if (!searchQuery.trim()) return validOptions;
    return validOptions.filter(option => 
      option.label.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [validOptions, searchQuery]);

  const handleSelectAll = () => {
    if (selected.length === validOptions.length) {
      onChange([]);
    } else {
      onChange(validOptions.map(option => option.value));
    }
  };

  // Group options if showGroups is enabled
  const groupedOptions = React.useMemo(() => {
    if (!showGroups) return { ungrouped: filteredOptions };
    
    return filteredOptions.reduce((groups: Record<string, Option[]>, option) => {
      const groupName = option.group || 'Other';
      if (!groups[groupName]) {
        groups[groupName] = [];
      }
      groups[groupName].push(option);
      return groups;
    }, {});
  }, [filteredOptions, showGroups]);

  // Add debug console.log to check the exact format of the options
  React.useEffect(() => {
    console.log("MultiSelect - validOptions count:", validOptions.length);
    console.log("MultiSelect - filteredOptions count:", filteredOptions.length);
    if (validOptions.length === 0 && options.length > 0) {
      console.log("First few options received:", options.slice(0, 3));
    }
  }, [options, validOptions, filteredOptions]);

  // Modify the display text for single select mode
  const displayText = React.useMemo(() => {
    if (selected.length === 0) return placeholder;
    
    if (singleSelect && selected.length === 1) {
      const selectedOption = options.find(opt => opt.value === selected[0]);
      return selectedOption?.label || selected[0];
    }
    
    return `${selected.length} selected`;
  }, [selected, options, placeholder, singleSelect]);

  return (
    <div className={containerClassName}>
      <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
        <PopoverTrigger asChild disabled={disabled}>
          <button
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "flex items-center justify-between w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
              className
            )}
          >
            {displayText}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent className={cn("p-0 bg-background shadow-lg z-50", popoverClassName)} align="start">
          <div className="p-2 border-b">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 w-full border-none focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>
          </div>
          <div className="max-h-[300px] overflow-auto p-1">
            {/* Hide Select All in single select mode */}
            {!singleSelect && validOptions.length > 0 && (
              <div
                className="relative flex cursor-pointer select-none items-center rounded-sm py-1.5 px-2 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground border-b border-border"
                onClick={handleSelectAll}
              >
                <div className="flex items-center justify-center mr-2 h-4 w-4 flex-shrink-0">
                  {selected.length === validOptions.length ? (
                    <CheckSquare className="h-4 w-4 text-primary" />
                  ) : (
                    <Square className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <span className="truncate">Select All</span>
              </div>
            )}
            
            {showGroups ? (
              Object.entries(groupedOptions).map(([groupName, groupOptions]) => (
                <React.Fragment key={groupName}>
                  {groupOptions.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/30 mt-1 first:mt-0">
                        {groupName}
                      </div>
                      {groupOptions.map((option) => (
                        <div
                          key={option.value}
                          className={cn(
                            "relative flex cursor-pointer select-none items-center rounded-sm py-1.5 px-2 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground",
                            selected.includes(option.value) ? "bg-accent/50" : ""
                          )}
                          onClick={() => handleSelect(option.value)}
                        >
                          <div className="flex items-center justify-center mr-2 h-4 w-4 flex-shrink-0">
                            {selected.includes(option.value) ? (
                              <CheckSquare className="h-4 w-4 text-primary" />
                            ) : (
                              <Square className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <span className="truncate whitespace-nowrap overflow-hidden text-ellipsis pr-2">
                            {option.label}
                          </span>
                        </div>
                      ))}
                    </>
                  )}
                </React.Fragment>
              ))
            ) : (
              filteredOptions.map((option) => (
                <div
                  key={option.value}
                  className={cn(
                    "relative flex cursor-pointer select-none items-center rounded-sm py-1.5 px-2 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground",
                    selected.includes(option.value) ? "bg-accent/50" : ""
                  )}
                  onClick={() => handleSelect(option.value)}
                >
                  <div className="flex items-center justify-center mr-2 h-4 w-4 flex-shrink-0">
                    {selected.includes(option.value) ? (
                      <CheckSquare className="h-4 w-4 text-primary" />
                    ) : (
                      <Square className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <span className="truncate whitespace-nowrap overflow-hidden text-ellipsis pr-2">
                    {option.label}
                  </span>
                </div>
              ))
            )}
            
            {filteredOptions.length === 0 && (
              <div className="py-2 px-2 text-sm text-center text-muted-foreground">
                No options found
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
