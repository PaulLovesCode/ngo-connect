import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Firebase Admin SDK initialization.
 * 
 * Supports 3 modes (checked in order):
 * 1. Service account key file at GOOGLE_APPLICATION_CREDENTIALS env var
 * 2. Service account key file at backend/serviceAccountKey.json
 * 3. Application Default Credentials (for Cloud-hosted environments)
 */
function initializeFirebase() {
  const projectId = process.env.FIREBASE_PROJECT_ID || 'unipal-a34bf';
  const databaseId = process.env.FIREBASE_DATABASE_ID || 'ai-studio-a64f5a1d-29a3-4667-874f-ca216739e224';

  // Option 1: Explicit service account key from env
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const keyPath = resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS);
    if (existsSync(keyPath)) {
      const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId,
      });
      console.log('✅ Firebase Admin initialized with service account key (env)');
      return { db: admin.firestore(), databaseId };
    }
  }

  // Option 2: Local service account key file
  const localKeyPath = resolve(__dirname, '..', 'serviceAccountKey.json');
  if (existsSync(localKeyPath)) {
    const serviceAccount = JSON.parse(readFileSync(localKeyPath, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId,
    });
    console.log('✅ Firebase Admin initialized with local service account key');
    return { db: admin.firestore(), databaseId };
  }

  // Option 3: Application Default Credentials
  try {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId,
    });
    console.log('✅ Firebase Admin initialized with application default credentials');
    return { db: admin.firestore(), databaseId };
  } catch (err) {
    console.warn('⚠️  Firebase Admin could not initialize automatically.');
    console.warn('   The backend will run in "stateless" mode (data must be passed via API).');
    console.warn('   To enable Firestore access, place serviceAccountKey.json in backend/');
    return { db: null, databaseId };
  }
}

const { db: rawDb, databaseId } = initializeFirebase();

// If we have a db and a custom database ID, get the specific database
let db = rawDb;
if (db && databaseId && databaseId !== '(default)') {
  try {
    db = admin.firestore();
    db.settings({ databaseId });
  } catch (e) {
    // Settings may already be applied — silently continue
  }
}

export { db, admin };
export default db;
