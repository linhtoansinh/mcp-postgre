# pg-mcp-server

A custom MCP (Model Context Protocol) server that gives Claude read-only access to a PostgreSQL database. Implements the MCP protocol directly over stdio — no SDK dependency.

## Tools

| Tool | Description |
|---|---|
| `query` | Execute SQL (read-only by default) |
| `list_tables` | List tables in a schema |
| `describe_table` | Show columns, types, nullability |
| `list_schemas` | List non-system schemas |

## Install

```bash
npm install github:linhtoansinh/mcp-postgre
```

## Usage

Add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": [
        "pg-mcp",
        "postgresql://mcp_reader:your_password@localhost:5432/your_database",
        "--read-only",
        "--timeout", "30000"
      ]
    }
  }
}
```

### CLI Arguments

```
pg-mcp <connection-string> [options]
```

| Argument | Default | Description |
|---|---|---|
| `<connection-string>` | — | PostgreSQL connection URI (`postgresql://user:pass@host:port/db`) |
| `--read-only` | on | Wrap queries in a read-only transaction (default) |
| `--no-read-only` | — | Allow write operations |
| `--timeout <ms>` | `30000` | Query timeout in milliseconds |

If no connection string is provided, the server falls back to environment variables (`PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`).

## Security

> **Prefer a local or staging database.** Avoid connecting Claude directly to a production database. Query results are sent to the LLM, which means any data Claude reads leaves your machine.

### Create a dedicated PostgreSQL user

Never use your admin (`postgres`) account. Create a restricted user with only the permissions Claude needs:

```sql
-- Create a read-only user
CREATE ROLE mcp_reader LOGIN PASSWORD 'a_strong_password';
GRANT CONNECT ON DATABASE your_database TO mcp_reader;
GRANT USAGE ON SCHEMA public TO mcp_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO mcp_reader;

-- Ensure future tables are also readable
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO mcp_reader;
```

### If you must connect to production

1. **Use a read replica**, not the primary.
2. **Create views that mask sensitive columns** so Claude never sees PII:

```sql
CREATE SCHEMA mcp_safe;

CREATE VIEW mcp_safe.users AS
  SELECT id, role, created_at FROM public.users;
  -- no email, name, phone, etc.

GRANT USAGE ON SCHEMA mcp_safe TO mcp_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA mcp_safe TO mcp_reader;
-- no grants on public schema
```

3. **Row-level security** can further limit which rows are visible:

```sql
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY mcp_policy ON orders FOR SELECT TO mcp_reader
  USING (is_test = true);
```

### Defense in depth

The server enforces read-only mode at the application level (`BEGIN TRANSACTION READ ONLY`). Combining this with a DB-level read-only user gives you two independent layers of protection — even if one is misconfigured, the other still blocks writes.

### Keep credentials out of version control

Your `.mcp.json` contains database credentials. Make sure it is in `.gitignore` (this repo already does this).

## Development

```bash
git clone https://github.com/linhtoansinh/mcp-postgre.git
cd mcp-postgre
npm install    # also runs the build via `prepare`
npm start      # runs dist/index.cjs
```

To rebuild after editing `src/`:

```bash
npm run build
```