# AOSN HubSpot Pipeline Dashboard

A read-only internal web dashboard that provides real-time visibility into HubSpot pipeline data, replacing manual Excel reporting.

## Features

- **Executive Overview**: KPIs including total pipeline, revenue, weighted amounts, and EBITDA
- **Pipeline Table**: Sortable/filterable deal list with CSV export
- **Trends Analytics**: Revenue and EBITDA by month and stage
- **Funnel Metrics**: Stage conversion rates and velocity tracking
- **Smart Caching**: 1-hour data cache to optimize HubSpot API usage

## Tech Stack

- **Framework**: Next.js 14+ (App Router) with TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **API**: HubSpot API Client

## Prerequisites

1. **Node.js** 18+ and npm
2. **PostgreSQL** 14+ installed and running locally
3. **HubSpot Personal Access Token** with these scopes:
   - `crm.objects.deals.read`
   - `crm.objects.contacts.read`
   - `crm.objects.companies.read`
   - `crm.objects.owners.read`
   - `crm.schemas.deals.read`
   - `crm.schemas.contacts.read`
   - `crm.schemas.companies.read`

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up PostgreSQL Database

Create a new database:

```bash
createdb hubspot_dashboard
```

Or using psql:

```sql
CREATE DATABASE hubspot_dashboard;
```

### 3. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and add your credentials:

```bash
# HubSpot API Configuration
HUBSPOT_ACCESS_TOKEN=your_personal_access_token_here

# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/hubspot_dashboard

# Application Configuration
NEXT_PUBLIC_APP_NAME=AOSN Pipeline Dashboard
CACHE_TTL_MINUTES=60
NODE_ENV=development
```

### 4. Run Database Migrations

Push the Prisma schema to your database:

```bash
npm run db:push
```

Or create a migration:

```bash
npm run db:migrate
```

Generate the Prisma client:

```bash
npm run db:generate
```

### 5. Start the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run db:generate` - Generate Prisma client
- `npm run db:push` - Push schema to database
- `npm run db:migrate` - Create and run migrations
- `npm run db:studio` - Open Prisma Studio

## Project Structure

```
hubspot-dashboard/
├── app/                    # Next.js App Router pages
│   ├── page.tsx           # Executive Overview
│   ├── pipeline/          # Pipeline table page
│   ├── trends/            # Trends analytics
│   ├── funnel/            # Funnel metrics
│   ├── api/               # API routes
│   └── layout.tsx         # Root layout
├── lib/
│   ├── hubspot/           # HubSpot API client
│   │   ├── client.ts      # Base client with caching
│   │   ├── deals.ts       # Deals API
│   │   ├── contacts.ts    # Contacts API
│   │   ├── companies.ts   # Companies API
│   │   ├── owners.ts      # Owners API
│   │   └── schemas.ts     # Schema introspection
│   ├── db/                # Database layer
│   │   └── prisma.ts      # Prisma client
│   ├── services/          # Business logic
│   └── utils/             # Helper functions
├── components/            # React components
├── types/                 # TypeScript types
├── prisma/
│   └── schema.prisma      # Database schema
└── public/               # Static assets
```

## Data Flow

1. **HubSpot API** → Fetch deals, contacts, companies, owners
2. **Transform** → Map HubSpot properties to internal schema
3. **Database** → Cache in PostgreSQL (1-hour TTL)
4. **In-Memory Cache** → Fast access for repeated requests
5. **UI** → Display in dashboard with filters and charts

## Metric Definitions

### Month Attribution Logic

Determines which month a deal belongs to for trend charts:

1. **Primary**: `Target Close Date`
2. **Fallback 1**: `Revised Expected Close Date`
3. **Fallback 2**: `Official Closed Date`
4. **Default**: "TBD" if no dates present

### Weighted Revenue

```
Weighted Revenue = SUM(amount × probability / 100)
```

Only includes open deals in the pipeline.

### Stage Conversion Rate

```
Conversion Rate = (Deals reaching Stage B) / (Deals reaching Stage A)
```

## HubSpot Property Mappings

See the plan file or data dictionary for complete field mappings between HubSpot properties and internal database fields.

## Caching Strategy

- **In-Memory Cache**: Fast, ephemeral (cleared on server restart)
- **Database Cache**: Persistent, survives restarts
- **TTL**: 1 hour (configurable via `CACHE_TTL_MINUTES`)
- **Manual Refresh**: Available via refresh button or API endpoint

## Security

- HubSpot token stored server-side only (never exposed to browser)
- No write operations to HubSpot
- Read-only dashboard
- Token in `.env.local` (git-ignored)

## Troubleshooting

### Database Connection Errors

Ensure PostgreSQL is running:

```bash
# Check if PostgreSQL is running
pg_isready

# Start PostgreSQL (macOS with Homebrew)
brew services start postgresql@14

# Start PostgreSQL (Linux)
sudo systemctl start postgresql
```

### HubSpot API Errors

- Verify your access token has the required scopes
- Check rate limits (app is designed to respect them with caching)
- Ensure token is correctly set in `.env.local`

### Missing Data

If certain fields are empty:

1. Check that the HubSpot properties exist in your portal
2. Verify property names match the mappings in `lib/hubspot/deals.ts`
3. Use the schema introspection to see available properties

## Next Steps

- [ ] Add authentication (Google OAuth or basic auth)
- [ ] Implement Phase 2 features (trends, funnel, campaign)
- [ ] Add unit tests for business logic
- [ ] Deploy to production environment
- [ ] Set up automated backups

## Support

For issues or questions, refer to the project documentation or contact the development team.
