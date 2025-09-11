# Office Templates

Comprehensive Microsoft Office document templates for common business scenarios. These templates use Nunjucks syntax for dynamic content generation and include proper frontmatter configuration for the Unjucks generator system.

## Template Categories

### Word Documents (`word/`)

#### Invoice Template (`word/invoice/`)
Professional invoice template with automatic calculations and tax handling.

**Features:**
- Company and client information sections
- Itemized billing with quantity, rate, and amount calculations
- Automatic subtotal, tax, and total calculations
- Notes section for payment terms
- Professional formatting with tables and borders

**Variables:**
- `companyName`, `companyAddress` - Your business details
- `clientName`, `clientAddress` - Customer information  
- `invoiceNumber`, `invoiceDate`, `dueDate` - Invoice identifiers
- `items[]` - Array of line items with description, quantity, rate
- `taxRate` - Tax percentage for calculations
- `notes` - Payment terms and additional information

**Usage:**
```bash
unjucks generate word/invoice --companyName "Acme Corp" --invoiceNumber "INV-2024-001" --dest ./documents
```

#### Service Agreement Template (`word/contract/`)
Comprehensive service agreement contract template.

**Features:**
- Party information for both service provider and client
- Detailed service description and deliverables
- Payment terms and schedule
- Termination and governing law clauses
- Professional legal document formatting

**Variables:**
- `partyA`, `partyB` - Service provider and client details (objects with name, address, email, phone)
- `serviceDescription` - Detailed description of services
- `startDate`, `endDate` - Contract term dates
- `paymentTerms` - Payment schedule and terms
- `deliverables[]` - Array of project deliverables with due dates
- `terminationClause`, `governingLaw` - Legal provisions

#### Monthly Report Template (`word/report/`)
Executive monthly business report with metrics and analysis.

**Features:**
- Executive summary section
- Key performance metrics with comparison tables
- Achievements and challenges sections
- Next month objectives
- Professional report formatting with charts and tables

**Variables:**
- `companyName`, `reportTitle` - Report identification
- `month`, `year`, `author`, `department` - Report metadata
- `executiveSummary` - High-level summary
- `keyMetrics[]` - Performance metrics with current/previous values
- `achievements[]`, `challenges[]` - Successes and issues
- `nextMonthGoals[]` - Future objectives

### Excel Spreadsheets (`excel/`)

#### Budget Tracker (`excel/financial/`)
Comprehensive budget tracking with department breakdowns and variance analysis.

**Features:**
- Quarterly budget breakdown by department and category
- Automatic variance calculations and formatting
- Summary sections with totals and percentages
- Conditional formatting for over/under budget scenarios
- Department-wise analysis and reporting

**Variables:**
- `year`, `companyName` - Budget period and organization
- `departments[]` - Array of departments with budget categories
- Each category includes Q1-Q4 budget and actual values
- Automatic formulas for calculations and analysis

#### Sales Dashboard (`excel/analytics/`)
Sales performance dashboard with KPIs and trend analysis.

**Features:**
- Key performance indicators with target comparison
- Sales by representative with ranking
- Product performance analysis
- Regional sales breakdown
- Monthly trend analysis with charts

**Variables:**
- `year`, `quarter`, `companyName` - Dashboard period
- `salesReps[]` - Sales team with individual targets
- `products[]` - Product portfolio with growth rates
- `regions[]` - Geographic regions with targets and YoY growth
- `targets` - Overall revenue and unit targets

#### Inventory Management (`excel/inventory/`)
Stock management system with reorder analysis and supplier tracking.

**Features:**
- Current stock levels with reorder point analysis
- Conditional formatting for stock status (in stock, low stock, out of stock)
- Supplier performance tracking
- Category-wise inventory analysis
- Reorder recommendations and cost calculations

**Variables:**
- `companyName`, `location`, `warehouseManager` - Facility details
- `inventoryItems[]` - Complete inventory with SKU, stock levels, costs
- `suppliers[]` - Supplier information with performance metrics
- Automatic status calculations and reorder analysis

### PowerPoint Presentations (`powerpoint/`)

#### Company Pitch Deck (`powerpoint/presentation/`)
Professional investor pitch presentation with standard startup slides.

**Features:**
- Title slide with company branding
- Problem/Solution slides with clear value proposition
- Market opportunity and business model
- Traction metrics and competitive analysis
- Financial projections and team introduction
- Funding ask with use of funds breakdown

**Variables:**
- `companyName`, `tagline`, `founderName` - Company basics
- `problemStatement`, `solutionDescription` - Core value prop
- `marketSize`, `businessModel` - Market and revenue info
- `traction[]` - Key metrics and achievements
- `team[]`, `competitors[]` - Team and competitive landscape
- `fundingAsk`, `useOfFunds[]` - Investment details

#### Employee Onboarding (`powerpoint/training/`)
Comprehensive new employee onboarding presentation.

**Features:**
- Welcome slide with employee details
- Company overview and values
- Role-specific information and expectations
- First week schedule and key contacts
- Policies, benefits, and tools overview
- Professional training presentation format

**Variables:**
- `companyName`, `employeeName`, `employeeTitle` - Basic info
- `startDate`, `manager`, `department` - Role details
- `companyValues[]` - Organization values and culture
- `firstWeekSchedule[]` - Day-by-day onboarding plan
- `policies[]`, `benefits[]`, `tools[]` - Company information
- `contacts[]` - Key people and their contact information

#### Quarterly Business Review (`powerpoint/report/`)
Executive quarterly review presentation for stakeholders.

**Features:**
- Executive summary with key highlights
- Financial results with growth metrics
- Key performance indicators and target achievement
- Achievements, challenges, and mitigation strategies
- Market update and competitive analysis
- Next quarter goals and risk/opportunity assessment

**Variables:**
- `companyName`, `quarter`, `year`, `presenter` - Report basics
- `executiveSummary` - High-level quarterly summary
- `financialResults` - Revenue, margins, and financial KPIs
- `keyMetrics[]` - Performance metrics vs. targets
- `achievements[]`, `challenges[]` - Quarterly highlights and issues
- `marketUpdate`, `competitorAnalysis[]` - External factors
- `nextQuarterGoals[]`, `risks[]`, `opportunities[]` - Forward-looking

## Usage Examples

### Generate Invoice
```bash
unjucks generate word/invoice \
  --companyName "Acme Consulting" \
  --clientName "TechCorp" \
  --invoiceNumber "INV-2024-001" \
  --dest ./invoices
```

### Generate Budget Tracker
```bash
unjucks generate excel/financial \
  --year 2024 \
  --companyName "TechStart Inc" \
  --dest ./budgets
```

### Generate Pitch Deck
```bash
unjucks generate powerpoint/presentation \
  --companyName "FutureTech AI" \
  --tagline "AI for Everyone" \
  --fundingAsk "5M Series A" \
  --dest ./presentations
```

## File Structure

```
office/
├── word/
│   ├── invoice/
│   │   ├── invoice.docx.njk
│   │   └── example-data.json
│   ├── contract/
│   │   ├── service-agreement.docx.njk
│   │   └── example-data.json
│   └── report/
│       ├── monthly-report.docx.njk
│       └── example-data.json
├── excel/
│   ├── financial/
│   │   ├── budget-tracker.xlsx.njk
│   │   └── example-data.json
│   ├── analytics/
│   │   ├── sales-dashboard.xlsx.njk
│   │   └── example-data.json
│   └── inventory/
│       ├── stock-management.xlsx.njk
│       └── example-data.json
├── powerpoint/
│   ├── presentation/
│   │   ├── company-pitch.pptx.njk
│   │   └── example-data.json
│   ├── training/
│   │   ├── onboarding.pptx.njk
│   │   └── example-data.json
│   └── report/
│       ├── quarterly-review.pptx.njk
│       └── example-data.json
└── README.md
```

## Features

### Dynamic Content
- Nunjucks templating syntax for variable substitution
- Conditional content based on data availability
- Loop structures for repeating elements (items, metrics, etc.)
- Built-in filters for formatting (currency, date, percentage)

### Professional Formatting
- Industry-standard layouts and styling
- Conditional formatting for Excel spreadsheets
- Consistent branding and typography
- Tables, charts, and visual elements

### Comprehensive Data Models
- Complete example data files for testing
- Realistic business scenarios and sample data
- Flexible schema supporting various use cases
- Clear documentation of required vs. optional fields

### Office Format Compatibility
- Native Microsoft Office XML formats
- Proper schema definitions and namespaces
- Full compatibility with Office 365 and desktop versions
- Support for advanced features like formulas and conditional formatting

## Template Customization

Each template can be customized by:

1. **Modifying Variables**: Update the frontmatter variables or pass different data
2. **Styling Changes**: Modify the XML formatting within the template files
3. **Content Structure**: Add or remove sections as needed
4. **Formula Logic**: Update Excel formulas for different calculation requirements

## Advanced Features

### Excel Templates
- Automatic formula generation
- Conditional formatting rules
- Data validation and protection
- Chart and graph placeholders
- Pivot table compatibility

### PowerPoint Templates
- Master slide definitions
- Animation and transition support
- Image and media placeholders
- Speaker notes integration
- Export compatibility

### Word Templates
- Table of contents generation
- Header and footer management
- Page numbering and breaks
- Mail merge compatibility
- Digital signature support

## Integration with Business Systems

These templates are designed to integrate with:
- CRM systems for customer data
- ERP systems for financial information
- HR systems for employee data
- Inventory management systems
- Project management tools

Use the example data files as a reference for structuring your own data sources and API integrations.