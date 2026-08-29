import React from 'react';
import { ShieldCheck, FileText, ArrowLeft, Mail, ExternalLink } from 'lucide-react';
import { VoxLogo } from './VoxLogo';

interface LegalViewProps {
  type: 'privacy' | 'terms';
  onBack?: () => void;
}

export const LegalView: React.FC<LegalViewProps> = ({ type, onBack }) => {
  const isPrivacy = type === 'privacy';

  return (
    <div className="min-h-screen bg-surface text-on-surface p-4 sm:p-8 flex flex-col items-center">
      <div className="w-full max-w-3xl space-y-8 py-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-6">
          <div className="flex items-center gap-3">
            <VoxLogo className="h-8 w-auto" />
            <span className="text-sm font-bold text-primary tracking-widest uppercase">
              VOX ÖZET HUKUKİ METİNLER
            </span>
          </div>
          {onBack ? (
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-xs font-bold bg-white/10 hover:bg-white/20 text-on-surface px-4 py-2 rounded-xl transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Uygulamaya Dön</span>
            </button>
          ) : (
            <a
              href="/"
              className="flex items-center gap-2 text-xs font-bold bg-primary text-on-primary px-4 py-2 rounded-xl transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Ana Sayfa</span>
            </a>
          )}
        </div>

        {/* Tab Selection */}
        <div className="flex gap-2 p-1 bg-surface-container rounded-2xl border border-white/10 max-w-md">
          <a
            href="/privacy"
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl text-center flex items-center justify-center gap-2 transition-all ${
              isPrivacy
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Gizlilik Politikası</span>
          </a>
          <a
            href="/terms"
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl text-center flex items-center justify-center gap-2 transition-all ${
              !isPrivacy
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Kullanım Şartları (EULA)</span>
          </a>
        </div>

        {/* Content Box */}
        <div className="bg-surface-container/80 border border-white/10 rounded-3xl p-6 sm:p-10 space-y-6 shadow-xl leading-relaxed text-sm text-on-surface/90">
          {isPrivacy ? (
            <>
              <div className="space-y-2 border-b border-white/10 pb-4">
                <h1 className="text-2xl font-bold font-display text-on-surface flex items-center gap-2.5">
                  <ShieldCheck className="w-7 h-7 text-emerald-400" />
                  VOX Özet - Gizlilik Politikası (Privacy Policy)
                </h1>
                <p className="text-xs text-on-surface-variant">
                  Son Güncelleme: 29 Ağustos 2026 • Yürürlük Tarihi: 1 Ocak 2026
                </p>
              </div>

              <div className="space-y-4">
                <h2 className="text-base font-bold text-emerald-400">1. Genel Bakış ve Taahhüt</h2>
                <p>
                  VOX Özet ("Uygulama", "Hizmet" veya "Biz"), kullanıcı gizliliğine ve kişisel verilerin korunmasına en üst düzeyde önem verir. Bu Gizlilik Politikası, mobil uygulamamızı ve web sitemizi (voxozet.com) kullanırken bilgilerinizin nasıl toplandığını, kullanıldığını ve korunduğunu açıklamaktadır.
                </p>

                <h2 className="text-base font-bold text-emerald-400">2. Toplanan Bilgiler</h2>
                <p>Uygulamamız aşağıdaki minimum veri kategorilerini işler:</p>
                <ul className="list-disc list-inside space-y-1.5 pl-2">
                  <li><strong>Hesap Bilgileri:</strong> Google Sign-In veya Apple Kimliği ile giriş yapıldığında ad, soyad ve e-posta adresi.</li>
                  <li><strong>Kullanıcı İçerikleri:</strong> Özetlenmek veya dinlenmek üzere eklediğiniz YouTube bağlantıları, makaleler veya metinler.</li>
                  <li><strong>Kullanım İstatistikleri:</strong> Dinleme süreleri, streak (kesintisiz gün) takibi ve yer imlerine eklenen haberler.</li>
                  <li><strong>Abonelik ve Ödeme Bilgileri:</strong> Apple App Store ve RevenueCat üzerinden işlenen anonim abonelik durumları (kredi kartı bilgileriniz doğrudan Apple tarafından işlenir ve VOX tarafından asla saklanmaz).</li>
                </ul>

                <h2 className="text-base font-bold text-emerald-400">3. Google ve YouTube Verileri</h2>
                <p>
                  Google OAuth izinleri yalnızca YouTube aboneliklerinizi listelemek ve seçtiğiniz videoları sizin adınıza sesli bültene dönüştürmek amacıyla kullanılır. Google kullanıcı verileri hiçbir şart altında üçüncü taraf reklam ağlarına satılmaz, ticari amaçla devredilmez veya model eğitimi için harici taraflarla paylaşılmaz.
                </p>

                <h2 className="text-base font-bold text-emerald-400">4. Yapay Zeka ve İşleme Güvenliği</h2>
                <p>
                  Özetleme ve seslendirme işlemleri, kurumsal düzeyde veri gizliliği sağlayan Google Gemini ve güvenli sunucu altyapısı üzerinden gerçekleştirilir. İçerikleriniz kişiselleştirilmiş bülten oluşturulduktan sonra yalnızca kendi kütüphanenizde şifreli olarak barındırılır.
                </p>

                <h2 className="text-base font-bold text-emerald-400">5. İletişim ve Veri Silme Talepleri</h2>
                <p>
                  Hesabınızı ve tüm verilerinizi dilediğiniz zaman uygulama içindeki Profil sekmesinden veya <a href="mailto:karahanbedel@gmail.com" className="text-primary underline">karahanbedel@gmail.com</a> adresine e-posta göndererek kalıcı olarak silebilirsiniz.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2 border-b border-white/10 pb-4">
                <h1 className="text-2xl font-bold font-display text-on-surface flex items-center gap-2.5">
                  <FileText className="w-7 h-7 text-primary" />
                  VOX Özet - Kullanım Koşulları ve EULA
                </h1>
                <p className="text-xs text-on-surface-variant">
                  Son Güncelleme: 29 Ağustos 2026 • Apple Standart EULA Uyumlu
                </p>
              </div>

              <div className="space-y-4">
                <h2 className="text-base font-bold text-primary">1. Hizmet Şartlarının Kabulü</h2>
                <p>
                  VOX Özet uygulamasını indirerek, yükleyerek veya kullanarak bu Kullanım Koşullarını ve Apple Standart Son Kullanıcı Lisans Sözleşmesini (EULA) kabul etmiş sayılırsınız.
                </p>

                <h2 className="text-base font-bold text-primary">2. Hizmetin Niteliği</h2>
                <p>
                  VOX, yapay zeka destekli içerik özetleme, RSS haber akışı ve metinden sese (TTS) dönüştürme hizmeti sunan bir kişisel asistan platformudur. Üretilen içerikler bilgilendirme amaçlı olup yatırım, tıbbi veya hukuki tavsiye niteliği taşımaz.
                </p>

                <h2 className="text-base font-bold text-primary">3. Abonelikler ve Otomatik Yenileme</h2>
                <p>
                  VOX Premium abonelikleri Apple Kimliği hesabınız üzerinden ücretlendirilir. Otomatik yenileme, mevcut abonelik döneminin bitiminden en az 24 saat önce iptal edilmediği sürece devam eder. Aboneliklerinizi dilediğiniz zaman iOS Ayarlar &gt; Apple Kimliği &gt; Abonelikler menüsünden yönetebilirsiniz.
                </p>

                <h2 className="text-base font-bold text-primary">4. Fikri Mülkiyet ve Adil Kullanım</h2>
                <p>
                  Uygulama üzerinden özetlenen harici haberlerin ve YouTube videolarının telif hakları ilgili yayıncılara aittir. VOX, içerikleri kaynak göstererek adil kullanım ve kişisel dinleme bülteni prensipleri çerçevesinde işler.
                </p>
              </div>
            </>
          )}

          {/* Contact Box */}
          <div className="pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-on-surface-variant">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary" />
              <span>Geliştirici İletişim: <strong>karahanbedel@gmail.com</strong></span>
            </div>
            <a
              href="https://voxozet.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-primary hover:underline font-bold"
            >
              <span>voxozet.com</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
