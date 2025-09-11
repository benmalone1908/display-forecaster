import React, { useState, useMemo } from 'react';
import { format, differenceInDays } from 'date-fns';
import { Clock, Activity, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Filter } from 'lucide-react';
import { parseDateString, setToEndOfDay, setToStartOfDay } from '@/lib/utils';

interface ContractTerms {
  Name: string;
  'Start Date': string;
  'End Date': string;
  Budget: string;
  CPM: string;
  'Impressions Goal': string;
}

interface CampaignStatus {
  name: string;
  startDate: Date | null;
  endDate: Date;
  daysRemaining: number;
  autoStatus: 'live' | 'attribution' | 'ended';
}

interface StatusTabProps {
  contractTermsData: ContractTerms[];
  deliveryData: any[];
  globalMostRecentDate?: Date;
  className?: string;
}

type SortField = 'name' | 'startDate' | 'endDate' | 'daysRemaining';
type SortDirection = 'asc' | 'desc';

const StatusTab: React.FC<StatusTabProps> = ({
  contractTermsData,
  deliveryData,
  globalMostRecentDate,
  className = '',
}) => {
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [hiddenStatuses, setHiddenStatuses] = useState<Set<string>>(new Set());

  const campaignStatuses = useMemo<CampaignStatus[]>(() => {
    // Always use today's date for status calculation, not the most recent data date
    const referenceDate = new Date();
    const campaigns: CampaignStatus[] = [];
    
    // Get all unique campaign names from delivery data
    const deliveryCampaigns = new Map<string, { lastDate: Date; hasRecentData: boolean }>();
    
    // Find the most recent date in delivery data
    let mostRecentDeliveryDate: Date | null = null;
    const deliveryDates = deliveryData
      .map(row => parseDateString(row.DATE))
      .filter(Boolean)
      .sort((a, b) => b!.getTime() - a!.getTime());
    
    if (deliveryDates.length > 0) {
      mostRecentDeliveryDate = deliveryDates[0]!;
    }
    
    // Process delivery data to get campaign info
    deliveryData.forEach(row => {
      const campaignName = row['CAMPAIGN ORDER NAME'];
      const dateStr = row.DATE;
      if (!campaignName || !dateStr || dateStr === 'Totals') return;
      
      const rowDate = parseDateString(dateStr);
      if (!rowDate) return;
      
      const existing = deliveryCampaigns.get(campaignName);
      if (!existing || rowDate > existing.lastDate) {
        const hasRecentData = mostRecentDeliveryDate ? 
          differenceInDays(mostRecentDeliveryDate, rowDate) === 0 : false;
        
        deliveryCampaigns.set(campaignName, {
          lastDate: rowDate,
          hasRecentData
        });
      }
    });
    
    // First, process campaigns that have contract terms
    contractTermsData.forEach((contract) => {
      const startDate = parseDateString(contract['Start Date']);
      const endDate = parseDateString(contract['End Date']);
      
      if (!startDate || !endDate) {
        console.warn(`Invalid dates for campaign ${contract.Name}: start=${contract['Start Date']}, end=${contract['End Date']}`);
        return;
      }

      // Calculate days remaining from reference date to end date
      // Use end of day for end date to match paging logic
      const endOfDayEndDate = setToEndOfDay(endDate);
      const startOfDayReferenceDate = setToStartOfDay(referenceDate);
      const daysRemaining = Math.max(0, differenceInDays(endOfDayEndDate, startOfDayReferenceDate));
      
      // Determine automatic status using same end-of-day logic
      let autoStatus: 'live' | 'attribution' | 'ended';
      const daysSinceEnd = differenceInDays(startOfDayReferenceDate, endOfDayEndDate);
      
      if (daysSinceEnd < 0) {
        // Campaign hasn't ended yet (end date is in the future)
        autoStatus = 'live';
      } else if (daysSinceEnd <= 30) {
        // Campaign ended within last 30 days
        autoStatus = 'attribution';
      } else {
        // Campaign ended more than 30 days ago
        autoStatus = 'ended';
      }

      campaigns.push({
        name: contract.Name,
        startDate,
        endDate,
        daysRemaining,
        autoStatus,
      });
    });
    
    // Then, process campaigns from delivery data that don't have contract terms
    deliveryCampaigns.forEach((deliveryInfo, campaignName) => {
      // Skip if this campaign already has contract terms
      if (contractTermsData.some(contract => contract.Name === campaignName)) {
        return;
      }
      
      // For campaigns without contract terms, determine status based on delivery data
      const daysSinceLastData = differenceInDays(setToStartOfDay(referenceDate), setToEndOfDay(deliveryInfo.lastDate));
      
      let autoStatus: 'live' | 'attribution' | 'ended';
      if (deliveryInfo.hasRecentData) {
        // Has data for most recent date - mark as attribution
        autoStatus = 'attribution';
      } else if (daysSinceLastData <= 30) {
        // Last data within 30 days - mark as attribution  
        autoStatus = 'attribution';
      } else {
        // More than 30 days since last data - mark as ended
        autoStatus = 'ended';
      }
      
      // For campaigns without contract terms, calculate days remaining from last impression date
      const endOfDayEndDate = setToEndOfDay(deliveryInfo.lastDate);
      const startOfDayReferenceDate = setToStartOfDay(referenceDate);
      const daysRemaining = Math.max(0, differenceInDays(endOfDayEndDate, startOfDayReferenceDate));
      
      campaigns.push({
        name: campaignName,
        startDate: null, // No contract terms, so we don't know the actual start date
        endDate: deliveryInfo.lastDate,   // Use last impression date as end date
        daysRemaining, // Calculate days remaining from last impression date
        autoStatus,
      });
    });
    
    return campaigns;
  }, [contractTermsData, deliveryData]);

  // Sort the campaign statuses based on current sort field and direction
  const sortedCampaignStatuses = useMemo(() => {
    const sorted = [...campaignStatuses].sort((a, b) => {
      let valueA: any;
      let valueB: any;

      switch (sortField) {
        case 'name':
          valueA = a.name.toLowerCase();
          valueB = b.name.toLowerCase();
          break;
        case 'startDate':
          // Handle null start dates - put them at the end
          if (a.startDate === null && b.startDate === null) return 0;
          if (a.startDate === null) return sortDirection === 'asc' ? 1 : -1;
          if (b.startDate === null) return sortDirection === 'asc' ? -1 : 1;
          valueA = a.startDate.getTime();
          valueB = b.startDate.getTime();
          break;
        case 'endDate':
          valueA = a.endDate.getTime();
          valueB = b.endDate.getTime();
          break;
        case 'daysRemaining':
          valueA = a.daysRemaining;
          valueB = b.daysRemaining;
          break;
        default:
          return 0;
      }

      if (valueA < valueB) return sortDirection === 'asc' ? -1 : 1;
      if (valueA > valueB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [campaignStatuses, sortField, sortDirection]);

  // Filter campaigns based on hidden statuses
  const filteredCampaignStatuses = useMemo(() => {
    return sortedCampaignStatuses.filter(campaign => 
      !hiddenStatuses.has(campaign.autoStatus)
    );
  }, [sortedCampaignStatuses, hiddenStatuses]);


  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-4 h-4 text-gray-400" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-4 h-4 text-gray-600" />
      : <ArrowDown className="w-4 h-4 text-gray-600" />;
  };

  const handleStatusFilterChange = (status: string, checked: boolean) => {
    const newHiddenStatuses = new Set(hiddenStatuses);
    if (checked) {
      newHiddenStatuses.delete(status);
    } else {
      newHiddenStatuses.add(status);
    }
    setHiddenStatuses(newHiddenStatuses);
  };

  const getStatusBadge = (campaign: CampaignStatus) => {
    const currentStatus = campaign.autoStatus;
    
    const statusConfig = {
      live: { color: 'bg-green-100 text-green-800', icon: Activity },
      attribution: { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
      ended: { color: 'bg-red-100 text-red-800', icon: Clock },
    };

    const config = statusConfig[currentStatus];
    const Icon = config.icon;

    return (
      <Badge className={`${config.color} border-0 capitalize`}>
        <Icon className="w-3 h-3 mr-1" />
        {currentStatus}
      </Badge>
    );
  };

  const formatDate = (date: Date) => {
    return format(date, 'MM/dd/yyyy');
  };

  // Debug logging
  console.log('StatusTab received contractTermsData:', contractTermsData.length, 'campaigns');
  
  if (contractTermsData.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center py-12 text-center ${className}`}>
        <Clock className="w-12 h-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Campaign Data</h3>
        <p className="text-gray-500 max-w-sm">
          No campaigns match the current filters. Try adjusting your global filters or upload contract terms data.
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Campaign Status Management</h2>
        <div className="flex items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Filter Status
                {hiddenStatuses.size > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary/10 text-primary rounded">
                    {hiddenStatuses.size}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuCheckboxItem
                checked={!hiddenStatuses.has('live')}
                onCheckedChange={(checked) => handleStatusFilterChange('live', checked)}
              >
                Show Live
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={!hiddenStatuses.has('attribution')}
                onCheckedChange={(checked) => handleStatusFilterChange('attribution', checked)}
              >
                Show Attribution
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={!hiddenStatuses.has('ended')}
                onCheckedChange={(checked) => handleStatusFilterChange('ended', checked)}
              >
                Show Ended
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="text-sm text-gray-500">
            {filteredCampaignStatuses.length} of {sortedCampaignStatuses.length} campaigns • Reference: {format(new Date(), 'MM/dd/yyyy')}
          </div>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead 
                className="font-semibold cursor-pointer hover:bg-gray-50 select-none"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center gap-2">
                  Campaign Name
                  {getSortIcon('name')}
                </div>
              </TableHead>
              <TableHead 
                className="font-semibold cursor-pointer hover:bg-gray-50 select-none"
                onClick={() => handleSort('startDate')}
              >
                <div className="flex items-center gap-2">
                  Start Date
                  {getSortIcon('startDate')}
                </div>
              </TableHead>
              <TableHead 
                className="font-semibold cursor-pointer hover:bg-gray-50 select-none"
                onClick={() => handleSort('endDate')}
              >
                <div className="flex items-center gap-2">
                  End Date
                  {getSortIcon('endDate')}
                </div>
              </TableHead>
              <TableHead 
                className="font-semibold text-center cursor-pointer hover:bg-gray-50 select-none"
                onClick={() => handleSort('daysRemaining')}
              >
                <div className="flex items-center justify-center gap-2">
                  Days Remaining
                  {getSortIcon('daysRemaining')}
                </div>
              </TableHead>
              <TableHead className="font-semibold">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCampaignStatuses.map((campaign) => (
              <TableRow key={campaign.name} className="hover:bg-gray-50">
                <TableCell className="font-medium max-w-xs">
                  <div className="truncate" title={campaign.name}>
                    {campaign.name}
                  </div>
                </TableCell>
                <TableCell>{campaign.startDate ? formatDate(campaign.startDate) : ''}</TableCell>
                <TableCell>{formatDate(campaign.endDate)}</TableCell>
                <TableCell className="text-center">
                  <span className={`inline-block px-2 py-1 rounded text-sm ${
                    campaign.daysRemaining > 0 
                      ? 'bg-blue-100 text-blue-800' 
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {campaign.daysRemaining > 0 ? `${campaign.daysRemaining} days` : '0 days'}
                  </span>
                </TableCell>
                <TableCell>{getStatusBadge(campaign)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-500 pt-4 border-t">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>Live ({sortedCampaignStatuses.filter(c => c.autoStatus === 'live').length})</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
            <span>Attribution ({sortedCampaignStatuses.filter(c => c.autoStatus === 'attribution').length})</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            <span>Ended ({sortedCampaignStatuses.filter(c => c.autoStatus === 'ended').length})</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatusTab;