# APAH AI Chat + Agent Handoff

The website now includes an AI visitor concierge, visitor-intake tracking, agent handoff, agent chat, page-visit history, and an email fallback when no configured agent is online.

## Required environment variables

- `OPENAI_API_KEY` — server-side only. Never expose it to the browser.
- `OPENAI_MODEL` — defaults to `gpt-5.6-luna`.
- `AGENT_DASHBOARD_TOKEN` — long random token used by `/admin/chat.html`.
- `APAH_AGENT_EMAIL` — fallback mailbox for offline handoff history.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` — required for email fallback.
- `CHAT_DATA_DIR` — optional private storage directory; defaults to `./data`.

## Agents

Configure real agents in `content/agents.json` or provide them through deployment configuration. Each agent needs an `id`, `name`, `email`, and `department`. Availability is controlled by the agent dashboard heartbeat. Do not publish personal agent details on the public website.

Example:

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

Replace example values only with company-approved information.

## Social accounts

`content/social.json` intentionally starts empty because the company brief requires official social accounts to be verified before publication. Add only approved URLs.

## Visitor information collected

The assistant progressively requests only business-relevant information: name, email, organization, role, country/region, area of interest, project stage, timing, optional budget range, preferred contact method, and the visitor's request. The client also records pages visited during the current chat session.

The chat must not request national ID, passwords, payment credentials, health information, religion, ethnicity, or other unnecessary sensitive data.

## Offline handoff

If no agent heartbeat is active, the system marks the conversation for follow-up and emails the configured fallback mailbox with the intake summary, page-visit history and complete conversation transcript.

## Production requirements

Use HTTPS, a reverse proxy, secure headers, a private persistent data store, backups, log retention rules, malware/abuse controls, and legal review before launch. Replace the local JSON session store with the production database selected by the deployment architecture.
