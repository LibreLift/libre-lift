import { randomUUID } from 'expo-crypto';
import { openDatabaseAsync } from 'expo-sqlite';
import { createDisplayNameStore } from './display-name-store';
import { createLocalDatabase } from './local-database';
import { createSqliteWorkoutService } from './sqlite-workout-service';

export function createNativeServices(databaseName = 'open-fit.db') {
  const database = createLocalDatabase(() => openDatabaseAsync(databaseName, { useNewConnection: true }));
  return {
    displayNameStore: createDisplayNameStore(database),
    workoutService: createSqliteWorkoutService(database, randomUUID),
  };
}
