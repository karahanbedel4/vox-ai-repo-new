import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('🚀 [VOX iOS Setup] Otomatik iOS ve Xcode konfigürasyonu denetleniyor...');

const rootPlistPath = path.join(rootDir, 'GoogleService-Info.plist');
const iosAppDir = path.join(rootDir, 'ios', 'App', 'App');
const iosPlistPath = path.join(iosAppDir, 'GoogleService-Info.plist');
const iosInfoPlist = path.join(iosAppDir, 'Info.plist');

// 1. GoogleService-Info.plist senkronizasyonu
if (fs.existsSync(rootPlistPath)) {
  if (fs.existsSync(iosAppDir)) {
    fs.copyFileSync(rootPlistPath, iosPlistPath);
    console.log('✅ [VOX iOS Setup] GoogleService-Info.plist -> ios/App/App/ dizinine senkronize edildi.');
  }
} else if (fs.existsSync(iosPlistPath)) {
  fs.copyFileSync(iosPlistPath, rootPlistPath);
  console.log('✅ [VOX iOS Setup] ios/App/App/GoogleService-Info.plist ana dizine kopyalandı.');
}

// 2. Info.plist içerisindeki REVERSED_CLIENT_ID ve ATS kontrolleri
if (fs.existsSync(iosInfoPlist)) {
  let infoContent = fs.readFileSync(iosInfoPlist, 'utf8');
  let plistContent = fs.existsSync(iosPlistPath) ? fs.readFileSync(iosPlistPath, 'utf8') : '';

  let reversedClientId = '';
  const match = plistContent.match(/<key>REVERSED_CLIENT_ID<\/key>\s*<string>([^<]+)<\/string>/);
  if (match && match[1]) {
    reversedClientId = match[1].trim();
  }

  // REVERSED_CLIENT_ID ekleme
  if (reversedClientId && !infoContent.includes(reversedClientId)) {
    console.log(`🔧 [VOX iOS Setup] Info.plist URL Schemes içine ${reversedClientId} ekleniyor...`);
    infoContent = infoContent.replace(
      /<string>vox<\/string>/,
      `<string>vox</string>\n\t\t\t\t<string>${reversedClientId}</string>`
    );
  }

  // App Transport Security kontrolü
  if (!infoContent.includes('<key>NSAppTransportSecurity</key>')) {
    console.log('🔧 [VOX iOS Setup] Info.plist içerisine NSAppTransportSecurity ekleniyor...');
    infoContent = infoContent.replace(
      /<key>UIBackgroundModes<\/key>/,
      `<key>NSAppTransportSecurity</key>\n\t<dict>\n\t\t<key>NSAllowsArbitraryLoads</key>\n\t\t<true/>\n\t</dict>\n\t<key>UIBackgroundModes</key>`
    );
  }

  fs.writeFileSync(iosInfoPlist, infoContent, 'utf8');
  console.log('✅ [VOX iOS Setup] Info.plist ayarları ve URL Types tamamen güncellendi.');
}

console.log('✨ [VOX iOS Setup] Tüm Xcode ayarları hazır! Sıfır manuel işlem ile Xcode derlemesine geçilebilir.\n');
