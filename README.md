## Target classification

**Site:** [Books to Scrape](https://books.toscrape.com)

**Why this is appropriate:** Books to Scrape is a sandbox site built specifically for people to practise web scraping on. Its own homepage states "We love being scraped!" and displays a banner explaining that it is a demo website for web scraping purposes, with prices and ratings randomly assigned and holding no real meaning. This is the only kind of site this assignment touches.

**Scope:** The first 3 catalogue pages only, and the individual book pages linked from them (60 book pages in total).

**Data collected:** Book title, price, availability, star rating, and description — all publicly displayed on each book's page.

**robots.txt check:** Requested `https://books.toscrape.com/robots.txt` — the site returned a 404 Not Found. No robots file found. A missing file is not permission, it is just a missing file; permission hereinstead comes from the site's own explicit invitation to be scraped.

I will not reuse this code on another site without checking its rules and terms first.# scraper
