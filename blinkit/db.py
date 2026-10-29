"""SQLite storage for Blinkit products.

Two tables:
  products         - one row per product (name, brand, pack size, links)
  price_snapshots  - one row per product per scrape, so you can track
                     price / discount / stock changes over time
"""

import sqlite3
from datetime import datetime, timezone

SCHEMA = """
CREATE TABLE IF NOT EXISTS categories (
    url         TEXT PRIMARY KEY,
    name        TEXT,
    scraped_at  TEXT
);

CREATE TABLE IF NOT EXISTS products (
    product_id  TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    brand       TEXT,
    unit        TEXT,
    category    TEXT,
    product_url TEXT,
    image_url   TEXT,
    first_seen  TEXT NOT NULL,
    last_seen   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS price_snapshots (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id   TEXT NOT NULL REFERENCES products(product_id),
    price        REAL,
    mrp          REAL,
    discount_pct REAL,
    in_stock     INTEGER,
    scraped_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_snapshots_product ON price_snapshots(product_id, scraped_at);
"""


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def connect(path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    return conn


def add_categories(conn: sqlite3.Connection, urls: list[str]) -> int:
    before = conn.total_changes
    conn.executemany(
        "INSERT OR IGNORE INTO categories (url) VALUES (?)", [(u,) for u in urls]
    )
    conn.commit()
    return conn.total_changes - before


def pending_categories(conn: sqlite3.Connection, limit: int | None = None) -> list[str]:
    sql = "SELECT url FROM categories ORDER BY scraped_at IS NOT NULL, scraped_at"
    if limit:
        sql += f" LIMIT {int(limit)}"
    return [r["url"] for r in conn.execute(sql)]


def mark_category_scraped(conn: sqlite3.Connection, url: str, name: str | None) -> None:
    conn.execute(
        "UPDATE categories SET scraped_at = ?, name = COALESCE(?, name) WHERE url = ?",
        (now(), name, url),
    )
    conn.commit()


def save_products(conn: sqlite3.Connection, products: list[dict], category: str | None) -> int:
    ts = now()
    for p in products:
        conn.execute(
            """
            INSERT INTO products (product_id, name, brand, unit, category,
                                  product_url, image_url, first_seen, last_seen)
            VALUES (:product_id, :name, :brand, :unit, :category,
                    :product_url, :image_url, :ts, :ts)
            ON CONFLICT(product_id) DO UPDATE SET
                name        = excluded.name,
                brand       = COALESCE(excluded.brand, products.brand),
                unit        = COALESCE(excluded.unit, products.unit),
                category    = COALESCE(excluded.category, products.category),
                product_url = COALESCE(excluded.product_url, products.product_url),
                image_url   = COALESCE(excluded.image_url, products.image_url),
                last_seen   = excluded.last_seen
            """,
            {**p, "category": category, "ts": ts},
        )
        conn.execute(
            """
            INSERT INTO price_snapshots (product_id, price, mrp, discount_pct, in_stock, scraped_at)
            VALUES (:product_id, :price, :mrp, :discount_pct, :in_stock, :ts)
            """,
            {**p, "ts": ts},
        )
    conn.commit()
    return len(products)
