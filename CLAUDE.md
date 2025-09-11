# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a React-based Display Campaign Monitor application built with Vite, TypeScript, and shadcn/ui components. The application analyzes campaign performance data, tracks pacing metrics, and provides visualizations for campaign health monitoring.

## Development Commands

- **Start development server**: `npm run dev` (runs on port 8080)
- **Build for production**: `npm run build`
- **Build for development**: `npm run build:dev`
- **Lint code**: `npm run lint`
- **Preview production build**: `npm run preview`

## Technology Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **UI Library**: shadcn/ui components with Radix UI primitives
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Data Handling**: React Query, PapaParse for CSV processing
- **Routing**: React Router DOM
- **State Management**: React Context API
- **Form Handling**: React Hook Form with Zod validation

## Architecture Overview

### Main Application Structure

The app follows a component-based architecture with these key areas:

1. **Data Upload & Processing** (`src/pages/Index.tsx`): Handles CSV file uploads and data validation
2. **Dashboard Views** (`src/components/Dashboard*.tsx`): Multiple dashboard layouts for different data visualizations
3. **Campaign Analysis** (`src/components/Campaign*.tsx`): Campaign-specific components for health, pacing, and trends
4. **Charts & Visualizations** (`src/components/ui/chart.tsx`, various chart components): Built on Recharts
5. **Global State** (`src/contexts/CampaignFilterContext.tsx`): Manages campaign filtering and agency mappings

### Key Components

- **FileUpload**: Handles CSV data upload with validation
- **DashboardWrapper**: Main dashboard container with multiple chart types
- **CampaignSparkCharts**: Trend visualization for individual campaigns
- **PacingTable/PacingMetrics**: Campaign pacing analysis
- **CampaignHealthTab**: Health scoring and anomaly detection
- **GlobalFilters**: Hierarchical filtering (Agency → Advertiser → Campaign)

### Data Flow

1. CSV files are uploaded and parsed using PapaParse
2. Data is validated for required fields (DATE, CAMPAIGN ORDER NAME, IMPRESSIONS, CLICKS, REVENUE, SPEND)
3. Campaign names are parsed to extract agency and advertiser information using regex patterns
4. Data is filtered and aggregated for various visualizations
5. Context providers manage filtering state across components

## Campaign Name Parsing

The application uses complex regex patterns to extract agency and advertiser information from campaign names. Campaign names follow these formats:

- Standard: `2001367: HRB: District Cannabis-241217`
- Slash format: `2001569/2001963: MJ: Test Client-Campaign Name-250501`
- Awaiting IO: `Awaiting IO: PRP: Advertiser Name-Campaign Details`

Agency abbreviations are mapped to full names in `AGENCY_MAPPING` within `CampaignFilterContext.tsx`.

## File Organization

- **Components**: Organized by functionality (ui/, campaign-specific, charts)
- **Contexts**: Global state management
- **Utils**: Helper functions for colors, scoring, and formatting
- **Pages**: Route-level components
- **Hooks**: Custom React hooks

## Development Guidelines

### Data Handling
- All numeric fields are converted to numbers during data processing
- Dates are normalized to MM/DD/YYYY format
- Test campaigns are filtered out using keywords ('test', 'demo', 'draft') and 'TST' agency code

### Component Patterns
- Uses shadcn/ui component system with Tailwind CSS
- Charts use Recharts with custom styling and gradients
- Responsive design with mobile-first approach
- Extensive use of React hooks for state management

### Performance Considerations
- Uses `useMemo` for expensive calculations and filtering
- Implements virtual scrolling for large datasets
- Optimizes re-renders with proper dependency arrays

## Common Development Tasks

### Adding New Chart Types
1. Create component in appropriate subfolder
2. Follow existing Recharts patterns with gradients and tooltips
3. Implement responsive container and mobile-friendly styling
4. Add to dashboard layout with proper filtering integration

### Modifying Campaign Parsing
- Update regex patterns in `CampaignFilterContext.tsx`
- Add new agency mappings to `AGENCY_MAPPING`
- Test with various campaign name formats

### Adding New Metrics
1. Update data validation in upload handler
2. Add calculation logic in appropriate components
3. Create visualization components following existing patterns
4. Update TypeScript interfaces as needed

## File Upload Requirements

### Campaign Data CSV
Required columns: DATE, CAMPAIGN ORDER NAME, IMPRESSIONS, CLICKS, REVENUE, SPEND
Optional: TRANSACTIONS

### Pacing Data CSV  
Expected columns: Campaign, various pacing-related metrics

### Contract Terms CSV
Expected columns: Contract-related fields for health scoring

## Configuration Files

- **Vite**: `vite.config.ts` (includes path aliases `@/` → `src/`)
- **TypeScript**: `tsconfig.json` with relaxed settings for rapid development
- **ESLint**: `eslint.config.js` with React-specific rules
- **Tailwind**: `tailwind.config.ts` with custom animations and shadcn integration