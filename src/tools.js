import { query, isReadOnly } from "./db.js";

const queryDescriptionReadOnly =
  "Execute a read-only SQL query against the PostgreSQL database. " +
  "Only SELECT and other read operations are allowed. " +
  "Mutations (INSERT, UPDATE, DELETE, DROP, etc.) will be rejected. " +
  "Returns rows as JSON.";

const queryDescriptionReadWrite =
  "Execute any SQL statement against the PostgreSQL database. " +
  "Supports SELECT, INSERT, UPDATE, DELETE, CREATE TABLE, ALTER TABLE, DROP TABLE, " +
  "and any other valid PostgreSQL SQL. Returns rows for SELECT queries, " +
  "or the number of affected rows for mutations.";

export function getToolDefinitions() {
  return [
    {
      name: "query",
      description: isReadOnly()
        ? queryDescriptionReadOnly
        : queryDescriptionReadWrite,
      inputSchema: {
        type: "object",
        properties: {
          sql: {
            type: "string",
            description: "The SQL statement to execute",
          },
          params: {
            type: "array",
            items: {},
            description:
              "Optional parameterized query values (use $1, $2, etc. in SQL)",
          },
        },
        required: ["sql"],
      },
    },
    {
      name: "list_tables",
      description:
        "List all tables in a given schema. Defaults to the 'public' schema.",
      inputSchema: {
        type: "object",
        properties: {
          schema: {
            type: "string",
            description: "Schema name (default: public)",
          },
        },
      },
    },
    {
      name: "describe_table",
      description:
        "Show column names, data types, nullability, and defaults for a table.",
      inputSchema: {
        type: "object",
        properties: {
          table: {
            type: "string",
            description: "Table name",
          },
          schema: {
            type: "string",
            description: "Schema name (default: public)",
          },
        },
        required: ["table"],
      },
    },
    {
      name: "list_schemas",
      description: "List all non-system schemas in the database.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
  ];
}

const handlers = {
  async query(args) {
    const result = await query(args.sql, args.params || []);
    if (result.command === "SELECT" || result.rows.length > 0) {
      return JSON.stringify(result.rows, null, 2);
    }
    return `${result.command} — ${result.rowCount} row(s) affected`;
  },

  async list_tables(args) {
    const schema = args?.schema || "public";
    const result = await query(
      `SELECT table_name, table_type
       FROM information_schema.tables
       WHERE table_schema = $1
       ORDER BY table_name`,
      [schema],
    );
    if (result.rows.length === 0) {
      return `No tables found in schema "${schema}"`;
    }
    return result.rows
      .map((r) => `${r.table_name} (${r.table_type})`)
      .join("\n");
  },

  async describe_table(args) {
    const schema = args?.schema || "public";
    const result = await query(
      `SELECT column_name, data_type, is_nullable, column_default, character_maximum_length
       FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = $2
       ORDER BY ordinal_position`,
      [schema, args.table],
    );
    if (result.rows.length === 0) {
      return `Table "${schema}.${args.table}" not found`;
    }
    return result.rows
      .map((r) => {
        let type = r.data_type;
        if (r.character_maximum_length)
          type += `(${r.character_maximum_length})`;
        const nullable = r.is_nullable === "YES" ? "NULL" : "NOT NULL";
        const def = r.column_default ? ` DEFAULT ${r.column_default}` : "";
        return `${r.column_name}: ${type} ${nullable}${def}`;
      })
      .join("\n");
  },

  async list_schemas() {
    const result = await query(
      `SELECT schema_name
       FROM information_schema.schemata
       WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
       ORDER BY schema_name`,
    );
    return result.rows.map((r) => r.schema_name).join("\n");
  },
};

export async function callTool(name, args) {
  const handler = handlers[name];
  if (!handler) {
    throw new Error(`Unknown tool: ${name}`);
  }
  return handler(args);
}
