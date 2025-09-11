import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Download, ChevronRight, Eye, Loader2, Settings } from "lucide-react";
import { toast } from "sonner";
import { DateRange } from "react-day-picker";
import DateRangePicker from "@/components/DateRangePicker";
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface StreamlinedPdfExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: any[];
  pacingData?: any[];
  contractTermsData?: any[];
  dateRange?: DateRange;
  appliedFilters?: {
    agencies: string[];
    advertisers: string[];
    campaigns: string[];
  };
  showLiveOnly?: boolean;
}

interface ChartSelection {
  category: string;
  type: string;
  subOptions?: {
    format?: string;
    mode?: string;
    period?: string;
  };
  dateRange?: DateRange;
  id: string;
}

const StreamlinedPdfExportModal = ({
  open,
  onOpenChange,
  data,
  pacingData = [],
  contractTermsData = [],
  dateRange,
  appliedFilters,
  showLiveOnly = false
}: StreamlinedPdfExportModalProps) => {
  const [selectedCharts, setSelectedCharts] = useState<ChartSelection[]>([]);
  const [currentChart, setCurrentChart] = useState<Partial<ChartSelection> | null>(null);
  const [currentChartDateRange, setCurrentChartDateRange] = useState<DateRange | undefined>(() => {
    // Default to the provided dateRange, but constrain it to available data if needed
    if (!dateRange) return undefined;
    
    return dateRange;
  });
  const [isExporting, setIsExporting] = useState(false);
  const [currentStep, setCurrentStep] = useState(1); // 1: Chart Selection, 2: Date Selection, 3: Charts Added, 4: Preview & Export

  // Calculate available date range from data
  const availableDateRange = useMemo(() => {
    if (!data || data.length === 0) return { min: new Date(), max: new Date() };
    
    const dates = data
      .map(row => {
        const dateStr = row.DATE || row.date;
        if (!dateStr) return null;
        
        // Handle different date formats
        let parsedDate: Date;
        if (dateStr.includes('/')) {
          // MM/DD/YYYY or M/D/YYYY format
          parsedDate = new Date(dateStr);
        } else if (dateStr.includes('-')) {
          // YYYY-MM-DD format
          parsedDate = new Date(dateStr);
        } else {
          return null;
        }
        
        return isNaN(parsedDate.getTime()) ? null : parsedDate;
      })
      .filter(Boolean) as Date[];
    
    if (dates.length === 0) return { min: new Date(), max: new Date() };
    
    return {
      min: new Date(Math.min(...dates.map(d => d.getTime()))),
      max: new Date(Math.max(...dates.map(d => d.getTime())))
    };
  }, [data]);

  // Chart options based on Dashboard tab
  const chartCategories: Record<string, {
    name: string;
    options: { value: string; label: string; }[];
    subOptions?: Record<string, { value: string; label: string; }[]>;
  }> = {
    "spark-charts": {
      name: "Spark Charts",
      options: [
        { value: "impressions", label: "Impressions" },
        { value: "clicks", label: "Clicks" },
        { value: "ctr", label: "CTR" },
        { value: "transactions", label: "Transactions" },
        { value: "revenue", label: "Attributed Sales" },
        { value: "roas", label: "ROAS" }
      ]
    },
    "campaign-performance": {
      name: "Campaign Performance Combined Chart",
      options: [
        { value: "combined", label: "Combined Performance Chart" }
      ],
      subOptions: {
        format: [
          { value: "by-date", label: "By Date" },
          { value: "by-day-of-week", label: "By Day of Week" }
        ],
        mode: [
          { value: "display", label: "Display" },
          { value: "attribution", label: "Attribution" }
        ]
      }
    },
    "weekly-comparison": {
      name: "Weekly Comparison",
      options: [
        { value: "comparison", label: "Weekly Comparison Chart" }
      ],
      subOptions: {
        period: [
          { value: "7-days", label: "7 days" },
          { value: "14-days", label: "14 days" },
          { value: "30-days", label: "30 days" }
        ]
      }
    }
  };

  const handleCategorySelect = (category: string) => {
    const selectedCategory = chartCategories[category];
    
    // If there's only one option, auto-select it
    if (selectedCategory && selectedCategory.options.length === 1) {
      setCurrentChart({
        category,
        type: selectedCategory.options[0].value,
        subOptions: {}
      });
    } else {
      setCurrentChart({
        category,
        type: "",
        subOptions: {}
      });
    }
  };

  const handleTypeSelect = (type: string) => {
    if (currentChart) {
      setCurrentChart({
        ...currentChart,
        type
      });
    }
  };

  const handleSubOptionSelect = (optionType: string, value: string) => {
    if (currentChart) {
      setCurrentChart({
        ...currentChart,
        subOptions: {
          ...currentChart.subOptions,
          [optionType]: value
        }
      });
    }
  };

  const canProceedToNextStep = () => {
    if (currentStep === 1) {
      if (!currentChart?.type) return false;
      
      const category = chartCategories[currentChart.category as keyof typeof chartCategories];
      if (category.subOptions) {
        return Object.keys(category.subOptions).every(key => 
          currentChart.subOptions?.[key]
        );
      }
      return true;
    }
    if (currentStep === 2) {
      return currentChartDateRange?.from && currentChartDateRange?.to;
    }
    if (currentStep === 3) {
      return selectedCharts.length >= 1;
    }
    if (currentStep === 4) {
      return selectedCharts.length >= 2;
    }
    return true;
  };

  const getCurrentChartTitle = () => {
    if (!currentChart) return "";
    
    const category = chartCategories[currentChart.category as keyof typeof chartCategories];
    const typeOption = category.options.find(opt => opt.value === currentChart.type);
    
    let title = typeOption?.label || "";
    
    if (currentChart.subOptions) {
      Object.entries(currentChart.subOptions).forEach(([key, value]) => {
        const subOption = category.subOptions?.[key]?.find(opt => opt.value === value);
        if (subOption) {
          title += ` - ${subOption.label}`;
        }
      });
    }
    
    return title;
  };

  const getChartTitle = (chart: ChartSelection) => {
    const category = chartCategories[chart.category as keyof typeof chartCategories];
    const typeOption = category.options.find(opt => opt.value === chart.type);
    
    let title = typeOption?.label || "";
    
    if (chart.subOptions) {
      Object.entries(chart.subOptions).forEach(([key, value]) => {
        const subOption = category.subOptions?.[key]?.find(opt => opt.value === value);
        if (subOption) {
          title += ` - ${subOption.label}`;
        }
      });
    }
    
    return title;
  };

  const addCurrentChart = () => {
    if (currentChart && currentChart.type && currentChartDateRange) {
      const newChart: ChartSelection = {
        ...currentChart as ChartSelection,
        dateRange: currentChartDateRange,
        id: Date.now().toString()
      };
      
      // Debug logging to understand what configuration is being saved
      console.log(`🎯 ADDING CHART TO SELECTION:`, {
        category: newChart.category,
        type: newChart.type,
        subOptions: newChart.subOptions,
        title: getChartTitle(newChart)
      });
      
      const updatedCharts = [...selectedCharts, newChart];
      setSelectedCharts(updatedCharts);
      
      // Debug log the updated chart selection
      console.log(`📊 UPDATED CHART SELECTION (${updatedCharts.length} charts):`);
      updatedCharts.forEach((chart, index) => {
        console.log(`  ${index + 1}. ${getChartTitle(chart)} - ${JSON.stringify(chart.subOptions)}`);
      });
      
      setCurrentChart(null);
      setCurrentChartDateRange(dateRange);
      
      // Always go to Step 3 (Charts Added) after adding a chart
      setCurrentStep(3);
    }
  };

  const removeChart = (id: string) => {
    setSelectedCharts(prev => prev.filter(chart => chart.id !== id));
  };

  // Function to switch chart modes for different views
  const switchChartMode = async (mode: 'display' | 'attribution'): Promise<void> => {
    console.log(`🔄 Switching chart mode to: ${mode}`);
    
    // For display mode, we don't need to do anything - it's likely the default
    if (mode === 'display') {
      console.log(`✅ Display mode - assuming this is the default chart state`);
      return;
    }
    
    // For attribution mode, we need to find and click the attribution selector
    console.log(`🔍 Looking for attribution mode selector...`);
    
    // Strategy 1: Look for buttons, toggles, or clickable elements with "Attribution" text
    console.log(`🔍 Strategy 1: Looking for clickable elements with "Attribution" text`);
    const allElements = document.querySelectorAll('*');
    const attributionElements: HTMLElement[] = [];
    
    for (const element of allElements) {
      if (element instanceof HTMLElement) {
        const text = element.textContent?.trim() || '';
        const isClickable = element.tagName === 'BUTTON' || 
                           element.getAttribute('role') === 'button' ||
                           element.classList.contains('cursor-pointer') ||
                           element.onclick !== null;
        
        if (text.includes('Attribution') && isClickable) {
          attributionElements.push(element);
          console.log(`📋 Found clickable Attribution element: "${text}" (${element.tagName.toLowerCase()})`);
        }
      }
    }
    
    // Strategy 2: Look for toggle switches or radio buttons near performance chart
    console.log(`🔍 Strategy 2: Looking for toggle switches or radio elements`);
    const toggleElements = document.querySelectorAll('input[type="radio"], input[type="checkbox"], [role="switch"], [role="radio"]');
    for (const toggle of toggleElements) {
      const parent = toggle.parentElement;
      if (parent && parent.textContent?.includes('Attribution')) {
        console.log(`📋 Found toggle near Attribution: ${toggle.tagName.toLowerCase()} with parent text: "${parent.textContent?.slice(0, 50)}"`);
        attributionElements.push(parent as HTMLElement);
      }
    }
    
    // Try clicking the found attribution elements first
    console.log(`🔍 Attempting to click ${attributionElements.length} found attribution elements`);
    
    for (const element of attributionElements) {
      try {
        console.log(`🖱️ Clicking attribution element: "${element.textContent?.slice(0, 50)}" (${element.tagName.toLowerCase()})`);
        element.click();
        
        // Wait for the mode to change
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check if mode successfully changed to attribution
        const updatedElements = document.querySelectorAll('*');
        let attributionModeActive = false;
        
        for (const el of updatedElements) {
          const text = el.textContent?.trim() || '';
          // Look for signs that attribution mode is now active
          if (text.includes('Attribution') && (text.includes('active') || text.includes('selected'))) {
            attributionModeActive = true;
            console.log(`✅ Attribution mode activated: "${text.slice(0, 80)}"`);
            break;
          }
        }
        
        if (attributionModeActive) {
          console.log(`✅ Successfully switched to attribution mode`);
          return;
        } else {
          console.log(`⚠️ Click didn't activate attribution mode, trying next element`);
        }
        
      } catch (error) {
        console.log(`⚠️ Error clicking attribution element:`, error);
      }
    }
    
    // If no dedicated attribution elements found, use fallback logic
    console.log(`🔍 Fallback: Looking for any elements containing "Attribution" text`);
    const chartModeElements: HTMLElement[] = [];
    
    for (const element of allElements) {
      if (element instanceof HTMLElement) {
        const text = element.textContent?.trim() || '';
        
        // Log elements that mention chart mode or our target mode
        if (text.includes('Chart Mode') || text.includes('Mode')) {
          chartModeElements.push(element);
          console.log(`🎛️ Found Chart Mode element: "${text.slice(0, 100)}" (${element.tagName.toLowerCase()})`);
        }
        
        // Look for exact matches and near matches
        if (text === modeText || text === mode || text.includes(modeText)) {
          const tagName = element.tagName.toLowerCase();
          const role = element.getAttribute('role');
          const className = element.className;
          
          console.log(`🎯 Found potential ${mode} element: "${text}" (${tagName}, role=${role}, class=${className})`);
          
          // Handle different types of interactive elements
          if (tagName === 'button' || 
              role === 'tab' || 
              role === 'option' ||
              tagName === 'option' ||
              element.hasAttribute('data-value') ||
              className.includes('toggle') ||
              className.includes('select') ||
              element.closest('[role="tablist"]') ||
              element.closest('select') ||
              element.closest('[data-radix-select-content]') ||
              element.closest('[role="listbox"]')) {
            
            potentialSelectors.push(element);
          }
        }
        
        // Special handling: Look for any interactive element near "Chart Mode:" text
        if (text.includes('Chart Mode:')) {
          console.log(`🔍 Found Chart Mode text, analyzing surrounding elements:`);
          
          // Check the element itself and its parent chain for interactive components
          let currentElement = element;
          for (let depth = 0; depth < 5 && currentElement; depth++) {
            const allChildren = currentElement.querySelectorAll('*');
            allChildren.forEach(child => {
              if (child instanceof HTMLElement) {
                const childText = child.textContent?.trim() || '';
                const childTag = child.tagName.toLowerCase();
                const childRole = child.getAttribute('role');
                const hasDataValue = child.hasAttribute('data-value');
                const isRadixTrigger = child.hasAttribute('data-radix-select-trigger');
                const isRadixContent = child.hasAttribute('data-radix-select-content');
                
                // Log ALL potentially interactive elements
                if (childTag === 'select' || childTag === 'button' || childRole === 'button' || 
                    childRole === 'option' || childRole === 'listbox' || hasDataValue || 
                    isRadixTrigger || isRadixContent || child.classList.contains('select') ||
                    childText === 'Display' || childText === 'Attribution') {
                  
                  console.log(`  📋 Interactive element: "${childText.slice(0, 30)}" (${childTag}, role=${childRole}, radix-trigger=${isRadixTrigger}, data-value=${child.getAttribute('data-value')})`);
                  
                  // Add to potential selectors if it might be useful
                  if (isRadixTrigger || childText === 'Display' || childText === 'Attribution' || 
                      hasDataValue || childRole === 'option') {
                    potentialSelectors.push(child);
                  }
                }
              }
            });
            currentElement = currentElement.parentElement;
          }
        }
        
        // Also check for select dropdowns
        if (element.tagName.toLowerCase() === 'select') {
          const select = element as HTMLSelectElement;
          console.log(`📋 Found select dropdown with options:`, Array.from(select.options).map(opt => opt.textContent));
        }
      }
    }
    
    console.log(`📊 Found ${chartModeElements.length} chart mode elements, ${potentialSelectors.length} potential selectors`);
    
    // Try to click the most promising selectors
    for (const element of potentialSelectors) {
      const text = element.textContent?.trim() || '';
      const tagName = element.tagName.toLowerCase();
      
      console.log(`📱 Attempting to click ${mode} selector: "${text}" (${tagName})`);
      
      try {
        // Special handling for Radix UI select triggers
        if (element.hasAttribute('data-radix-select-trigger')) {
          console.log(`🎯 Handling Radix select trigger - clicking to open options`);
          element.click();
          
          // Wait for dropdown to open
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Now look for the attribution option in the opened dropdown
          const dropdownOptions = document.querySelectorAll('[role="option"], [data-radix-select-item]');
          for (const option of dropdownOptions) {
            if (option instanceof HTMLElement && 
                (option.textContent?.trim() === modeText || 
                 option.getAttribute('data-value') === mode)) {
              console.log(`📋 Found ${mode} option in dropdown: "${option.textContent}"`);
              option.click();
              await new Promise(resolve => setTimeout(resolve, 800));
              
              // Verify mode changed
              const updatedElements = document.querySelectorAll('*');
              for (const el of updatedElements) {
                if (el.textContent?.includes(`Chart Mode:${modeText}`)) {
                  console.log(`✅ Confirmed mode changed to ${mode} via Radix select`);
                  return;
                }
              }
            }
          }
        } else {
          // Regular click handling
          element.click();
          
          // Wait for DOM to update
          await new Promise(resolve => setTimeout(resolve, 800));
          
          console.log(`✅ Successfully clicked ${mode} selector`);
          
          // Verify the mode actually changed by checking if the current display shows our target mode
          const updatedElements = document.querySelectorAll('*');
          let modeChanged = false;
          for (const el of updatedElements) {
            if (el.textContent?.includes(`Chart Mode:${modeText}`) || 
                el.textContent?.includes(`Mode:${modeText}`) ||
                el.textContent?.includes(modeText) && el.textContent?.includes('active')) {
              modeChanged = true;
              console.log(`✅ Confirmed mode changed to ${mode}`);
              break;
            }
          }
          
          if (modeChanged) {
            return;
          }
        }
      } catch (error) {
        console.log(`⚠️ Error clicking ${mode} selector:`, error);
      }
    }
    
    // Try select dropdowns as fallback
    const selects = document.querySelectorAll('select');
    for (const select of selects) {
      if (select instanceof HTMLSelectElement) {
        for (const option of select.options) {
          if (option.value === mode || option.textContent?.trim() === modeText) {
            console.log(`📱 Attempting select change to ${mode}`);
            try {
              select.value = option.value;
              select.dispatchEvent(new Event('change', { bubbles: true }));
              await new Promise(resolve => setTimeout(resolve, 800));
              console.log(`✅ Successfully switched to ${mode} mode via select`);
              return;
            } catch (error) {
              console.log(`⚠️ Error changing select to ${mode}:`, error);
            }
          }
        }
      }
    }
    
    console.log(`⚠️ Could not find or activate ${mode} mode selector`);
  };

  // Function to switch to weekly comparison view
  const switchToWeeklyView = async (): Promise<void> => {
    console.log(`🔄 Switching to weekly comparison view`);
    
    // Enhanced debugging for weekly view switching
    console.log(`🔍 Debugging available weekly UI elements:`);
    
    const weeklyKeywords = ['Weekly Comparison', 'weekly', 'Week', 'comparison', 'Weekly'];
    const allElements = document.querySelectorAll('*');
    const weeklyElements: HTMLElement[] = [];
    const potentialWeeklySelectors: HTMLElement[] = [];
    
    for (const element of allElements) {
      if (element instanceof HTMLElement) {
        const text = element.textContent?.trim() || '';
        
        // Log all elements that mention weekly
        if (weeklyKeywords.some(keyword => text.toLowerCase().includes(keyword.toLowerCase()))) {
          weeklyElements.push(element);
          console.log(`📅 Found weekly element: "${text.slice(0, 80)}" (${element.tagName.toLowerCase()})`);
          
          const tagName = element.tagName.toLowerCase();
          const role = element.getAttribute('role');
          
          // Look for clickable weekly elements
          if (tagName === 'button' || 
              role === 'tab' ||
              element.classList.contains('tab') ||
              element.closest('[role="tablist"]') ||
              tagName === 'h3' || // Sometimes weekly sections have headers
              tagName === 'h2') {
            
            potentialWeeklySelectors.push(element);
            console.log(`🎯 Potential weekly selector: "${text.slice(0, 50)}" (${tagName}, role=${role})`);
          }
        }
      }
    }
    
    console.log(`📊 Found ${weeklyElements.length} weekly elements, ${potentialWeeklySelectors.length} potential selectors`);
    
    // Try clicking the weekly selectors
    for (const element of potentialWeeklySelectors) {
      const text = element.textContent?.trim() || '';
      const tagName = element.tagName.toLowerCase();
      
      console.log(`📱 Attempting to click weekly selector: "${text.slice(0, 50)}" (${tagName})`);
      
      try {
        element.click();
        await new Promise(resolve => setTimeout(resolve, 800));
        console.log(`✅ Successfully clicked weekly selector`);
        
        // Verify we're now in weekly view by looking for weekly-specific content
        const updatedElements = document.querySelectorAll('*');
        let weeklyViewActive = false;
        for (const el of updatedElements) {
          if (el.textContent?.includes('periods found') || 
              el.textContent?.includes('Period:') ||
              el.textContent?.includes('days of data')) {
            weeklyViewActive = true;
            console.log(`✅ Confirmed weekly view is active`);
            break;
          }
        }
        
        if (weeklyViewActive) {
          return;
        }
      } catch (error) {
        console.log(`⚠️ Error clicking weekly selector:`, error);
      }
    }
    
    console.log(`⚠️ Could not find or activate weekly view selector`);
  };

  const findChartElement = async (chart: ChartConfig, usedElements?: Set<HTMLElement>): Promise<HTMLElement | null> => {
    // Strategy: Find chart containers based on chart configuration
    const { category, type } = chart;
    
    console.log(`🔍 Looking for chart: ${category}:${type}`);
    
    // For campaign-performance charts, switch modes if needed
    if (category === 'campaign-performance') {
      const mode = chart.subOptions?.mode || 'display';
      await switchChartMode(mode);
    }
    
    // For weekly-comparison, we don't need to switch views - we capture the section directly
    
    // Enhanced debugging - analyze actual DOM structure  
    const allChartElements = document.querySelectorAll('.recharts-responsive-container');
    console.log(`📊 Found ${allChartElements.length} recharts containers:`);
    
    allChartElements.forEach((el, index) => {
      const rect = el.getBoundingClientRect();
      const parent = el.parentElement?.parentElement; // Go up to find meaningful container
      const parentText = parent?.textContent?.slice(0, 120).replace(/\s+/g, ' ') || 'No parent text';
      console.log(`  ${index}: Size: ${Math.round(rect.width)}x${Math.round(rect.height)}, Parent: "${parentText}"`);
    });

    // Debug: Look for any elements that might contain attribution/weekly text
    console.log(`🔍 Searching for attribution/weekly indicators:`);
    const allElements = document.querySelectorAll('*');
    let attributionElements = 0;
    let weeklyElements = 0;
    
    Array.from(allElements).forEach(el => {
      const text = el.textContent?.toLowerCase() || '';
      if (text.includes('attribution') && text.length < 200) {
        attributionElements++;
        console.log(`  Attribution text found: "${el.textContent?.slice(0, 100)}"`);
      }
      if ((text.includes('weekly') || text.includes('week')) && text.length < 200) {
        weeklyElements++;
        console.log(`  Weekly text found: "${el.textContent?.slice(0, 100)}"`);
      }
    });
    
    console.log(`Found ${attributionElements} attribution indicators, ${weeklyElements} weekly indicators`);

    // Debug: Check if there are tabs or switches that might change chart content
    const tabs = document.querySelectorAll('[role="tab"], .tab, [class*="tab"], [class*="toggle"], [class*="switch"]');
    console.log(`🎛️ Found ${tabs.length} potential tabs/toggles:`);
    tabs.forEach((tab, index) => {
      const text = tab.textContent?.slice(0, 50) || '';
      console.log(`  Tab ${index}: "${text}"`);
    });
    
    let targetElement: HTMLElement | null = null;

    if (category === 'spark-charts') {
      // For spark charts, find the container that holds the 6 small charts (400x64)
      // Get the parent container of all small charts
      const smallCharts = Array.from(allChartElements).filter(el => {
        const rect = el.getBoundingClientRect();
        return rect.height < 100; // Small charts (64px height)
      });
      
      if (smallCharts.length >= 4) {
        // Find the common parent container that holds all small charts
        const firstChart = smallCharts[0];
        let container = firstChart.parentElement;
        
        // Go up the DOM tree to find a container that includes multiple charts
        while (container && container.querySelectorAll('.recharts-responsive-container').length < 4) {
          container = container.parentElement;
        }
        
        targetElement = container as HTMLElement;
        if (targetElement) {
          console.log(`✅ Found spark charts container with ${smallCharts.length} small charts`);
        }
      }
      
    } else if (category === 'campaign-performance') {
      // For performance charts, we need to handle sub-options (display vs attribution, by-date vs by-day-of-week)
      const { subOptions } = chart;
      const mode = subOptions?.mode || 'display';
      const format = subOptions?.format || 'by-date';
      
      console.log(`🔍 Looking for campaign-performance chart: mode=${mode}, format=${format}`);
      
      const largeCharts = Array.from(allChartElements).filter(el => {
        const rect = el.getBoundingClientRect();
        return rect.height > 300; // Large charts (400px height)
      });
      
      console.log(`📊 Found ${largeCharts.length} large charts for campaign performance`);
      
      if (largeCharts.length > 1) {
        // Multiple large charts - try to differentiate
        if (mode === 'attribution') {
          const chart = largeCharts[1] as HTMLElement || largeCharts[0] as HTMLElement;
          if (usedElements?.has(chart)) {
            console.log(`❌ Attribution chart not available - chart already used`);
            targetElement = null;
          } else {
            targetElement = chart;
            console.log(`✅ Found attribution performance chart (using chart ${largeCharts.length > 1 ? '2' : '1'})`);
          }
        } else {
          const chart = largeCharts[0] as HTMLElement;
          if (usedElements?.has(chart)) {
            console.log(`❌ Display chart not available - chart already used`);
            targetElement = null;
          } else {
            targetElement = chart;
            console.log(`✅ Found display performance chart (using chart 1)`);
          }
        }
      } else if (largeCharts.length === 1) {
        // Only one large chart available - both display and attribution can use it
        const chart = largeCharts[0] as HTMLElement;
        
        // For campaign-performance charts, we allow reuse of the same element
        // because we switch the mode via UI controls, not different chart elements
        // Only reject if it's already used by a non-campaign-performance chart
        targetElement = chart;
        console.log(`✅ Found ${mode} performance chart (allowing reuse for mode switching): ${Math.round(chart.getBoundingClientRect().width)}x${Math.round(chart.getBoundingClientRect().height)}`);
      } else {
        console.log(`❌ No large charts found for campaign performance`);
        targetElement = null;
      }
      
    } else if (category === 'weekly-comparison') {
      // Weekly comparison - find the complete container with header AND cards
      console.log(`🔍 Looking for complete weekly comparison container (header + cards)`);
      
      // First, find elements that contain "Weekly Comparison" as a starting point
      const allElements = document.querySelectorAll('*');
      let weeklyHeaders: HTMLElement[] = [];
      
      for (const element of allElements) {
        if (element instanceof HTMLElement) {
          const text = element.textContent || '';
          if (text.includes('Weekly Comparison') && text.includes('periods found')) {
            weeklyHeaders.push(element);
            console.log(`📋 Found weekly header: "${text.slice(0, 80).replace(/\s+/g, ' ')}" (${element.tagName.toLowerCase()})`);
          }
        }
      }
      
      // Now for each header, walk up the DOM to find the container that includes both header and cards
      for (const header of weeklyHeaders) {
        let currentElement = header;
        
        for (let level = 0; level < 8 && currentElement; level++) {
          currentElement = currentElement.parentElement;
          
          if (currentElement instanceof HTMLElement) {
            const rect = currentElement.getBoundingClientRect();
            const text = currentElement.textContent || '';
            
            // Check if this parent contains both the header and period cards
            const hasPeriodCards = text.includes('Period:');
            const hasWeeklyComparison = text.includes('Weekly Comparison');
            const hasReasonableSize = rect.width > 400 && rect.width < 900 && rect.height > 150 && rect.height < 500;
            const notTooMuchOtherContent = !text.includes('Campaign Performance') && !text.includes('Export PDF');
            
            console.log(`    Level ${level}: ${Math.round(rect.width)}x${Math.round(rect.height)} - hasPeriodCards=${hasPeriodCards}, hasWeeklyComparison=${hasWeeklyComparison}, hasReasonableSize=${hasReasonableSize}, notTooMuchOtherContent=${notTooMuchOtherContent}`);
            
            if (hasPeriodCards && hasReasonableSize && notTooBig && notTooMuchOtherContent) {
              console.log(`✅ Found complete weekly container at level ${level}: ${Math.round(rect.width)}x${Math.round(rect.height)}`);
              console.log(`    Content check: hasPeriodCards=${hasPeriodCards}, reasonableSize=${hasReasonableSize}, notTooBig=${notTooBig}`);
              targetElement = currentElement;
              break;
            } else {
              console.log(`📊 Level ${level} parent: ${Math.round(rect.width)}x${Math.round(rect.height)} - hasPeriodCards=${hasPeriodCards}, reasonableSize=${hasReasonableSize}, notTooBig=${notTooBig}`);
            }
          }
        }
        
        if (targetElement) break;
      }
      
      // Fallback: if we can't find the perfect container, use a less strict approach
      if (!targetElement && weeklyHeaders.length > 0) {
        console.log(`⚠️ Perfect container not found, trying fallback approach`);
        
        for (const header of weeklyHeaders) {
          let currentElement = header;
          
          // More relaxed criteria for fallback
          for (let level = 0; level < 6 && currentElement; level++) {
            currentElement = currentElement.parentElement;
            
            if (currentElement instanceof HTMLElement) {
              const rect = currentElement.getBoundingClientRect();
              const text = currentElement.textContent || '';
              
              // Less strict requirements
              const hasWeeklyContent = text.includes('Weekly Comparison');
              const notTooSmall = rect.width > 400 && rect.height > 200;
              const notWholeDashboard = rect.width < 1200 && rect.height < 800;
              
              if (hasWeeklyContent && notTooSmall && notWholeDashboard) {
                console.log(`✅ Fallback weekly container at level ${level}: ${Math.round(rect.width)}x${Math.round(rect.height)}`);
                targetElement = currentElement;
                break;
              }
            }
          }
          
          if (targetElement) break;
        }
      }
      
      // Final fallback: just use the first header we found
      if (!targetElement && weeklyHeaders.length > 0) {
        console.log(`⚠️ Using header element as last resort`);
        targetElement = weeklyHeaders[0];
      }
      
      if (!targetElement) {
        console.log(`❌ Could not find any weekly comparison element`);
      }
    }

    // Only use fallback for spark-charts, not for other categories
    if (!targetElement && category === 'spark-charts') {
      const fallbackChart = document.querySelector('.recharts-responsive-container');
      if (fallbackChart instanceof HTMLElement && fallbackChart.offsetParent !== null) {
        targetElement = fallbackChart.closest('.card') as HTMLElement || fallbackChart;
        console.log(`🔄 Using fallback chart element for ${category}:${type}`, targetElement);
      }
    }
    
    if (!targetElement) {
      console.warn(`❌ No chart element found for ${category}:${type}`);
    }
    
    return targetElement;
  };

  const handleExport = async () => {
    setIsExporting(true);
    
    try {
      // First, close the modal so we can access the main dashboard charts
      onOpenChange(false);
      
      // Wait a moment for the modal to close and DOM to update
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Track used chart elements to prevent duplicates
      const usedChartElements = new Set<HTMLElement>();
      
      // Create PDF document
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const margin = 20;
      let currentY = margin;

      // Add title
      pdf.setFontSize(20);
      pdf.text('Campaign Performance Report', pageWidth / 2, currentY, { align: 'center' });
      currentY += 15;
      
      // Add generation info
      pdf.setFontSize(12);
      pdf.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth / 2, currentY, { align: 'center' });
      currentY += 15;
      
      // Add filter information
      pdf.setFontSize(14);
      pdf.text('Applied Filters:', margin, currentY);
      currentY += 10;
      
      pdf.setFontSize(11);
      pdf.text(`Campaign Status: ${showLiveOnly ? 'Live Only' : 'All Campaigns'}`, margin + 5, currentY);
      currentY += 7;
      pdf.text(`Data Rows: ${data.length.toLocaleString()}`, margin + 5, currentY);
      currentY += 7;
      pdf.text(`Agencies: ${appliedFilters?.agencies.length || 'All'}`, margin + 5, currentY);
      currentY += 7;
      pdf.text(`Campaigns: ${appliedFilters?.campaigns.length || 'All'}`, margin + 5, currentY);
      currentY += 20;

      // Now look for charts in the main page (not inside the modal)
      console.log('🔍 Searching for charts after modal closed...');
      
      // Group charts by category for better layout
      const chartsByCategory = selectedCharts.reduce((acc, chart) => {
        if (!acc[chart.category]) acc[chart.category] = [];
        acc[chart.category].push(chart);
        return acc;
      }, {} as Record<string, ChartConfig[]>);

      // Process each category
      console.log(`📋 Processing chart categories:`, Object.keys(chartsByCategory));
      for (const [category, charts] of Object.entries(chartsByCategory)) {
        console.log(`📋 Processing ${category}: ${charts.length} charts`);
        charts.forEach((chart, index) => {
          console.log(`  ${index + 1}. ${getChartTitle(chart)} - Config:`, { category: chart.category, type: chart.type, subOptions: chart.subOptions });
        });
        if (category === 'spark-charts' && charts.length > 0) {
          // Handle spark charts - capture only selected metrics by finding individual chart elements
          try {
            // Add section title
            pdf.setFontSize(14);
            pdf.setFont('helvetica', 'bold');
            pdf.text(`Spark Charts (${charts.length} selected metrics)`, margin, currentY);
            currentY += 10;

            // List the selected metrics
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'normal');
            const metricsText = charts.map(c => c.type.toUpperCase()).join(', ');
            pdf.text(`Selected Metrics: ${metricsText}`, margin, currentY);
            currentY += 8;

            // Add date range (use the first chart's range as they should be similar)
            const dateText = `Date Range: ${charts[0].dateRange?.from?.toLocaleDateString()} - ${charts[0].dateRange?.to?.toLocaleDateString()}`;
            pdf.text(dateText, margin, currentY);
            currentY += 15;

            // Wait for animations
            await new Promise(resolve => setTimeout(resolve, 500));

            // Find individual spark chart elements based on their metric type
            const sparkChartElements: HTMLElement[] = [];
            const allChartElements = document.querySelectorAll('.recharts-responsive-container');
            
            // Map of metric names to look for in parent text
            const metricMap = {
              'impressions': 'impressions',
              'clicks': 'clicks',
              'ctr': 'ctr',
              'transactions': 'transactions',
              'revenue': 'revenue',
              'roas': 'roas'
            };

            // Find the specific charts for selected metrics
            for (const chart of charts) {
              const metricName = metricMap[chart.type.toLowerCase() as keyof typeof metricMap];
              if (metricName) {
                // Find chart element whose parent contains this metric name
                const matchingElement = Array.from(allChartElements).find(el => {
                  const rect = el.getBoundingClientRect();
                  if (rect.height > 100) return false; // Skip large charts
                  
                  const parent = el.parentElement?.parentElement;
                  const parentText = parent?.textContent?.toLowerCase() || '';
                  return parentText.includes(metricName);
                });
                
                if (matchingElement) {
                  sparkChartElements.push(matchingElement.parentElement?.parentElement as HTMLElement || matchingElement as HTMLElement);
                }
              }
            }

            console.log(`Found ${sparkChartElements.length} individual spark charts for selected metrics`);

            if (sparkChartElements.length === 0) {
              // Fallback: show error
              pdf.setFontSize(10);
              pdf.setTextColor(255, 0, 0);
              pdf.text('Selected spark charts not found', margin, currentY);
              pdf.setTextColor(0, 0, 0);
              currentY += 15;
              continue;
            }

            // Calculate layout for selected charts (up to 3 per row)
            const chartsPerRow = Math.min(3, sparkChartElements.length);
            const chartWidth = (pageWidth - (2 * margin) - ((chartsPerRow - 1) * 5)) / chartsPerRow;
            const rows = Math.ceil(sparkChartElements.length / chartsPerRow);
            let chartIndex = 0;

            for (let row = 0; row < rows; row++) {
              let rowHeight = 0;
              const rowElements: { canvas: any; x: number; y: number; width: number; height: number }[] = [];

              // Capture charts for this row
              for (let col = 0; col < chartsPerRow && chartIndex < sparkChartElements.length; col++) {
                const element = sparkChartElements[chartIndex];
                
                // Capture individual chart
                const canvas = await html2canvas(element, {
                  scale: 2,
                  useCORS: true,
                  allowTaint: true,
                  backgroundColor: '#ffffff',
                  logging: false
                });

                const chartHeight = (canvas.height * chartWidth) / canvas.width;
                rowHeight = Math.max(rowHeight, chartHeight);

                rowElements.push({
                  canvas,
                  x: margin + (col * (chartWidth + 5)),
                  y: currentY,
                  width: chartWidth,
                  height: chartHeight
                });

                chartIndex++;
              }

              // Check if we need a new page
              if (currentY + rowHeight + 20 > pageHeight - margin) {
                pdf.addPage();
                currentY = margin;
                // Update y positions for new page
                rowElements.forEach(el => el.y = currentY);
              }

              // Add all charts in this row
              for (const element of rowElements) {
                const imgData = element.canvas.toDataURL('image/jpeg', 0.95);
                pdf.addImage(imgData, 'JPEG', element.x, element.y, element.width, element.height);
              }

              currentY += rowHeight + 15;
            }

            currentY += 10; // Extra spacing after spark charts section

          } catch (error) {
            console.error('Error capturing spark charts:', error);
            pdf.setFontSize(10);
            pdf.setTextColor(255, 0, 0);
            pdf.text('Error capturing spark charts', margin, currentY);
            pdf.setTextColor(0, 0, 0);
            currentY += 15;
          }
        } else {
          // Handle individual charts (non-spark or single spark chart)
          for (const [index, chart] of charts.entries()) {
            try {
              const element = await findChartElement(chart, usedChartElements);
              
              if (!element) {
                // Add error message for missing chart
                pdf.setFontSize(12);
                pdf.setTextColor(255, 0, 0);
                pdf.text(`Chart not found: ${getChartTitle(chart)}`, margin, currentY);
                pdf.setTextColor(0, 0, 0);
                currentY += 15;
                continue;
              }

              // Mark this chart as used to prevent reuse 
              // Allow reuse for weekly-comparison and campaign-performance (for different modes)
              if (chart.category !== 'weekly-comparison' && chart.category !== 'campaign-performance') {
                usedChartElements.add(element);
              }

              // Wait for any animations and mode switches to complete
              await new Promise(resolve => setTimeout(resolve, 1000));
              
              // Additional wait if this was a mode-switched chart
              if (chart.category === 'campaign-performance' && chart.subOptions?.mode === 'attribution') {
                console.log(`⏱️ Extra wait for attribution mode chart to load...`);
                await new Promise(resolve => setTimeout(resolve, 1000));
              }

              // Capture the chart element
              const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                backgroundColor: '#ffffff',
                logging: false
              });

              // Calculate dimensions to fit page
              const imgWidth = pageWidth - (2 * margin);
              const imgHeight = (canvas.height * imgWidth) / canvas.width;

              // Check if we need a new page
              if (currentY + imgHeight + 20 > pageHeight - margin) {
                pdf.addPage();
                currentY = margin;
              }

              // Add chart title
              pdf.setFontSize(12);
              pdf.setFont('helvetica', 'bold');
              pdf.text(getChartTitle(chart), margin, currentY);
              currentY += 8;

              // Add date range info
              pdf.setFontSize(10);
              pdf.setFont('helvetica', 'normal');
              const dateText = `Date Range: ${chart.dateRange?.from?.toLocaleDateString()} - ${chart.dateRange?.to?.toLocaleDateString()}`;
              pdf.text(dateText, margin, currentY);
              currentY += 12;

              // Add the chart image
              const imgData = canvas.toDataURL('image/jpeg', 0.95);
              pdf.addImage(imgData, 'JPEG', margin, currentY, imgWidth, imgHeight);
              currentY += imgHeight + 20;

            } catch (chartError) {
              console.error(`Error capturing chart ${getChartTitle(chart)}:`, chartError);
              // Add error message to PDF
              pdf.setFontSize(10);
              pdf.setTextColor(255, 0, 0);
              pdf.text(`Error capturing: ${getChartTitle(chart)}`, margin, currentY);
              pdf.setTextColor(0, 0, 0);
              currentY += 15;
            }
          }
        }
      }

      // Generate filename
      const timestamp = new Date().toISOString().split('T')[0];
      const chartTitle = selectedCharts.map(chart => getChartTitle(chart)).join('-').replace(/\s+/g, '-').toLowerCase();
      const filename = `campaign-report-${chartTitle}-${timestamp}.pdf`;
      
      // Save the PDF
      pdf.save(filename);
      
      toast.success(`PDF downloaded: ${filename}`);
      
    } catch (error) {
      console.error('Export error:', error);
      toast.error("Failed to export PDF. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const resetSelection = () => {
    setSelectedCharts([]);
    setCurrentChart(null);
    setCurrentChartDateRange(dateRange);
    setCurrentStep(1);
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Step 1: Select Chart Type</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Choose a chart from the Dashboard tab to include in your PDF report.
              </p>
            </div>

            {/* Category Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Chart Category</CardTitle>
                <CardDescription>Select the type of chart you want to include</CardDescription>
              </CardHeader>
              <CardContent>
                <Select
                  value={currentChart?.category || ""}
                  onValueChange={handleCategorySelect}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a chart category..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(chartCategories).map(([key, category]) => (
                      <SelectItem key={key} value={key}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Type Selection - only show if there are multiple options */}
            {currentChart?.category && chartCategories[currentChart.category as keyof typeof chartCategories].options.length > 1 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Specific Chart</CardTitle>
                  <CardDescription>
                    Select the specific chart from {chartCategories[currentChart.category as keyof typeof chartCategories].name}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Select
                    value={currentChart.type || ""}
                    onValueChange={handleTypeSelect}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose specific chart..." />
                    </SelectTrigger>
                    <SelectContent>
                      {chartCategories[currentChart.category as keyof typeof chartCategories].options.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            )}
            

            {/* Sub-options */}
            {currentChart?.type && chartCategories[currentChart.category as keyof typeof chartCategories].subOptions && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Chart Options</CardTitle>
                  <CardDescription>Configure the chart settings</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    {Object.entries(chartCategories[currentChart.category as keyof typeof chartCategories].subOptions!).map(([key, options]) => (
                      <div key={key} className="space-y-2">
                        <label className="text-sm font-medium capitalize">{key.replace('-', ' ')}</label>
                        <Select
                          value={currentChart.subOptions?.[key] || ""}
                          onValueChange={(value) => handleSubOptionSelect(key, value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={`Choose ${key.replace('-', ' ')}...`} />
                          </SelectTrigger>
                          <SelectContent>
                            {options.map(option => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Step 2: Select Date Range</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Choose the date range for your selected chart: <Badge variant="outline">{getCurrentChartTitle()}</Badge>
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Chart Date Range</CardTitle>
                <CardDescription>
                  This will override the global date range for this specific chart.<br/>
                  Available data: {availableDateRange.min.toLocaleDateString()} to {availableDateRange.max.toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DateRangePicker
                  dateRange={currentChartDateRange}
                  onDateRangeChange={setCurrentChartDateRange}
                  minDate={availableDateRange.min}
                  maxDate={availableDateRange.max}
                />
              </CardContent>
            </Card>

            {/* Add Chart Button */}
            <div className="flex justify-center">
              <Button 
                onClick={addCurrentChart}
                disabled={!canProceedToNextStep()}
                className="flex items-center gap-2"
              >
                Add Chart to Report
              </Button>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Step 3: Charts Added</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Manage your selected charts and choose your next action.
              </p>
            </div>

            {/* Charts Added Management */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Charts Added ({selectedCharts.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  {selectedCharts.map((chart) => (
                    <div key={chart.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                      <div>
                        <div className="font-medium text-sm">{getChartTitle(chart)}</div>
                        <div className="text-xs text-muted-foreground">
                          {chart.dateRange?.from?.toLocaleDateString()} - {chart.dateRange?.to?.toLocaleDateString()}
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => removeChart(chart.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
                
                {/* Action Buttons */}
                <div className="flex justify-center gap-3 pt-2 border-t">
                  <Button 
                    onClick={() => {
                      console.log(`🔄 ADD ANOTHER CHART: Resetting currentChart state`);
                      console.log(`   Before reset - currentChart:`, currentChart);
                      setCurrentChart(null);
                      setCurrentChartDateRange(dateRange);
                      setCurrentStep(1);
                      console.log(`   After reset - should be null on next render`);
                    }}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    Add Another Chart
                  </Button>
                  <Button 
                    onClick={() => setCurrentStep(4)}
                    disabled={selectedCharts.length < 2}
                    className="flex items-center gap-2"
                    size="default"
                  >
                    <Eye className="h-4 w-4" />
                    Preview & Export Report
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-4">Step 4: Preview Report</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Review your report configuration before generating the PDF.
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Report Summary</CardTitle>
                <CardDescription>This is what will be included in your PDF</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  {selectedCharts.map((chart) => (
                    <div key={chart.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                      <div>
                        <div className="font-medium">{getChartTitle(chart)}</div>
                        <div className="text-sm text-muted-foreground">
                          {chart.dateRange?.from?.toLocaleDateString()} - {chart.dateRange?.to?.toLocaleDateString()}
                        </div>
                      </div>
                      <Badge variant="secondary">Chart</Badge>
                    </div>
                  ))}
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="font-medium text-sm">Applied Filters (Inherited from Dashboard):</div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Campaign Status:</span>{" "}
                      <Badge variant="outline" className="ml-1">
                        {showLiveOnly ? "Live Only" : "All Campaigns"}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Data Rows:</span>{" "}
                      <Badge variant="outline" className="ml-1">{data.length.toLocaleString()}</Badge>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Agencies:</span>{" "}
                      <Badge variant="outline" className="ml-1">
                        {appliedFilters?.agencies.length || "All"}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Campaigns:</span>{" "}
                      <Badge variant="outline" className="ml-1">
                        {appliedFilters?.campaigns.length || "All"}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            PDF Export - Dashboard Charts
          </DialogTitle>
        </DialogHeader>

        {/* Progress Indicator */}
        <div className="flex items-center justify-center space-x-2 py-4 border-b">
          {[1, 2, 3, 4].map((step) => (
            <React.Fragment key={step}>
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                ${currentStep >= step 
                  ? 'bg-blue-500 text-white' 
                  : 'bg-gray-200 text-gray-500'
                }
              `}>
                {step}
              </div>
              {step < 4 && (
                <ChevronRight className={`h-4 w-4 ${currentStep > step ? 'text-blue-500' : 'text-gray-300'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {renderStepContent()}
        </div>

        {/* Footer */}
        <Separator />
        <div className="flex items-center justify-between p-4">
          <div className="flex gap-2">
            {currentStep > 1 && currentStep !== 3 && (
              <Button 
                variant="outline" 
                onClick={() => setCurrentStep(currentStep - 1)}
              >
                Back
              </Button>
            )}
            <Button variant="ghost" onClick={resetSelection}>
              Start Over
            </Button>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            
            {currentStep === 1 ? (
              <Button 
                onClick={() => setCurrentStep(2)}
                disabled={!canProceedToNextStep()}
              >
                Next
              </Button>
            ) : currentStep === 2 ? (
              // No footer buttons for Step 2, just the "Add Chart to Report" button
              <div />
            ) : currentStep === 3 ? (
              // No footer buttons for Step 3, actions are in the card
              <div />
            ) : (
              <Button 
                onClick={handleExport}
                disabled={isExporting}
              >
                {isExporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isExporting ? "Generating..." : "Export PDF"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StreamlinedPdfExportModal;