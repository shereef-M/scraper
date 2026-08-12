const fs = require("fs");
const cheerio = require("cheerio");
const { z } = require("zod");

const startUrl = "https://books.toscrape.com/catalogue/page-1.html";

const BookSchema = z.object({
  title: z.string().min(1),
  product_url: z.string().url(),
  price_gbp: z.number().positive(),
  price_text: z.string(),
  availability_text: z.string(),
  rating_text: z.string().nullable(),
  description: z.string().nullable(),
  source_page: z.string().url(),
  fetched_at: z.string(),
});

async function fetchAndCache(url, cachePath) {
  // Check cache first
  if (fs.existsSync(cachePath)) {
    console.log(`CACHE HIT: ${cachePath}`);
    return fs.readFileSync(cachePath, "utf8");
  }

  // Try at most 2 times
  for (let attempt = 1; attempt <= 2; attempt++) {
    let response;

    try {
      response = await fetch(url, {
        headers: {
          "User-Agent":
            "FlyRankInternshipA9/1.0 (+https://github.com/shereef-M/scraper)",
        },
        signal: AbortSignal.timeout(5000),
      });
    } catch (error) {
      // Network error or timeout
      if (attempt === 1) {
        console.log("Fetch failed. Retrying in 1 second...");

        await new Promise((resolve) => setTimeout(resolve, 1000));

        continue;
      }

      throw error;
    }

    // 5xx → retry once
    if (response.status >= 500) {
      if (attempt === 1) {
        console.log(`Server error ${response.status}. Retrying in 1 second...`);

        await new Promise((resolve) => setTimeout(resolve, 1000));

        continue;
      }

      throw new Error(
        `Request failed with status ${response.status} for ${url}`,
      );
    }

    // 403, 404, etc. → do NOT retry
    if (response.status !== 200) {
      throw new Error(
        `Request failed with status ${response.status} for ${url}`,
      );
    }

    // Successful response
    const html = await response.text();

    fs.mkdirSync("cache", {
      recursive: true,
    });

    fs.writeFileSync(cachePath, html);

    console.log(`FETCH: ${url}`);

    // Politeness delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    return html;
  }
}

function parsePrice(priceText) {
  // "£51.77" -> strip everything except digits and the decimal point
  const cleaned = priceText.replace(/[^0-9.]/g, "");
  return parseFloat(cleaned);
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
    const startTime = Date.now();
    let cacheHits = 0;
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
    let failedPages = 0;

    for (const [bookUrl, sourcePage] of seen.entries()) {
      try {
        const urlParts = bookUrl.split("/").filter(Boolean);
        const bookSlug = urlParts[urlParts.length - 2];
        const bookCachePath = `cache/book-${bookSlug}.html`;

        const bookHtml = await fetchAndCache(bookUrl, bookCachePath);
        const record = extractBookRecord(bookHtml, bookUrl, sourcePage);

        records.push(record);
      } catch (error) {
        console.log(`SKIPPED (failed): ${bookUrl} — ${error.message}`);
        failedPages++;
      }
    }
    // Stage 4: normalize, validate, and split into good/bad
    const validRecords = [];
    const invalidRecords = [];

    for (const rawRecord of records) {
      const result = normalizeAndValidate(rawRecord);
      if (result.valid) {
        validRecords.push(result.record);
      } else {
        invalidRecords.push({ record: result.record, reason: result.reason });
      }
    }

    // Dedupe by product_url (canonical identity) — idempotency
    const uniqueValidRecords = Array.from(
      new Map(validRecords.map((r) => [r.product_url, r])).values(),
    );

    fs.mkdirSync("output", { recursive: true });
    fs.writeFileSync(
      "output/books.json",
      JSON.stringify(uniqueValidRecords, null, 2),
    );
    fs.writeFileSync(
      "output/errors.json",
      JSON.stringify(invalidRecords, null, 2),
    );

    console.log(`\nvalid_records=${uniqueValidRecords.length}`);
    console.log(`invalid_records=${invalidRecords.length}`);
    const runReport = {
      start_time: new Date(startTime).toISOString(),
      duration_ms: Date.now() - startTime,
      pages_fetched: pageNumber,
      valid_records: uniqueValidRecords.length,
      invalid_records: invalidRecords.length,
      failed_pages: failedPages,
    };

    fs.writeFileSync(
      "output/run-report.json",
      JSON.stringify(runReport, null, 2),
    );

    console.log("\nRun report:");
    console.log(runReport);

    console.log("\nSample record:");
    console.log(records[0]);
    console.log(`\ndetail_pages=${records.length}`);
  } catch (error) {
    console.error("Error:", error.message);
  }
}
function normalizeAndValidate(rawRecord) {
  const cleanRecord = {
    ...rawRecord,
    price_gbp: parsePrice(rawRecord.price_text),
  };
  const result = BookSchema.safeParse(cleanRecord);
  if (result.success) {
    return {
      record: result.data,
      valid: true,
    };
  }

  return {
    valid: false,
    reason: result.error.message,
    record: rawRecord,
  };
}

main();
