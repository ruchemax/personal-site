# Personal website of Maksim Ruchkin

Source code for [maxruchkin.org](https://www.maxruchkin.org), a bilingual personal and academic website covering research projects, publications, software, and local-history materials.

[![Maksim Ruchkin personal website](docs/assets/site-preview.png)](https://www.maxruchkin.org)

## Technology

- [Astro](https://astro.build/) with server-side rendering
- Tailwind CSS
- Vercel deployment and analytics
- Nodemailer for the contact form
- Cloudflare Turnstile for spam protection

## Local development

Requirements: Node.js 22 or newer and pnpm 10.

```sh
pnpm install --frozen-lockfile
cp .env.example .env
pnpm dev
```

On Windows PowerShell, use `Copy-Item .env.example .env` instead of `cp .env.example .env`.

The development server is available at `http://localhost:4321`.

## Environment variables

The contact endpoint requires these server-side variables:

| Variable | Purpose |
| --- | --- |
| `SMTP_PASSWORD` | Application password for the SMTP account |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile server-side secret |

Copy `.env.example` to `.env` for local development and provide real values only in your local environment or deployment provider. Never commit `.env` files or generated `.vercel` output.

## Commands

| Command | Action |
| --- | --- |
| `pnpm dev` | Start the development server |
| `pnpm build` | Create a production build |
| `pnpm preview` | Preview the production build |
| `pnpm astro check` | Run Astro diagnostics |

## Deployment

The project is configured for Vercel through `@astrojs/vercel`. Set the required environment variables in the Vercel project settings before deploying.

## Content and licensing

No open-source license is currently granted. Website text, publications, photographs, maps, and other media remain the property of their respective authors and rights holders unless stated otherwise.
