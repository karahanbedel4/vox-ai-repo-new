import { Purchases, LOG_LEVEL, CustomerInfo, PurchasesOffering, PurchasesPackage } from '@revenuecat/purchases-capacitor';
import { RevenueCatUI, PAYWALL_RESULT } from '@revenuecat/purchases-capacitor-ui';
import { appStorage } from './storage';

// RevenueCat Configuration Options
export const REVENUECAT_CONFIG = {
  apiKey: 'test_dpDWFaiEPzlLeUuaLjhNglecjsB',
  entitlementId: 'Vox - Bulten Ozetleyici Pro',
  fallbackEntitlementIds: ['vox_pro', 'vox_bulten_ozetleyici_pro', 'pro'],
  products: {
    lifetime: 'lifetime',
    yearly: 'yearly',
    monthly: 'monthly'
  }
};

let isInitialized = false;

/**
 * Checks if running inside native Capacitor environment (iOS / Android app)
 */
export function isCapacitorNative(): boolean {
  return typeof window !== 'undefined' && 
         (window as any).Capacitor !== undefined && 
         typeof (window as any).Capacitor.isNativePlatform === 'function' &&
         (window as any).Capacitor.isNativePlatform();
}

/**
 * Helper to generate mock CustomerInfo for Web environment fallback
 */
function getWebMockCustomerInfo(isPro: boolean = false): CustomerInfo {
  const now = new Date();
  const dateStr = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
  
  const entitlementObj: any = {
    identifier: REVENUECAT_CONFIG.entitlementId,
    isActive: isPro,
    willRenew: isPro,
    periodType: 'NORMAL',
    latestPurchaseDate: now.toISOString(),
    latestPurchaseDateMillis: now.getTime(),
    originalPurchaseDate: now.toISOString(),
    originalPurchaseDateMillis: now.getTime(),
    expirationDate: isPro ? dateStr : null,
    expirationDateMillis: isPro ? (now.getTime() + 30 * 24 * 60 * 60 * 1000) : null,
    store: 'PLAY_STORE',
    productIdentifier: 'monthly',
    productPlanIdentifier: 'monthly-plan',
    isSandbox: true,
    unsubscribeDetectedAt: null,
    unsubscribeDetectedAtMillis: null,
    billingIssueDetectedAt: null,
    billingIssueDetectedAtMillis: null,
    ownershipType: 'PURCHASED'
  };

  const mockData: any = {
    entitlements: {
      all: isPro ? { [REVENUECAT_CONFIG.entitlementId]: entitlementObj } : {},
      active: isPro ? { [REVENUECAT_CONFIG.entitlementId]: entitlementObj } : {},
      verification: 'NOT_REQUESTED'
    },
    activeSubscriptions: isPro ? ['monthly'] : [],
    allPurchasedProductIdentifiers: isPro ? ['monthly'] : [],
    nonSubscriptionTransactions: [],
    latestExpirationDate: isPro ? dateStr : null,
    firstSeen: now.toISOString(),
    originalAppUserId: 'web_guest',
    requestDate: now.toISOString(),
    allExpirations: {},
    allPurchaseDates: {},
    originalApplicationVersion: '1.0.0',
    originalPurchaseDate: null,
    managementURL: null
  };

  return mockData as CustomerInfo;
}

/**
 * Checks web local storage subscription state for fallback
 */
function getWebLocalSubscriptionState(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = appStorage.getItemSync('vox_subscription');
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return !!parsed.isPremium;
  } catch (e) {
    return false;
  }
}

/**
 * Initializes the RevenueCat SDK with API key & optional user ID.
 * Safe for both Web browser environment and native mobile app.
 */
export async function initRevenueCat(appUserID?: string): Promise<boolean> {
  if (!isCapacitorNative()) {
    console.log('[RevenueCat] Web environment detected. Skipping native SDK initialization.');
    return false;
  }

  try {
    if (isInitialized) return true;

    // Set verbose logging in development
    await Purchases.setLogLevel({ level: LOG_LEVEL.VERBOSE });

    // Configure RevenueCat SDK natively
    await Purchases.configure({
      apiKey: REVENUECAT_CONFIG.apiKey,
      appUserID: appUserID || undefined
    });

    isInitialized = true;
    console.log('[RevenueCat] Native SDK Initialized successfully with API Key:', REVENUECAT_CONFIG.apiKey);
    return true;
  } catch (error) {
    console.warn('[RevenueCat] Native init warning:', error);
    return false;
  }
}

/**
 * Log in a specific user to RevenueCat
 */
export async function logInRevenueCat(appUserID: string): Promise<CustomerInfo | null> {
  if (!isCapacitorNative()) {
    console.log('[RevenueCat] Web mode: logIn simulated for user', appUserID);
    const isPro = getWebLocalSubscriptionState();
    return getWebMockCustomerInfo(isPro);
  }

  try {
    if (!isInitialized) await initRevenueCat(appUserID);
    const result = await Purchases.logIn({ appUserID });
    return result.customerInfo;
  } catch (error) {
    console.warn('[RevenueCat] logIn error:', error);
    return null;
  }
}

/**
 * Log out current user from RevenueCat
 */
export async function logOutRevenueCat(): Promise<CustomerInfo | null> {
  if (!isCapacitorNative()) {
    console.log('[RevenueCat] Web mode: logOut simulated');
    return getWebMockCustomerInfo(false);
  }

  try {
    const result = await Purchases.logOut();
    return result.customerInfo;
  } catch (error) {
    console.warn('[RevenueCat] logOut error:', error);
    return null;
  }
}

/**
 * Get current Customer Info and entitlement state
 */
export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  if (!isCapacitorNative()) {
    const isPro = getWebLocalSubscriptionState();
    return getWebMockCustomerInfo(isPro);
  }

  try {
    const info = await Purchases.getCustomerInfo();
    return info.customerInfo;
  } catch (error) {
    console.warn('[RevenueCat] getCustomerInfo error:', error);
    return null;
  }
}

/**
 * Helper to check entitlement for "Vox - Bulten Ozetleyici Pro" from CustomerInfo object
 */
export function isEntitledToPro(customerInfo: CustomerInfo | null | undefined): boolean {
  if (!customerInfo || !customerInfo.entitlements || !customerInfo.entitlements.active) {
    return false;
  }
  const active = customerInfo.entitlements.active;

  // 1. Check primary entitlement identifier "Vox - Bulten Ozetleyici Pro"
  if (active[REVENUECAT_CONFIG.entitlementId]) return true;

  // 2. Check fallback entitlement identifiers
  for (const fallbackId of REVENUECAT_CONFIG.fallbackEntitlementIds) {
    if (active[fallbackId]) return true;
  }

  // 3. Any active entitlement check
  return Object.keys(active).length > 0;
}

/**
 * Check whether the active user has entitlement for "Vox - Bulten Ozetleyici Pro"
 */
export async function checkProEntitlement(): Promise<boolean> {
  if (!isCapacitorNative()) {
    return getWebLocalSubscriptionState();
  }

  try {
    const customerInfo = await getCustomerInfo();
    return isEntitledToPro(customerInfo);
  } catch (error) {
    console.warn('[RevenueCat] checkProEntitlement error:', error);
    return false;
  }
}

/**
 * Get current offerings configured in RevenueCat dashboard (Monthly, Yearly, Lifetime)
 */
export async function getOfferings(): Promise<PurchasesOffering | null> {
  if (!isCapacitorNative()) {
    console.log('[RevenueCat] Web mode: returning fallback offering structure');
    return null;
  }

  try {
    const offerings = await Purchases.getOfferings();
    if (offerings.current) {
      return offerings.current;
    }
    return null;
  } catch (error) {
    console.warn('[RevenueCat] getOfferings error:', error);
    return null;
  }
}

/**
 * Purchase a RevenueCat package (Package object)
 */
export async function purchasePackage(packageToPurchase: PurchasesPackage): Promise<{
  success: boolean;
  customerInfo?: CustomerInfo;
  userCancelled?: boolean;
  error?: string;
}> {
  if (!isCapacitorNative()) {
    console.log('[RevenueCat] Web mode: purchases are delegated to web backend fallback');
    return {
      success: false,
      error: 'Web ortamında yerel simülasyon ödeme akışı kullanılıyor.'
    };
  }

  try {
    const result = await Purchases.purchasePackage({ aPackage: packageToPurchase });
    const entitled = isEntitledToPro(result.customerInfo);
    return {
      success: entitled,
      customerInfo: result.customerInfo
    };
  } catch (error: any) {
    console.error('[RevenueCat] Purchase failed:', error);
    return {
      success: false,
      userCancelled: error?.userCancelled || error?.code === 1,
      error: error?.message || 'Satın alma işlemi tamamlanamadı.'
    };
  }
}

/**
 * Restore Previous Purchases
 */
export async function restorePurchases(): Promise<{
  success: boolean;
  customerInfo?: CustomerInfo;
  error?: string;
}> {
  if (!isCapacitorNative()) {
    console.log('[RevenueCat] Web mode: restore requested');
    const isPro = getWebLocalSubscriptionState();
    return {
      success: isPro,
      customerInfo: getWebMockCustomerInfo(isPro),
      error: isPro ? undefined : 'Aktif abonelik bulunamadı.'
    };
  }

  try {
    const result = await Purchases.restorePurchases();
    const entitled = isEntitledToPro(result.customerInfo);
    return {
      success: entitled,
      customerInfo: result.customerInfo
    };
  } catch (error: any) {
    console.error('[RevenueCat] Restore failed:', error);
    return {
      success: false,
      error: error?.message || 'Satın alımlar geri yüklenemedi.'
    };
  }
}

/**
 * Present RevenueCat Native Paywall UI
 * Uses RevenueCat Paywalls tool (https://www.revenuecat.com/docs/tools/paywalls)
 */
export async function presentPaywall(): Promise<{ success: boolean; result?: PAYWALL_RESULT }> {
  if (!isCapacitorNative()) {
    console.log('[RevenueCat UI] Web mode: native paywall skipped');
    return { success: false };
  }

  try {
    const paywallRes = await RevenueCatUI.presentPaywall();
    console.log('[RevenueCat UI] Paywall result:', paywallRes);
    const isPro = await checkProEntitlement();
    return {
      success: isPro,
      result: paywallRes.result
    };
  } catch (error) {
    console.warn('[RevenueCat UI] presentPaywall warning (web preview fallback):', error);
    return { success: false };
  }
}

/**
 * Present RevenueCat Paywall ONLY IF user does NOT have the Pro entitlement
 */
export async function presentPaywallIfNeeded(): Promise<{ success: boolean; result?: PAYWALL_RESULT }> {
  if (!isCapacitorNative()) {
    console.log('[RevenueCat UI] Web mode: native paywallIfNeeded skipped');
    return { success: false };
  }

  try {
    const paywallRes = await RevenueCatUI.presentPaywallIfNeeded({
      requiredEntitlementIdentifier: REVENUECAT_CONFIG.entitlementId
    });
    const isPro = await checkProEntitlement();
    return {
      success: isPro,
      result: paywallRes.result
    };
  } catch (error) {
    console.warn('[RevenueCat UI] presentPaywallIfNeeded warning:', error);
    return { success: false };
  }
}

/**
 * Present RevenueCat Customer Center (https://www.revenuecat.com/docs/tools/customer-center)
 * Allows users to manage subscriptions, cancel, restore, or request refunds.
 */
export async function presentCustomerCenter(): Promise<boolean> {
  if (!isCapacitorNative()) {
    console.log('[RevenueCat UI] Web mode: Customer Center skipped');
    return false;
  }

  try {
    if (RevenueCatUI && typeof RevenueCatUI.presentCustomerCenter === 'function') {
      await RevenueCatUI.presentCustomerCenter();
      return true;
    }
    return false;
  } catch (error) {
    console.warn('[RevenueCat UI] Customer Center error:', error);
    return false;
  }
}
