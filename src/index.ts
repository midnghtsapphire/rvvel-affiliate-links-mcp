#!/usr/bin/env node

/**
 * Rvvel Affiliate Links MCP Server
 * 
 * Central hub for managing affiliate links across all applications and AI agents.
 * 
 * Features:
 * - Store affiliate links with metadata (program, product, commission, category, expiry)
 * - Retrieve links by category, program, or commission rate
 * - Full-text search across all stored links
 * - Track clicks, conversions, and revenue per link
 * - Export links as JSON or CSV
 * - One source of truth for the entire Rvvel ecosystem
 * 
 * Usage:
 *   npx rvvel-affiliate-links-mcp
 * 
 * MCP Configuration:
 *   {
 *     "mcpServers": {
 *       "rvvel-affiliate-links": {
 *         "command": "npx",
 *         "args": ["rvvel-affiliate-links-mcp"]
 *       }
 *     }
 *   }
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { z } from "zod";

// ─── Types & Schemas ────────────────────────────────────────────

const AffiliateLink = z.object({
  id: z.string().optional(),
  program: z.string().describe("Affiliate program name (Amazon, ShareASale, etc.)"),
  product: z.string().describe("Product name or description"),
  link: z.string().url().describe("Affiliate link URL"),
  commissionRate: z.number().min(0).max(100).describe("Commission rate as percentage"),
  category: z.string().describe("Product category (tech, home, fitness, etc.)"),
  tags: z.array(z.string()).optional().describe("Additional tags for filtering"),
  expiry: z.string().datetime().optional().describe("Link expiry date"),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
  clicks: z.number().default(0),
  conversions: z.number().default(0),
  revenue: z.number().default(0),
  notes: z.string().optional(),
});

type AffiliateLink = z.infer<typeof AffiliateLink>;

// ─── Database Setup ─────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "..", "rvvel-affiliate-links.db");

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS affiliate_links (
    id TEXT PRIMARY KEY,
    program TEXT NOT NULL,
    product TEXT NOT NULL,
    link TEXT NOT NULL UNIQUE,
    commission_rate REAL NOT NULL,
    category TEXT NOT NULL,
    tags TEXT,
    expiry TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    clicks INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    revenue REAL DEFAULT 0,
    notes TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_program ON affiliate_links(program);
  CREATE INDEX IF NOT EXISTS idx_category ON affiliate_links(category);
  CREATE INDEX IF NOT EXISTS idx_commission ON affiliate_links(commission_rate);
  CREATE INDEX IF NOT EXISTS idx_created ON affiliate_links(created_at);

  CREATE TABLE IF NOT EXISTS link_clicks (
    id TEXT PRIMARY KEY,
    link_id TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    source TEXT,
    user_id TEXT,
    FOREIGN KEY(link_id) REFERENCES affiliate_links(id)
  );

  CREATE TABLE IF NOT EXISTS link_conversions (
    id TEXT PRIMARY KEY,
    link_id TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    amount REAL,
    order_id TEXT,
    FOREIGN KEY(link_id) REFERENCES affiliate_links(id)
  );

  CREATE INDEX IF NOT EXISTS idx_link_clicks ON link_clicks(link_id);
  CREATE INDEX IF NOT EXISTS idx_link_conversions ON link_conversions(link_id);
`);

// ─── Helper Functions ───────────────────────────────────────────

function generateId(): string {
  return `aff_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getAffiliateLink(id: string): AffiliateLink | null {
  const stmt = db.prepare("SELECT * FROM affiliate_links WHERE id = ?");
  const row = stmt.get(id) as any;
  if (!row) return null;

  return {
    id: row.id,
    program: row.program,
    product: row.product,
    link: row.link,
    commissionRate: row.commission_rate,
    category: row.category,
    tags: row.tags ? JSON.parse(row.tags) : [],
    expiry: row.expiry,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    clicks: row.clicks,
    conversions: row.conversions,
    revenue: row.revenue,
    notes: row.notes,
  };
}

function getAllAffiliateLinks(): AffiliateLink[] {
  const stmt = db.prepare("SELECT * FROM affiliate_links ORDER BY created_at DESC");
  const rows = stmt.all() as any[];
  return rows.map((row) => ({
    id: row.id,
    program: row.program,
    product: row.product,
    link: row.link,
    commissionRate: row.commission_rate,
    category: row.category,
    tags: row.tags ? JSON.parse(row.tags) : [],
    expiry: row.expiry,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    clicks: row.clicks,
    conversions: row.conversions,
    revenue: row.revenue,
    notes: row.notes,
  }));
}

// ─── MCP Server Setup ───────────────────────────────────────────

const server = new Server(
  {
    name: "rvvel-affiliate-links-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// ─── Tool: store_affiliate_link ──────────────────────────────────

server.setRequestHandler("tools/list", async () => ({
  tools: [
    {
      name: "store_affiliate_link",
      description:
        "Store a new affiliate link in the Rvvel database. Returns the link ID for tracking.",
      inputSchema: {
        type: "object",
        properties: {
          program: {
            type: "string",
            description: "Affiliate program (Amazon, ShareASale, CJ, Rakuten, Impact, etc.)",
          },
          product: {
            type: "string",
            description: "Product name or description",
          },
          link: {
            type: "string",
            description: "Full affiliate link URL",
          },
          commissionRate: {
            type: "number",
            description: "Commission rate as percentage (0-100)",
          },
          category: {
            type: "string",
            description: "Product category (tech, home, fitness, finance, etc.)",
          },
          tags: {
            type: "array",
            items: { type: "string" },
            description: "Optional tags for filtering",
          },
          expiry: {
            type: "string",
            description: "Optional expiry date (ISO 8601)",
          },
          notes: {
            type: "string",
            description: "Optional notes about the link",
          },
        },
        required: ["program", "product", "link", "commissionRate", "category"],
      },
    },
    {
      name: "get_affiliate_links",
      description:
        "Retrieve affiliate links filtered by category, program, or commission rate.",
      inputSchema: {
        type: "object",
        properties: {
          category: {
            type: "string",
            description: "Filter by category",
          },
          program: {
            type: "string",
            description: "Filter by program",
          },
          minCommission: {
            type: "number",
            description: "Minimum commission rate",
          },
          maxCommission: {
            type: "number",
            description: "Maximum commission rate",
          },
          limit: {
            type: "number",
            description: "Limit results (default 50)",
          },
        },
      },
    },
    {
      name: "get_best_link",
      description:
        "Get the highest-commission affiliate link for a specific category.",
      inputSchema: {
        type: "object",
        properties: {
          category: {
            type: "string",
            description: "Product category",
          },
        },
        required: ["category"],
      },
    },
    {
      name: "search_links",
      description: "Full-text search across all affiliate links by product name.",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Search query",
          },
          limit: {
            type: "number",
            description: "Limit results (default 20)",
          },
        },
        required: ["query"],
      },
    },
    {
      name: "get_stats",
      description: "Get click, conversion, and revenue stats for a specific link.",
      inputSchema: {
        type: "object",
        properties: {
          linkId: {
            type: "string",
            description: "Affiliate link ID",
          },
        },
        required: ["linkId"],
      },
    },
    {
      name: "track_click",
      description: "Track a click on an affiliate link.",
      inputSchema: {
        type: "object",
        properties: {
          linkId: {
            type: "string",
            description: "Affiliate link ID",
          },
          source: {
            type: "string",
            description: "Traffic source (email, social, blog, etc.)",
          },
          userId: {
            type: "string",
            description: "Optional user ID",
          },
        },
        required: ["linkId"],
      },
    },
    {
      name: "track_conversion",
      description: "Track a conversion (sale) for an affiliate link.",
      inputSchema: {
        type: "object",
        properties: {
          linkId: {
            type: "string",
            description: "Affiliate link ID",
          },
          amount: {
            type: "number",
            description: "Sale amount",
          },
          orderId: {
            type: "string",
            description: "Optional order ID from affiliate program",
          },
        },
        required: ["linkId", "amount"],
      },
    },
    {
      name: "export_links",
      description: "Export all affiliate links as JSON or CSV.",
      inputSchema: {
        type: "object",
        properties: {
          format: {
            type: "string",
            enum: ["json", "csv"],
            description: "Export format",
          },
        },
        required: ["format"],
      },
    },
  ],
}));

server.setRequestHandler("tools/call", async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "store_affiliate_link": {
        const id = generateId();
        const now = new Date().toISOString();
        const stmt = db.prepare(`
          INSERT INTO affiliate_links 
          (id, program, product, link, commission_rate, category, tags, expiry, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(
          id,
          args.program,
          args.product,
          args.link,
          args.commissionRate,
          args.category,
          args.tags ? JSON.stringify(args.tags) : null,
          args.expiry || null,
          now,
          now
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                linkId: id,
                message: `Affiliate link stored: ${args.product} (${args.program})`,
              }),
            },
          ],
        };
      }

      case "get_affiliate_links": {
        let query = "SELECT * FROM affiliate_links WHERE 1=1";
        const params: any[] = [];

        if (args.category) {
          query += " AND category = ?";
          params.push(args.category);
        }
        if (args.program) {
          query += " AND program = ?";
          params.push(args.program);
        }
        if (args.minCommission !== undefined) {
          query += " AND commission_rate >= ?";
          params.push(args.minCommission);
        }
        if (args.maxCommission !== undefined) {
          query += " AND commission_rate <= ?";
          params.push(args.maxCommission);
        }

        query += " ORDER BY commission_rate DESC LIMIT ?";
        params.push(args.limit || 50);

        const stmt = db.prepare(query);
        const rows = stmt.all(...params) as any[];
        const links = rows.map((row) => ({
          id: row.id,
          program: row.program,
          product: row.product,
          link: row.link,
          commissionRate: row.commission_rate,
          category: row.category,
          clicks: row.clicks,
          conversions: row.conversions,
          revenue: row.revenue,
        }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                count: links.length,
                links,
              }),
            },
          ],
        };
      }

      case "get_best_link": {
        const stmt = db.prepare(
          "SELECT * FROM affiliate_links WHERE category = ? ORDER BY commission_rate DESC LIMIT 1"
        );
        const row = stmt.get(args.category) as any;

        if (!row) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  error: `No links found for category: ${args.category}`,
                }),
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                id: row.id,
                product: row.product,
                program: row.program,
                link: row.link,
                commissionRate: row.commission_rate,
                category: row.category,
              }),
            },
          ],
        };
      }

      case "search_links": {
        const query = `%${args.query}%`;
        const stmt = db.prepare(
          "SELECT * FROM affiliate_links WHERE product LIKE ? OR notes LIKE ? ORDER BY commission_rate DESC LIMIT ?"
        );
        const rows = stmt.all(query, query, args.limit || 20) as any[];
        const links = rows.map((row) => ({
          id: row.id,
          product: row.product,
          program: row.program,
          link: row.link,
          commissionRate: row.commission_rate,
          category: row.category,
        }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                query: args.query,
                count: links.length,
                links,
              }),
            },
          ],
        };
      }

      case "get_stats": {
        const link = getAffiliateLink(args.linkId);
        if (!link) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ error: "Link not found" }),
              },
            ],
          };
        }

        const clickStmt = db.prepare("SELECT COUNT(*) as count FROM link_clicks WHERE link_id = ?");
        const convStmt = db.prepare("SELECT COUNT(*) as count FROM link_conversions WHERE link_id = ?");

        const clicks = (clickStmt.get(args.linkId) as any).count;
        const conversions = (convStmt.get(args.linkId) as any).count;

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                linkId: args.linkId,
                product: link.product,
                program: link.program,
                clicks,
                conversions,
                revenue: link.revenue,
                conversionRate: clicks > 0 ? ((conversions / clicks) * 100).toFixed(2) + "%" : "0%",
              }),
            },
          ],
        };
      }

      case "track_click": {
        const id = generateId();
        const stmt = db.prepare(
          "INSERT INTO link_clicks (id, link_id, timestamp, source, user_id) VALUES (?, ?, ?, ?, ?)"
        );
        stmt.run(id, args.linkId, new Date().toISOString(), args.source || null, args.userId || null);

        const updateStmt = db.prepare("UPDATE affiliate_links SET clicks = clicks + 1 WHERE id = ?");
        updateStmt.run(args.linkId);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ success: true, message: "Click tracked" }),
            },
          ],
        };
      }

      case "track_conversion": {
        const id = generateId();
        const stmt = db.prepare(
          "INSERT INTO link_conversions (id, link_id, timestamp, amount, order_id) VALUES (?, ?, ?, ?, ?)"
        );
        stmt.run(
          id,
          args.linkId,
          new Date().toISOString(),
          args.amount,
          args.orderId || null
        );

        const updateStmt = db.prepare(
          "UPDATE affiliate_links SET conversions = conversions + 1, revenue = revenue + ? WHERE id = ?"
        );
        updateStmt.run(args.amount, args.linkId);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                message: `Conversion tracked: $${args.amount}`,
              }),
            },
          ],
        };
      }

      case "export_links": {
        const links = getAllAffiliateLinks();

        if (args.format === "csv") {
          const headers = ["ID", "Program", "Product", "Link", "Commission %", "Category", "Clicks", "Conversions", "Revenue"];
          const rows = links.map((l) => [
            l.id,
            l.program,
            l.product,
            l.link,
            l.commissionRate,
            l.category,
            l.clicks,
            l.conversions,
            l.revenue,
          ]);

          const csv = [
            headers.join(","),
            ...rows.map((r) => r.map((v) => `"${v}"`).join(",")),
          ].join("\n");

          return {
            content: [
              {
                type: "text",
                text: csv,
              },
            ],
          };
        } else {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(links, null, 2),
              },
            ],
          };
        }
      }

      default:
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: `Unknown tool: ${name}` }),
            },
          ],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: error instanceof Error ? error.message : "Unknown error",
          }),
        },
      ],
      isError: true,
    };
  }
});

// ─── Start Server ───────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    "[Rvvel Affiliate Links MCP] Server running — central hub for affiliate links across the ecosystem"
  );
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
