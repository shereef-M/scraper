const fs = require("fs");
const cheerio = require("cheerio");

const startUrl = "https://books.toscrape.com/catalogue/page-1.html";

async function fetchAndCache(url, cachePath) {
  if (fs.existsSync(cachePath)) {
    console.log(`CACHE HIT: ${cachePath}`);
    return fs.readFileSync(cachePath, "utf8");
  }

  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "FlyRankInternshipA9/1.0 (+https://github.com/shereef-M/scraper)",
    },
    signal: AbortSignal.timeout(5000),
  });

  if (response.status !== 200) {
    throw new Error(`Request failed with status ${response.status} for ${url}`);
  }

  const html = await response.text();
  fs.mkdirSync("cache", { recursive: true });
  fs.writeFileSync(cachePath, html);
  console.log(`FETCH: ${url}`);

  // Politeness delay — only after a real network fetch
  await new Promise((resolve) => setTimeout(resolve, 500));

  return html;
}

function extractBookRecord(html, url, sourcePage) {
  const $ = cheerio.load(html);

  const title = $("div.product_main h1").text().trim();
  const product_url = url;
  const price_text = $("p.price_color").text().trim();
  const availability_text = $("p.availability").text().trim();

  const ratingClass = $("p.star-rating").attr("class");
  const rating_text = ratingClass
    ? ratingClass.split(" ").find((className) => className !== "star-rating")
    : null;

  const descriptionElement = $("#product_description + p");
  const description = descriptionElement.length
    ? descriptionElement.text().trim()
    : null;

  const source_page = sourcePage;
  const fetched_at = new Date().toISOString();

  return {
    title,
    product_url,
    price_text,
    availability_text,
    rating_text,
    description,
    source_page,
    fetched_at,
  };
}

async function main() {
  try {
    // discoveredUrls now stores { url, sourcePage } pairs, not just urls
    const discoveredUrls = [];

    let currentUrl = startUrl;
    let pageNumber = 0;

    while (currentUrl && pageNumber < 3) {
      pageNumber++;
      console.log(`\nProcessing page ${pageNumber}: ${currentUrl}`);

      const cachePath = `cache/catalogue-page-${pageNumber}.html`;
      const html = await fetchAndCache(currentUrl, cachePath);
      const $ = cheerio.load(html);
      const thisPageUrl = currentUrl;

      $("article.product_pod h3 a").each((index, element) => {
        const href = $(element).attr("href");
        if (href) {
          const absoluteUrl = new URL(href, currentUrl).href;
          discoveredUrls.push({ url: absoluteUrl, sourcePage: thisPageUrl });
        }
      });

      const nextHref = $("li.next a").attr("href");
      if (nextHref) {
        currentUrl = new URL(nextHref, currentUrl).href;
      } else {
        currentUrl = null;
      }
    }

    // Dedupe by url, keeping the first sourcePage seen for each
    const seen = new Map();
    for (const entry of discoveredUrls) {
      if (!seen.has(entry.url)) {
        seen.set(entry.url, entry.sourcePage);
      }
    }

    console.log(`\ncatalogue_pages=${pageNumber}`);
    console.log(`discovered=${discoveredUrls.length}`);
    console.log(`unique_urls=${seen.size}`);

    // Stage 3: visit every book page and extract a raw record
    const records = [];

    for (const [bookUrl, sourcePage] of seen.entries()) {
      const urlParts = bookUrl.split("/").filter(Boolean);
      const bookSlug = urlParts[urlParts.length - 2];
      const bookCachePath = `cache/book-${bookSlug}.html`;

      const bookHtml = await fetchAndCache(bookUrl, bookCachePath);
      const record = extractBookRecord(bookHtml, bookUrl, sourcePage);

      records.push(record);
    }

    console.log("\nSample record:");
    console.log(records[0]);
    console.log(`\ndetail_pages=${records.length}`);
  } catch (error) {
    console.error("Error:", error.message);
  }
}

main();
