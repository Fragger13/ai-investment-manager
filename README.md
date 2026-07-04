# AI Investment Manager

Working MVP for beginner-friendly personal investment planning for Indian retail investors.

The app now uses backend APIs for onboarding, document upload, dashboard intelligence, recommendations, market/research source attribution, and AI chat. It does not fill user-facing flows with random sample data.

## Run Locally

Backend:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --port 8000
```

Frontend:

```bash
npm install --prefix frontend
npm run dev --prefix frontend
```

Open:

- Frontend: http://localhost:3000
- If port 3000 is busy, Next.js may use http://localhost:3001. The backend allows both ports in local development.
- Backend health: http://127.0.0.1:8000/health
- API docs: http://127.0.0.1:8000/docs

The frontend defaults to `http://127.0.0.1:8000/api/v1`. Override with:

```bash
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api/v1 npm run dev --prefix frontend
```

### Local Dev Login

Seed the local-only development user after installing backend dependencies:

```bash
cd backend
.venv/bin/python scripts/seed_dev_user.py
```

Credentials:

- Email: `tanishq13@gmail.com`
- Password: `Test@12345`

The seed script only runs when `ENVIRONMENT` is `development`, `dev`, `local`, or `test`, and only against the local SQLite database. It is not run automatically in production.

Auth failure messages distinguish:

- user not found
- wrong password
- backend unavailable
- server error
- unsupported local password hash requiring reset

## MVP Features

- Functional auth with FastAPI, JWT, and SQLite persistence.
- Blank onboarding fields with helpful placeholders.
- DOB-based age calculation.
- Auto-calculated monthly inflow from salary, bonus, side income, and other income.
- Document-first or manual onboarding.
- Real file upload endpoint with PDF, CSV, and XLSX validation and parsing.
- Reviewable extracted fields with confidence and “Needs your review” status.
- Dynamic additional investments.
- Short-term and long-term risk comfort capture.
- Travel, retirement, financial freedom, and EMI-aware goal planning.
- Behavioral profile capture and saved use in alerts and recommendations.
- Rule-backed active agents for health, investing, market/research, behavior, documents, opportunities, goals, and chat.
- Source-attributed recommendations and market insights.
- Investment risk disclaimers in dashboard and recommendations.

## Document Upload Support

Supported now:

- PDF text extraction using a lightweight built-in parser for digital PDFs.
- CSV parsing using Python standard library.
- XLSX parsing using Python standard library ZIP/XML reading.

Image OCR:

- The upload flow rejects image OCR for now and tells users that OCR support is coming soon.
- The service interface is ready to connect OCR later.

## Phase 2 Research Ingestion

The research layer now attempts real, source-backed ingestion when `POST /api/v1/research/refresh` runs:

- RSS/public feed ingestion from validated finance sources configured in `backend/app/config/research_sources.yaml`: LiveMint, Economic Times, Times of India Business, Investing.com India, Hindu BusinessLine, RBI, and SEBI.
- API-style structured market ingestion from Yahoo Finance chart endpoints for Indian indices and ETFs.
- AMFI NAV text ingestion for selected mutual fund research records.
- CoinGecko simple price ingestion for Bitcoin and Ethereum crypto research.
- Deterministic rule-based signal extraction for sentiment, asset classes, sectors, instruments, macro themes, risk warnings, opportunities, confidence, relevance, and source credibility.
- Database persistence for research sources, research articles, market signals, asset research, and source refresh logs.
- Duplicate protection for repeated article URLs and repeated market signals.
- Market page refresh workflow with status, latest timestamps, source URLs, data mode labels, and credibility scores.

The system does not scrape paywalled/blocked pages, does not use browser automation for ingestion, and does not present fallback or cached data as live.

Phase 2A reliability upgrades:

- Shared resilient HTTP client with urllib first, curl fallback, retries, timeouts, content validation, and file-backed response cache.
- Explicit data modes: `live`, `cached`, `delayed`, `limited`, and `fallback`.
- Dead or blocked feeds are excluded from the YAML source registry instead of being treated as usable sources.
- RSS endpoints are required to return parseable RSS/Atom XML before articles are stored.
- AMFI, Yahoo Finance, and CoinGecko connectors use the same retry/cache path.

Live source endpoints used by the Phase 2 connectors include:

- AMFI NAV: `https://portal.amfiindia.com/spages/NAVOpen.txt`
- Yahoo Finance chart API: `https://query1.finance.yahoo.com/v8/finance/chart/...`
- CoinGecko simple price API: `https://api.coingecko.com/api/v3/simple/price`
- LiveMint Markets RSS: `https://www.livemint.com/rss/markets`
- Economic Times Markets RSS: `https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms`
- Times of India Business RSS: `https://timesofindia.indiatimes.com/rssfeeds/1898055.cms`
- Investing.com India RSS: `https://in.investing.com/rss/news_25.rss`
- Hindu BusinessLine Markets RSS: `https://www.thehindubusinessline.com/markets/?service=rss`
- RBI Press Releases RSS: `https://rbi.org.in/pressreleases_rss.xml`
- SEBI RSS: `https://www.sebi.gov.in/sebirss.xml`

If any source is unavailable, blocked, rate-limited, or the local environment has no internet access, the refresh log marks that source as `limited` or `fallback` and keeps the UI explicit about data quality.

## Optional Market API Keys

The app works without API keys, but optional keys can improve future source coverage. Missing keys should not break local development.

```bash
ALPHA_VANTAGE_API_KEY=
TWELVE_DATA_API_KEY=
NEWS_API_KEY=
COINGECKO_API_KEY=
OPENAI_API_KEY=
```

## Optional Local LLM With Ollama

The app can use a local open-source LLM for AI chat and explanation rewriting while keeping deterministic fallbacks if Ollama is unavailable.

Install and start Ollama:

```bash
brew install ollama
ollama serve
ollama pull qwen3:8b
ollama run qwen3:8b
```

Backend `.env` example:

```env
LLM_PROVIDER=ollama
LLM_ENABLED=true
OLLAMA_BASE_URL=http://localhost:11434
LLM_MODEL_REASONING=qwen3:8b
LLM_MODEL_FAST=qwen3:8b
LLM_MODEL_EXTRACTION=qwen3:8b
LLM_TIMEOUT_CHAT_SECONDS=20
LLM_TIMEOUT_ENHANCEMENT_SECONDS=8
LLM_BATCH_SIZE=2
```

Then run the backend and frontend normally. Check local LLM status at:

```text
GET http://127.0.0.1:8000/debug/llm-usage
```

The endpoint reports provider, model names, Ollama reachability, and fallback status. It does not expose secrets.

`qwen3:8b` is the recommended local model for machines with 16GB RAM. Chat waits for a response for up to 20 seconds. Recommendation, market, and asset copy enhancement runs in the background with an 8-second per-item limit, so core app data remains available if Ollama is slow or offline.

## Advanced Research Intelligence

Architecture documentation:

- `docs/ADVANCED_RESEARCH_ARCHITECTURE.md`

Phase 1 includes:

- Research source registry.
- Research database models for sources, articles, signals, assets, recommendation sources, and refresh logs.
- RSS/API connector structure without uncontrolled scraping.
- Deterministic signal extraction and fallback-labelled market signals.
- Advanced recommendation schema with exact instrument names, source links, suitability, confidence, action plan, risks, and data mode.
- Recommendations UI filters, sorting, source counts, evidence panels, refresh button, and fallback/live labels.
- Market page showing research signals and source registry entries.

Phase 2 includes:

- Real RSS/API ingestion structure for safe public sources.
- AMFI, Yahoo Finance endpoint, and CoinGecko connectors with fallback labeling.
- Source credibility scoring and refresh logs.
- Stored market signals and asset research from live or clearly labelled limited/fallback sources.
- Market Intelligence UI refresh button, status panel, source links, sentiment tags, timestamps, and source credibility scores.

Research APIs:

```text
POST /api/v1/research/refresh
GET  /api/v1/research/sources
GET  /api/v1/research/signals
GET  /api/v1/research/assets
GET  /api/v1/research/status
POST /api/v1/recommendations/generate-advanced
GET  /api/v1/recommendations/latest
GET  /api/v1/recommendations/{id}/sources
```

## Verification

Useful checks:

```bash
backend/.venv/bin/python -m compileall backend/app
npm run lint --prefix frontend
npm run build
```

## Deploy (production)

Production layout: frontend on Vercel, backend + SQLite on a single always-on
VM (a 1GB EC2 t3.micro is enough), LLM on Ollama Cloud. Assets live in `deploy/`:

1. **Backend VM** (Ubuntu 24.04): `git clone <repo> ~/askpapa && cd ~/askpapa && bash deploy/setup-ec2.sh api.<domain> <domain>`.
   The script sets up swap, Python venv, Caddy (automatic Let's Encrypt SSL),
   a systemd service, a nightly DB backup cron, and generates `backend/.env`
   with fresh secrets. Then edit `backend/.env` to paste the Ollama Cloud and
   Resend API keys — and back that file up somewhere safe: losing
   `DATA_ENCRYPTION_SECRET` or `RECOVERY_MASTER_KEY` orphans encrypted user data.
2. **Email**: verify the domain at resend.com/domains (DKIM/SPF DNS records) —
   the sandbox `resend.dev` sender does not deliver to other people, and
   registration/password reset depend on email.
3. **Vercel**: import the repo, root directory `frontend/`, env var
   `NEXT_PUBLIC_API_URL=https://api.<domain>/api/v1`, add the domain.
4. **DNS**: `A api → VM elastic IP`; apex/www per Vercel's instructions; plus
   Resend's records. SSL is automatic on both hosts (nothing to buy).
5. **LLM**: create an API key at ollama.com; production uses the cloud model
   `qwen3.5:9b` via `OLLAMA_BASE_URL=https://ollama.com` + `OLLAMA_API_KEY`.
   Free-tier caps degrade copy to deterministic fallbacks, never an outage.

## Safety

The app provides educational decision support, not guaranteed financial advice. Investments involve market risk. Users should verify source links and suitability before investing.
