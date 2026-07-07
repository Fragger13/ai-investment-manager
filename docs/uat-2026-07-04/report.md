# AskPapa — Multi-User UAT Report (2026-07-04)

Full user-acceptance test with 5 mock users spanning very different financial lives, driven end to end through the real stack (register → email OTP → verify → onboarding → dashboard → recommendation engine → chat/goal agents → UI walkthrough with screenshots). Every defect found was fixed and re-verified the same day.

## The 5 personas

| Persona | Profile | Income /mo | True surplus /mo | Net worth | Goals |
|---|---|---|---|---|---|
| Aarav Joshi (student, 21, Pune) | Part-time + freelance, no loans, ₹5k crypto | ₹12,000 | ₹5,100 | ₹30,000 | Travel, Higher education |
| Aditi Nair (fresher SWE, 24, Bengaluru) | ₹18k rent, education loan EMI ₹8,667, index-fund SIP | ₹58,000 | ₹15,333 | ₹1.3L | Higher education, Travel |
| Rohit Malhotra (senior exec, 36, Gurugram) | Home + car loan EMIs ₹45k, ₹1.19Cr assets | ₹1,95,000 | ₹91,722 | ₹1.19Cr | Child education, Retirement, Debt |
| Farhan Sheikh (business owner, 45, Mumbai) | Variable income, business loan, ₹3.25Cr assets | ₹4,00,000 | ₹2,64,667 | ₹3.25Cr | Business, Marriage, Retirement |
| Meera Krishnan (professor, 53, Chennai) | No loans, conservative, ₹2.38Cr assets | ₹1,60,000 | ₹98,500 | ₹2.38Cr | Retirement, Marriage, Travel |

## Verdict on personalization

**Plans are genuinely personalized — and now mathematically honest.**

| Persona | Cluster assigned | Recs | Plan total /mo | Within surplus? |
|---|---|---|---|---|
| Student | Moderate balanced | 4 | ₹4,182 | ✅ (≤ ₹5,100) |
| Fresher | Moderate balanced | 7 | ₹12,572 | ✅ (≤ ₹15,333) |
| Executive | Moderate balanced | 9 | ₹73,245 | ✅ (≤ ₹91,722) |
| Business | **Aggressive growth** | 10 (incl. BTC/ETH) | ₹2,09,468 | ✅ (≤ ₹2,64,667) |
| Preretiree | **Conservative goal-first** | 9 (incl. gilt fund) | ₹83,727 | ✅ (≤ ₹98,500) |

- SIP sizing scales ~50× between student and business owner.
- Clusters, risk labels, and asset mix differ by profile: only the aggressive 45-year-old gets crypto; only the conservative 53-year-old gets a gilt ladder; equity is "buy/Medium" for growth-tolerant users and "watchlist/High" for the conservative preretiree.
- Reasoning references user-specific facts (emergency gap ₹16.4k vs ₹1.96L vs ₹3L; "At 53, capital preservation matters more…").
- No two personas share an identical plan. Chat answers quote each user's own surplus.
- Known limitation (unchanged): users in the same risk band draw from a similar instrument pool (fresher vs executive share ~88% of instrument names, at very different amounts). Deeper candidate-pool diversification is the next engine iteration.

## Defects found → fixed → re-verified

### P0 — Cross-user data leak on the dashboard
A hydration race: on a cold load the dashboard fetched `latestProfile` **before** the persisted session loaded, got the **globally last-saved profile** (another user's), displayed it, and then **persisted it into the current user's session**. Screenshot evidence showed Aditi's sidebar with Meera's entire finances.
**Fix:** `hasHydrated` gate in the auth store (`onRehydrateStorage`) + dashboard effect waits for it; backend `/onboarding/latest` without a token now only returns guest profiles, never account-owned ones.

### P0 — Cross-user commitment leak in the portfolio
`/portfolio/summary` read the **global** `user_action_events` table: the owner's ₹2,000/mo committed SIPs appeared in every persona's portfolio (screenshot evidence).
**Fix:** action events are now stamped with `user_id` on write and filtered per caller on read and delete; frontend sends the session token on record/remove/summary calls. Verified: an action recorded by one user is invisible to all others; guest actions stay guest-only.

### P1 — Rent and subscriptions excluded from investable surplus
Backend computed surplus as `income − expenses − EMI` in 8 places, while the onboarding UI explicitly collects rent separately ("Don't include rent or EMIs"). Renters got inflated surpluses (fresher: ₹34,333 shown vs ₹15,333 true, +124%) and every SIP downstream was sized off it. The expense pie even double-counted rent (clamping "Other spends" to ₹0).
**Fix:** one canonical `monthly_commitments()` / `computed_monthly_surplus()` / `emergency_target_base()` in `intelligence.py`, used by the dashboard, health score, engine profile context, goal funding, portfolio, adaptive memory and chat. Frontend `monthlyCommitments` matched (adds legacy subscriptions). Dashboard, engine and chat now quote the identical number.

### P1 — Plans suggested ~3× the user's money
Every recommendation got its **entire asset-class budget** (three debt funds × 70% of surplus each + six equity funds × the full equity sleeve ≈ 312% of surplus). Fresher's plan totalled ₹1,07,121/mo against a ₹34,333 surplus.
**Fix:** `_normalize_bucket_sizing` in the orchestrator — each bucket's budget is split across its best-ranked picks with a realistic ₹500 minimum SIP ticket; picks that would fall below it are dropped (student now gets 1 meaningful equity SIP of ₹765, not six ₹109 slivers). All alias fields re-synced. All 5 plans now fit within surplus.

### P2 — Age alone branded equity "High risk"
Any user 45+ saw all equity as High/watchlist even with a stated 25%+ drawdown tolerance.
**Fix:** High now requires being a senior, a panic-seller, or a pre-retiree without long-term growth appetite. Aggressive 45-year-old → buy/Medium; conservative 53-year-old unchanged (watchlist/High).

### P2 — API accepted 1-character passwords
`POST /auth/register` had no password policy (UI only had `required`).
**Fix:** `min_length=8` at the API schema + form validation with an inline error.

### P3 — Risk pill labels contradicted stored values
"<1 year" saved `1-3 years`; "2-5 years" saved `3-5 years`.
**Fix:** labels now match the stored values exactly.

### P3 — Three surplus formulas across features
Dashboard, engine and chat each computed "available money" differently (chat subtracted rent but not subscriptions; engine subtracted neither).
**Fix:** all routes through the canonical helper; verified identical output (₹15,333 for the fresher across all three).

## What passed cleanly

- **Auth:** register → OTP email → verify → login; wrong password 401, unknown user 404, bad/expired codes rejected, resend cooldown enforced, duplicate email 409.
- **Onboarding validation:** empty submit → 422 listing every missing field; negative income, string-in-number rejected; profile round-trips byte-exact; partial saves never flip the onboarding-complete flag.
- **Dashboard math (post-fix):** income, net worth, savings rate, health score (0–100, sensibly differentiated 62–93), goals, expense pie — verified against hand-computed values for all 5.
- **Goal estimator agent:** metro 2BHK ₹1.45Cr, private child education ₹20L, international travel ₹3.6L — plausible, always inside the deterministic band, LLM-refined (`source:"ai"`), instant calculator fallback when the LLM is down.
- **Chat agent:** personalized numbers per user; graceful deterministic fallback when the LLM times out.
- **UI walkthrough:** login-injected sessions for all 5 users across Home, Plan, Goals, Portfolio, Discover — correct name, correct numbers, plan sized to the user's true monthly budget, portfolio itemised per user (25 screenshots in `screenshots/`).
- **Security posture:** XSS payload in a text field is stored but React-escaped on render, and the input sanitizer strips it in the UI; no secrets or DBs tracked in git.

## Addendum (same day): instrument pool personalization shipped

Limitation #2 below was addressed right after this report. A deterministic
**category planner** (`services/recommendations/category_planner.py`) now gates
and orders fund categories per profile — ELSS only above the tax threshold,
small caps never for beginners/panic-sellers/conservative pre-retirees, gilt
and corporate bond ladders for conservative and older profiles, index-first
for first-time investors — and the factor engine's fund scoring gained
life-stage, beginner and irregular-income weight tilts. One recommendation per
fund category (no more duplicate balanced-advantage rows), and generic debt
products (bank FD) rank below the curated fund ladder.

Result on the same 5 personas: average pairwise instrument overlap fell from
~78% to ~59%; fresher vs executive from 100% to 75%; executive vs preretiree
78% → 47%. The student no longer sees an ELSS; every plan still fits inside
the user's surplus with ≥ ₹500 tickets.

## Known limitations (documented, deliberate)

1. **LLM latency** — qwen3:8b chat takes 14–20s and often hits the 20s timeout (falls back to deterministic replies). Consider a smaller/faster chat model or a longer timeout.
2. **Instrument pool overlap** within the same risk band — addressed same-day, see addendum above.
3. **Emergency ladder redundancy** — up to 3 cash-like debt funds (liquid/overnight/short-duration); amounts are correct, could consolidate to 1–2 rows.
4. **Uniform confidence badges** (94 debt / 88 equity) across users — cosmetic.
5. **`AskPapa_final.mp4` (141MB)** exceeds GitHub's 100MB hard limit → gitignored so the push succeeds. The Our Story button still works locally. Ship it via Git LFS or a compressed re-export (~720p H.264 lands well under 100MB).
6. **15 ESLint warnings** — all `next/image` advisories on small local `<img>` assets; no errors.

## Codebase health at hand-off

- `tsc --noEmit` clean · `next lint` 0 errors · **`next build` passes** (all 20 routes).
- Backend `compileall` clean, all routers import.
- Git hygiene: DB backups (`*.db.bak-*`), `*.tsbuildinfo` and the oversized MP4 gitignored; `tsconfig.tsbuildinfo` untracked; root `package-lock.json` added; no secrets/DBs tracked.

## Test artifacts

- `screenshots/` — 25 captures: `{student,fresher,executive,business,preretiree}-{dashboard,plan,goals,portfolio,discover}.jpg`
- Mock accounts: `uat.{student,fresher,executive,business,preretiree}@example.com` (password `UatPass!2026`) — safe to delete anytime.
- A pre-UAT database backup was kept outside the repo.
