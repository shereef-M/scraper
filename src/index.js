const fs = require("fs");

const url = "https://books.toscrape.com/catalogue/page-1.html";
const cachePath = "cache/catalogue-page-1.html";

async function main() {
  try {
    let html;

    // 1. Check if the cached file already exists
    if (fs.existsSync(cachePath)) {
      // 2. Read the cached file
      html = fs.readFileSync(cachePath, "utf8");

      console.log("CACHE HIT");
    } else {
      // 3. Fetch the website
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "FlyRankInternshipA9/1.0 (+https://github.com/shereef-M/scraper)",
        },

        // 4. Stop the request if it takes longer than 5 seconds
        signal: AbortSignal.timeout(5000),
      });

      // 5. Only continue if the server returned 200
      if (response.status !== 200) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      // 6. Get the HTML from the response
      html = await response.text();

      // 7. Make sure the cache folder exists
      fs.mkdirSync("cache", { recursive: true });

      // 8. Save the HTML to the cache
      fs.writeFileSync(cachePath, html);

      console.log("FETCH");
    }

    // 9. Print the response size
    const size = Buffer.byteLength(html, "utf8");

    console.log(`Response size: ${size} bytes`);
  } catch (error) {
    console.error("Error:", error.message);
  }
}

main();
