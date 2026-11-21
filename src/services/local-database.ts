type SqlParameter = string | number;

export interface LocalSqliteConnection {
  execAsync(sql: string): Promise<void>;
  getAllAsync<T>(sql: string, ...params: SqlParameter[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, ...params: SqlParameter[]): Promise<T | null>;
  runAsync(sql: string, ...params: SqlParameter[]): Promise<unknown>;
  closeAsync(): Promise<void>;
}

const migrations = [
  `CREATE TABLE workout_templates (
    sequence INTEGER PRIMARY KEY,
    id TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    content TEXT NOT NULL
  );
  CREATE TABLE template_creation_receipts (
    operation_id TEXT PRIMARY KEY NOT NULL,
    template_id TEXT NOT NULL,
    content TEXT NOT NULL
  );
  CREATE INDEX template_creation_receipts_template ON template_creation_receipts (template_id);`,
  `ALTER TABLE template_creation_receipts RENAME TO template_save_receipts;`,
];

export function createLocalDatabase(openConnection: () => Promise<LocalSqliteConnection>) {
  let connection: LocalSqliteConnection | undefined;
  let pending = Promise.resolve();

  async function discard(db: LocalSqliteConnection) {
    connection = undefined;
    // Preserve the original failure if closing an unusable connection also fails.
    await db.closeAsync().catch(() => {});
  }

  async function transaction<T>(db: LocalSqliteConnection, run: () => Promise<T>): Promise<T> {
    try {
      await db.execAsync('BEGIN IMMEDIATE');
      const result = await run();
      await db.execAsync('COMMIT');
      return result;
    } catch (error) {
      try {
        await db.execAsync('ROLLBACK');
      } catch {
        if (connection === db) await discard(db);
      }
      throw error;
    }
  }

  async function initialize() {
    const db = await openConnection();
    try {
      await db.execAsync('PRAGMA busy_timeout = 3000; PRAGMA foreign_keys = ON;');
      await transaction(db, async () => {
        const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
        if (!version || version.user_version > migrations.length) {
          throw new Error('This database requires a newer version of the app.');
        }
        for (const [index, sql] of migrations.entries()) {
          if (index < version.user_version) continue;
          await db.execAsync(sql);
          await db.execAsync(`PRAGMA user_version = ${index + 1}`);
        }
      });
      return db;
    } catch (error) {
      await discard(db);
      throw error;
    }
  }

  // Keep all access to this private connection in order so reads never join a pending write.
  function read<T>(run: (db: LocalSqliteConnection) => Promise<T>): Promise<T> {
    const result = pending.then(async () => {
      connection ??= await initialize();
      return run(connection);
    });
    pending = result.then(() => {}, () => {});
    return result;
  }

  return {
    read,
    write<T>(run: (db: LocalSqliteConnection) => Promise<T>): Promise<T> {
      return read(db => transaction(db, () => run(db)));
    },
  };
}
