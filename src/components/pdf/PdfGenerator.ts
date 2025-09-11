import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { PdfExportOptions, PdfExportSettings } from './types';

export class PdfGenerator {
  private pdf: jsPDF;
  private settings: PdfExportSettings;
  private pageWidth: number;
  private pageHeight: number;
  private margin: number = 20;
  private currentY: number = 20;

  constructor(settings: PdfExportSettings) {
    this.settings = settings;
    this.pdf = new jsPDF({
      orientation: settings.orientation,
      unit: 'mm',
      format: settings.pageSize,
    });

    // Set page dimensions
    if (settings.pageSize === 'a4') {
      this.pageWidth = settings.orientation === 'portrait' ? 210 : 297;
      this.pageHeight = settings.orientation === 'portrait' ? 297 : 210;
    } else {
      this.pageWidth = settings.orientation === 'portrait' ? 215.9 : 279.4;
      this.pageHeight = settings.orientation === 'portrait' ? 279.4 : 215.9;
    }
  }

  async generatePdf(options: PdfExportOptions): Promise<void> {
    try {
      // Add title page
      this.addTitlePage(options);

      // Add export information
      if (options.settings.includeFilters || options.settings.includeDateRange) {
        this.addExportInfo(options);
      }

      // Generate charts
      for (const chartId of options.selectedCharts) {
        await this.addChartSection(chartId);
      }

      // Add page numbers
      this.addPageNumbers();

    } catch (error) {
      console.error('Error generating PDF:', error);
      throw error;
    }
  }

  private addTitlePage(options: PdfExportOptions): void {
    this.pdf.setFontSize(24);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('Campaign Analytics Report', this.pageWidth / 2, 40, { align: 'center' });

    this.pdf.setFontSize(12);
    this.pdf.setFont('helvetica', 'normal');
    const date = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    this.pdf.text(`Generated on ${date}`, this.pageWidth / 2, 55, { align: 'center' });

    this.currentY = 80;
  }

  private addExportInfo(options: PdfExportOptions): void {
    this.pdf.setFontSize(14);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('Report Parameters', this.margin, this.currentY);
    this.currentY += 10;

    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'normal');

    if (options.settings.includeDateRange && options.dateRange) {
      const fromDate = options.dateRange.from.toLocaleDateString();
      const toDate = options.dateRange.to?.toLocaleDateString() || 'Present';
      this.pdf.text(`Date Range: ${fromDate} - ${toDate}`, this.margin, this.currentY);
      this.currentY += 6;
    }

    if (options.settings.includeFilters && options.appliedFilters) {
      const filters = options.appliedFilters;
      
      if (filters.agencies.length > 0) {
        this.pdf.text(`Agencies: ${filters.agencies.join(', ')}`, this.margin, this.currentY);
        this.currentY += 6;
      }
      
      if (filters.advertisers.length > 0) {
        this.pdf.text(`Advertisers: ${filters.advertisers.join(', ')}`, this.margin, this.currentY);
        this.currentY += 6;
      }
      
      if (filters.campaigns.length > 0) {
        this.pdf.text(`Campaigns: ${filters.campaigns.slice(0, 5).join(', ')}${filters.campaigns.length > 5 ? ` and ${filters.campaigns.length - 5} more...` : ''}`, this.margin, this.currentY);
        this.currentY += 6;
      }
    }

    this.currentY += 10;
  }

  private async addChartSection(chartId: string): Promise<void> {
    const element = document.getElementById(chartId);
    if (!element) {
      console.warn(`Chart element with ID '${chartId}' not found`);
      return;
    }

    try {
      // Wait for any animations to complete
      await this.waitForAnimations(500);

      // Capture the chart
      const canvas = await html2canvas(element, {
        scale: this.settings.quality,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      // Calculate dimensions
      const imgWidth = this.pageWidth - (2 * this.margin);
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      // Check if we need a new page
      if (this.currentY + imgHeight > this.pageHeight - this.margin) {
        this.pdf.addPage();
        this.currentY = this.margin;
      }

      // Add chart title
      const chartTitle = this.getChartTitle(chartId);
      if (chartTitle) {
        this.pdf.setFontSize(12);
        this.pdf.setFont('helvetica', 'bold');
        this.pdf.text(chartTitle, this.margin, this.currentY);
        this.currentY += 10;
      }

      // Add the image
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      this.pdf.addImage(imgData, 'JPEG', this.margin, this.currentY, imgWidth, imgHeight);
      this.currentY += imgHeight + 15;

    } catch (error) {
      console.error(`Error capturing chart ${chartId}:`, error);
      // Add error message to PDF
      this.pdf.setFontSize(10);
      this.pdf.setTextColor(255, 0, 0);
      this.pdf.text(`Error capturing chart: ${chartId}`, this.margin, this.currentY);
      this.pdf.setTextColor(0, 0, 0);
      this.currentY += 10;
    }
  }

  private getChartTitle(chartId: string): string | null {
    const titles: Record<string, string> = {
      'dashboard-metrics': 'Dashboard Metrics Overview',
      'dashboard-weekly': 'Weekly Performance Comparison',
      'spark-charts': 'Campaign Trend Analysis',
      'health-scatter': 'Campaign Health Analysis',
      'health-methodology': 'Health Scoring Methodology',
      'pacing-table': 'Campaign Pacing Analysis',
      'pacing-metrics': 'Pacing Performance Metrics',
      'raw-data-table': 'Raw Data Summary',
    };

    return titles[chartId] || null;
  }

  private waitForAnimations(delay: number = 500): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  private addPageNumbers(): void {
    const pageCount = this.pdf.internal.getNumberOfPages();
    
    for (let i = 1; i <= pageCount; i++) {
      this.pdf.setPage(i);
      this.pdf.setFontSize(8);
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.text(
        `Page ${i} of ${pageCount}`,
        this.pageWidth / 2,
        this.pageHeight - 10,
        { align: 'center' }
      );
    }
  }

  save(filename: string): void {
    this.pdf.save(filename);
  }

  getBlob(): Blob {
    return this.pdf.output('blob');
  }
}