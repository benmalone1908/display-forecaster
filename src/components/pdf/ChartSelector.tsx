import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChartSection } from "./types";

interface ChartSelectorProps {
  availableCharts: ChartSection[];
  selectedCharts: string[];
  onSelectionChange: (selected: string[]) => void;
}

const ChartSelector = ({ availableCharts, selectedCharts, onSelectionChange }: ChartSelectorProps) => {
  const handleChartToggle = (chartId: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedCharts, chartId]);
    } else {
      onSelectionChange(selectedCharts.filter(id => id !== chartId));
    }
  };

  const handleSelectAll = () => {
    const availableChartIds = availableCharts.filter(chart => chart.available).map(chart => chart.id);
    onSelectionChange(availableChartIds);
  };

  const handleSelectNone = () => {
    onSelectionChange([]);
  };

  const availableChartsCount = availableCharts.filter(chart => chart.available).length;
  const selectedCount = selectedCharts.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Select Charts to Export</h3>
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            {selectedCount} of {availableChartsCount} selected
          </Badge>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSelectAll}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          Select All
        </button>
        <span className="text-sm text-gray-400">|</span>
        <button
          type="button"
          onClick={handleSelectNone}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          Select None
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 max-h-96 overflow-y-auto">
        {availableCharts.map((chart) => (
          <Card
            key={chart.id}
            className={`p-4 transition-colors ${
              chart.available 
                ? selectedCharts.includes(chart.id)
                  ? 'bg-blue-50 border-blue-200' 
                  : 'hover:bg-gray-50'
                : 'bg-gray-50 opacity-50 cursor-not-allowed'
            }`}
          >
            <div className="flex items-start space-x-3">
              <Checkbox
                id={chart.id}
                checked={selectedCharts.includes(chart.id)}
                onCheckedChange={(checked) => handleChartToggle(chart.id, checked as boolean)}
                disabled={!chart.available}
                className="mt-1"
              />
              <div className="flex-1">
                <label
                  htmlFor={chart.id}
                  className={`block text-sm font-medium cursor-pointer ${
                    chart.available ? 'text-gray-900' : 'text-gray-400'
                  }`}
                >
                  {chart.name}
                  {!chart.available && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      Not Available
                    </Badge>
                  )}
                </label>
                <p className={`mt-1 text-xs ${
                  chart.available ? 'text-gray-600' : 'text-gray-400'
                }`}>
                  {chart.description}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {selectedCount === 0 && (
        <div className="text-center py-4 text-gray-500 text-sm">
          Please select at least one chart to export
        </div>
      )}
    </div>
  );
};

export default ChartSelector;