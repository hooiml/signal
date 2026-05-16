# Signal

Signal is a Next.js market-signal dashboard for decision-support views across market data, sentiment, positioning, and persisted snapshots.

## Project Docs

- Agent map: `AGENTS.md`
- Architecture: `docs/ARCHITECTURE.md`
- Harness standards: `docs/HARNESS.md`
- Testing and verification: `docs/TESTING.md`
- Workflows: `docs/WORKFLOWS.md`
- Scoring rules: `docs/signal-scoring.md`

## Getting Started

Install dependencies and run the development server:

```powershell
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

The main dashboard route starts at `src/app/page.tsx`, with V2 dashboard UI under `src/components/v2`.

## Verification

```powershell
npm run lint
npm run typecheck
npm run harness
```

Run `npm run build` for route, framework, dependency, or deployment-related changes.

## Learn More

- Repo workflows: `docs/WORKFLOWS.md`
- Testing details: `docs/TESTING.md`
- Next.js documentation: [nextjs.org/docs](https://nextjs.org/docs)

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
