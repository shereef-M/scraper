const fs = require("fs");
const cheerio = require("cheerio");

const startUrl = "https://books.toscrape.com/catalogue/page-1.html";

async function fetchAndCache(url, cachePath) {
  // Check if the page already exists in the cache
  if (fs.existsSync(cachePath)) {
    console.log(`CACHE HIT: ${cachePath}`);

    return fs.readFileSync(cachePath, "utf8");
  }

  // Fetch the page
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "FlyRankInternshipA9/1.0 (+https://github.com/shereef-M/scraper)",
    },
    signal: AbortSignal.timeout(5000),
  });

  // Only continue if the response was successful
  if (response.status !== 200) {
    throw new Error(`Request failed with status ${response.status} for ${url}`);
  }

  // Get the HTML
  const html = await response.text();

  // Make sure the cache folder exists
  fs.mkdirSync("cache", { recursive: true });

  // Save the page
  fs.writeFileSync(cachePath, html);

  console.log(`FETCH: ${url}`);

  return html;
}

async function main() {
  try {
    // Store all discovered book URLs here
    const discoveredUrls = [];

    let currentUrl = startUrl;
    let pageNumber = 0;

    // Follow pages until there is no "next" link
    // The assignment asks for the first 3 pages
    while (currentUrl && pageNumber < 3) {
      pageNumber++;

      console.log(`\nProcessing page ${pageNumber}: ${currentUrl}`);

      // Create the cache filename
      const cachePath = `cache/catalogue-page-${pageNumber}.html`;

      // Get the HTML using our reusable function
      const html = await fetchAndCache(currentUrl, cachePath);

      // Load the HTML into Cheerio
      const $ = cheerio.load(html);

      // Find every book link
      $("article.product_pod h3 a").each((index, element) => {
        const href = $(element).attr("href");

        if (href) {
          // Convert relative URL into absolute URL
          const absoluteUrl = new URL(href, currentUrl).href;

          discoveredUrls.push(absoluteUrl);
        }
      });

      // Find the "next" link
      const nextHref = $("li.next a").attr("href");

      if (nextHref) {
        // Convert the next page's relative URL into an absolute URL
        currentUrl = new URL(nextHref, currentUrl).href;
      } else {
        // No next page, so stop
        currentUrl = null;
      }
    }

    // Remove duplicate URLs
    const uniqueUrls = new Set(discoveredUrls);

    // Print the required results
    console.log(`\ncatalogue_pages=${pageNumber}`);
    console.log(`discovered=${discoveredUrls.length}`);
    console.log(`unique_urls=${uniqueUrls.size}`);
  } catch (error) {
    console.error("Error:", error.message);
  }
}

main();
