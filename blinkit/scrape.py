"""Build a SQLite database of Blinkit products using Firecrawl.

Usage:
    python -m blinkit.scrape discover            # find category pages
    python -m blinkit.scrape scrape --limit 5    # scrape 5 categories into the DB
    python -m blinkit.scrape url <category-url>  # scrape one page directly
    python -m blinkit.scrape stats               # what's in the DB
"""

import argparse
import hashlib
import os
import re
import sys
import time

from dotenv import load_dotenv
from firecrawl import Firecrawl
from pydantic import BaseModel, Field

from blinkit import db

BASE_URL = "https://blinkit.com"
# Category listing pages look like https://blinkit.com/cn/vegetables-fruits/cid/1487/1489
CATEGORY_RE = re.compile(r"^https://blinkit\.com/cn/[^?#]+/cid/\d+/\d+/?$")
# Product pages look like https://blinkit.com/prn/amul-taaza-milk/prid/19512
PRODUCT_ID_RE = re.compile(r"/prid/(\d+)")


# ---- What we ask Firecrawl to extract from each page --------------------

class Product(BaseModel):
    name: str = Field(description="Product name as shown on the card")
    brand: str | None = Field(None, description="Brand, if shown or obvious from the name")
    unit: str | None = Field(None, description="Pack size / quantity, e.g. '500 ml', '1 kg', '6 pieces'")
    price: float | None = Field(None, description="Selling price in rupees, number only")
    mrp: float | None = Field(None, description="Struck-through MRP in rupees, number only, if shown")
    discount_pct: float | None = Field(None, description="Discount percent shown on the card, number only")
    in_stock: bool | None = Field(None, description="False if the card says 'Out of stock'")
    product_url: str | None = Field(None, description="Absolute link to the product page (contains /prid/)")
    image_url: str | None = Field(None, description="Product image URL")


class CategoryPage(BaseModel):
    category_name: str | None = Field(None, description="Name of the category being listed")
    products: list[Product]


EXTRACT_PROMPT = (
    "This is a Blinkit grocery category listing. Extract every product card on the page "
    "with its name, brand, pack size, selling price, MRP, discount and stock status. "
    "Prices are in Indian rupees; return plain numbers without the ₹ sign."
)


# ---- Firecrawl helpers ---------------------------------------------------

def make_client() -> Firecrawl:
    key = os.getenv("FIRECRAWL_API_KEY")
    if not key:
        sys.exit("FIRECRAWL_API_KEY is not set. Copy .env.example to .env and add your key.")
    return Firecrawl(api_key=key)


def location_headers() -> dict[str, str]:
    """Blinkit reads the delivery location from cookies; without it the
    site shows a 'select location' prompt instead of prices."""
    lat = os.getenv("BLINKIT_LAT", "28.6315")
    lon = os.getenv("BLINKIT_LON", "77.2167")
    return {"Cookie": f"gr_1_lat={lat}; gr_1_lon={lon}"}


def discover_categories(fc: Firecrawl, limit: int) -> list[str]:
    result = fc.map(BASE_URL, search="cn", limit=limit, location={"country": "IN"})
    urls = {link.url.rstrip("/") for link in result.links}
    return sorted(u for u in urls if CATEGORY_RE.match(u))


def scrape_page(fc: Firecrawl, url: str) -> CategoryPage:
    doc = fc.scrape(
        url,
        formats=[{"type": "json", "prompt": EXTRACT_PROMPT, "schema": CategoryPage.model_json_schema()}],
        headers=location_headers(),
        location={"country": "IN", "languages": ["en-IN"]},
        # Listings load lazily: wait for the grid, then scroll to load more cards.
        actions=[
            {"type": "wait", "milliseconds": 3000},
            {"type": "scroll", "direction": "down"},
            {"type": "wait", "milliseconds": 1500},
            {"type": "scroll", "direction": "down"},
            {"type": "wait", "milliseconds": 1500},
        ],
        only_main_content=False,
        timeout=120_000,
    )
    return CategoryPage.model_validate(doc.json or {"products": []})


# ---- Cleaning -------------------------------------------------------------

def product_id(p: Product) -> str:
    """Use Blinkit's own product id when we have the URL, otherwise a stable
    hash of name + pack size so re-scrapes update the same row."""
    if p.product_url and (m := PRODUCT_ID_RE.search(p.product_url)):
        return m.group(1)
    key = f"{p.name.strip().lower()}|{(p.unit or '').strip().lower()}"
    return "h_" + hashlib.sha1(key.encode()).hexdigest()[:12]


def to_rows(page: CategoryPage) -> list[dict]:
    rows = {}
    for p in page.products:
        if not p.name:
            continue
        url = p.product_url
        if url and url.startswith("/"):
            url = BASE_URL + url
        discount = p.discount_pct
        if discount is None and p.price and p.mrp and p.mrp > p.price:
            discount = round((p.mrp - p.price) / p.mrp * 100, 1)
        row = p.model_dump()
        row.update(
            product_id=product_id(p),
            product_url=url,
            discount_pct=discount,
            in_stock=None if p.in_stock is None else int(p.in_stock),
        )
        rows[row["product_id"]] = row  # de-dupe within a page
    return list(rows.values())


# ---- Commands -------------------------------------------------------------

def cmd_discover(args, conn):
    fc = make_client()
    urls = discover_categories(fc, args.limit)
    added = db.add_categories(conn, urls)
    print(f"Found {len(urls)} category pages, {added} new. Run `scrape` next.")


def scrape_one(fc, conn, url):
    page = scrape_page(fc, url)
    rows = to_rows(page)
    db.save_products(conn, rows, page.category_name)
    db.mark_category_scraped(conn, url, page.category_name)
    print(f"  {len(rows):4d} products  {page.category_name or ''}  {url}")
    return len(rows)


def cmd_scrape(args, conn):
    fc = make_client()
    urls = db.pending_categories(conn, args.limit)
    if not urls:
        sys.exit("No categories in the DB. Run `discover` first, or use `url <link>`.")
    total = 0
    for i, url in enumerate(urls, 1):
        print(f"[{i}/{len(urls)}]", end="")
        try:
            total += scrape_one(fc, conn, url)
        except Exception as e:  # keep going; one bad page shouldn't stop the run
            print(f"  FAILED {url}: {e}")
        time.sleep(args.delay)
    print(f"Done. Saved {total} product snapshots to {args.db}")


def cmd_url(args, conn):
    fc = make_client()
    db.add_categories(conn, [args.url])
    scrape_one(fc, conn, args.url)


def cmd_stats(args, conn):
    q = lambda sql: conn.execute(sql).fetchone()[0]
    print(f"categories:      {q('SELECT COUNT(*) FROM categories')} "
          f"({q('SELECT COUNT(*) FROM categories WHERE scraped_at IS NOT NULL')} scraped)")
    print(f"products:        {q('SELECT COUNT(*) FROM products')}")
    print(f"price snapshots: {q('SELECT COUNT(*) FROM price_snapshots')}")


def main(argv=None):
    load_dotenv()
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--db", default="blinkit.db", help="SQLite file (default: blinkit.db)")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("discover", help="find category pages with Firecrawl map")
    p.add_argument("--limit", type=int, default=5000, help="max URLs to map")
    p.set_defaults(func=cmd_discover)

    p = sub.add_parser("scrape", help="scrape category pages into the DB")
    p.add_argument("--limit", type=int, default=None, help="only scrape N categories")
    p.add_argument("--delay", type=float, default=2.0, help="seconds between pages")
    p.set_defaults(func=cmd_scrape)

    p = sub.add_parser("url", help="scrape a single category URL")
    p.add_argument("url")
    p.set_defaults(func=cmd_url)

    p = sub.add_parser("stats", help="show DB counts")
    p.set_defaults(func=cmd_stats)

    args = parser.parse_args(argv)
    conn = db.connect(args.db)
    args.func(args, conn)


if __name__ == "__main__":
    main()
