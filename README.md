# AsyncAnticheat Website

Complete website for AsyncAnticheat including:
- **Landing page** (`/`) - Product showcase and features
- **Dashboard** (`/dashboard`) - Server owner panel for managing findings
- **Documentation** (`/docs`) - Built with Nextra

## Development

```bash
# Copy environment variables
cp .env.example .env.local

# Install dependencies
bun install

# Start dev server
bun dev
```

## Build

```bash
bun run build
```

## Environment Variables

```bash
# API URL - points to the async_anticheat_api Rust backend
NEXT_PUBLIC_API_URL=http://localhost:3002

# Supabase Configuration (required for authentication)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Structure

```
async_anticheat_website/
├── app/
│   ├── (dashboard)/     # Dashboard routes (protected)
│   ├── api/             # API routes
│   ├── auth/            # Auth callback
│   ├── docs/            # Documentation (Nextra)
│   ├── login/           # Login page
│   ├── page.tsx         # Landing page
│   └── layout.tsx       # Root layout
├── components/          # Shared React components
├── content/             # MDX documentation files
├── lib/                 # Utilities and Supabase clients
├── public/              # Static assets
└── types/               # TypeScript types
```

## Tech Stack

- **Next.js 16** - React framework
- **Tailwind CSS v4** - Styling
- **Nextra** - Documentation
- **Supabase** - Authentication & Database
- **Pagefind** - Documentation search

## License

GPL-3.0
