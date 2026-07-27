import { getDb } from './db';

function init(): void {
  const db = getDb();
  // Tables are auto-created by getDb() -> initSchema()
  // No mock data - all data comes from Takealot API sync
  console.log('Database initialized. No mock data. Use store authorization to sync from Takealot.');
}

init();
