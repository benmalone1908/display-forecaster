/**
 * IO Number Extraction Utility
 *
 * Extracts IO numbers from campaign names following the established naming conventions.
 * Campaign names typically start with a 7-digit number (IO number).
 * Sometimes there are two numbers separated by a slash - use the larger one.
 */

/**
 * Extract IO number from campaign name
 * Returns the larger number if there are two slash-separated numbers (legacy behavior)
 */
export const extractIONumber = (campaignName: string): string | null => {
  if (!campaignName) return null;

  // Look for pattern: 7-digit number(s) at the start, possibly slash-separated
  // Examples: "2001567:", "2001567/2001103:", "2001367: HRB: District Cannabis"
  const ioPattern = /^(\d{7})(?:\/(\d{7}))?/;
  const match = campaignName.match(ioPattern);

  if (!match) return null;

  const firstNumber = match[1];
  const secondNumber = match[2];

  // If there's a second number, return the larger one
  if (secondNumber) {
    return parseInt(firstNumber) > parseInt(secondNumber) ? firstNumber : secondNumber;
  }

  return firstNumber;
};

/**
 * Extract IO numbers from campaign name, keeping both if slash-separated
 * Returns array of IO numbers as they appear in the campaign name
 */
export const extractIONumbers = (campaignName: string): string[] => {
  if (!campaignName) return [];

  // Look for pattern: 7-digit number(s) at the start, possibly slash-separated
  const ioPattern = /^(\d{7})(?:\/(\d{7}))?/;
  const match = campaignName.match(ioPattern);

  if (!match) return [];

  const firstNumber = match[1];
  const secondNumber = match[2];

  if (secondNumber) {
    return [firstNumber, secondNumber];
  }

  return [firstNumber];
};

/**
 * Get the display format for IO numbers (as they appear in campaign name)
 */
export const getIODisplayFormat = (campaignName: string): string | null => {
  if (!campaignName) return null;

  const ioPattern = /^(\d{7}(?:\/\d{7})?)/;
  const match = campaignName.match(ioPattern);

  return match ? match[1] : null;
};

/**
 * Extract all unique IO numbers from an array of campaign data
 */
export const extractAllIONumbers = (campaignData: any[]): string[] => {
  const ioNumbers = new Set<string>();

  campaignData.forEach(row => {
    const campaignName = row["CAMPAIGN ORDER NAME"] || row.campaign_order_name || "";
    const ioNums = extractIONumbers(campaignName);

    ioNums.forEach(io => ioNumbers.add(io));
  });

  return Array.from(ioNumbers).sort();
};

/**
 * Extract all unique IO display formats (including slash-separated) from campaign data
 */
export const extractAllIODisplayFormats = (campaignData: any[]): Map<string, string[]> => {
  const ioMap = new Map<string, string[]>();

  campaignData.forEach(row => {
    const campaignName = row["CAMPAIGN ORDER NAME"] || row.campaign_order_name || "";
    const ioNums = extractIONumbers(campaignName);
    const displayFormat = getIODisplayFormat(campaignName);

    if (ioNums.length > 0 && displayFormat) {
      ioMap.set(displayFormat, ioNums);
    }
  });

  return ioMap;
};

/**
 * Group campaign data by IO number (legacy - uses single IO)
 */
export const groupDataByIO = (campaignData: any[]): Record<string, any[]> => {
  const grouped: Record<string, any[]> = {};

  campaignData.forEach(row => {
    const campaignName = row["CAMPAIGN ORDER NAME"] || row.campaign_order_name || "";
    const ioNumber = extractIONumber(campaignName);

    if (ioNumber) {
      if (!grouped[ioNumber]) {
        grouped[ioNumber] = [];
      }
      grouped[ioNumber].push(row);
    }
  });

  return grouped;
};

/**
 * Group campaign data by IO display format (handles slash-separated IOs)
 */
export const groupDataByIODisplay = (campaignData: any[]): Record<string, any[]> => {
  const grouped: Record<string, any[]> = {};

  campaignData.forEach(row => {
    const campaignName = row["CAMPAIGN ORDER NAME"] || row.campaign_order_name || "";
    const ioDisplay = getIODisplayFormat(campaignName);

    if (ioDisplay) {
      if (!grouped[ioDisplay]) {
        grouped[ioDisplay] = [];
      }
      grouped[ioDisplay].push(row);
    }
  });

  return grouped;
};

/**
 * Validate if a string looks like a valid IO number (7 digits)
 */
export const isValidIONumber = (ioNumber: string): boolean => {
  return /^\d{7}$/.test(ioNumber);
};

/**
 * Find mismatched IO numbers between two datasets
 */
export const findMismatchedIOs = (
  salesforceIOs: string[],
  dashboardIOs: string[]
): {
  onlyInSalesforce: string[];
  onlyInDashboard: string[];
  matched: string[];
} => {
  const sfSet = new Set(salesforceIOs);
  const dbSet = new Set(dashboardIOs);

  const onlyInSalesforce = salesforceIOs.filter(io => !dbSet.has(io));
  const onlyInDashboard = dashboardIOs.filter(io => !sfSet.has(io));
  const matched = salesforceIOs.filter(io => dbSet.has(io));

  return {
    onlyInSalesforce: onlyInSalesforce.sort(),
    onlyInDashboard: onlyInDashboard.sort(),
    matched: matched.sort()
  };
};

/**
 * Find matches between Salesforce IOs and dashboard IO display formats
 */
export const findIOMatches = (
  salesforceIOs: string[],
  campaignData: any[]
): {
  matches: Array<{ displayFormat: string; ioNumbers: string[]; matchedSalesforceIOs: string[] }>;
  unmatchedSalesforce: string[];
  unmatchedDashboard: string[];
} => {
  const ioDisplayMap = extractAllIODisplayFormats(campaignData);
  const allDashboardIOs = extractAllIONumbers(campaignData);

  const sfSet = new Set(salesforceIOs);
  const matches: Array<{ displayFormat: string; ioNumbers: string[]; matchedSalesforceIOs: string[] }> = [];
  const matchedSalesforceIOs = new Set<string>();
  const matchedDashboardIOs = new Set<string>();

  // Find matches for each display format
  ioDisplayMap.forEach((ioNumbers, displayFormat) => {
    const matchedSFIOs = ioNumbers.filter(io => sfSet.has(io));

    if (matchedSFIOs.length > 0) {
      matches.push({
        displayFormat,
        ioNumbers,
        matchedSalesforceIOs: matchedSFIOs
      });

      // Track which IOs have been matched
      matchedSFIOs.forEach(io => matchedSalesforceIOs.add(io));
      ioNumbers.forEach(io => matchedDashboardIOs.add(io));
    }
  });

  const unmatchedSalesforce = salesforceIOs.filter(io => !matchedSalesforceIOs.has(io));

  // Create a set of all individual IOs that are part of matched display formats
  const iosInMatchedCampaigns = new Set<string>();
  matches.forEach(match => {
    match.ioNumbers.forEach(io => iosInMatchedCampaigns.add(io));
  });

  // Only include IOs in unmatchedDashboard if they're not part of any matched campaign
  const unmatchedDashboard = allDashboardIOs.filter(io =>
    !matchedDashboardIOs.has(io) && !iosInMatchedCampaigns.has(io)
  );

  return {
    matches: matches.sort((a, b) => a.displayFormat.localeCompare(b.displayFormat)),
    unmatchedSalesforce: unmatchedSalesforce.sort(),
    unmatchedDashboard: unmatchedDashboard.sort()
  };
};