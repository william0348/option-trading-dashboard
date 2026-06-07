import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const keyPath = process.env.FIREBASE_ADMIN_KEY_PATH;
if (!keyPath) {
  console.error('Error: FIREBASE_ADMIN_KEY_PATH environment variable is not set.');
  console.error('Usage: FIREBASE_ADMIN_KEY_PATH=/path/to/serviceAccount.json node scan.mjs');
  process.exit(1);
}
const sa = JSON.parse(readFileSync(keyPath, 'utf8'));

const app = initializeApp({ credential: cert(sa) }, 'main');
const db = getFirestore(app, 'ai-studio-51c83bd5-262e-4f28-98c4-e91d0c5d643f');

const snap = await db.collection('trades').limit(3).get();
console.log(`trades collection: ${snap.size} sample docs`);
snap.forEach(d => {
  console.log('\n--- doc:', d.id);
  console.log(JSON.stringify(d.data(), null, 2));
});

const total = await db.collection('trades').count().get();
console.log(`\nTotal trades docs: ${total.data().count}`);
process.exit(0);
