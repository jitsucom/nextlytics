import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import {
  GenericContainer,
  type StartedTestContainer,
  Network,
  type StartedNetwork,
  Wait,
} from "testcontainers";
import pg from "pg";
import {
  generatePgCreateTableSQL,
  type AnalyticsEventRow,
} from "@nextlytics/core/backends/postgrest";

export type { AnalyticsEventRow };

const INIT_SQL = [
  generatePgCreateTableSQL("analytics"),
  generatePgCreateTableSQL("analytics_delayed"),
].join("\n");

const PG_ALIAS = "postgres";

export class ThirdpartyServices {
  private network: StartedNetwork | null = null;
  private pgContainer: StartedPostgreSqlContainer | null = null;
  private postgrestContainer: StartedTestContainer | null = null;
  private pgPool: pg.Pool | null = null;

  get postgresPort(): number {
    return this.pgContainer?.getPort() ?? 0;
  }

  get postgrestUrl(): string {
    const port = this.postgrestContainer?.getMappedPort(3000) ?? 0;
    return `http://localhost:${port}`;
  }

  async start(): Promise<void> {
    if (this.pgContainer) return;

    try {
      this.network = await new Network().start();

      console.log("Starting Postgres container...");
      this.pgContainer = await new PostgreSqlContainer("postgres:16-alpine")
        .withNetwork(this.network)
        .withNetworkAliases(PG_ALIAS)
        .withDatabase("nextlytics_test")
        .withUsername("postgres")
        .withPassword("postgres")
        .start();

      this.pgPool = new pg.Pool({
        connectionString: this.pgContainer.getConnectionUri(),
      });
      await this.pgPool.query(INIT_SQL);

      console.log("Starting PostgREST container...");
      this.postgrestContainer = await new GenericContainer("postgrest/postgrest:v12.2.3")
        .withNetwork(this.network)
        .withEnvironment({
          PGRST_DB_URI: `postgres://postgres:postgres@${PG_ALIAS}:5432/nextlytics_test`,
          PGRST_DB_ANON_ROLE: "postgres",
          PGRST_DB_SCHEMAS: "public",
        })
        .withExposedPorts(3000)
        .withWaitStrategy(Wait.forHttp("/", 3000).forStatusCode(200))
        .start();

      console.log(`Services ready (postgres:${this.postgresPort}, postgrest:${this.postgrestUrl})`);
    } catch (err) {
      if (err instanceof Error && err.message.includes("container runtime")) {
        throw new Error("Docker is not running. Please start Docker and try again.");
      }
      throw err;
    }
  }

  async stop(): Promise<void> {
    await this.disconnectDb();

    if (this.postgrestContainer) {
      await this.postgrestContainer.stop();
      this.postgrestContainer = null;
    }

    if (this.pgContainer) {
      await this.pgContainer.stop();
      this.pgContainer = null;
    }

    if (this.network) {
      await this.network.stop();
      this.network = null;
    }
  }

  private getPool(): pg.Pool {
    if (!this.pgPool) {
      throw new Error("Database not connected. Call start() first.");
    }
    return this.pgPool;
  }

  private async disconnectDb(): Promise<void> {
    if (this.pgPool) {
      await this.pgPool.end();
      this.pgPool = null;
    }
  }

  async clearAnalytics(): Promise<void> {
    await this.getPool().query("DELETE FROM analytics");
    await this.getPool().query("DELETE FROM analytics_delayed");
  }

  async getAnalyticsEvents(): Promise<AnalyticsEventRow[]> {
    const result = await this.getPool().query<AnalyticsEventRow>(
      "SELECT * FROM analytics ORDER BY timestamp ASC"
    );
    return result.rows;
  }

  async getAnalyticsEventsByPath(path: string): Promise<AnalyticsEventRow[]> {
    const result = await this.getPool().query<AnalyticsEventRow>(
      "SELECT * FROM analytics WHERE path = $1 ORDER BY timestamp ASC",
      [path]
    );
    return result.rows;
  }

  /** Get events from the delayed (on-client-event) backend */
  async getDelayedAnalyticsEvents(): Promise<AnalyticsEventRow[]> {
    const result = await this.getPool().query<AnalyticsEventRow>(
      "SELECT * FROM analytics_delayed ORDER BY timestamp ASC"
    );
    return result.rows;
  }
}
