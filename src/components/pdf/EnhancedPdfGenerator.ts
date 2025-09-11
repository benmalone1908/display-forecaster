import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { 
  ChartInstance, 
  PdfConfiguration, 
  PdfGlobalSettings, 
  DataProcessingResult,
  getTemplateById 
} from './enhanced-types';
import { DataProcessingEngine } from './DataProcessingEngine';

interface ChartRenderResult {
  instance: ChartInstance;
  canvas: HTMLCanvasElement;
  metadata: {
    width: number;
    height: number;
    dataRowCount: number;
    dateRange: string;
  };
}

export class EnhancedPdfGenerator {
  private pdf: jsPDF;
  private settings: PdfGlobalSettings;
  private dataEngine: DataProcessingEngine;
  private pageWidth: number;
  private pageHeight: number;
  private margin: number = 20;
  private currentY: number = 20;
  private tempContainer: HTMLElement | null = null;

  constructor(settings: PdfGlobalSettings, dataEngine: DataProcessingEngine) {
    this.settings = settings;
    this.dataEngine = dataEngine;
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

  async generatePdf(configuration: PdfConfiguration): Promise<void> {
    try {
      // Create temporary container for rendering charts
      this.createTempContainer();

      // Add title page
      this.addTitlePage(configuration);

      // Add table of contents if enabled
      if (this.settings.includeTableOfContents) {
        this.addTableOfContents(configuration.instances);
      }

      // Add summary if enabled
      if (this.settings.includeSummary) {
        await this.addExecutiveSummary(configuration.instances);
      }

      // Render and add each chart instance
      for (const instance of configuration.instances) {
        await this.addChartInstance(instance);
        
        if (this.settings.pageBreakBetweenCharts) {
          this.pdf.addPage();
          this.currentY = this.margin;
        }
      }

      // Add page numbers
      this.addPageNumbers();

      // Cleanup
      this.cleanupTempContainer();

    } catch (error) {
      console.error('Error generating enhanced PDF:', error);
      this.cleanupTempContainer();
      throw error;
    }
  }

  private createTempContainer(): void {
    this.tempContainer = document.createElement('div');
    this.tempContainer.style.position = 'fixed';
    this.tempContainer.style.top = '-10000px';
    this.tempContainer.style.left = '-10000px';
    this.tempContainer.style.width = '1200px';
    this.tempContainer.style.height = '800px';
    this.tempContainer.style.backgroundColor = 'white';
    this.tempContainer.style.zIndex = '-1000';
    document.body.appendChild(this.tempContainer);
  }

  private cleanupTempContainer(): void {
    if (this.tempContainer && this.tempContainer.parentNode) {
      this.tempContainer.parentNode.removeChild(this.tempContainer);
      this.tempContainer = null;
    }
  }

  private addTitlePage(configuration: PdfConfiguration): void {
    this.pdf.setFontSize(24);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('Custom Campaign Analytics Report', this.pageWidth / 2, 40, { align: 'center' });

    this.pdf.setFontSize(12);
    this.pdf.setFont('helvetica', 'normal');
    const date = configuration.metadata.generatedAt.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    this.pdf.text(`Generated on ${date}`, this.pageWidth / 2, 55, { align: 'center' });

    // Add metadata
    if (configuration.metadata.description) {
      this.pdf.setFontSize(10);
      this.pdf.text(configuration.metadata.description, this.pageWidth / 2, 70, { 
        align: 'center',
        maxWidth: this.pageWidth - (2 * this.margin)
      });
    }

    // Add chart count
    this.pdf.setFontSize(14);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text(`${configuration.instances.length} Custom Charts`, this.pageWidth / 2, 90, { align: 'center' });

    this.currentY = 110;
  }

  private addTableOfContents(instances: ChartInstance[]): void {
    this.pdf.addPage();
    this.currentY = this.margin;

    this.pdf.setFontSize(18);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('Table of Contents', this.margin, this.currentY);
    this.currentY += 15;

    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'normal');

    instances.forEach((instance, index) => {
      const template = getTemplateById(instance.templateId);
      const title = `${index + 1}. ${instance.name}`;
      const description = template?.description || 'Custom chart';
      
      this.pdf.text(title, this.margin, this.currentY);
      this.currentY += 5;
      this.pdf.setTextColor(128, 128, 128);
      this.pdf.text(description, this.margin + 5, this.currentY);
      this.pdf.setTextColor(0, 0, 0);
      this.currentY += 8;
    });

    this.currentY += 10;
  }

  private async addExecutiveSummary(instances: ChartInstance[]): Promise<void> {
    this.pdf.addPage();
    this.currentY = this.margin;

    this.pdf.setFontSize(18);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('Executive Summary', this.margin, this.currentY);
    this.currentY += 15;

    // Generate summary statistics
    const summaryStats = await this.generateSummaryStats(instances);
    
    this.pdf.setFontSize(10);
    this.pdf.setFont('helvetica', 'normal');

    // Total data points
    this.pdf.text(`Total Data Points: ${summaryStats.totalRows.toLocaleString()}`, this.margin, this.currentY);
    this.currentY += 8;

    // Date range
    this.pdf.text(`Date Range: ${summaryStats.dateRange.from} - ${summaryStats.dateRange.to}`, this.margin, this.currentY);
    this.currentY += 8;

    // Chart breakdown
    this.pdf.text(`Charts Included: ${instances.length}`, this.margin, this.currentY);
    this.currentY += 8;

    // Top metrics (if available)
    if (summaryStats.topMetrics.length > 0) {
      this.currentY += 5;
      this.pdf.setFont('helvetica', 'bold');
      this.pdf.text('Key Insights:', this.margin, this.currentY);
      this.currentY += 8;

      this.pdf.setFont('helvetica', 'normal');
      summaryStats.topMetrics.forEach(metric => {
        this.pdf.text(`• ${metric}`, this.margin + 5, this.currentY);
        this.currentY += 6;
      });
    }

    this.currentY += 10;
  }

  private async generateSummaryStats(instances: ChartInstance[]): Promise<{
    totalRows: number;
    dateRange: { from: string; to: string };
    topMetrics: string[];
  }> {
    let totalRows = 0;
    let earliestDate: Date | null = null;
    let latestDate: Date | null = null;
    const metrics: string[] = [];

    for (const instance of instances) {
      try {
        const result = this.dataEngine.processInstanceData(instance);
        totalRows += result.summary.totalRows;

        if (!earliestDate || result.summary.dateRange.from < earliestDate) {
          earliestDate = result.summary.dateRange.from;
        }
        if (!latestDate || result.summary.dateRange.to > latestDate) {
          latestDate = result.summary.dateRange.to;
        }

        // Add key insights
        if (result.summary.metrics.IMPRESSIONS_total > 1000000) {
          metrics.push(`${instance.name}: Over 1M impressions`);
        }
        if (result.summary.metrics.ROAS > 3) {
          metrics.push(`${instance.name}: Strong ROAS (${result.summary.metrics.ROAS.toFixed(2)}x)`);
        }
      } catch (error) {
        console.error(`Error processing instance ${instance.id}:`, error);
      }
    }

    return {
      totalRows,
      dateRange: {
        from: earliestDate?.toLocaleDateString() || 'Unknown',
        to: latestDate?.toLocaleDateString() || 'Unknown'
      },
      topMetrics: metrics.slice(0, 5) // Top 5 insights
    };
  }

  private async addChartInstance(instance: ChartInstance): Promise<void> {
    try {
      // Process data for this instance
      const result = this.dataEngine.processInstanceData(instance);
      
      // Render the chart
      const renderResult = await this.renderChartInstance(instance, result);
      
      // Add to PDF
      await this.addRenderedChart(renderResult);
      
    } catch (error) {
      console.error(`Error adding chart instance ${instance.id}:`, error);
      // Add error message to PDF
      this.addErrorMessage(instance, error as Error);
    }
  }

  private async renderChartInstance(instance: ChartInstance, data: DataProcessingResult): Promise<ChartRenderResult> {
    if (!this.tempContainer) {
      throw new Error('Temporary container not initialized');
    }

    // Create chart element based on template type
    const chartElement = await this.createChartElement(instance, data);
    this.tempContainer.appendChild(chartElement);

    // Wait for rendering
    await this.waitForAnimations(500);

    // Capture with html2canvas
    const canvas = await html2canvas(chartElement, {
      scale: this.settings.quality,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    // Clean up
    this.tempContainer.removeChild(chartElement);

    return {
      instance,
      canvas,
      metadata: {
        width: canvas.width,
        height: canvas.height,
        dataRowCount: data.summary.totalRows,
        dateRange: `${data.summary.dateRange.from.toLocaleDateString()} - ${data.summary.dateRange.to.toLocaleDateString()}`
      }
    };
  }

  private async createChartElement(instance: ChartInstance, data: DataProcessingResult): Promise<HTMLElement> {
    const template = getTemplateById(instance.templateId);
    if (!template) {
      throw new Error(`Template not found: ${instance.templateId}`);
    }

    // Create container
    const container = document.createElement('div');
    container.style.width = '1000px';
    container.style.height = `${instance.settings.chartHeight || 400}px`;
    container.style.padding = '20px';
    container.style.backgroundColor = 'white';
    container.style.fontFamily = 'system-ui, -apple-system, sans-serif';

    // Add title
    const title = document.createElement('h2');
    title.textContent = instance.name;
    title.style.margin = '0 0 16px 0';
    title.style.fontSize = '18px';
    title.style.fontWeight = 'bold';
    container.appendChild(title);

    // Add data summary
    const summary = document.createElement('div');
    summary.style.marginBottom = '16px';
    summary.style.fontSize = '12px';
    summary.style.color = '#666';
    summary.innerHTML = `
      <div>Data Points: ${data.summary.totalRows.toLocaleString()}</div>
      <div>Date Range: ${data.summary.dateRange.from.toLocaleDateString()} - ${data.summary.dateRange.to.toLocaleDateString()}</div>
    `;
    container.appendChild(summary);

    // Create chart based on template type
    if (template.id.startsWith('metric_')) {
      await this.createMetricChart(container, instance, data);
    } else if (template.id.startsWith('trend_')) {
      await this.createTrendChart(container, instance, data);
    } else if (template.id.startsWith('analysis_')) {
      await this.createAnalysisChart(container, instance, data);
    } else {
      await this.createDataTable(container, instance, data);
    }

    return container;
  }

  private async createMetricChart(container: HTMLElement, instance: ChartInstance, data: DataProcessingResult): Promise<void> {
    // Create metric display
    const metricType = instance.templateId.replace('metric_', '').toUpperCase();
    const value = data.summary.metrics[`${metricType}_total`] || 0;
    
    const metricDiv = document.createElement('div');
    metricDiv.style.textAlign = 'center';
    metricDiv.style.padding = '40px';
    metricDiv.style.border = '2px solid #e5e7eb';
    metricDiv.style.borderRadius = '8px';
    metricDiv.innerHTML = `
      <div style="font-size: 48px; font-weight: bold; color: #1f2937; margin-bottom: 8px;">
        ${this.formatMetricValue(metricType, value)}
      </div>
      <div style="font-size: 16px; color: #6b7280;">
        Total ${metricType.toLowerCase().replace('_', ' ')}
      </div>
      <div style="font-size: 12px; color: #9ca3af; margin-top: 8px;">
        Average: ${this.formatMetricValue(metricType, data.summary.metrics[`${metricType}_average`] || 0)}
      </div>
    `;
    container.appendChild(metricDiv);
  }

  private async createTrendChart(container: HTMLElement, instance: ChartInstance, data: DataProcessingResult): Promise<void> {
    // Create simple trend visualization
    const chartDiv = document.createElement('div');
    chartDiv.style.height = '300px';
    chartDiv.style.border = '1px solid #e5e7eb';
    chartDiv.style.borderRadius = '8px';
    chartDiv.style.display = 'flex';
    chartDiv.style.alignItems = 'center';
    chartDiv.style.justifyContent = 'center';
    chartDiv.style.backgroundColor = '#f9fafb';
    chartDiv.innerHTML = `
      <div style="text-align: center; color: #6b7280;">
        <div style="font-size: 24px; margin-bottom: 8px;">📈</div>
        <div>Trend Chart</div>
        <div style="font-size: 12px; margin-top: 4px;">${data.data.length} data points</div>
      </div>
    `;
    container.appendChild(chartDiv);
  }

  private async createAnalysisChart(container: HTMLElement, instance: ChartInstance, data: DataProcessingResult): Promise<void> {
    // Create analysis visualization placeholder
    const analysisDiv = document.createElement('div');
    analysisDiv.style.height = '300px';
    analysisDiv.style.border = '1px solid #e5e7eb';
    analysisDiv.style.borderRadius = '8px';
    analysisDiv.style.display = 'flex';
    analysisDiv.style.alignItems = 'center';
    analysisDiv.style.justifyContent = 'center';
    analysisDiv.style.backgroundColor = '#f9fafb';
    analysisDiv.innerHTML = `
      <div style="text-align: center; color: #6b7280;">
        <div style="font-size: 24px; margin-bottom: 8px;">🔍</div>
        <div>Analysis Chart</div>
        <div style="font-size: 12px; margin-top: 4px;">${data.summary.totalRows} rows analyzed</div>
      </div>
    `;
    container.appendChild(analysisDiv);
  }

  private async createDataTable(container: HTMLElement, instance: ChartInstance, data: DataProcessingResult): Promise<void> {
    // Create data table
    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.fontSize = '12px';

    // Header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const sampleRow = data.data[0];
    if (sampleRow) {
      Object.keys(sampleRow).slice(0, 6).forEach(key => {
        const th = document.createElement('th');
        th.textContent = key;
        th.style.border = '1px solid #e5e7eb';
        th.style.padding = '8px';
        th.style.backgroundColor = '#f9fafb';
        th.style.fontWeight = 'bold';
        headerRow.appendChild(th);
      });
    }
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Body (first 10 rows)
    const tbody = document.createElement('tbody');
    data.data.slice(0, 10).forEach(row => {
      const tr = document.createElement('tr');
      Object.values(row).slice(0, 6).forEach(value => {
        const td = document.createElement('td');
        td.textContent = String(value);
        td.style.border = '1px solid #e5e7eb';
        td.style.padding = '6px 8px';
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    container.appendChild(table);

    // Add note about truncation
    if (data.data.length > 10) {
      const note = document.createElement('div');
      note.style.fontSize = '10px';
      note.style.color = '#9ca3af';
      note.style.marginTop = '8px';
      note.textContent = `Showing first 10 of ${data.data.length} rows`;
      container.appendChild(note);
    }
  }

  private async addRenderedChart(renderResult: ChartRenderResult): Promise<void> {
    // Calculate dimensions
    const imgWidth = this.pageWidth - (2 * this.margin);
    const imgHeight = (renderResult.canvas.height * imgWidth) / renderResult.canvas.width;

    // Check if we need a new page
    if (this.currentY + imgHeight > this.pageHeight - this.margin) {
      this.pdf.addPage();
      this.currentY = this.margin;
    }

    // Add the image
    const imgData = renderResult.canvas.toDataURL('image/jpeg', 0.95);
    this.pdf.addImage(imgData, 'JPEG', this.margin, this.currentY, imgWidth, imgHeight);
    this.currentY += imgHeight + 15;
  }

  private addErrorMessage(instance: ChartInstance, error: Error): void {
    this.pdf.setFontSize(12);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text(`Error rendering: ${instance.name}`, this.margin, this.currentY);
    this.currentY += 8;

    this.pdf.setFontSize(10);
    this.pdf.setTextColor(255, 0, 0);
    this.pdf.text(`${error.message}`, this.margin, this.currentY);
    this.pdf.setTextColor(0, 0, 0);
    this.currentY += 12;
  }

  private formatMetricValue(metricType: string, value: number): string {
    if (metricType.includes('REVENUE') || metricType.includes('SPEND')) {
      return `$${value.toLocaleString()}`;
    } else if (metricType === 'CTR') {
      return `${value.toFixed(3)}%`;
    } else if (metricType === 'ROAS') {
      return `${value.toFixed(2)}x`;
    } else {
      return value.toLocaleString();
    }
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