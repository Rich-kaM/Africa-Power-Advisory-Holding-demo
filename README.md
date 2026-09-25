# Africa Power Advisory Holding — APAH Website

Bilingual French/English corporate website for Africa Power Advisory Holding.

## Included

- Individual HTML file for every public page in `/fr/` and `/en/`
- Shared accessible responsive header/footer
- Services & Industries merged architecture
- Actuality, Careers, Newsletter, Experts, Projects, Insights, Sustainability and legal pages
- Custom 403/404/500/503 pages
- Supplied APAH brand assets and approved co-founder photographs
- **Follow us** footer area driven by `content/social.json`; only company-verified social URLs are rendered
- **AI visitor concierge** that welcomes new visitors, gathers business/project intake information, records pages visited during the chat session, and answers questions using the configured AI provider
- **Human-agent handoff** with configurable real agents, agent online heartbeat, private agent console and conversation history
- **Offline handoff email** with visitor intake, page-visit history and conversation transcript when no agent is online
- Security-oriented environment-variable configuration; no API keys in frontend code

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000/fr/` or `http://localhost:3000/en/`.

## AI chat configuration

Set these in the deployment environment, not in frontend files:

```bash
export OPENAI_API_KEY="..."
export OPENAI_MODEL="gpt-5.6-luna"
```

The server calls the OpenAI Responses API. The API key never reaches the browser.

## Human agents

Configure approved agents in `content/agents.json`:

```json
{
  "agents": [
    {
      "id": "energy-advisory-01",
      "name": "Approved Agent Name",
      "email": "approved.role@company.example",
      "department": "Energy Advisory"
    }
  ]
}
```

Use only real company-approved agent information. The file is blocked from public HTTP access.

Create a strong private dashboard token:

```bash
export AGENT_DASHBOARD_TOKEN="a-long-random-secret"
```

Then open `/admin/chat.html`, enter the token and the configured agent ID. The console sends a heartbeat so the visitor chatbot can know that an agent is online.

## Offline email fallback

Configure SMTP and the APAH team mailbox:

```bash
export APAH_AGENT_EMAIL="approved-team-mailbox@example.org"
export SMTP_HOST="smtp.example.org"
export SMTP_PORT="587"
export SMTP_USER="..."
export SMTP_PASS="..."
export SMTP_FROM="APAH Website <website@example.org>"
```

When no agent heartbeat is active, the handoff endpoint sends the conversation history to the configured mailbox. If SMTP is not configured, the conversation remains stored for authorized follow-up and the visitor receives a truthful status message.

## Follow us

`content/social.json` starts empty because the company brief requires official social accounts to be verified before publication. Add only approved HTTPS URLs. They will automatically appear in the footer on every page.

## Security / production

The local JSON store is intentionally simple for this deliverable. For production, move chat sessions to a protected database, put storage outside the public web root, use HTTPS, secure headers, backups, retention/deletion policies, rate limiting, abuse monitoring and legal review. Never commit `.env`, API keys, dashboard tokens or SMTP credentials.

## 21st.dev MCP

The project keeps the MCP setup separate from runtime website secrets:

```bash
export API_KEY_21ST="YOUR_21ST_DEV_KEY"
codex mcp add 21st --url https://21st.dev/api/mcp --bearer-token-env-var API_KEY_21ST
```

## Checks

```bash
npm run check
```

The static QA check covers the individual public HTML pages. See `docs/chatbot.md` for the AI/handoff implementation and production requirements.

## Black theme and theme toggle

- The website now uses a **black/dark theme by default**, with a persistent light/dark toggle in the header and mobile menu.
- The choice is saved in browser `localStorage` under `apah-theme`.
- The toggle follows the supplied shadcn-style interaction: moon for dark mode and sun for light mode.
- A shadcn-compatible React/TypeScript source component is included at `components/ui/theme-toggle.tsx`, with `lib/utils.ts`, `tsconfig.json`, `tailwind.config.ts` and PostCSS configuration prepared for a future React/shadcn build.
- The existing production site remains the independent bilingual HTML architecture so all 42 pages stay separately editable.

### React / shadcn setup note

The existing APAH site is a static HTML/Node project rather than a React application. To avoid a risky full migration of all 42 independently editable pages, the theme is integrated natively in the current site and the requested React component is also included in the standard `components/ui` location.

For a full shadcn application build, initialize a React/TypeScript app with the shadcn CLI, then keep reusable components under `components/ui`:

```bash
npx shadcn@latest init
npm install lucide-react clsx tailwind-merge class-variance-authority
```

The included `components/ui/theme-toggle.tsx` uses `lucide-react` and `@/lib/utils` exactly as the requested component pattern.

## Follow us

The header and footer now include **Follow us / Suivez-nous**, linked to the supplied LinkedIn profile:
`https://www.linkedin.com/in/richard-mbasha-mukulu-315b7916b/`
