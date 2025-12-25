# AsyncAnticheat Website (Providence)

## Project Overview

Complete website for AsyncAnticheat including:
- **Landing page** (`/`) - Product showcase and features
- **Dashboard** (`/dashboard`) - Server owner panel for managing findings
- **Server Registration** (`/register-server`) - One-click server linking
- **Documentation** (`/docs`) - Built with Nextra

## Tech Stack

- **Next.js 16** - React framework with App Router
- **React 19** - UI library
- **Tailwind CSS v4** - Styling
- **Nextra** - Documentation
- **Supabase** - Authentication & Database
- **Pagefind** - Documentation search
- **Bun** - Package manager and runtime
- **Radix UI** - Accessible component primitives
- **Zod** - Schema validation
- **Motion** - Animations

## Commands

```bash
# Install dependencies
bun install

# Start dev server
bun dev

# Build for production
bun run build

# Run linter
bun lint
```

## Project Structure

```
providence/
├── app/
│   ├── (dashboard)/     # Dashboard routes (protected)
│   ├── api/             # API routes
│   ├── auth/            # Auth callback
│   ├── docs/            # Documentation (Nextra)
│   ├── login/           # Login page
│   ├── page.tsx         # Landing page
│   └── layout.tsx       # Root layout
├── components/          # Shared React components
│   ├── dashboard/       # Dashboard-specific components
│   └── ui/              # Radix-based UI primitives
├── content/             # MDX documentation files
├── lib/                 # Utilities
│   ├── api.ts           # API client for Rust backend
│   ├── supabase/        # Supabase clients
│   └── utils.ts         # General utilities
├── public/              # Static assets
└── types/               # TypeScript types
```

## Environment Variables

Copy `.env.example` to `.env.local` and configure:

```bash
# API URL - points to the async_anticheat_api Rust backend
NEXT_PUBLIC_API_URL=http://localhost:3002

# Supabase Configuration (required for authentication)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Get values from `~/minecraft/secrets.json`:
```bash
jq -r '.shared.supabase.url' ~/minecraft/secrets.json
jq -r '.shared.supabase.anon_key' ~/minecraft/secrets.json
jq -r '.shared.supabase.service_role_key' ~/minecraft/secrets.json
```

## Development Authentication

The dashboard requires authentication. For local development:

**Dev User Credentials** (from `~/minecraft/secrets.json`):
```bash
# Email
jq -r '.projects.asyncanticheat.website.dev_user.email' ~/minecraft/secrets.json
# Password
jq -r '.projects.asyncanticheat.website.dev_user.pass' ~/minecraft/secrets.json
```

To login during development:
1. Navigate to `http://localhost:3000/login`
2. Use email login with the dev user credentials above
3. Access protected routes like `/dashboard/findings`

## Conventions

### Code Style

- **Components**: PascalCase (`MyComponent.tsx`)
- **Functions/variables**: camelCase
- **Files**: kebab-case for utilities, PascalCase for React components
- **Imports**: External first, then internal with `@/` alias

### TypeScript

- Strict mode enabled
- Use interfaces for props
- Path alias: `@/*` maps to project root

### React

- Function components with TypeScript
- Server Components by default (Next.js App Router)
- Use `"use client"` directive only when needed

### Documentation

- Docs content lives in `content/` directory
- Use MDX for documentation pages
- Update `_meta.js` for navigation order

## Related Projects

This is part of the AsyncAnticheat ecosystem:
- **Plugin**: `asyncanticheat/asyncanticheat/` - Gradle multi-module
- **API**: `asyncanticheat/api.asyncanticheat.com/` - Rust Axum backend
- **Detection Modules**: Rust modules for movement, combat, player detection

## Deployment

Auto-deploys to Vercel from `main` branch. Configure environment variables in Vercel dashboard.

## AI Agent Guidelines

- Keep changes focused and minimal
- Follow existing code style
- Update docs when changing user-facing behavior
- Use `bun` for all package operations
- Never edit `node_modules/`, `.next/`, or `build/` directories
- Wire code to read from environment variables
- Never paste secret values into code or docs
