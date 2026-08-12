# Polite Scraper — Books to Scrape

A small, polite scraping pipeline built for FlyRank Internship Backend Track, Week 5, Assignment A9.

## Target classification

**Site:** [Books to Scrape](https://books.toscrape.com)

**Why this is appropriate:** Books to Scrape is a sandbox site built specifically for people to practise
web scraping on. Its own homepage states "We love being scraped!" and displays a banner explaining that
it is a demo website for web scraping purposes, with prices and ratings randomly assigned and holding no
real meaning. This is the only kind of site this assignment touches.

**Scope:** The first 3 catalogue pages only, and the individual book pages linked from them (60 book pages
in total).

**Data collected:** Book title, price, availability, star rating, and description — all publicly displayed
on each book's page.

**robots.txt check:** Requested `https://books.toscrape.com/robots.txt` — the site returned a 404 Not
Found. No robots file found. A missing file is not permission, it is just a missing file; permission here
instead comes from the site's own explicit invitation to be scraped.

I will not reuse this code on another site without checking its rules and terms first.

## How to run

### Install

Requires Node.js 20+.

\`\`\`bash
git clone https://github.com/shereef-M/scraper.git
cd scraper
npm install
\`\`\`

### Run

\`\`\`bash
node src/index.js
\`\`\`

This will:

- Fetch and cache the first 3 catalogue pages
- Discover and visit all 60 book detail pages
- Extract, normalize, and validate each record
- Write \`output/books.json\`, \`output/errors.json\`, and \`output/run-report.json\`

Running it a second time reuses the cache in \`cache/\` and produces the same 60 records — safe to re-run.

## Record schema

Each validated record in \`output/books.json\` has the following fields:

| Field                 | Type                   | Notes                                                                                     |
| --------------------- | ---------------------- | ----------------------------------------------------------------------------------------- |
| \`title\`             | string                 | Book title                                                                                |
| \`product_url\`       | string (URL)           | Absolute URL — used as the record's canonical identity                                    |
| \`price_gbp\`         | number                 | Price as a real number, parsed from \`price_text\` (e.g. \`51.77\`)                       |
| \`price_text\`        | string                 | Original price as shown on the page (e.g. \`"£51.77"\`) — kept alongside the parsed value |
| \`availability_text\` | string                 | Stock status as shown on the page (e.g. \`"In stock (22 available)"\`)                    |
| \`rating_text\`       | string or null         | Star rating as a word (e.g. \`"Three"\`)                                                  |
| \`description\`       | string or null         | Book description; \`null\` if the page had none — never invented                          |
| \`source_page\`       | string (URL)           | Which catalogue page this book was discovered on                                          |
| \`fetched_at\`        | string (ISO timestamp) | When this record was fetched                                                              |

Records are validated against a Zod schema before being written to \`books.json\`. Any record that fails
validation is written to \`output/errors.json\` instead, along with the reason it failed.

## Politeness rules

- **User-agent**: every request identifies itself with \`FlyRankInternshipA9/1.0 (+https://github.com/shereef-M/scraper)\`, so a site owner reviewing their logs can see who made the request and where to find more information.
- **Timeout**: every request gives up after 5 seconds rather than hanging indefinitely.
- **Delay**: a 500ms pause follows every real network fetch, so the site is only touched once per request rather than being hammered. Cached pages skip this delay entirely, since they never leave this machine.
- **Caching**: every page fetched is saved to \`cache/\` and reused on subsequent runs, so repeated development and testing sends far fewer requests to the actual site.
- **Retry discipline**: timeouts and server errors (5xx) get one retry after a short wait; a 404 or 403 is never retried, since the page either doesn't exist or the site has explicitly said no.

No browser was needed for this assignment: the data (title, price, availability, rating, description) is
already present in the HTML the server sends back — a browser would only add cost (memory, startup time,
complexity) without revealing any data that isn't already there.

## Sample run report

\`\`\`json
{
"start_time": "2026-08-12T10:25:36.938Z",
"duration_ms": 362,
"pages_fetched": 3,
"valid_records": 60,
"invalid_records": 0,
"failed_pages": 0
}
\`\`\`

## Ethics note

This scraper only touches Books to Scrape, a site built specifically to be scraped for practice, and
nothing else. In general: I'd use an official API instead of scraping wherever one exists; I would never
bypass a login, paywall, or an explicit block (like a 403); and I would only collect the data actually
needed for the task at hand, not everything a page happens to expose.

## Limitations

- \`description\` scraping occasionally captures duplicated text due to how the page structures its content — this wasn't corrected, since the goal was to extract what's actually present, not rewrite it.
- The scraper currently handles only this specific site's HTML structure; it isn't written to generalize to other bookstores or catalogue sites without changes to the CSS selectors.
