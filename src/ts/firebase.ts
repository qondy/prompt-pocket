import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// NOTE: Firebase の Web 設定は秘匿情報ではなく、実質的な防御は firestore.rules 側で行う。
// （他のミニアプリと同様に、この値はコミットして良い）
const firebaseConfig = {
  apiKey: 'AIzaSyBcG1N308XC7PhCEC8hce2vUI-hAEmI_NE',
  authDomain: 'prompt-pocket-12d79e.firebaseapp.com',
  projectId: 'prompt-pocket-12d79e',
  storageBucket: 'prompt-pocket-12d79e.firebasestorage.app',
  messagingSenderId: '851790305404',
  appId: '1:851790305404:web:a867863f5d16ea4af451f9',
};

export const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
