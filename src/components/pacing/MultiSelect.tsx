import * as React from "react";
import { Check, ChevronsUpDown, Square, CheckSquare, Search } from "lucide-react";

export interface Option {
  value: string;
  label: string;
}

interface MultiSelectProps {
  options: Option[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Select options",
  className = "",
  disabled = false,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  const handleSelect = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((item) => item !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  // Filter options based on search query
  const filteredOptions = React.useMemo(() => {
    if (!searchQuery.trim()) return options;
    return options.filter(option => 
      option.label.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [options, searchQuery]);

  const handleSelectAll = () => {
    if (selected.length === options.length) {
      onChange([]);
    } else {
      onChange(options.map(option => option.value));
    }
  };

  const displayText = React.useMemo(() => {
    if (selected.length === 0) return placeholder;
    if (selected.length === 1) {
      const selectedOption = options.find(opt => opt.value === selected[0]);
      return selectedOption?.label || selected[0];
    }
    return `${selected.length} selected`;
  }, [selected, options, placeholder]);

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={`flex items-center justify-between w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-colors ${className}`}
      >
        <span className="truncate text-white">{displayText}</span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-white/70" />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          
          {/* Dropdown */}
          <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl max-h-80 overflow-hidden">
            {/* Search */}
            <div className="p-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-gray-400" />
                <input 
                  type="text"
                  placeholder="Search..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-8 border-none outline-none text-sm bg-transparent"
                />
              </div>
            </div>

            <div className="max-h-60 overflow-auto p-1">
              {/* Select All */}
              {options.length > 0 && (
                <div
                  className="flex cursor-pointer items-center rounded-md px-3 py-2 text-sm hover:bg-gray-100 border-b border-gray-100"
                  onClick={handleSelectAll}
                >
                  <div className="mr-3 h-4 w-4 flex items-center justify-center">
                    {selected.length === options.length ? (
                      <CheckSquare className="h-4 w-4 text-blue-600" />
                    ) : (
                      <Square className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                  <span className="font-medium text-gray-700">Select All</span>
                </div>
              )}
              
              {/* Options */}
              {filteredOptions.map((option) => (
                <div
                  key={option.value}
                  className={`flex cursor-pointer items-center rounded-md px-3 py-2 text-sm hover:bg-gray-100 transition-colors ${
                    selected.includes(option.value) ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => handleSelect(option.value)}
                >
                  <div className="mr-3 h-4 w-4 flex items-center justify-center">
                    {selected.includes(option.value) ? (
                      <CheckSquare className="h-4 w-4 text-blue-600" />
                    ) : (
                      <Square className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                  <span className="truncate text-gray-700">{option.label}</span>
                </div>
              ))}
              
              {filteredOptions.length === 0 && (
                <div className="py-6 px-3 text-sm text-center text-gray-400">
                  No options found
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}