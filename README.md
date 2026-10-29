# basic-understanding
learning

## Blinkit product database (Firecrawl + SQLite)

`blinkit/` uses [Firecrawl](https://firecrawl.dev) to find Blinkit category pages,
pull structured product data from them with an LLM extraction schema, and save it to a
local SQLite file (`blinkit.db`). Each run adds a new price snapshot, so you
build a **price history** over time.

### Setup

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # then put your FIRECRAWL_API_KEY in .env
```

In `.env`, set `BLINKIT_LAT` / `BLINKIT_LON` to your area. Blinkit prices and stock
depend on the delivery location.

### Run

```bash
python -m blinkit.scrape discover            # map blinkit.com -> category URLs
python -m blinkit.scrape scrape --limit 3    # try 3 categories first
python -m blinkit.scrape stats
```

Or test with one page:

```bash
python -m blinkit.scrape url https://blinkit.com/cn/milk/cid/14/922
```

### Tables

| table | what's in it |
|---|---|
| `categories` | category URLs found by `discover`, plus when each was last scraped |
| `products` | one row per product: name, brand, unit, category, URL, image |
| `price_snapshots` | price, MRP, discount %, in-stock for each product on every scrape |

Example queries (`sqlite3 blinkit.db`):

```sql
-- latest price of every product
SELECT p.name, p.unit, s.price, s.mrp, s.discount_pct
FROM products p JOIN price_snapshots s ON s.product_id = p.product_id
WHERE s.scraped_at = (SELECT MAX(scraped_at) FROM price_snapshots WHERE product_id = p.product_id)
ORDER BY s.discount_pct DESC;

-- price history for one product
SELECT scraped_at, price FROM price_snapshots WHERE product_id = '19512' ORDER BY scraped_at;
```

### Notes

- Each page scrape with JSON extraction uses Firecrawl credits. Start with `--limit`.
- Scrape slowly (`--delay`) and check Blinkit's terms of use before you collect data at scale.
