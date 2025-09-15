# AsyncAnticheat Website

Complete website for AsyncAnticheat including:
- **Landing page** (`/`) - Product showcase and features
- **Dashboard** (`/dashboard`) - Server owner panel for managing findings
- **Server Registration** (`/register-server`) - One-click server linking
- **Documentation** (`/docs`) - Built with Nextra

## Authentication Flow

1. User installs plugin on their Minecraft server
2. Plugin generates unique server token and displays registration link
3. User clicks link → `/register-server?token=...`
4. If not logged in, user clicks "Sign in to link this server"
5. User authenticates via GitHub/Discord/Email OAuth
6. After auth, redirected back to registration page with token preserved
7. User clicks "Link server" to complete registration
8. Server is now linked to their dashboard account

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
