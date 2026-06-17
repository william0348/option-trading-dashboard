import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore, doc, setDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Optimize for iframe/sandbox environments
setPersistence(auth, browserLocalPersistence).catch(console.error);

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();

let isSigningIn = false;

export const signInWithGoogle = async () => {
  if (isSigningIn) return;
  isSigningIn = true;
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    if (error.code === 'auth/popup-blocked') {
      alert("登入視窗被瀏覽器攔截了，請在網址列右側允許彈出視窗，然後再試一次。");
    } else if (error.code === 'auth/cancelled-popup-request') {
      console.warn("登入視窗已關閉或請求被取消");
    } else {
      console.error("Firebase Sign-in Error:", error);
    }
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const logout = () => signOut(auth);

export { onAuthStateChanged };
export type { User };

// Firestore Helpers
export const syncUserProfile = async (user: User) => {
  const userRef = doc(db, 'users', user.uid);
  await setDoc(userRef, {
    email: user.email,
    name: user.displayName,
    picture: user.photoURL,
    lastLogin: new Date().toISOString()
  }, { merge: true });
};

// Deterministic ID from key trade fields — used as Firestore doc ID to prevent duplicate imports.
// Uses FNV-1a 64-bit (as two 32-bit halves) to avoid birthday-bound collisions at ~10k trades.
function tradeDocId(trade: any): string {
  const key = [
    trade.Date ?? '',
    trade.Action ?? '',
    trade.Symbol ?? '',
    trade.Quantity ?? '',
    trade.Amount ?? '',
    trade.Account ?? '',
  ].join('|');
  let h1 = 0x811c9dc5, h2 = 0xcbf29ce4;
  for (let i = 0; i < key.length; i++) {
    const c = key.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x01000193) ^ (h1 >>> 16);
  }
  return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36);
}

const FIRESTORE_BATCH_LIMIT = 499;

export const saveTradesToFirestore = async (userId: string, trades: any[]) => {
  const userTradesCol = collection(db, 'users', userId, 'trades');
  const createdAt = new Date().toISOString();

  // Process in batches of 499 (Firestore limit is 500 ops/batch)
  for (let i = 0; i < trades.length; i += FIRESTORE_BATCH_LIMIT) {
    const chunk = trades.slice(i, i + FIRESTORE_BATCH_LIMIT);
    const batch = writeBatch(db);
    for (const trade of chunk) {
      // setDoc with deterministic ID = idempotent: re-uploading same CSV is a no-op
      const docRef = doc(userTradesCol, tradeDocId(trade));
      batch.set(docRef, { raw: trade, createdAt });
    }
    await batch.commit();
  }
};

export const loadTradesFromFirestore = async (userId: string) => {
  // Try new subcollection first
  const subCol = collection(db, 'users', userId, 'trades');
  const subSnap = await getDocs(subCol);
  if (!subSnap.empty) {
    return subSnap.docs.map(d => d.data().raw);
  }

  // Fallback: old flat trades collection (queried by userId)
  const q = query(collection(db, 'trades'), where('userId', '==', userId));
  const flatSnap = await getDocs(q);
  return flatSnap.docs.map(d => d.data().raw);
};
