import { ChartInstance, ChartTemplate, createDefaultInstance } from './enhanced-types';

export class ChartInstanceManager {
  private instances: Map<string, ChartInstance> = new Map();
  private nextId = 1;

  constructor() {
    // Initialize with empty instances map
  }

  // Create a new chart instance
  createInstance(template: ChartTemplate, customName?: string): ChartInstance {
    const id = this.generateId();
    const defaultInstance = createDefaultInstance(template, customName);
    
    const instance: ChartInstance = {
      ...defaultInstance,
      id,
      createdAt: new Date(),
      order: this.getNextOrder(),
    };

    this.instances.set(id, instance);
    return instance;
  }

  // Duplicate an existing instance
  duplicateInstance(instanceId: string, customName?: string): ChartInstance | null {
    const original = this.instances.get(instanceId);
    if (!original) return null;

    const id = this.generateId();
    const duplicated: ChartInstance = {
      ...original,
      id,
      name: customName || `${original.name} (Copy)`,
      createdAt: new Date(),
      order: this.getNextOrder(),
    };

    this.instances.set(id, duplicated);
    return duplicated;
  }

  // Update an existing instance
  updateInstance(instanceId: string, updates: Partial<ChartInstance>): boolean {
    const instance = this.instances.get(instanceId);
    if (!instance) return false;

    const updated = { ...instance, ...updates };
    this.instances.set(instanceId, updated);
    return true;
  }

  // Remove an instance
  removeInstance(instanceId: string): boolean {
    return this.instances.delete(instanceId);
  }

  // Get all instances
  getAllInstances(): ChartInstance[] {
    return Array.from(this.instances.values()).sort((a, b) => a.order - b.order);
  }

  // Get instance by ID
  getInstance(instanceId: string): ChartInstance | null {
    return this.instances.get(instanceId) || null;
  }

  // Reorder instances
  reorderInstances(instanceIds: string[]): boolean {
    const instances = instanceIds
      .map(id => this.instances.get(id))
      .filter(Boolean) as ChartInstance[];

    if (instances.length !== instanceIds.length) return false;

    instances.forEach((instance, index) => {
      instance.order = index;
      this.instances.set(instance.id, instance);
    });

    return true;
  }

  // Clear all instances
  clearAllInstances(): void {
    this.instances.clear();
    this.nextId = 1;
  }

  // Import instances from configuration
  importInstances(instances: ChartInstance[]): void {
    this.clearAllInstances();
    instances.forEach(instance => {
      this.instances.set(instance.id, instance);
      // Update nextId to avoid conflicts
      const numericId = parseInt(instance.id.replace('chart_', ''));
      if (numericId >= this.nextId) {
        this.nextId = numericId + 1;
      }
    });
  }

  // Export instances for saving/sharing
  exportInstances(): ChartInstance[] {
    return this.getAllInstances();
  }

  // Get instances count
  getInstanceCount(): number {
    return this.instances.size;
  }

  // Get instances by template
  getInstancesByTemplate(templateId: string): ChartInstance[] {
    return Array.from(this.instances.values())
      .filter(instance => instance.templateId === templateId)
      .sort((a, b) => a.order - b.order);
  }

  // Validate instance configuration
  validateInstance(instance: ChartInstance): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!instance.id) {
      errors.push('Instance ID is required');
    }

    if (!instance.templateId) {
      errors.push('Template ID is required');
    }

    if (!instance.name || instance.name.trim().length === 0) {
      errors.push('Instance name is required');
    }

    if (instance.order < 0) {
      errors.push('Order must be non-negative');
    }

    // Validate filters
    if (!Array.isArray(instance.filters.agencies)) {
      errors.push('Agencies filter must be an array');
    }

    if (!Array.isArray(instance.filters.advertisers)) {
      errors.push('Advertisers filter must be an array');
    }

    if (!Array.isArray(instance.filters.campaigns)) {
      errors.push('Campaigns filter must be an array');
    }

    if (!['all', 'display', 'attribution'].includes(instance.filters.campaignType)) {
      errors.push('Campaign type must be "all", "display", or "attribution"');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Helper methods
  private generateId(): string {
    return `chart_${this.nextId++}`;
  }

  private getNextOrder(): number {
    const instances = Array.from(this.instances.values());
    if (instances.length === 0) return 0;
    return Math.max(...instances.map(i => i.order)) + 1;
  }

  // Statistics and insights
  getInstanceStats() {
    const instances = this.getAllInstances();
    const templateCounts = new Map<string, number>();
    const categoryCounts = new Map<string, number>();

    instances.forEach(instance => {
      // Count by template
      const templateCount = templateCounts.get(instance.templateId) || 0;
      templateCounts.set(instance.templateId, templateCount + 1);
    });

    return {
      totalInstances: instances.length,
      templateCounts: Object.fromEntries(templateCounts),
      categoryCounts: Object.fromEntries(categoryCounts),
      averageFiltersPerInstance: instances.length > 0 
        ? instances.reduce((sum, instance) => {
            return sum + 
              instance.filters.agencies.length + 
              instance.filters.advertisers.length + 
              instance.filters.campaigns.length;
          }, 0) / instances.length 
        : 0
    };
  }
}