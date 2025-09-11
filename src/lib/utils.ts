import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(value: number, options: { 
  decimals?: number, 
  prefix?: string,
  suffix?: string,
  abbreviate?: boolean 
} = {}): string {
  const { 
    decimals = 0, 
    prefix = '', 
    suffix = '',
    abbreviate = true
  } = options;
  
  if (abbreviate) {
    if (value >= 1000000) {
      return `${prefix}${(value / 1000000).toFixed(1)}M${suffix}`;
    } else if (value >= 1000) {
      return `${prefix}${(value / 1000).toFixed(1)}K${suffix}`;
    }
  }
  
  return `${prefix}${value.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${suffix}`;
}

export function parseDateString(dateStr: string): Date | null {
  if (!dateStr) return null;
  
  try {
    // Standardize the date string
    const cleanDateStr = dateStr.trim();
    
    // Handle MM/DD/YYYY or MM/DD/YY format
    if (cleanDateStr.includes('/')) {
      const parts = cleanDateStr.split('/');
      if (parts.length !== 3) {
        console.warn(`Invalid date format: ${cleanDateStr} - expected MM/DD/YYYY or MM/DD/YY`);
        return null;
      }
      
      const month = parseInt(parts[0], 10);
      const day = parseInt(parts[1], 10);
      let year = parseInt(parts[2], 10);
      
      if (isNaN(month) || isNaN(day) || isNaN(year)) {
        console.warn(`Invalid date parts: month=${parts[0]}, day=${parts[1]}, year=${parts[2]}`);
        return null;
      }
      
      // Handle 2-digit years - assume 2000s
      if (year < 100) {
        year += 2000;
        console.log(`Converted 2-digit year ${parts[2]} to ${year}`);
      }
      
      if (month < 1 || month > 12) {
        console.warn(`Invalid month: ${month}`);
        return null;
      }
      if (day < 1 || day > 31) {
        console.warn(`Invalid day: ${day}`);
        return null;
      }
      
      // Use noon (12:00) to avoid timezone issues
      const date = new Date(year, month - 1, day, 12, 0, 0, 0);
      
      if (isNaN(date.getTime())) {
        console.warn(`Invalid date created from: ${cleanDateStr}`);
        return null;
      }
      
      return date;
    } 
    // Handle YYYY-MM-DD format
    else if (/^\d{4}-\d{2}-\d{2}$/.test(cleanDateStr)) {
      // Create date at noon to avoid timezone issues
      const date = new Date(`${cleanDateStr}T12:00:00`);
      
      if (isNaN(date.getTime())) {
        console.warn(`Invalid ISO date: ${cleanDateStr}`);
        return null;
      }
      
      return date;
    }
    // Try standard JS Date parsing as fallback
    else {
      const date = new Date(cleanDateStr);
      
      if (isNaN(date.getTime())) {
        console.warn(`Failed to parse date: ${cleanDateStr}`);
        return null;
      }
      
      // Set to noon to avoid timezone issues
      const safeDate = new Date(date);
      safeDate.setHours(12, 0, 0, 0);
      
      return safeDate;
    }
  } catch (error) {
    console.error(`Error parsing date string: ${dateStr}`, error);
    return null;
  }
}

export function normalizeDate(date: Date | string): string {
  if (!date) return '';
  
  try {
    let dateObj: Date | null;
    
    if (typeof date === 'string') {
      // Try parsing with our custom parser first
      dateObj = parseDateString(date);
      
      // If that fails, try direct Date constructor
      if (!dateObj) {
        try {
          dateObj = new Date(date);
          if (isNaN(dateObj.getTime())) {
            console.error(`Invalid date string: ${date}`);
            return '';
          }
        } catch (e) {
          console.error(`Error creating date from string: ${date}`, e);
          return '';
        }
      }
    } else {
      // If we already have a Date object, use it directly
      dateObj = date;
    }
    
    if (!dateObj || isNaN(dateObj.getTime())) {
      console.error(`Invalid date object: ${date}`);
      return '';
    }
    
    // Format consistently as MM/DD/YYYY
    const month = String(dateObj.getMonth() + 1);
    const day = String(dateObj.getDate());
    const year = dateObj.getFullYear();
    
    return `${month}/${day}/${year}`;
  } catch (error) {
    console.error(`Error normalizing date ${date}:`, error);
    return '';
  }
}

export function isSameDay(date1: Date | string, date2: Date | string): boolean {
  if (!date1 || !date2) return false;
  
  try {
    const d1 = normalizeDate(date1);
    const d2 = normalizeDate(date2);
    return d1 === d2;
  } catch (error) {
    console.error(`Error comparing dates ${date1} and ${date2}:`, error);
    return false;
  }
}

export function setToEndOfDay(date: Date): Date {
  try {
    if (!date || isNaN(date.getTime())) {
      console.warn('Invalid date passed to setToEndOfDay');
      return new Date(); // Return current date as fallback
    }
    
    const result = new Date(date);
    result.setHours(23, 59, 59, 999);
    return result;
  } catch (error) {
    console.error('Error in setToEndOfDay', error);
    return date; // Return original as fallback
  }
}

export function setToStartOfDay(date: Date): Date {
  try {
    if (!date || isNaN(date.getTime())) {
      console.warn('Invalid date passed to setToStartOfDay');
      return new Date(); // Return current date as fallback
    }
    
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
  } catch (error) {
    console.error('Error in setToStartOfDay', error);
    return date; // Return original as fallback
  }
}

export function logDateDetails(label: string, date: Date | string, extraInfo: string = ''): void {
  try {
    if (!date) {
      console.error(`${label}: Empty date ${extraInfo}`);
      return;
    }
    
    let dateObj: Date;
    
    if (typeof date === 'string') {
      const parsed = parseDateString(date);
      if (!parsed) {
        console.error(`${label}: Failed to parse date: ${date} ${extraInfo}`);
        return;
      }
      dateObj = parsed;
    } else {
      dateObj = date;
    }
    
    if (isNaN(dateObj.getTime())) {
      console.error(`${label}: Invalid date: ${date} ${extraInfo}`);
      return;
    }
    
    console.log(`${label}: ${dateObj.toISOString()} (${dateObj.toLocaleString()}) ${extraInfo}`);
  } catch (error) {
    console.error(`Error logging date ${date}:`, error);
  }
}

export function createConsistentDate(date: Date | string): Date {
  if (!date) throw new Error('Date cannot be empty');
  
  try {
    if (typeof date === 'string') {
      // For ISO format strings (YYYY-MM-DD), create at noon
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return new Date(`${date}T12:00:00`);
      }
      
      // For MM/DD/YYYY format, use parseDateString
      if (date.includes('/')) {
        const parsed = parseDateString(date);
        if (parsed) return parsed;
      }
      
      // Fallback - create date and set to noon
      const d = new Date(date);
      if (isNaN(d.getTime())) {
        throw new Error(`Invalid date string: ${date}`);
      }
      
      d.setHours(12, 0, 0, 0);
      return d;
    }
    
    // If already a date object, create a new one at noon
    const d = new Date(date);
    d.setHours(12, 0, 0, 0);
    return d;
  } catch (error) {
    console.error(`Error creating consistent date from ${date}:`, error);
    throw new Error(`Failed to create consistent date: ${error}`);
  }
}
