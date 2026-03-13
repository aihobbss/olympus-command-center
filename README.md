# Vantage Command Center

Centralized multi-store command center for fashion dropshipping teams — manage product research, ad campaigns, profit tracking, creative generation, customer service, and coaching from a single dashboard. Multi-user with admin approval; all module data is store-scoped.

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS 3 with custom design tokens
- **Animation:** Framer Motion
- **State:** Zustand
- **Icons:** Lucide React
- **Backend:** Supabase (auth, RLS, per-store data)
- **Charts:** Recharts
- **Fonts:** Syne (display) · JetBrains Mono (metrics) · Inter (body)

## Getting Started

```bash
# Clone the repository
git clone <repo-url>
cd vantage-command-center

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Modules

| Module | Route | Description |
|---|---|---|
| **Research** | `/research` | Scout winning products from competitors using Afterlib and Winning Hunter data |
| **Import** | `/import` | One-click import from research into your Shopify store via Kopy |
| **Product Creation** | `/product-creation` | AI-assisted product listings with descriptions, pricing, and variants |
| **Ad Manager** | `/ad-manager` | Live Meta campaign dashboard with SOP-based Kill / Scale / Watch recommendations |
| **Profit Tracker** | `/profit-tracker` | Real-time P&L tracking across every order with daily breakdown |
| **Creative Generator** | `/creative-generator` | AI-powered ad creative generation via Nanobanana Pro |
| **Customer Service** | `/customer-service` | AI-drafted email responses with refund SOPs and customer history |
| **Coach View** | `/coach-view` | Multi-store monitoring dashboard for coaching students |

## Demo Mode

The app ships with **demo mode enabled by default**. A thin indigo banner at the top indicates that all data is simulated. Click the dismiss button to hide it.

Use the **"Take a Tour"** button in the top bar to start a guided 8-step walkthrough of every module.

## Project Structure

```
vantage-command-center/
├── app/                    Next.js App Router pages
├── components/
│   ├── ui/                 Reusable UI primitives
│   └── modules/            Per-module components
├── lib/                    Utilities, stores, Supabase client
├── data/
│   └── mock/               Mock data (all 5 datasets)
└── hooks/                  Custom React hooks
```

## License

Private — not for redistribution.
