import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Calculator, DollarSign, TrendingDown, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import { RecalculationPreview } from '@/utils/dataRecalculation';

interface RecalculationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: RecalculationPreview | null;
  isLoading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isApplying: boolean;
}

const RecalculationModal: React.FC<RecalculationModalProps> = ({
  open,
  onOpenChange,
  preview,
  isLoading,
  onConfirm,
  onCancel,
  isApplying
}) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <div className="text-center">
              <h3 className="font-semibold">Analyzing Data</h3>
              <p className="text-sm text-muted-foreground">Generating recalculation preview...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!preview) {
    return null;
  }

  const totalOriginalSpend = preview.orangellowCorrections.totalOriginalSpend + preview.manualCpmCorrections.totalOriginalSpend;
  const totalCorrectedSpend = preview.orangellowCorrections.totalCorrectedSpend + preview.manualCpmCorrections.totalCorrectedSpend;
  const totalSavings = totalOriginalSpend - totalCorrectedSpend;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Recalculation Preview
          </DialogTitle>
          <DialogDescription>
            Review the changes that will be applied to your campaign data. All corrections use updated CPM rates.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Total Campaigns</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(preview.totalRows)}</div>
                <p className="text-sm text-muted-foreground">
                  {formatNumber(preview.affectedRows)} will be updated
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Spend Impact</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(Math.abs(totalSavings))}
                </div>
                <p className="text-sm text-muted-foreground">
                  {totalSavings > 0 ? 'Spend reduction' : 'Spend increase'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Correction Types</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {preview.orangellowCorrections.count > 0 && (
                    <Badge variant="secondary" className="mr-1">
                      {preview.orangellowCorrections.count} Orangellow
                    </Badge>
                  )}
                  {preview.manualCpmCorrections.count > 0 && (
                    <Badge variant="secondary">
                      {preview.manualCpmCorrections.count} Manual CPM
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Tabs */}
          <Tabs defaultValue="summary" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="campaigns">Campaign Details</TabsTrigger>
              <TabsTrigger value="breakdown">Type Breakdown</TabsTrigger>
            </TabsList>

            <TabsContent value="summary" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {preview.orangellowCorrections.count > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Orangellow Corrections</CardTitle>
                      <CardDescription>SM and OG campaigns recalculated at $7 CPM</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between">
                        <span>Campaigns affected:</span>
                        <span className="font-semibold">{formatNumber(preview.orangellowCorrections.count)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Original spend:</span>
                        <span>{formatCurrency(preview.orangellowCorrections.totalOriginalSpend)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Corrected spend:</span>
                        <span>{formatCurrency(preview.orangellowCorrections.totalCorrectedSpend)}</span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span>Difference:</span>
                        <span className={preview.orangellowCorrections.totalCorrectedSpend < preview.orangellowCorrections.totalOriginalSpend ? 'text-green-600' : 'text-red-600'}>
                          {formatCurrency(preview.orangellowCorrections.totalCorrectedSpend - preview.orangellowCorrections.totalOriginalSpend)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {preview.manualCpmCorrections.count > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Manual CPM Corrections</CardTitle>
                      <CardDescription>Campaign-specific CPM adjustments</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between">
                        <span>Campaigns affected:</span>
                        <span className="font-semibold">{formatNumber(preview.manualCpmCorrections.count)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Original spend:</span>
                        <span>{formatCurrency(preview.manualCpmCorrections.totalOriginalSpend)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Corrected spend:</span>
                        <span>{formatCurrency(preview.manualCpmCorrections.totalCorrectedSpend)}</span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span>Difference:</span>
                        <span className={preview.manualCpmCorrections.totalCorrectedSpend < preview.manualCpmCorrections.totalOriginalSpend ? 'text-green-600' : 'text-red-600'}>
                          {formatCurrency(preview.manualCpmCorrections.totalCorrectedSpend - preview.manualCpmCorrections.totalOriginalSpend)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="campaigns">
              <Card>
                <CardHeader>
                  <CardTitle>Campaign Changes</CardTitle>
                  <CardDescription>
                    Detailed view of spend changes for each affected campaign
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-64">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Campaign Name</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>CPM Rate</TableHead>
                          <TableHead className="text-right">Original Spend</TableHead>
                          <TableHead className="text-right">New Spend</TableHead>
                          <TableHead className="text-right">Difference</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.campaignChanges.map((change, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium max-w-xs truncate">
                              {change.campaignName}
                            </TableCell>
                            <TableCell>
                              <Badge variant={change.correctionType === 'orangellow' ? 'default' : 'secondary'}>
                                {change.correctionType === 'orangellow' ? 'Orangellow' : change.identifier}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              ${change.cpmRate?.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(change.originalSpend)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(change.correctedSpend)}
                            </TableCell>
                            <TableCell className="text-right">
                              <span className={change.difference < 0 ? 'text-green-600' : 'text-red-600'}>
                                {change.difference < 0 ? (
                                  <TrendingDown className="inline h-3 w-3 mr-1" />
                                ) : (
                                  <TrendingUp className="inline h-3 w-3 mr-1" />
                                )}
                                {formatCurrency(Math.abs(change.difference))}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="breakdown">
              <div className="space-y-4">
                {Object.entries(preview.manualCpmCorrections.byType).map(([identifier, details]) => (
                  <Card key={identifier}>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Badge variant="secondary">{identifier}</Badge>
                        <span className="text-sm font-normal">
                          ${details.cpm} CPM
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground">Campaigns</div>
                          <div className="font-semibold">{formatNumber(details.count)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Original Spend</div>
                          <div className="font-semibold">{formatCurrency(details.originalSpend)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Corrected Spend</div>
                          <div className="font-semibold">{formatCurrency(details.correctedSpend)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Difference</div>
                          <div className={`font-semibold ${details.correctedSpend < details.originalSpend ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(details.correctedSpend - details.originalSpend)}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mr-auto">
            <AlertTriangle className="h-4 w-4" />
            This will update your database with corrected spend values
          </div>
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isApplying}
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isApplying || preview.affectedRows === 0}
            className="flex items-center gap-2"
          >
            {isApplying ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Applying Changes...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4" />
                Apply Corrections ({formatNumber(preview.affectedRows)} campaigns)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RecalculationModal;