import type { createLocalDatabase } from './local-database';

export interface DisplayNameStore {
  read(): Promise<string | null>;
  write(name: string): Promise<void>;
}

export function createDisplayNameStore(database: ReturnType<typeof createLocalDatabase>): DisplayNameStore {
  return {
    read() {
      return database.read(async db => {
        const row = await db.getFirstAsync<{ display_name: string }>('SELECT display_name FROM local_profile WHERE id = 1');
        return row?.display_name ?? null;
      });
    },
    write(name) {
      return database.write(async db => {
        await db.runAsync(
          `INSERT INTO local_profile (id, display_name) VALUES (1, ?)
           ON CONFLICT (id) DO UPDATE SET display_name = excluded.display_name`,
          name,
        );
      });
    },
  };
}
