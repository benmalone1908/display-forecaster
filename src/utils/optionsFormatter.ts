import { Option } from "@/components/MultiSelect";

/**
 * Converts string arrays to option objects for Select and MultiSelect components
 * @param values Array of string values
 * @returns Array of Option objects with value and label properties
 */
export const formatStringArrayToOptions = (values: string[]): Option[] => {
  if (!Array.isArray(values)) {
    console.error("formatStringArrayToOptions received non-array:", values);
    return [];
  }
  
  return values.map(value => ({
    value: value,
    label: value
  }));
};

/**
 * Converts option objects to string array
 * @param options Array of Option objects
 * @returns Array of string values
 */
export const extractValuesFromOptions = (options: Option[]): string[] => {
  if (!Array.isArray(options)) {
    console.error("extractValuesFromOptions received non-array:", options);
    return [];
  }
  
  return options.map(option => option.value);
};

/**
 * Ensures an array is in the proper Option[] format for Select/MultiSelect components
 * @param input Either string[] or Option[]
 * @returns Properly formatted Option[]
 */
export const ensureOptionFormat = (input: string[] | Option[]): Option[] => {
  if (!Array.isArray(input) || input.length === 0) {
    return [];
  }
  
  // Check if the first item is already in Option format
  if (typeof input[0] === 'object' && input[0] !== null && 'value' in input[0] && 'label' in input[0]) {
    return input as Option[];
  }
  
  // Otherwise convert from string[] to Option[]
  return formatStringArrayToOptions(input as string[]);
};

/**
 * Debug utility to log option formats
 */
export const debugLogOptions = (label: string, options: any[]): void => {
  console.log(`DEBUG - ${label} count: ${options?.length || 0}`);
  if (options && options.length > 0) {
    console.log(`DEBUG - ${label} first few items:`, options.slice(0, 3));
    console.log(`DEBUG - ${label} item type:`, typeof options[0]);
    if (typeof options[0] === 'object' && options[0] !== null) {
      console.log(`DEBUG - ${label} keys:`, Object.keys(options[0]));
    }
  }
};
