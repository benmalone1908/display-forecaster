import { createContext, useContext, useState, ReactNode, useEffect, useMemo, useCallback } from 'react';

// Define the agency mapping
export const AGENCY_MAPPING: Record<string, string> = {
  '2RS': 'Two Rivers',
  '6D': '6 Degrees Media',
  'BLO': 'Be Local One',
  'CB': 'Crystal Bol',
  'CN': 'Cannabis Now',
  'FDD': 'Fat Dawgs Digital',
  'FLD': 'Fieldtest',
  'FLWR': 'The Flowery',
  'HD': 'Highday',
  'HG': 'Happy Greens',
  'HRB': 'Herb.co',
  'LP': 'Lettuce Print',
  'MJ': 'MediaJel Direct',
  'NLMC': 'NLMC',
  'NP': 'Noble People',
  'OG': 'Orangellow',
  'PRP': 'Propaganda Creative',
  'SM': 'Orangellow',
  'TCC': 'Tulip City Creative',
  'TF': 'Tact Firm',
  'TRN': 'Terrayn',
  'W&T': 'Water & Trees',
  'WWX': 'Wunderworx'
};

// Cache for parsed campaign data
type CampaignParseCache = {
  advertiser: string;
  agency: string;
  abbreviation: string;
  isTest: boolean;
};

type CampaignFilterContextType = {
  showLiveOnly: boolean;
  setShowLiveOnly: (value: boolean) => void;
  showAggregatedSparkCharts: boolean;
  setShowAggregatedSparkCharts: (value: boolean) => void;
  showDebugInfo: boolean;
  setShowDebugInfo: (value: boolean) => void;
  extractAdvertiserName: (campaignName: string) => string;
  extractAgencyInfo: (campaignName: string) => { agency: string, abbreviation: string };
  isTestCampaign: (campaignName: string) => boolean;
  // Cache management
  clearCache: () => void;
};

const CampaignFilterContext = createContext<CampaignFilterContextType | undefined>(undefined);


export function CampaignFilterProvider({ children }: { children: ReactNode }) {
  const [showLiveOnly, setShowLiveOnly] = useState(true); // Default to showing live campaigns
  const [showAggregatedSparkCharts, setShowAggregatedSparkCharts] = useState(true); // Default to showing aggregated spark charts
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  
  // Cache for campaign parsing results
  const [campaignCache, setCampaignCache] = useState<Map<string, CampaignParseCache>>(new Map());

  // Clear cache function
  const clearCache = useCallback(() => {
    setCampaignCache(new Map());
  }, []);

  // Memoized regex patterns to avoid recompiling
  const regexPatterns = useMemo(() => ({
    slashFormat: /^\d+\s*\/\s*\d+:\s*([^:]+):/,
    agencyMatch: /^\d+:\s*([^:]+):/,
    agencyMatchNoSpace: /^\d+:([^:]+):/,  // Handle cases without space after colon
    originalAgencyMatch: /^([^:]+):/,
    awaitingIO: /^Awaiting IO:\s*([^:]+):/,
    wwxFormat: /^\d+:?\s*WWX-/,
    wwxDash: /-WWX-/,
    newFormat: /^\d+(?:\/\d+)?:\s*[^:]+:\s*([^-]+)/,
    newFormatNoSpace: /^\d+(?:\/\d+)?:[^:]+:([^-]+)/,  // Handle cases without spaces
    agencyPrefixes: new RegExp(`(SM|2RS|6D|BLO|CB|CN|FDD|FLD|FLWR|HD|HG|HRB|LP|MJ|NLMC|NP|OG|PRP|TCC|TF|TRN|W&T|WWX):\\\\s+(.*?)(?=-)`, 'i')
  }), []);

  // Helper function to extract agency information from campaign name with caching
  const extractAgencyInfo = useCallback((campaignName: string): { agency: string, abbreviation: string } => {
    if (!campaignName) return { agency: "", abbreviation: "" };
    
    // Check cache first
    const cached = campaignCache.get(campaignName);
    if (cached) {
      return { agency: cached.agency, abbreviation: cached.abbreviation };
    }
    
    if (showDebugInfo) {
      console.log(`Extracting agency from: "${campaignName}"`);
    }
    
    // Special case for the campaigns with Partner-PRP or PRP-Pend Oreille
    if (campaignName.includes('2001943:Partner-PRP') || campaignName.includes('2001943: PRP-Pend Oreille')) {
      const result = { agency: 'Propaganda Creative', abbreviation: 'PRP' };
      // Temporarily disable caching to prevent infinite loops
      // setCampaignCache(prev => new Map(prev).set(campaignName, {
      //   advertiser: '',
      //   agency: result.agency,
      //   abbreviation: result.abbreviation,
      //   isTest: false
      // }));
      return result;
    }
    
    // Handle campaign names with "Awaiting IO"
    if (campaignName.startsWith('Awaiting IO:')) {
      const awaitingIOMatch = campaignName.match(regexPatterns.awaitingIO);
      if (awaitingIOMatch?.[1]) {
        const abbreviation = awaitingIOMatch[1].trim();
        const agency = AGENCY_MAPPING[abbreviation] || abbreviation;
        const result = { agency, abbreviation };
        
        // Temporarily disable caching to prevent infinite loops
        // setCampaignCache(prev => new Map(prev).set(campaignName, {
        //   advertiser: '',
        //   agency,
        //   abbreviation,
        //   isTest: false
        // }));
        
        if (showDebugInfo) {
          console.log(`Awaiting IO format: "${campaignName}" -> Agency: "${agency}", Abbreviation: "${abbreviation}"`);
        }
        return result;
      }
    }
    
    // Special case for campaigns starting with numeric IDs and containing WWX-
    if (campaignName.match(regexPatterns.wwxFormat) || campaignName.includes('-WWX-')) {
      const result = { agency: 'Wunderworx', abbreviation: 'WWX' };
      // Temporarily disable caching to prevent infinite loops
      // setCampaignCache(prev => new Map(prev).set(campaignName, {
      //   advertiser: '',
      //   agency: result.agency,
      //   abbreviation: result.abbreviation,
      //   isTest: false
      // }));
      
      if (showDebugInfo) {
        console.log(`WWX format: "${campaignName}" -> Agency: "Wunderworx", Abbreviation: "WWX"`);
      }
      return result;
    }
    
    // Handle campaign names with slashes in the IO number
    const slashFormatMatch = campaignName.match(regexPatterns.slashFormat);
    if (slashFormatMatch?.[1]) {
      const abbreviation = slashFormatMatch[1].trim();
      const agency = AGENCY_MAPPING[abbreviation] || abbreviation;
      const result = { agency, abbreviation };
      
      setCampaignCache(prev => new Map(prev).set(campaignName, {
        advertiser: '',
        agency,
        abbreviation,
        isTest: false
      }));
      
      if (showDebugInfo) {
        console.log(`Slash format: "${campaignName}" -> Agency: "${agency}", Abbreviation: "${abbreviation}"`);
      }
      return result;
    }
    
    // Standard format matching (with space after colon)
    const agencyMatch = campaignName.match(regexPatterns.agencyMatch);
    if (agencyMatch?.[1]) {
      const abbreviation = agencyMatch[1].trim();
      const agency = AGENCY_MAPPING[abbreviation] || abbreviation;
      const result = { agency, abbreviation };
      
      setCampaignCache(prev => new Map(prev).set(campaignName, {
        advertiser: '',
        agency,
        abbreviation,
        isTest: false
      }));
      
      if (showDebugInfo) {
        console.log(`Standard format: "${campaignName}" -> Agency: "${agency}", Abbreviation: "${abbreviation}"`);
      }
      return result;
    }
    
    // Standard format matching (without space after colon)
    const agencyMatchNoSpace = campaignName.match(regexPatterns.agencyMatchNoSpace);
    if (agencyMatchNoSpace?.[1]) {
      const abbreviation = agencyMatchNoSpace[1].trim();
      const agency = AGENCY_MAPPING[abbreviation] || abbreviation;
      const result = { agency, abbreviation };
      
      setCampaignCache(prev => new Map(prev).set(campaignName, {
        advertiser: '',
        agency,
        abbreviation,
        isTest: false
      }));
      
      if (showDebugInfo) {
        console.log(`Standard format (no space): "${campaignName}" -> Agency: "${agency}", Abbreviation: "${abbreviation}"`);
      }
      return result;
    }
    
    // Fallback to original regex for backward compatibility
    const originalAgencyMatch = campaignName.match(regexPatterns.originalAgencyMatch);
    if (originalAgencyMatch?.[1]) {
      const abbreviation = originalAgencyMatch[1].trim();
      const agency = AGENCY_MAPPING[abbreviation] || abbreviation;
      const result = { agency, abbreviation };
      
      setCampaignCache(prev => new Map(prev).set(campaignName, {
        advertiser: '',
        agency,
        abbreviation,
        isTest: false
      }));
      
      if (showDebugInfo) {
        console.log(`Fallback format: "${campaignName}" -> Agency: "${agency}", Abbreviation: "${abbreviation}"`);
      }
      return result;
    }
    
    if (showDebugInfo) {
      console.log(`No match found for: "${campaignName}"`);
    }
    const result = { agency: "", abbreviation: "" };
    
    // Temporarily disable caching to prevent infinite loops
    // setCampaignCache(prev => new Map(prev).set(campaignName, {
    //   advertiser: '',
    //   agency: '',
    //   abbreviation: '',
    //   isTest: false
    // }));
    
    return result;
  }, [regexPatterns, campaignCache, showDebugInfo]);

  // Helper function to extract advertiser name from campaign name with caching
  const extractAdvertiserName = useCallback((campaignName: string): string => {
    if (!campaignName) return "";
    
    // Check cache first
    const cached = campaignCache.get(campaignName);
    if (cached && cached.advertiser) {
      return cached.advertiser;
    }
    
    if (showDebugInfo) {
      console.log(`Trying to extract advertiser from: "${campaignName}"`);
    }
    
    // Special case for Sol Flower
    if (campaignName.includes('Sol Flower')) {
      if (showDebugInfo) {
        console.log(`Found Sol Flower campaign: "${campaignName}"`);
      }
      
      // Temporarily disable caching to prevent infinite loops
      // setCampaignCache(prev => {
      //   const newCache = new Map(prev);
      //   const existing = newCache.get(campaignName) || { advertiser: '', agency: '', abbreviation: '', isTest: false };
      //   newCache.set(campaignName, { ...existing, advertiser: 'Sol Flower' });
      //   return newCache;
      // });
      
      return "Sol Flower";
    }
    
    // Handle "Awaiting IO" format
    if (campaignName.startsWith('Awaiting IO:')) {
      const awaitingIOMatch = campaignName.match(/^Awaiting IO:\s*[^:]+:\s*([^-]+)/);
      if (awaitingIOMatch?.[1]) {
        const extracted = awaitingIOMatch[1].trim();
        
        // Temporarily disable caching to prevent infinite loops
        // setCampaignCache(prev => {
        //   const newCache = new Map(prev);
        //   const existing = newCache.get(campaignName) || { advertiser: '', agency: '', abbreviation: '', isTest: false };
        //   newCache.set(campaignName, { ...existing, advertiser: extracted });
        //   return newCache;
        // });
        
        if (showDebugInfo) {
          console.log(`Awaiting IO format extraction result: "${extracted}" from "${campaignName}"`);
        }
        return extracted;
      }
    }
    
    // For the new format "2001367: HRB: District Cannabis-241217"
    const newFormatMatch = campaignName.match(regexPatterns.newFormat);
    if (newFormatMatch?.[1]) {
      const extracted = newFormatMatch[1].trim();
      
      setCampaignCache(prev => {
        const newCache = new Map(prev);
        const existing = newCache.get(campaignName) || { advertiser: '', agency: '', abbreviation: '', isTest: false };
        newCache.set(campaignName, { ...existing, advertiser: extracted });
        return newCache;
      });
      
      if (showDebugInfo) {
        console.log(`New format extraction result: "${extracted}" from "${campaignName}"`);
      }
      return extracted;
    }
    
    // For the new format without spaces "2002057:MJ:Kamu Karaoke-AIDA Models-DIS-250820"
    const newFormatNoSpaceMatch = campaignName.match(regexPatterns.newFormatNoSpace);
    if (newFormatNoSpaceMatch?.[1]) {
      const extracted = newFormatNoSpaceMatch[1].trim();
      
      setCampaignCache(prev => {
        const newCache = new Map(prev);
        const existing = newCache.get(campaignName) || { advertiser: '', agency: '', abbreviation: '', isTest: false };
        newCache.set(campaignName, { ...existing, advertiser: extracted });
        return newCache;
      });
      
      if (showDebugInfo) {
        console.log(`New format (no space) extraction result: "${extracted}" from "${campaignName}"`);
      }
      return extracted;
    }
    
    // Try with the expanded agency prefixes regex
    const match = campaignName.match(regexPatterns.agencyPrefixes);
    if (match?.[2]) {
      const extracted = match[2].trim();
      
      setCampaignCache(prev => {
        const newCache = new Map(prev);
        const existing = newCache.get(campaignName) || { advertiser: '', agency: '', abbreviation: '', isTest: false };
        newCache.set(campaignName, { ...existing, advertiser: extracted });
        return newCache;
      });
      
      if (showDebugInfo) {
        console.log(`Regex extraction result: "${extracted}" from "${campaignName}"`);
      }
      return extracted;
    }
    
    // Fallback to splitting by hyphen if the regex fails
    const agencyPrefixes = "SM|2RS|6D|BLO|CB|CN|FDD|FLD|FLWR|HD|HG|HRB|LP|MJ|NLMC|NP|OG|PRP|TCC|TF|TRN|W&T|WWX";
    const prefixMatch = campaignName.match(new RegExp(`^(${agencyPrefixes}):`));
    if (prefixMatch && campaignName.includes('-')) {
      const parts = campaignName.split('-');
      const firstPart = parts[0].trim();
      
      const colonIndex = firstPart.indexOf(':');
      if (colonIndex !== -1) {
        const extracted = firstPart.substring(colonIndex + 1).trim();
        
        // Temporarily disable caching to prevent infinite loops
        // setCampaignCache(prev => {
        //   const newCache = new Map(prev);
        //   const existing = newCache.get(campaignName) || { advertiser: '', agency: '', abbreviation: '', isTest: false };
        //   newCache.set(campaignName, { ...existing, advertiser: extracted });
        //   return newCache;
        // });
        
        if (showDebugInfo) {
          console.log(`Fallback extraction result: "${extracted}" from "${campaignName}"`);
        }
        return extracted;
      }
    }
    
    if (showDebugInfo) {
      console.log(`Failed to extract advertiser from: "${campaignName}"`);
    }
    
    // Temporarily disable caching to prevent infinite loops
    // setCampaignCache(prev => {
    //   const newCache = new Map(prev);
    //   const existing = newCache.get(campaignName) || { advertiser: '', agency: '', abbreviation: '', isTest: false };
    //   newCache.set(campaignName, { ...existing, advertiser: '' });
    //   return newCache;
    // });
    
    return "";
  }, [regexPatterns, campaignCache, showDebugInfo]);

  // Helper function to check if a campaign is a test/demo/draft campaign with caching
  const isTestCampaign = useCallback((campaignName: string): boolean => {
    if (!campaignName) return false;
    
    // Check cache first
    const cached = campaignCache.get(campaignName);
    if (cached && cached.isTest !== undefined) {
      return cached.isTest;
    }
    
    const lowerCaseName = campaignName.toLowerCase();
    
    // Check for test/demo/draft keywords
    let isTest = false;
    if (lowerCaseName.includes('test') || 
        lowerCaseName.includes('demo') || 
        lowerCaseName.includes('draft')) {
      isTest = true;
    } else {
      // Check for TST agency abbreviation
      const { abbreviation } = extractAgencyInfo(campaignName);
      if (abbreviation === 'TST') {
        isTest = true;
      }
    }
    
    // Temporarily disable caching to prevent infinite loops
    // setCampaignCache(prev => {
    //   const newCache = new Map(prev);
    //   const existing = newCache.get(campaignName) || { advertiser: '', agency: '', abbreviation: '', isTest: false };
    //   newCache.set(campaignName, { ...existing, isTest });
    //   return newCache;
    // });
    
    return isTest;
  }, [campaignCache, extractAgencyInfo]);

  // Log some test cases for debugging
  useEffect(() => {
    if (showDebugInfo) {
      console.log("Testing agency extraction with problematic cases:");
      const problemCases = [
        "2001569/2001963: MJ: Test Client-Campaign Name-250501",
        "2001567/2001103: MJ: Mankind Dispensary-Concerts/Gamers-250404",
        "2001216/2001505: NLMC: Strawberry Fields-Pueblo North-250411",
      ];
      
      problemCases.forEach(test => {
        const agencyInfo = extractAgencyInfo(test);
        console.log(`Problem case: "${test}" -> Agency: "${agencyInfo.agency}", Abbreviation: "${agencyInfo.abbreviation}"`);
      });
    }
  }, [extractAgencyInfo, showDebugInfo]);

  return (
    <CampaignFilterContext.Provider value={{ 
      showLiveOnly, 
      setShowLiveOnly,
      showAggregatedSparkCharts,
      setShowAggregatedSparkCharts,
      showDebugInfo,
      setShowDebugInfo,
      extractAdvertiserName,
      extractAgencyInfo,
      isTestCampaign,
      clearCache
    }}>
      {children}
    </CampaignFilterContext.Provider>
  );
}

export function useCampaignFilter() {
  const context = useContext(CampaignFilterContext);
  if (context === undefined) {
    throw new Error('useCampaignFilter must be used within a CampaignFilterProvider');
  }
  return context;
}