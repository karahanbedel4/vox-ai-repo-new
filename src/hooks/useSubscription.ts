import { useState, useEffect, useCallback } from 'react';
import { UserProfile } from '../types';
import { db, incrementUserQuota, updateUserPremiumStatus } from '../lib/firebase';
import { safeApiFetch } from '../lib/api';
import { doc, onSnapshot } from 'firebase/firestore';
import { appStorage } from '../lib/storage';
import { 
  initRevenueCat, 
  logInRevenueCat, 
  checkProEntitlement, 
  getOfferings, 
  purchasePackage as rcPurchasePackage, 
  restorePurchases as rcRestorePurchases,
  presentPaywall as rcPresentPaywall,
  presentCustomerCenter as rcPresentCustomerCenter,
  REVENUECAT_CONFIG
} from '../lib/revenuecat';

export interface UseSubscriptionResult {
  isPremium: boolean;
  subscriptionTier: 'free' | 'premium_monthly' | 'premium_yearly' | 'premium_lifetime';
  subscriptionEndsAt: string | null;
  dailyQuotaUsed: number;
  dailyQuotaLimit: number;
  isQuotaExceeded: boolean;
  isGuest: boolean;
  isLoading: boolean;
  isPaywallOpen: boolean;
  setIsPaywallOpen: (open: boolean) => void;
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  purchasePackage: (tier: 'monthly' | 'yearly' | 'lifetime') => Promise<{ success: boolean; message: string }>;
  restorePurchases: () => Promise<{ success: boolean; message: string }>;
  openNativePaywall: () => Promise<boolean>;
  openCustomerCenter: () => Promise<boolean>;
  incrementQuota: () => Promise<boolean>;
  resetQuota: () => void;
}

const FREE_DAILY_QUOTA_LIMIT = 3;
const GUEST_QUOTA_LIMIT = 1;

export function useSubscription(user: UserProfile | null): UseSubscriptionResult {
  const isGuest = !user || user.authProvider === 'guest';
  const [isPremium, setIsPremium] = useState<boolean>(user?.isPremium ?? false);
  const [subscriptionTier, setSubscriptionTier] = useState<'free' | 'premium_monthly' | 'premium_yearly' | 'premium_lifetime'>(
    user?.subscriptionTier as any || 'free'
  );
  const [subscriptionEndsAt, setSubscriptionEndsAt] = useState<string | null>(
    user?.subscriptionEndsAt || null
  );
  const [dailyQuotaUsed, setDailyQuotaUsed] = useState<number>(user?.dailyQuotaUsed || 0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isPaywallOpen, setIsPaywallOpen] = useState<boolean>(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  // Sync with Firestore real-time doc if user is logged in
  useEffect(() => {
    if (!user?.uid) {
      // Fallback local persistence check
      appStorage.getItem('vox_subscription').then((localSub) => {
        if (localSub) {
          try {
            const parsed = JSON.parse(localSub);
            setIsPremium(parsed.isPremium);
            setSubscriptionTier(parsed.subscriptionTier || 'free');
            setSubscriptionEndsAt(parsed.subscriptionEndsAt || null);
          } catch (e) {}
        }
      });
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const userRef = doc(db, 'users', user.uid);

    const unsub = onSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as UserProfile;
        if (data.isPremium !== undefined) setIsPremium(!!data.isPremium);
        if (data.subscriptionTier) setSubscriptionTier(data.subscriptionTier as any);
        if (data.subscriptionEndsAt) setSubscriptionEndsAt(data.subscriptionEndsAt);

        // Check if daily quota needs reset
        if (data.lastQuotaResetDate !== today) {
          setDailyQuotaUsed(0);
        } else {
          setDailyQuotaUsed(data.dailyQuotaUsed || 0);
        }
      }
    }, (err) => {
      console.warn('Subscription snapshot listener fallback:', err);
    });

    return () => unsub();
  }, [user?.uid]);

  // RevenueCat SDK Initialization & Entitlement Check for "Vox - Bulten Ozetleyici Pro"
  useEffect(() => {
    let isMounted = true;
    async function setupRevenueCat() {
      await initRevenueCat(user?.uid || undefined);
      if (user?.uid) {
        await logInRevenueCat(user.uid);
      }
      const entitled = await checkProEntitlement();
      if (isMounted && entitled) {
        setIsPremium(true);
      }
    }
    setupRevenueCat();
    return () => { isMounted = false; };
  }, [user?.uid]);

  const dailyQuotaLimit = isPremium ? Infinity : (isGuest ? GUEST_QUOTA_LIMIT : FREE_DAILY_QUOTA_LIMIT);
  const isQuotaExceeded = !isPremium && dailyQuotaUsed >= dailyQuotaLimit;

  // Increment Quota when creating summary / TTS
  const incrementQuota = useCallback(async (): Promise<boolean> => {
    if (isPremium) return true;

    // Guest user limit check (Max 1 free summary allowed in guest mode)
    if (isGuest && dailyQuotaUsed >= GUEST_QUOTA_LIMIT) {
      setIsAuthModalOpen(true);
      return false;
    }

    // Registered user limit check
    if (!isGuest && dailyQuotaUsed >= FREE_DAILY_QUOTA_LIMIT) {
      setIsPaywallOpen(true);
      return false;
    }

    const nextQuota = dailyQuotaUsed + 1;
    setDailyQuotaUsed(nextQuota);

    // Save locally
    const today = new Date().toISOString().split('T')[0];
    appStorage.setItem('vox_daily_quota', JSON.stringify({ count: nextQuota, date: today }));

    // Persist to Firestore if user exists
    if (user?.uid) {
      try {
        await incrementUserQuota(user.uid);
      } catch (e) {
        console.warn('Quota sync warning:', e);
      }
    }

    if (isGuest && nextQuota >= GUEST_QUOTA_LIMIT) {
      // Trigger login prompt modal after guest finishes their 1 allowed test summary
      setTimeout(() => setIsAuthModalOpen(true), 1200);
    } else if (!isGuest && nextQuota >= FREE_DAILY_QUOTA_LIMIT) {
      // Trigger paywall alert after using last free quota slot
      setTimeout(() => setIsPaywallOpen(true), 800);
    }

    return true;
  }, [dailyQuotaUsed, isPremium, isGuest, user?.uid]);

  const resetQuota = useCallback(() => {
    setDailyQuotaUsed(0);
    appStorage.removeItem('vox_daily_quota');
  }, []);

  // Purchase Package (RevenueCat SDK with Web API Fallback)
  const purchasePackage = useCallback(async (tier: 'monthly' | 'yearly' | 'lifetime'): Promise<{ success: boolean; message: string }> => {
    setIsLoading(true);
    try {
      // 1. Check Native RevenueCat Offerings
      const currentOffering = await getOfferings();
      if (currentOffering && currentOffering.availablePackages && currentOffering.availablePackages.length > 0) {
        // Match product package: monthly ($rc_monthly), yearly ($rc_annual), lifetime ($rc_lifetime)
        const matchedPackage = currentOffering.availablePackages.find(p => {
          if (tier === 'lifetime') return p.packageType === 'LIFETIME' || p.identifier.includes('lifetime');
          if (tier === 'yearly') return p.packageType === 'ANNUAL' || p.identifier.includes('yearly') || p.identifier.includes('annual');
          return p.packageType === 'MONTHLY' || p.identifier.includes('monthly');
        }) || currentOffering.availablePackages[0];

        if (matchedPackage) {
          const res = await rcPurchasePackage(matchedPackage);
          if (res.success) {
            setIsPremium(true);
            const subTier = tier === 'lifetime' ? 'premium_lifetime' : (tier === 'yearly' ? 'premium_yearly' : 'premium_monthly');
            setSubscriptionTier(subTier as any);
            
            if (user?.uid) {
              await updateUserPremiumStatus(user.uid, true, subTier as any);
            }

            appStorage.setItem('vox_subscription', JSON.stringify({
              isPremium: true,
              subscriptionTier: subTier
            }));

            setIsPaywallOpen(false);
            setIsLoading(false);
            return { success: true, message: 'Vox - Bulten Ozetleyici Pro aboneliğiniz başarıyla aktif edildi!' };
          } else if (res.userCancelled) {
            setIsLoading(false);
            return { success: false, message: 'Satın alma işlemi iptal edildi.' };
          }
        }
      }

      // 2. Web API Endpoint Fallback (for Web Preview & Stripe/App Store webhook simulation)
      const response = await safeApiFetch('/api/subscription/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.uid || 'guest_user',
          tier,
          platform: 'revenuecat_storekit2',
          entitlementId: REVENUECAT_CONFIG.entitlementId
        })
      });

      let data: any = null;
      if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
        data = await response.json();
      }
      if (data?.success) {
        setIsPremium(true);
        const subTier = tier === 'lifetime' ? 'premium_lifetime' : (tier === 'yearly' ? 'premium_yearly' : 'premium_monthly');
        setSubscriptionTier(subTier as any);
        const endDate = new Date();
        if (tier === 'lifetime') {
          endDate.setFullYear(endDate.getFullYear() + 99);
        } else if (tier === 'yearly') {
          endDate.setDate(endDate.getDate() + 365);
        } else {
          endDate.setDate(endDate.getDate() + 30);
        }
        setSubscriptionEndsAt(endDate.toISOString());

        if (user?.uid) {
          await updateUserPremiumStatus(user.uid, true, subTier as any, endDate.toISOString());
        }

        // Update local state
        appStorage.setItem('vox_subscription', JSON.stringify({
          isPremium: true,
          subscriptionTier: subTier,
          subscriptionEndsAt: endDate.toISOString()
        }));

        setIsPaywallOpen(false);
        setIsLoading(false);
        return { success: true, message: 'Tebrikler! Vox - Bulten Ozetleyici Pro aboneliğiniz aktif edildi.' };
      } else {
        throw new Error(data.error || 'Ödeme işlemi tamamlanamadı');
      }
    } catch (err: any) {
      setIsLoading(false);
      return { success: false, message: err.message || 'RevenueCat ödeme altyapısına bağlanırken bir hata oluştu.' };
    }
  }, [user?.uid]);

  // Restore Purchases
  const restorePurchases = useCallback(async (): Promise<{ success: boolean; message: string }> => {
    setIsLoading(true);
    try {
      const rcRes = await rcRestorePurchases();
      if (rcRes.success) {
        setIsPremium(true);
        const subTier = 'premium_monthly';
        setSubscriptionTier(subTier);

        // Update isPremium in Firestore
        if (user?.uid) {
          await updateUserPremiumStatus(user.uid, true, subTier);
        }

        appStorage.setItem('vox_subscription', JSON.stringify({
          isPremium: true,
          subscriptionTier: subTier
        }));

        setIsLoading(false);
        setIsPaywallOpen(false);
        return { success: true, message: 'Satın alımlarınız RevenueCat üzerinden başarıyla geri yüklendi!' };
      }

      // Check server API status
      const res = await safeApiFetch(`/api/subscription/status?userId=${user?.uid || 'guest_user'}`);
      let data: any = null;
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        data = await res.json();
      }
      if (data?.isPremium) {
        setIsPremium(true);
        const subTier = data.subscriptionTier || 'premium_monthly';
        setSubscriptionTier(subTier);

        // Update isPremium in Firestore
        if (user?.uid) {
          await updateUserPremiumStatus(user.uid, true, subTier);
        }

        appStorage.setItem('vox_subscription', JSON.stringify({
          isPremium: true,
          subscriptionTier: subTier
        }));

        setIsPaywallOpen(false);
        setIsLoading(false);
        return { success: true, message: 'Vox Pro aboneliğiniz başarıyla doğrulandı ve geri yüklendi.' };
      } else {
        setIsLoading(false);
        return { success: false, message: 'Aktif bir Vox - Bulten Ozetleyici Pro aboneliği bulunamadı.' };
      }
    } catch (e: any) {
      setIsLoading(false);
      return { success: false, message: 'Satın alımlar geri yüklenirken hata oluştu.' };
    }
  }, [user?.uid]);

  // Open RevenueCat Native Paywall UI
  const openNativePaywall = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);
    try {
      const { success } = await rcPresentPaywall();
      if (success) {
        setIsPremium(true);
        setIsPaywallOpen(false);
      }
      setIsLoading(false);
      return success;
    } catch (e) {
      setIsLoading(false);
      return false;
    }
  }, []);

  // Open RevenueCat Customer Center UI
  const openCustomerCenter = useCallback(async (): Promise<boolean> => {
    return await rcPresentCustomerCenter();
  }, []);

  return {
    isPremium,
    subscriptionTier,
    subscriptionEndsAt,
    dailyQuotaUsed,
    dailyQuotaLimit,
    isQuotaExceeded,
    isGuest,
    isLoading,
    isPaywallOpen,
    setIsPaywallOpen,
    isAuthModalOpen,
    setIsAuthModalOpen,
    purchasePackage,
    restorePurchases,
    openNativePaywall,
    openCustomerCenter,
    incrementQuota,
    resetQuota
  };
}
