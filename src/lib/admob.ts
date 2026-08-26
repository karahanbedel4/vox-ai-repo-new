import { Capacitor } from '@capacitor/core';
import { 
  AdMob, 
  BannerAdOptions, 
  BannerAdSize, 
  BannerAdPosition, 
  AdmobConsentStatus,
  RewardAdOptions,
  AdOptions
} from '@capacitor-community/admob';

export const ADMOB_CONFIG = {
  appId: 'ca-app-pub-4663082689738592~3692688176',
  bannerAdId: 'ca-app-pub-4663082689738592/1804891439',
  interstitialAdId: 'ca-app-pub-4663082689738592/4333967374',
  rewardedAdId: 'ca-app-pub-4663082689738592/8850023384'
};

let isAdMobInitialized = false;
let isBannerVisible = false;

/**
 * Initializes AdMob SDK on native iOS / Android devices.
 */
export async function initAdMob(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return false;
  }

  if (isAdMobInitialized) {
    return true;
  }

  try {
    await AdMob.initialize({
      initializeForTesting: false
    });
    isAdMobInitialized = true;
    console.log('[AdMob] Initialized successfully with App ID:', ADMOB_CONFIG.appId);
    return true;
  } catch (err) {
    console.warn('[AdMob] Initialization warning:', err);
    return false;
  }
}

/**
 * Shows Bottom Banner Ad (Only for free tier users)
 */
export async function showBannerAd(isPremiumUser: boolean = false): Promise<boolean> {
  if (isPremiumUser || !Capacitor.isNativePlatform()) {
    if (isBannerVisible) {
      await hideBannerAd();
    }
    return false;
  }

  try {
    if (!isAdMobInitialized) {
      await initAdMob();
    }

    const options: BannerAdOptions = {
      adId: ADMOB_CONFIG.bannerAdId,
      adSize: BannerAdSize.BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: 60, // Above bottom navigation bar
      isTesting: false
    };

    await AdMob.showBanner(options);
    isBannerVisible = true;
    console.log('[AdMob] Banner Ad shown successfully');
    return true;
  } catch (err) {
    console.warn('[AdMob] showBannerAd error:', err);
    return false;
  }
}

/**
 * Hides currently displayed Banner Ad
 */
export async function hideBannerAd(): Promise<void> {
  if (!Capacitor.isNativePlatform() || !isBannerVisible) return;
  try {
    await AdMob.hideBanner();
    isBannerVisible = false;
  } catch (err) {
    console.warn('[AdMob] hideBanner error:', err);
  }
}

/**
 * Removes Banner Ad from memory
 */
export async function removeBannerAd(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await AdMob.removeBanner();
    isBannerVisible = false;
  } catch (err) {
    console.warn('[AdMob] removeBanner error:', err);
  }
}

/**
 * Shows full-screen Interstitial Ad (e.g. after finishing an article or podcast)
 */
export async function showInterstitialAd(isPremiumUser: boolean = false): Promise<boolean> {
  if (isPremiumUser || !Capacitor.isNativePlatform()) {
    return false;
  }

  try {
    if (!isAdMobInitialized) {
      await initAdMob();
    }

    const options: AdOptions = {
      adId: ADMOB_CONFIG.interstitialAdId,
      isTesting: false
    };

    await AdMob.prepareInterstitial(options);
    await AdMob.showInterstitial();
    console.log('[AdMob] Interstitial Ad presented');
    return true;
  } catch (err) {
    console.warn('[AdMob] showInterstitialAd error:', err);
    return false;
  }
}

/**
 * Shows Rewarded Video Ad to grant bonus quota/articles to free users
 */
export async function showRewardedAd(
  isPremiumUser: boolean = false,
  onRewardEarned?: () => void
): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    // If testing on web, simulate earning reward
    if (onRewardEarned) onRewardEarned();
    return true;
  }

  try {
    if (!isAdMobInitialized) {
      await initAdMob();
    }

    const options: RewardAdOptions = {
      adId: ADMOB_CONFIG.rewardedAdId,
      isTesting: false
    };

    await AdMob.prepareRewardVideoAd(options);
    const rewardItem = await AdMob.showRewardVideoAd();
    
    if (rewardItem && onRewardEarned) {
      console.log('[AdMob] Rewarded Ad completed. Reward:', rewardItem);
      onRewardEarned();
    }
    return true;
  } catch (err) {
    console.warn('[AdMob] showRewardedAd error:', err);
    return false;
  }
}
