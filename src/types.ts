export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  birthdate?: string;
  authProvider?: 'google' | 'apple' | 'email' | 'guest';
  isPremium: boolean;
  subscriptionTier?: 'free' | 'premium_monthly' | 'premium_yearly';
  subscriptionEndsAt?: string;
  customerId?: string;
  dailyQuotaUsed?: number;
  lastQuotaResetDate?: string;
  focusScore: number;
  streakCount: number;
  weeklyMinutes: number;
  totalArticlesRead: number;
  totalListenedMinutes: number;
  pushToken?: string;
  pushTokenUpdatedAt?: string;
  createdAt?: string;
}

export type SourceType = 'youtube' | 'web' | 'rss' | 'ocr' | 'pdf' | 'text';

export interface Article {
  id: string;
  title: string;
  summary: string;
  content: string;
  category: string;
  sourceUrl?: string;
  sourceType: SourceType;
  durationSeconds: number;
  imageUrl?: string;
  createdAt: string;
  author?: string;
  keyPoints?: string[];
  transcriptWords?: { word: string; start: number; duration: number }[];
  englishTitle?: string;
  englishSummary?: string;
  englishContent?: string;
  englishKeyPoints?: string[];
}

export interface YouTubeVideoItem {
  id: string;
  title: string;
  videoId: string;
  publishedAt?: string;
  thumbnail?: string;
}

export interface ChannelSource {
  id: string;
  title: string;
  type: 'rss' | 'youtube' | 'newsletter';
  unreadCount: number;
  enabled: boolean;
  notificationsEnabled?: boolean;
  thumbnail?: string;
  description?: string;
  url?: string;
  recentVideos?: YouTubeVideoItem[];
}

export interface UserHistoryItem {
  id?: string;
  userId: string;
  articleId: string;
  listenedSeconds: number;
  completed: boolean;
  updatedAt: string;
}

export interface BookmarkItem {
  id?: string;
  userId: string;
  articleId: string;
  savedAt: string;
}

export type TabType = 'read' | 'listen' | 'add' | 'library' | 'profile';

export interface AmbientChannel {
  id: string;
  name: string;
  volume: number; // 0.0 to 1.0
  active: boolean;
  isCustomUrl?: boolean;
  customUrl?: string;
}

export interface SharedLinkItem {
  id: string;
  url: string;
  title?: string;
  sourceType: SourceType;
  platformName: 'YouTube' | 'X / Twitter' | 'Web' | 'PDF / Belge' | 'Metin';
  thumbnail?: string;
  addedAt: string;
}
