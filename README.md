# THE PROMPTERS - AI Image Competition Platform

## Project Overview

This is a competitive programming platform where teams compete in AI-powered image recognition and generation challenges across multiple rounds.

## Project Info

- **Project Type**: Web Application (Competition Platform)
- **Stack**: Vite + React + TypeScript + Supabase + Tailwind CSS

## Tech Stack

- **Frontend**: Vite, React, TypeScript, Tailwind CSS
- **UI Components**: shadcn-ui
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Realtime)
- **Package Manager**: Bun

## Getting Started

### Prerequisites

- Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)
- Bun package manager - [install bun](https://bun.sh)

### Installation

```sh
# Install dependencies
bun install

# Start the development server
bun run dev
```

### Build for Production

```sh
bun run build
```

## Project Structure

```
src/
├── components/       # React components
│   ├── competition/  # Competition-specific components
│   └── ui/           # shadcn-ui components
├── hooks/            # Custom React hooks
├── integrations/     # Supabase client & types
├── lib/              # Utility functions
├── pages/            # Page components
└── test/             # Test files
```

## Features

- Multi-round competition system (Image Search, Hints + Search, AI Recreation)
- Real-time round state management
- Team management with admin dashboard
- Image submission and approval system
- Anti-cheat monitoring
- Projector mode for display
- Winner tracking and announcements

## License

MIT

