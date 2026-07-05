# Publishing this article to Medium

Everything you need is in this folder:

- `askpapa-article.md` — the article text with image markers.
- `images/` — 5 app screenshots, 4 architecture diagrams, hero art, and Papa.
- `diagrams/*.mmd` — editable Mermaid sources for the diagrams. Re-render with:
  `npx -y @mermaid-js/mermaid-cli -i diagrams/<name>.mmd -o images/diagram-<name>.png -b white -w 1600 --scale 2`

## Steps

1. Go to medium.com → your avatar → **Write**.
2. Paste the article text section by section (Medium handles headings, bold, and lists when pasted from a rendered Markdown preview; from raw text you may need to re-apply `##` headings with Medium's `T` toolbar).
3. At every `![...](images/...)` marker, delete the marker line and insert the matching image with the `+` button → image. Order of appearance:

   | # | File | Where it goes |
   |---|------|----------------|
   | 1 | `images/hero.png` | Directly under the subtitle (also the cover) |
   | 2 | `images/papa-laugh.png` | "Meet Papa" section |
   | 3 | `images/dashboard.jpg` | After the health score paragraph |
   | 4 | `images/goals.jpg` | "Goals with a reality check" |
   | 5 | `images/plan.jpg` | "A plan, not a lecture" |
   | 6 | `images/discover.jpg` | "Discover, with reasons attached" |
   | 7 | `images/portfolio.jpg` | After the Discover paragraph |
   | 8 | `images/diagram-topology.png` | "The shape of the system" |
   | 9 | `images/diagram-llm-pattern.png` | "The quant decides, the LLM explains" |
   | 10 | `images/diagram-recommendation-pipeline.png` | "Life of a recommendation" |
   | 11 | `images/diagram-encryption-flow.png` | "Privacy as architecture" |

4. Add captions to the screenshots (Medium shows them small and grey), e.g. "The dashboard: one screen, no jargon."
5. Title and subtitle are the first two lines of the article. Set the **cover image** to `hero.png` (or `dashboard.jpg` if you prefer a product shot in previews).

## Suggested metadata

- **Tags** (Medium allows 5): `Personal Finance`, `Artificial Intelligence`, `Side Project`, `Software Architecture`, `India`
- **Publications worth submitting to**: Level Up Coding, ILLUMINATION, Better Programming (if reopen), The Startup — any accepts increases reach substantially vs self publish.
- **SEO title** (Settings → SEO): "How I Built AskPapa, an AI Money Mentor for India, on a $0 Stack"

## Before you hit publish

- The screenshots use synthetic persona data (Priya Nair, Rohit Malhotra, etc.) — safe to publish. They show the older "Your money buddy" tagline in the sidebar; recapture later if you want current branding.
- Nothing in the article exposes scoring weights, prompts, secrets, server addresses, or key derivation details. Keep it that way if you edit.
- Read the article once out loud. Anything that does not sound like you, change.
