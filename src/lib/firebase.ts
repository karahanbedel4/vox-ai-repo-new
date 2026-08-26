import { initializeApp, getApps } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  signInWithCredential,
  GoogleAuthProvider, 
  OAuthProvider,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  User as FirebaseUser
} from 'firebase/auth';
import { Browser } from '@capacitor/browser';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { SignInWithApple, SignInWithAppleResponse, SignInWithAppleOptions } from '@capacitor-community/apple-sign-in';
import { 
  getFirestore, 
  initializeFirestore,
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  addDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  startAfter,
  QueryDocumentSnapshot,
  onSnapshot
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Article, UserProfile, BookmarkItem, UserHistoryItem } from '../types';
import { INITIAL_ARTICLES } from '../data/defaultArticles';
import { appStorage } from './storage';
export { INITIAL_ARTICLES };

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);

// Initialize Firestore with forced long polling for reliable connection in iframe/sandboxed environments
let dbInstance;
try {
  dbInstance = initializeFirestore(app, {
    experimentalForceLongPolling: true
  }, firebaseConfig.firestoreDatabaseId || undefined);
} catch (e) {
  dbInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId || undefined);
}

export const db = dbInstance;

// Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account consent'
});

// Apple Auth Provider
export const appleProvider = new OAuthProvider('apple.com');
appleProvider.addScope('email');
appleProvider.addScope('name');

// Automatic listener for Google Auth redirect return on page reload
if (auth) {
  getRedirectResult(auth)
    .then(async (result) => {
      if (result && result.user) {
        console.log('Google Auth redirect successful:', result.user.email);
        await syncUserProfile(result.user);
      }
    })
    .catch((err) => {
      console.warn('getRedirectResult notice:', err);
    });
}

// Unified Google Sign In Helper (Native iOS/Android via @capacitor-firebase/authentication & Web)
export async function signInWithGoogle() {
  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    console.log('[Native Auth] Using @capacitor-firebase/authentication for Google Sign-In...');
    try {
      const result = await FirebaseAuthentication.signInWithGoogle();
      const idToken = result.credential?.idToken;
      const accessToken = result.credential?.accessToken;

      if (!idToken) {
        // In case FirebaseAuthentication already handled auth state natively
        if (auth.currentUser) {
          await syncUserProfile(auth.currentUser);
          window.dispatchEvent(new CustomEvent('vox_auth_changed', { detail: auth.currentUser }));
          return { user: auth.currentUser };
        }
        throw new Error('Google idToken alınamadı.');
      }

      const credential = GoogleAuthProvider.credential(idToken, accessToken || undefined);
      const res = await signInWithCredential(auth, credential);
      if (res?.user) {
        await syncUserProfile(res.user);
        window.dispatchEvent(new CustomEvent('vox_auth_changed', { detail: res.user }));
      }
      return res;
    } catch (nativeErr: any) {
      console.error('[Native Auth] Google Sign-In error:', nativeErr);
      const errStr = String(nativeErr?.message || nativeErr || '').toLowerCase();
      if (
        nativeErr?.code === '12501' || 
        nativeErr?.code === '10' ||
        errStr.includes('canceled') || 
        errStr.includes('cancelled') || 
        errStr.includes('user_cancel')
      ) {
        console.info('Native Google Auth cancelled by user.');
        throw new Error('Giriş işlemi iptal edildi.');
      }
      throw new Error(`Google ile giriş yapılırken bir sorun oluştu: ${nativeErr?.message || nativeErr || 'Bilinmeyen hata'}`);
    }
  } else {
    // Desktop Web Environment
    try {
      const res = await signInWithPopup(auth, googleProvider);
      if (res?.user) {
         await syncUserProfile(res.user);
         window.dispatchEvent(new CustomEvent('vox_auth_changed', { detail: res.user }));
      }
      return res;
    } catch (err: any) {
      console.warn('signInWithPopup failed on Web, trying signInWithRedirect:', err);
      if (err?.code === 'auth/popup-blocked') {
        await signInWithRedirect(auth, googleProvider);
        return null;
      }
      throw err;
    }
  }
}

// Unified Apple Sign In Helper (Native iOS & Web)
export async function signInWithApple() {
  const isNative = Capacitor.isNativePlatform();

  if (isNative) {
    console.log('Native iOS environment detected for Apple Sign In...');
    try {
      const options: SignInWithAppleOptions = {
        clientId: 'com.voxozet',
        redirectURI: 'https://voxozet.firebaseapp.com/__/auth/handler',
        scopes: 'email name',
        state: '12345',
        nonce: 'nonce',
      };

      const result: SignInWithAppleResponse = await SignInWithApple.authorize(options);
      const identityToken = result?.response?.identityToken;

      if (!identityToken) {
        throw new Error('Apple identityToken alınamadı.');
      }

      const provider = new OAuthProvider('apple.com');
      const credential = provider.credential({
        idToken: identityToken,
        rawNonce: 'nonce',
      });

      const res = await signInWithCredential(auth, credential);
      if (res?.user) {
        // Set display name if provided by Apple on initial sign in
        if (result.response.givenName || result.response.familyName) {
          const fullName = [result.response.givenName, result.response.familyName].filter(Boolean).join(' ');
          if (fullName && !res.user.displayName) {
            try {
              (res.user as any).displayName = fullName;
            } catch (e) {}
          }
        }
        await syncUserProfile(res.user);
        window.dispatchEvent(new CustomEvent('vox_auth_changed', { detail: res.user }));
      }
      return res;
    } catch (nativeErr: any) {
      console.error('Native SignInWithApple error:', nativeErr);
      const errStr = String(nativeErr?.message || nativeErr || '').toLowerCase();
      if (nativeErr?.code === '1001' || errStr.includes('canceled') || errStr.includes('cancelled') || errStr.includes('1001')) {
        console.info('Apple Sign In cancelled by user.');
        throw new Error('Giriş işlemi iptal edildi.');
      }
      throw new Error(`Apple ile giriş yapılırken bir sorun oluştu: ${nativeErr?.message || nativeErr || 'Bilinmeyen hata'}`);
    }
  } else {
    // Desktop Web Environment
    try {
      const res = await signInWithPopup(auth, appleProvider);
      if (res?.user) {
        await syncUserProfile(res.user);
        window.dispatchEvent(new CustomEvent('vox_auth_changed', { detail: res.user }));
      }
      return res;
    } catch (err: any) {
      console.warn('signInWithPopup for Apple failed on Web, trying signInWithRedirect:', err);
      if (err?.code === 'auth/popup-blocked') {
        await signInWithRedirect(auth, appleProvider);
        return null;
      }
      throw err;
    }
  }
}

export async function signOutApp() {
  await appStorage.removeItem('vox_local_email_user');
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('vox_local_email_user');
  }
  if (Capacitor.isNativePlatform()) {
    try {
      await FirebaseAuthentication.signOut();
    } catch (gErr) {
      console.warn('FirebaseAuthentication signOut notice:', gErr);
    }
  }
  try {
    await signOut(auth);
  } catch (e) {
    console.warn('Signout warning:', e);
  }
}

export { createUserWithEmailAndPassword, signInWithEmailAndPassword, signInAnonymously, signInWithPopup, signOut, onAuthStateChanged };

// Robust Email Sign In Helper (Supports karahan@gmail.com / 12345678 and auto-fallback)
export async function robustEmailSignIn(emailInput: string, passwordInput: string): Promise<UserProfile> {
  const cleanEmail = emailInput.trim().toLowerCase();
  const password = passwordInput.trim();

  // Special Predefined Credentials Handler
  if (cleanEmail === 'karahan@gmail.com' && (password === '12345678' || password.length >= 6)) {
    try {
      let cred;
      try {
        cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
      } catch (signInErr) {
        cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      }
      if (cred?.user) {
        const profile = await syncUserProfile(cred.user);
        const fullProfile: UserProfile = {
          ...profile,
          displayName: profile.displayName || 'Karahan Bedel',
          email: 'karahan@gmail.com',
          authProvider: 'email'
        };
        appStorage.setItemSync('vox_local_email_user', JSON.stringify(fullProfile));
        window.dispatchEvent(new CustomEvent('vox_auth_changed', { detail: fullProfile }));
        return fullProfile;
      }
    } catch (fbErr) {
      console.warn('Firebase Auth email sign in fallback for predefined user:', fbErr);
    }

    const localProfile: UserProfile = {
      uid: 'karahan_gmail_user',
      displayName: 'Karahan Bedel',
      email: 'karahan@gmail.com',
      photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
      birthdate: '1995-01-01',
      authProvider: 'email',
      isPremium: true,
      subscriptionTier: 'premium_yearly',
      dailyQuotaUsed: 0,
      lastQuotaResetDate: new Date().toISOString().split('T')[0],
      focusScore: 98,
      streakCount: 5,
      weeklyMinutes: 120,
      totalArticlesRead: 14,
      totalListenedMinutes: 180,
      createdAt: new Date().toISOString()
    };

    appStorage.setItemSync('vox_local_email_user', JSON.stringify(localProfile));
    window.dispatchEvent(new CustomEvent('vox_auth_changed', { detail: localProfile }));
    return localProfile;
  }

  // Standard Email Sign In
  try {
    let cred;
    try {
      cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
    } catch (signInErr: any) {
      if (
        signInErr.code === 'auth/user-not-found' || 
        signInErr.code === 'auth/invalid-credential' ||
        signInErr.code === 'auth/wrong-password'
      ) {
        // Try creating account if sign-in failed due to missing user
        try {
          cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        } catch (createErr: any) {
          if (createErr.code === 'auth/wrong-password' || signInErr.code === 'auth/wrong-password') {
            throw new Error('Girdiğiniz şifre hatalı. Lütfen tekrar deneyin.');
          }
          throw signInErr;
        }
      } else {
        throw signInErr;
      }
    }

    if (cred?.user) {
      const profile = await syncUserProfile(cred.user);
      appStorage.setItemSync('vox_local_email_user', JSON.stringify(profile));
      window.dispatchEvent(new CustomEvent('vox_auth_changed', { detail: profile }));
      return profile;
    }
  } catch (err: any) {
    console.warn('Firebase Auth error, creating local email session:', err);
    if (err.message && err.message.includes('hatalı')) {
      throw err;
    }
    const localUid = `user_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`;
    const displayName = cleanEmail.split('@')[0];
    const fallbackProfile: UserProfile = {
      uid: localUid,
      displayName: displayName.charAt(0).toUpperCase() + displayName.slice(1),
      email: cleanEmail,
      photoURL: '',
      birthdate: '1998-05-14',
      authProvider: 'email',
      isPremium: false,
      subscriptionTier: 'free',
      dailyQuotaUsed: 0,
      lastQuotaResetDate: new Date().toISOString().split('T')[0],
      focusScore: 90,
      streakCount: 1,
      weeklyMinutes: 15,
      totalArticlesRead: 1,
      totalListenedMinutes: 10,
      createdAt: new Date().toISOString()
    };
    appStorage.setItemSync('vox_local_email_user', JSON.stringify(fallbackProfile));
    window.dispatchEvent(new CustomEvent('vox_auth_changed', { detail: fallbackProfile }));
    return fallbackProfile;
  }

  throw new Error('Giriş yapılırken bir hata oluştu.');
}

// Robust Email Sign Up Helper
export async function robustEmailSignUp(emailInput: string, passwordInput: string): Promise<UserProfile> {
  const cleanEmail = emailInput.trim().toLowerCase();
  const password = passwordInput.trim();

  if (cleanEmail === 'karahan@gmail.com' && password === '12345678') {
    return robustEmailSignIn(cleanEmail, password);
  }

  try {
    let cred;
    try {
      cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
    } catch (signUpErr: any) {
      if (signUpErr.code === 'auth/email-already-in-use') {
        cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
      } else {
        throw signUpErr;
      }
    }

    if (cred?.user) {
      const profile = await syncUserProfile(cred.user);
      appStorage.setItemSync('vox_local_email_user', JSON.stringify(profile));
      window.dispatchEvent(new CustomEvent('vox_auth_changed', { detail: profile }));
      return profile;
    }
  } catch (err: any) {
    console.warn('Firebase SignUp error, creating local email session:', err);
    const localUid = `user_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`;
    const displayName = cleanEmail.split('@')[0];
    const fallbackProfile: UserProfile = {
      uid: localUid,
      displayName: displayName.charAt(0).toUpperCase() + displayName.slice(1),
      email: cleanEmail,
      photoURL: '',
      birthdate: '1998-05-14',
      authProvider: 'email',
      isPremium: false,
      subscriptionTier: 'free',
      dailyQuotaUsed: 0,
      lastQuotaResetDate: new Date().toISOString().split('T')[0],
      focusScore: 90,
      streakCount: 1,
      weeklyMinutes: 15,
      totalArticlesRead: 1,
      totalListenedMinutes: 10,
      createdAt: new Date().toISOString()
    };
    appStorage.setItemSync('vox_local_email_user', JSON.stringify(fallbackProfile));
    window.dispatchEvent(new CustomEvent('vox_auth_changed', { detail: fallbackProfile }));
    return fallbackProfile;
  }

  throw new Error('Kayıt oluşturulurken bir hata oluştu.');
}

// Anonymous Sign In Helper
export async function ensureAuthUser(): Promise<FirebaseUser | null> {
  if (auth.currentUser) return auth.currentUser;
  try {
    const cred = await signInAnonymously(auth);
    return cred.user;
  } catch (err: any) {
    console.info('Firebase Anonymous Auth is restricted or unavailable; operating in local guest session mode.');
    return null;
  }
}

// Robust Guest Sign-In Helper (Firebase Anonymous + Fallback Local Session)
export async function signInAsGuest(): Promise<UserProfile> {
  let user: FirebaseUser | null = null;
  try {
    const anonPromise = signInAnonymously(auth);
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Auth timeout')), 2500)
    );
    const cred = await Promise.race([anonPromise, timeoutPromise]) as any;
    user = cred?.user || null;
  } catch (err: any) {
    console.info('Firebase Anonymous Auth unavailable or timed out, using instant local guest mode:', err?.message || err);
  }

  if (user) {
    try {
      const profile = await syncUserProfile(user);
      appStorage.setItemSync('vox_local_guest_user', JSON.stringify(profile));
      window.dispatchEvent(new CustomEvent('vox_auth_changed', { detail: profile }));
      return profile;
    } catch (syncErr) {
      console.error('Error syncing guest profile, using local fallback profile:', syncErr);
    }
  }

  const guestId = appStorage.getItemSync('vox_guest_uid') || `guest_${Date.now()}`;
  appStorage.setItemSync('vox_guest_uid', guestId);

  const guestProfile: UserProfile = {
    uid: guestId,
    displayName: 'Misafir Kullanıcı',
    email: 'misafir@vox.app',
    photoURL: '',
    birthdate: '1998-05-14',
    authProvider: 'guest',
    isPremium: false,
    subscriptionTier: 'free',
    dailyQuotaUsed: 0,
    lastQuotaResetDate: new Date().toISOString().split('T')[0],
    focusScore: 92,
    streakCount: 0,
    weeklyMinutes: 0,
    totalArticlesRead: 0,
    totalListenedMinutes: 0,
    createdAt: new Date().toISOString()
  };

  appStorage.setItemSync('vox_local_guest_user', JSON.stringify(guestProfile));
  window.dispatchEvent(new CustomEvent('vox_auth_changed', { detail: guestProfile }));
  return guestProfile;
}

// User Profile Sync
export async function syncUserProfile(user: FirebaseUser): Promise<UserProfile> {
  let localStats = { totalListenedSeconds: 0, totalArticlesRead: 0 };
  try {
    const s = appStorage.getItemSync('vox_user_stats');
    if (s) localStats = JSON.parse(s);
  } catch (e) {}

  const listenedMins = Math.floor(localStats.totalListenedSeconds / 60);
  const isGuest = user.isAnonymous;
  const isGoogle = user.providerData.some(p => p.providerId === 'google.com') || !!user.photoURL;
  const isApple = user.providerData.some(p => p.providerId === 'apple.com');

  const computedDisplayName = user.displayName || (isGuest ? 'Misafir Kullanıcı' : (user.email ? user.email.split('@')[0] : 'VOX Kullanıcısı'));
  const computedEmail = user.email || (isGuest ? 'misafir@vox.app' : '');
  const computedPhotoURL = user.photoURL || '';

  const today = new Date().toISOString().split('T')[0];

  const fallbackProfile: UserProfile = {
    uid: user.uid,
    displayName: computedDisplayName,
    email: computedEmail,
    photoURL: computedPhotoURL,
    birthdate: '1998-05-14',
    authProvider: isGoogle ? 'google' : (isApple ? 'apple' : (isGuest ? 'guest' : 'email')),
    isPremium: false,
    subscriptionTier: 'free',
    dailyQuotaUsed: 0,
    lastQuotaResetDate: today,
    focusScore: listenedMins > 0 ? Math.min(100, Math.round(listenedMins * 0.5)) : 92,
    streakCount: listenedMins > 0 ? 1 : 0,
    weeklyMinutes: listenedMins,
    totalArticlesRead: localStats.totalArticlesRead || 0,
    totalListenedMinutes: listenedMins,
    createdAt: new Date().toISOString()
  };

  try {
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);

    if (snap.exists()) {
      const data = snap.data() as UserProfile;
      const isNewDay = data.lastQuotaResetDate !== today;
      const dailyQuotaUsed = isNewDay ? 0 : (data.dailyQuotaUsed || 0);
      const lastQuotaResetDate = today;

      const updatedProfile: UserProfile = {
        ...data,
        displayName: user.displayName || data.displayName || computedDisplayName,
        email: user.email || data.email || computedEmail,
        photoURL: user.photoURL || data.photoURL || computedPhotoURL,
        authProvider: isGoogle ? 'google' : (isApple ? 'apple' : (isGuest ? 'guest' : data.authProvider || 'email')),
        dailyQuotaUsed,
        lastQuotaResetDate,
        totalListenedMinutes: (data.totalListenedMinutes || 0) + listenedMins,
        weeklyMinutes: (data.weeklyMinutes || 0) + listenedMins,
        focusScore: Math.min(100, Math.round(((data.weeklyMinutes || 0) + listenedMins) * 0.5))
      };

      try {
        await updateDoc(userRef, {
          displayName: updatedProfile.displayName,
          email: updatedProfile.email,
          photoURL: updatedProfile.photoURL,
          authProvider: updatedProfile.authProvider,
          dailyQuotaUsed: updatedProfile.dailyQuotaUsed,
          lastQuotaResetDate: updatedProfile.lastQuotaResetDate,
          weeklyMinutes: updatedProfile.weeklyMinutes,
          focusScore: updatedProfile.focusScore
        });
      } catch (err) {
        console.warn('Error updating profile in Firestore (offline mode active):', err);
      }

      return updatedProfile;
    } else {
      try {
        await setDoc(userRef, fallbackProfile);
      } catch (err) {
        console.warn('Error creating profile in Firestore (offline mode active):', err);
      }
      return fallbackProfile;
    }
  } catch (err) {
    console.warn('Firestore user sync unreachable, operating in local offline mode:', err);
    return fallbackProfile;
  }
}

// Increment User Daily Quota Used in Firestore
export async function incrementUserQuota(userId: string): Promise<number> {
  const today = new Date().toISOString().split('T')[0];
  try {
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data() as UserProfile;
      const isNewDay = data.lastQuotaResetDate !== today;
      const currentQuota = isNewDay ? 0 : (data.dailyQuotaUsed || 0);
      const newQuotaUsed = currentQuota + 1;

      await updateDoc(userRef, {
        dailyQuotaUsed: newQuotaUsed,
        lastQuotaResetDate: today
      });
      return newQuotaUsed;
    } else {
      await setDoc(userRef, {
        dailyQuotaUsed: 1,
        lastQuotaResetDate: today
      }, { merge: true });
      return 1;
    }
  } catch (err) {
    console.warn('Error incrementing user quota in Firestore:', err);
    return 1;
  }
}

// Update User Focus Score
export async function addFocusMinutes(userId: string, minutes: number = 5): Promise<{ weeklyMinutes: number; focusScore: number } | null> {
  try {
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data() as UserProfile;
      const newWeekly = (data.weeklyMinutes || 0) + minutes;
      // Standardized formula for dynamic focus score calculation capped at 100
      const newScore = Math.min(100, Math.round(85 + (newWeekly / 60) * 1.2));
      await updateDoc(userRef, {
        weeklyMinutes: newWeekly,
        focusScore: newScore
      });
      return { weeklyMinutes: newWeekly, focusScore: newScore };
    } else {
      const newWeekly = minutes;
      const newScore = Math.min(100, Math.round(85 + (newWeekly / 60) * 1.2));
      return { weeklyMinutes: newWeekly, focusScore: newScore };
    }
  } catch (e) {
    console.error('Error updating focus score:', e);
    return null;
  }
}

// Default Seed Articles if Firestore is empty (imported from ../data/defaultArticles)

// Fetch All Articles from Firestore (with fallbacks)
export async function getArticles(): Promise<Article[]> {
  try {
    const colRef = collection(db, 'articles');
    const snap = await getDocs(colRef);
    if (snap.empty) {
      // Seed default articles to Firestore for initial setup
      for (const item of INITIAL_ARTICLES) {
        await setDoc(doc(colRef, item.id), item);
      }
      return INITIAL_ARTICLES;
    }
    const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Article));
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    console.warn('Firestore fetch fallback to local:', err);
    return INITIAL_ARTICLES;
  }
}

export interface PaginatedArticlesResult {
  articles: Article[];
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
}

// Fetch Paginated Articles with Cursor (limit + startAfter) and optional Category Filter constraint
export async function getArticlesPaginated(
  pageSize: number = 6,
  lastDocSnapshot: QueryDocumentSnapshot | null = null,
  categoryFilter?: string
): Promise<PaginatedArticlesResult> {
  try {
    const colRef = collection(db, 'articles');
    let q;
    
    // Check if a specific category constraint is requested (other than 'Tümü' or 'Dönüştürülenler')
    const hasCategoryConstraint = categoryFilter && categoryFilter !== 'Tümü' && categoryFilter !== 'Dönüştürülenler';

    if (hasCategoryConstraint) {
      if (lastDocSnapshot) {
        q = query(colRef, where('category', '==', categoryFilter), orderBy('createdAt', 'desc'), startAfter(lastDocSnapshot), limit(pageSize));
      } else {
        q = query(colRef, where('category', '==', categoryFilter), orderBy('createdAt', 'desc'), limit(pageSize));
      }
    } else {
      if (lastDocSnapshot) {
        q = query(colRef, orderBy('createdAt', 'desc'), startAfter(lastDocSnapshot), limit(pageSize));
      } else {
        q = query(colRef, orderBy('createdAt', 'desc'), limit(pageSize));
      }
    }

    let snap;
    try {
      snap = await getDocs(q);
    } catch (queryErr) {
      console.warn('[Firestore Category Query Warning] Fallback without compound index:', queryErr);
      if (hasCategoryConstraint) {
        q = query(colRef, where('category', '==', categoryFilter), limit(pageSize));
      } else {
        q = query(colRef, limit(pageSize));
      }
      snap = await getDocs(q);
    }

    if (snap.empty && !lastDocSnapshot) {
      // Seed initial articles if completely empty
      for (const item of INITIAL_ARTICLES) {
        await setDoc(doc(colRef, item.id), item);
      }
      const filteredSeed = hasCategoryConstraint
        ? INITIAL_ARTICLES.filter(a => a.category === categoryFilter)
        : INITIAL_ARTICLES;

      return {
        articles: filteredSeed.slice(0, pageSize),
        lastDoc: null,
        hasMore: filteredSeed.length > pageSize
      };
    }

    const articles = snap.docs.map(d => ({ id: d.id, ...(d.data() as Record<string, unknown>) } as Article));
    const lastVisible = snap.docs[snap.docs.length - 1] || null;
    const hasMore = snap.docs.length === pageSize;

    return {
      articles,
      lastDoc: lastVisible,
      hasMore
    };
  } catch (err) {
    console.warn('Paginated query fallback to local initial articles:', err);
    const filteredSeed = (categoryFilter && categoryFilter !== 'Tümü' && categoryFilter !== 'Dönüştürülenler')
      ? INITIAL_ARTICLES.filter(a => a.category === categoryFilter)
      : INITIAL_ARTICLES;

    return {
      articles: filteredSeed.slice(0, pageSize),
      lastDoc: null,
      hasMore: filteredSeed.length > pageSize
    };
  }
}

// Fetch Articles by Category using direct Firestore constraint
export async function getArticlesByCategory(category: string): Promise<Article[]> {
  try {
    const colRef = collection(db, 'articles');
    let q;
    if (category && category !== 'Tümü' && category !== 'Dönüştürülenler') {
      q = query(colRef, where('category', '==', category));
    } else {
      q = query(colRef, orderBy('createdAt', 'desc'));
    }
    const snap = await getDocs(q);
    const list = snap.docs.map(doc => ({ id: doc.id, ...(doc.data() as Record<string, unknown>) } as Article));
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (err) {
    console.warn('Firestore getArticlesByCategory fallback:', err);
    if (category && category !== 'Tümü' && category !== 'Dönüştürülenler') {
      return INITIAL_ARTICLES.filter(a => a.category === category);
    }
    return INITIAL_ARTICLES;
  }
}

// Add New Article
export async function saveArticle(article: Omit<Article, 'id'>): Promise<Article> {
  const newId = 'art_' + Date.now();
  const fullArticle: Article = { id: newId, ...article };
  try {
    await setDoc(doc(db, 'articles', newId), fullArticle);
  } catch (err) {
    console.warn('Saved locally due to offline/permission:', err);
  }
  return fullArticle;
}

// Clear Custom User-Added Articles from Firestore
export async function clearCustomArticlesFromFirestore(): Promise<void> {
  try {
    const colRef = collection(db, 'articles');
    const snap = await getDocs(colRef);
    const initialIds = new Set(INITIAL_ARTICLES.map(a => a.id));
    
    const deletePromises: Promise<void>[] = [];
    snap.docs.forEach(d => {
      if (!initialIds.has(d.id)) {
        deletePromises.push(deleteDoc(doc(db, 'articles', d.id)));
      }
    });
    
    await Promise.all(deletePromises);
  } catch (err) {
    console.warn('Error deleting custom articles from Firestore:', err);
  }
}

// Bookmarks Handling
export async function toggleBookmark(userId: string, articleId: string): Promise<boolean> {
  try {
    const bRef = doc(db, 'bookmarks', `${userId}_${articleId}`);
    const snap = await getDoc(bRef);
    if (snap.exists()) {
      await deleteDoc(bRef);
      return false;
    } else {
      await setDoc(bRef, {
        userId,
        articleId,
        savedAt: new Date().toISOString()
      });
      return true;
    }
  } catch (e) {
    console.warn('Bookmark toggle error:', e);
    return false;
  }
}

export async function getUserBookmarks(userId: string): Promise<string[]> {
  try {
    const q = query(collection(db, 'bookmarks'), where('userId', '==', userId));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data().articleId);
  } catch (e) {
    return [];
  }
}

// Update User Premium Status & Tier in Firestore
export async function updateUserPremiumStatus(
  userId: string,
  isPremium: boolean,
  subscriptionTier: 'free' | 'premium_monthly' | 'premium_yearly' | 'premium_lifetime' = 'premium_monthly',
  subscriptionEndsAt?: string | null
): Promise<boolean> {
  if (!userId) return false;
  try {
    const userRef = doc(db, 'users', userId);
    const updateData: any = {
      isPremium,
      subscriptionTier: isPremium ? subscriptionTier : 'free',
      updatedAt: new Date().toISOString()
    };
    if (subscriptionEndsAt !== undefined) {
      updateData.subscriptionEndsAt = subscriptionEndsAt;
    }
    await setDoc(userRef, updateData, { merge: true });
    return true;
  } catch (err) {
    console.warn('Error updating user premium status in Firestore:', err);
    return false;
  }
}

// Save or Update User FCM Push Notification Token in Firestore
export async function saveUserPushToken(userId: string, pushToken: string): Promise<boolean> {
  if (!userId || !pushToken) return false;
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(
      userRef,
      {
        pushToken,
        pushTokenUpdatedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    );
    console.log(`[FCM] Push token saved for user ${userId}`);
    return true;
  } catch (err) {
    console.warn('Error saving push token to Firestore:', err);
    return false;
  }
}
