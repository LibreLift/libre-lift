import { randomUUID } from 'expo-crypto';
import { openDatabaseAsync } from 'expo-sqlite';
import { createSqliteWorkoutService } from './sqlite-workout-service';

export function createNativeWorkoutService(databaseName = 'open-fit.db') {
  return createSqliteWorkoutService(() => openDatabaseAsync(databaseName, { useNewConnection: true }), randomUUID);
}
