// Migration: flat trades collection → users/{userId}/trades subcollection
// Run: node migrate.mjs

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { createRequire } from 'module';
import { readFileSync } from 'fs';

const keyPath = process.env.FIREBASE_ADMIN_KEY_PATH;
if (!keyPath) {
  console.error('Error: FIREBASE_ADMIN_KEY_PATH environment variable is not set.');
  console.error('Usage: FIREBASE_ADMIN_KEY_PATH=/path/to/serviceAccount.json node migrate.mjs');
  process.exit(1);
}
const sa = JSON.parse(readFileSync(keyPath, 'utf8'));

const DB_ID = 'ai-studio-51c83bd5-262e-4f28-98c4-e91d0c5d643f';
const app = initializeApp({ credential: cert(sa) }, 'migration');
const db = getFirestore(app, DB_ID);

async function main() {
  const snap = await db.collection('trades').get();
  console.log(`Total docs to migrate: ${snap.docs.length}`);

  let migrated = 0;
  let skipped = 0;
  let batchOps = db.batch();
  let batchCount = 0;
  const BATCH_SIZE = 400; // Firestore batch limit is 500

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    const userId = data.userId;

    if (!userId || !data.raw) {
      console.log(`  SKIP: ${docSnap.id} (missing userId or raw)`);
      skipped++;
      continue;
    }

    const newRef = db.collection('users').doc(userId).collection('trades').doc();
    batchOps.set(newRef, {
      raw: data.raw,
      createdAt: data.createdAt || new Date().toISOString(),
    });
    batchCount++;
    migrated++;

    if (batchCount >= BATCH_SIZE) {
      await batchOps.commit();
      console.log(`  ...${migrated} migrated`);
      batchOps = db.batch();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batchOps.commit();
  }

  console.log(`\nDone! Migrated: ${migrated}, Skipped: ${skipped}`);
  console.log('You can now delete the old "trades" collection in Firebase Console.');
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
