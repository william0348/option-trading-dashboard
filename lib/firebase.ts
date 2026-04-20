import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs, addDoc, deleteDoc, updateDoc } from 'firebase/firestore';
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

export const saveTradesToFirestore = async (userId: string, trades: any[]) => {
  const batch = [];
  // To avoid duplicate imports, we could use a batch ID or hash, 
  // but for now let's just add them.
  for (const trade of trades) {
    batch.push(addDoc(collection(db, 'trades'), {
      userId,
      ...trade,
      importedAt: new Date().toISOString()
    }));
  }
  await Promise.all(batch);
};

export const loadTradesFromFirestore = async (userId: string) => {
  const q = query(collection(db, 'trades'), where('userId', '==', userId));
  const querySnapshot = await getDocs(q);
  const trades: any[] = [];
  querySnapshot.forEach((doc) => {
    trades.push(doc.data());
  });
  return trades;
};
