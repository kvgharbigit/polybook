import { Platform } from 'react-native';

// Platform detection and database selection
function createDatabase() {
  const isWeb = Platform.OS === 'web';
  
  if (isWeb) {
    console.log('Using web database (localStorage)');
    const { webDb } = require('./webDatabase');
    return webDb;
  } else {
    console.log('Using native database (SQLite)');
    const { db } = require('./database');
    return db;
  }
}

// Export singleton instance
export const db = createDatabase();
export default db;