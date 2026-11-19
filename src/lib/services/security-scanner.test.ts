import { describe, expect, it } from "vitest";
import { scanCode } from "./security-scanner";

const sqlFindings = (code: string) =>
  scanCode("src/app.ts", code, "typescript").filter((issue) => issue.id === "sql-template-literal");

describe("SQL template literal detection", () => {
  it("flags interpolated SQL in generic query calls", () => {
    const code = "const [p] = query<Product>(`SELECT * FROM products WHERE id = '${item.productId}'`);";
    const findings = sqlFindings(code);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("critical");
    expect(findings[0]?.line).toBe(1);
  });

  it("flags request data interpolated into a query", () => {
    expect(sqlFindings("db.query(`DELETE FROM users WHERE id = ${req.params.id}`);")).toHaveLength(1);
    expect(sqlFindings("pool.execute(`${req.body.filter}`);")).toHaveLength(1);
    expect(sqlFindings("prisma.$queryRawUnsafe(`SELECT * FROM t WHERE a = ${value}`);")).toHaveLength(1);
  });

  it("ignores parameterized queries and non-SQL templates", () => {
    expect(sqlFindings('query<Product>("SELECT * FROM products WHERE id = ?", [id]);')).toHaveLength(0);
    expect(sqlFindings("prisma.$queryRaw`SELECT * FROM users WHERE id = ${id}`;")).toHaveLength(0);
    expect(sqlFindings("query(`SELECT * FROM products`);")).toHaveLength(0);
    expect(sqlFindings("useQuery<Data>(`/api/items/${id}`);")).toHaveLength(0);
    expect(sqlFindings("logger.query(`loaded ${count} rows`);")).toHaveLength(0);
  });
});
