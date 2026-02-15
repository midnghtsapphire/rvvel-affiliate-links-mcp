# Rvvel Affiliate Links MCP Server

Central hub for managing affiliate links across all Rvvel applications and AI agents. One source of truth for the entire ecosystem.

## Overview

The Rvvel Affiliate Links MCP Server provides a unified interface for storing, retrieving, searching, and tracking affiliate links. Any application, AI agent, or skill in the Rvvel ecosystem can query this server to get the best affiliate links for any category or product.

**Key features:**
- Store affiliate links with metadata (program, product, commission rate, category, expiry)
- Retrieve links by category, program, or commission rate
- Full-text search across all stored links
- Track clicks, conversions, and revenue per link
- Export links as JSON or CSV
- One source of truth for the entire Rvvel ecosystem

## Installation

```bash
npm install rvvel-affiliate-links-mcp
```

Or install globally:

```bash
npm install -g rvvel-affiliate-links-mcp
```

## Usage

### Start the MCP Server

```bash
npx rvvel-affiliate-links-mcp
```

The server will start listening on stdio and create a SQLite database at `rvvel-affiliate-links.db`.

### Configure in Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "rvvel-affiliate-links": {
      "command": "npx",
      "args": ["rvvel-affiliate-links-mcp"]
    }
  }
}
```

### Use in Your Application

Once configured, you can use the MCP tools:

#### 1. Store an Affiliate Link

```
Tool: store_affiliate_link
Input:
{
  "program": "Amazon Associates",
  "product": "Ergonomic Office Chair",
  "link": "https://amazon.com/dp/B123456789?tag=rvvel-20",
  "commissionRate": 4.5,
  "category": "office-furniture",
  "tags": ["ergonomic", "wfh", "productivity"],
  "notes": "Great for ADHD-friendly workspace setup"
}

Output:
{
  "success": true,
  "linkId": "aff_1708000000000_abc123",
  "message": "Affiliate link stored: Ergonomic Office Chair (Amazon Associates)"
}
```

#### 2. Get Links by Category

```
Tool: get_affiliate_links
Input:
{
  "category": "office-furniture",
  "minCommission": 3,
  "limit": 10
}

Output:
{
  "count": 5,
  "links": [
    {
      "id": "aff_1708000000000_abc123",
      "program": "Amazon Associates",
      "product": "Ergonomic Office Chair",
      "link": "https://amazon.com/dp/B123456789?tag=rvvel-20",
      "commissionRate": 4.5,
      "category": "office-furniture",
      "clicks": 42,
      "conversions": 3,
      "revenue": 67.50
    }
  ]
}
```

#### 3. Get Best Link for a Category

```
Tool: get_best_link
Input:
{
  "category": "office-furniture"
}

Output:
{
  "id": "aff_1708000000000_abc123",
  "product": "Ergonomic Office Chair",
  "program": "Amazon Associates",
  "link": "https://amazon.com/dp/B123456789?tag=rvvel-20",
  "commissionRate": 4.5,
  "category": "office-furniture"
}
```

#### 4. Search Links

```
Tool: search_links
Input:
{
  "query": "monitor",
  "limit": 20
}

Output:
{
  "query": "monitor",
  "count": 3,
  "links": [
    {
      "id": "aff_1708000000001_def456",
      "product": "4K USB-C Monitor 27 inch",
      "program": "Amazon Associates",
      "link": "https://amazon.com/dp/B987654321?tag=rvvel-20",
      "commissionRate": 4.5,
      "category": "tech-peripherals"
    }
  ]
}
```

#### 5. Get Link Statistics

```
Tool: get_stats
Input:
{
  "linkId": "aff_1708000000000_abc123"
}

Output:
{
  "linkId": "aff_1708000000000_abc123",
  "product": "Ergonomic Office Chair",
  "program": "Amazon Associates",
  "clicks": 42,
  "conversions": 3,
  "revenue": 67.50,
  "conversionRate": "7.14%"
}
```

#### 6. Track a Click

```
Tool: track_click
Input:
{
  "linkId": "aff_1708000000000_abc123",
  "source": "email-newsletter",
  "userId": "user_12345"
}

Output:
{
  "success": true,
  "message": "Click tracked"
}
```

#### 7. Track a Conversion

```
Tool: track_conversion
Input:
{
  "linkId": "aff_1708000000000_abc123",
  "amount": 22.50,
  "orderId": "amzn_order_123456"
}

Output:
{
  "success": true,
  "message": "Conversion tracked: $22.50"
}
```

#### 8. Export Links

```
Tool: export_links
Input:
{
  "format": "json"
}

Output:
[
  {
    "id": "aff_1708000000000_abc123",
    "program": "Amazon Associates",
    "product": "Ergonomic Office Chair",
    "link": "https://amazon.com/dp/B123456789?tag=rvvel-20",
    "commissionRate": 4.5,
    "category": "office-furniture",
    "tags": ["ergonomic", "wfh", "productivity"],
    "clicks": 42,
    "conversions": 3,
    "revenue": 67.50,
    "notes": "Great for ADHD-friendly workspace setup"
  }
]
```

## Supported Affiliate Programs

- Amazon Associates
- ShareASale
- CJ Affiliate
- Rakuten Advertising
- Impact
- Custom (any affiliate program)

## Database Schema

### affiliate_links

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PRIMARY KEY | Unique link ID |
| program | TEXT | Affiliate program name |
| product | TEXT | Product name/description |
| link | TEXT UNIQUE | Affiliate link URL |
| commission_rate | REAL | Commission percentage (0-100) |
| category | TEXT | Product category |
| tags | TEXT (JSON) | Optional tags array |
| expiry | TEXT | Optional expiry date (ISO 8601) |
| created_at | TEXT | Creation timestamp |
| updated_at | TEXT | Last update timestamp |
| clicks | INTEGER | Total clicks |
| conversions | INTEGER | Total conversions |
| revenue | REAL | Total revenue generated |
| notes | TEXT | Optional notes |

### link_clicks

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PRIMARY KEY | Click event ID |
| link_id | TEXT | Foreign key to affiliate_links |
| timestamp | TEXT | Click timestamp |
| source | TEXT | Traffic source (email, social, blog, etc.) |
| user_id | TEXT | Optional user ID |

### link_conversions

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PRIMARY KEY | Conversion event ID |
| link_id | TEXT | Foreign key to affiliate_links |
| timestamp | TEXT | Conversion timestamp |
| amount | REAL | Sale amount |
| order_id | TEXT | Optional order ID from affiliate program |

## Integration with Revvel

The Rvvel Affiliate Links MCP Server integrates seamlessly with the main Revvel application:

1. **Affiliate Pipeline** — Auto-discovers products and stores links via `store_affiliate_link`
2. **Product Recommendations** — Retrieves best links per category via `get_best_link`
3. **Campaign Generation** — Searches for relevant links via `search_links`
4. **Analytics Dashboard** — Tracks performance via `get_stats` and `track_click`/`track_conversion`
5. **Revenue Reporting** — Exports data via `export_links`

## Development

### Install Dependencies

```bash
npm install
```

### Run Tests

```bash
npm test
```

### Build

```bash
npm run build
```

### Development Mode

```bash
npm run dev
```

## License

MIT

## Support

For issues, questions, or contributions, visit: https://github.com/MIDNGHTSAPPHIRE/rvvel-affiliate-links-mcp

---

**Built with ❤️ for the Rvvel ecosystem**
