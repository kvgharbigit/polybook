import { Platform } from 'react-native';

// Platform detection and database selection
function createDatabase() {
  const isWeb = Platform.OS === 'web';
  
  try {
    if (isWeb) {
      console.log('Using web database (localStorage)');
      const { webDb } = require('./webDatabase');
      return webDb;
    } else {
      console.log('Using native database (SQLite)');
      const { db } = require('./database');
      return db;
    }
  } catch (error) {
    console.error('Failed to load database implementation:', error);
    throw new Error(`Database initialization failed: ${error.message}`);
  }
}

// Export singleton instance
export const db = createDatabase();
export default db;