# AsyncAnticheat Dashboard

A beautiful, professional dashboard for Minecraft server owners to monitor and manage their AsyncAnticheat protection.

## Features

- **Server Management**: Add, remove, and switch between multiple Minecraft servers
- **Module Configuration**: Toggle and configure anticheat check modules
- **Findings View**: Browse detected cheating attempts with filtering and search
- **Analytics**: Visualize trends with charts and a detection timeline
- **Real-time Updates**: Live data from your AsyncAnticheat plugin

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS with dark theme
- **Components**: Radix UI primitives
- **Icons**: Remix Icons
- **Database**: Supabase (PostgreSQL)

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
- Supabase account (for production)

### Installation

```bash
# Install dependencies
bun install

# Copy environment file
cp .env.example .env.local

# Configure your Supabase credentials in .env.local

# Start development server
bun run dev
```

### Development

```bash
bun run dev      # Start dev server at http://localhost:3000
bun run build    # Build for production
bun run start    # Start production server
bun run lint     # Run ESLint
```

## Project Structure

```
asyncanticheat.com/
├── app/
│   ├── (dashboard)/           # Dashboard route group
│   │   ├── layout.tsx         # Dashboard layout with sidebar
│   │   └── dashboard/
│   │       ├── page.tsx       # Overview page
│   │       ├── modules/       # Module management
│   │       ├── findings/      # Findings browser
│   │       ├── analytics/     # Charts and insights
│   │       └── settings/      # Server settings
│   ├── globals.css            # Global styles
│   ├── layout.tsx             # Root layout
│   └── page.tsx               # Landing page (redirects to dashboard)
├── components/
│   ├── dashboard/             # Dashboard components
│   │   ├── sidebar.tsx        # Navigation sidebar
│   │   └── add-server-dialog.tsx
│   ├── ui/                    # Reusable UI components
│   └── ...
├── lib/
│   ├── supabase/              # Supabase client utilities
│   ├── server-store.ts        # Local server storage
│   └── utils.ts               # Utility functions
└── types/
    └── supabase.ts            # TypeScript types
```

## License

MIT

