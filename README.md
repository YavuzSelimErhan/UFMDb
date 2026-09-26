# 🎬 UFMDb — Ultimate Film Database

Modern, ölçeklenebilir, Clean Architecture tabanlı film veritabanı uygulaması.

## 🏗️ Mimari

```
backend/
  src/
    UFMDb.Domain             → Entity'ler, enum'lar, ortak taban sınıflar (bağımlılık yok)
    UFMDb.Application        → CQRS (MediatR), DTO'lar, validasyon, arayüzler (Domain'e bağımlı)
    UFMDb.Infrastructure     → JWT, şifreleme, harici servisler (Application'a bağımlı)
    UFMDb.Persistence        → EF Core DbContext (PostgreSQL/Npgsql), konfigürasyonlar, migration'lar
    UFMDb.API                → Controller'lar, middleware, Program.cs (tüm katmanları birleştirir)
    UFMDb.Tools.TmdbImporter → TMDB'den gerçek film verisi çeken bağımsız console aracı
  tests/
    UFMDb.Tests              → xUnit testleri (auth, validasyon, rate limiting, exception handling)
frontend/
  src/
    components/  pages/  features/  services/  store/  i18n/  types/  styles/
```

Bağımlılık yönü daima içe doğrudur: `API → Infrastructure/Persistence → Application → Domain`.
Application katmanı hiçbir zaman EF Core'a doğrudan bağımlı değildir; `IApplicationDbContext` soyutlaması üzerinden çalışır.

## ⚙️ Backend'i Çalıştırma

### Gereksinimler
- .NET 8 SDK
- PostgreSQL (Docker, yerel kurulum, veya bulut — örn. Supabase/Azure Database for PostgreSQL)
- (Opsiyonel) `dotnet-ef` global tool: `dotnet tool install --global dotnet-ef`

### Adımlar

```bash
cd backend

# 1. Bağımlılıkları geri yükle
dotnet restore

# 2. appsettings.json'ı örnek dosyadan oluştur ve kendi değerlerinle doldur
#    (appsettings.json .gitignore'dadır, bu yüzden repoda yer almaz)
cp src/UFMDb.API/appsettings.example.json src/UFMDb.API/appsettings.json
#    → ConnectionStrings:DefaultConnection (Postgres bağlantı bilgilerin)
#    → JwtSettings:Secret (production'da MUTLAKA rastgele, en az 32 karakter bir değerle değiştir)

# 3. API'yi çalıştır — migration dosyaları repo'da zaten mevcut, Program.cs başlangıçta
#    bekleyen migration'ları otomatik uygular; yeniden migration oluşturmana gerek yok
dotnet run --project src/UFMDb.API
```

API varsayılan olarak `https://localhost:7001` üzerinde ayağa kalkar; Swagger UI `/swagger` altında görüntülenebilir (yalnızca `Development` ortamında açık).

**Veri:** Uygulama veritabanını boş kurar — demo/seed verisi yoktur. Film/oyuncu verisini içeri almak için aşağıdaki TMDB Import Aracı'nı kullan. Bir admin hesabına ihtiyacın varsa `POST /api/auth/register` ile kayıt ol, sonra rolünü doğrudan veritabanından ya da (elindeki ilk admin üzerinden) `PUT /api/users/{id}/role` ile `Admin` yap.

## 💻 Frontend'i Çalıştırma

```bash
cd frontend
npm install
npm run dev
```

**Stack:** React 18 + TypeScript, Redux Toolkit (global state), TanStack Query (sunucu state/cache), React Router 6, i18next (TR/EN), axios.

`vite.config.ts` içindeki proxy ayarı `/api` isteklerini backend'e yönlendirir; backend portunuz farklıysa güncelleyin.

## 🧪 Backend Testlerini Çalıştırma

```bash
cd backend
dotnet test tests/UFMDb.Tests
```

Auth akışları (login/register/refresh/logout), şifre hashleme, rate limiting politikası ve global exception handling middleware'i kapsanır.

## 🔑 Öne Çıkan Tasarım Kararları

- **CQRS + MediatR**: Her endpoint tek bir Command/Query'ye karşılık gelir; okuma ve yazma yolları ayrıştırılmıştır.
- **Soft delete + global query filter**: `IsDeleted` alanı olan tüm entity'ler otomatik olarak sorgulardan filtrelenir.
- **Ağırlıklı ortalama puan**: `Movie.AverageRating`, TMDB'den gelen orijinal oy sayısı/ortalaması (`SeedVoteCount`/`SeedRating`) hiç silinmeden bir çapa olarak tutulur; sitede verilen yeni puanlar bunun üzerine gerçek oy sayılarıyla ağırlıklandırılarak eklenir (bkz. `MovieRatingRecalculator`, tek doğru kaynak). Letterboxd tarzı 0.5 adımlı puanlama kullanılır.
- **JWT + Refresh Token rotation**: Access token kısa ömürlü; refresh token'lar tablo bazlı tutulur ve her kullanımda rotate edilir.
- **Rate limiting**: `/api/auth/*` uçları IP bazlı sabit pencereli limitleyici ile korunur (bkz. `UFMDb.API/RateLimiting`).
- **i18n altyapısı**: Hem backend (`Genre.NameTr` gibi alanlar) hem frontend (i18next) TR/EN'i destekler.
- **Sosyal özellikler**: Takip sistemi, kullanıcı profilleri, liste beğenileri, review'lara yorum/beğeni gibi özellikler mevcut ve genişlemeye açık şekilde tasarlanmış.
- **Seans defteri (screening log)**: Bir filmi birden çok kez izleyip her seansı ayrı ayrı kaydedebilirsin (rewatch desteği); bir filme dair "güncel puanın" her zaman en son puanladığın seansı yansıtır.

## 🎬 Gerçek Film Verisi: TMDB Import Aracı

Proje, [The Movie Database (TMDB)](https://www.themoviedb.org/) API'sinden gerçek film/oyuncu verisi çekebilen ayrı bir console aracı içerir: `UFMDb.Tools.TmdbImporter`.

### Neden ayrı bir proje?
1000+ film çekmek dakikalar sürebilir (TMDB rate limit'ine takılmamak için istekler arasında bilinçli bekleme var) — bunu bir HTTP endpoint'i üzerinden yapmak timeout riski taşır. Bu yüzden bağımsız, terminalden çalıştırılan, ilerlemesini canlı gösteren bir console uygulaması olarak tasarlandı.

### Kurulum ve çalıştırma

```bash
cd backend

# 1. appsettings.json'ı örnek dosyadan oluştur ve API anahtarını gir
cp src/UFMDb.Tools.TmdbImporter/appsettings.example.json src/UFMDb.Tools.TmdbImporter/appsettings.json
#    → Tmdb:ApiKey alanına gerçek anahtarını yaz (https://www.themoviedb.org/settings/api)
#    → ConnectionStrings:DefaultConnection'ın ana API ile aynı olduğundan emin ol

# 2. Import'u çalıştır (varsayılan hedef sayılar appsettings'teki Tmdb ayarlarından okunur)
dotnet run --project src/UFMDb.Tools.TmdbImporter
```

Terminalde ilerleme şu şekilde akar:
```
[20/1000] işlendi — 20 yeni, 0 güncellendi, 0 başarısız. Son: Inception (2010)
[40/1000] işlendi — 40 yeni, 0 güncellendi, 0 başarısız. Son: The Dark Knight (2008)
...
```

### Nasıl çalışır (idempotent upsert)
- Her film/oyuncu/tür, TMDB'deki ID'siyle eşleştirilir (`TmdbId` kolonu) — bizim kendi `Guid` Id'lerimiz asla değişmez.
- Aracı **istediğin zaman tekrar çalıştırabilirsin**: yeni film ekler, var olanları günceller, hiçbir review/rating/watchlist verisine dokunmaz (onlar bizim Guid Id'lerimize bağlı).
- TMDB'nin 0-10'luk puan skalası, bizim 0-5'lik (yarım yıldız destekli) skalamıza **ikiye bölünerek** çevrilip `SeedRating`/`SeedVoteCount` olarak saklanır — bu, sitede birikmiş gerçek kullanıcı puanlarının üzerine eklenen sabit bir çapadır, asla ezilmez.
- Oyuncu biyografi/uyruk/doğum tarihi alanları TMDB'nin credits endpoint'inde gelmediği için boş bırakılır (binlerce ek API çağrısı gerektireceğinden performans amaçlı atlandı) — admin panelden istediğin oyuncuyu sonradan düzenleyebilirsin.

### İleride yeni kolon eklersen
Örneğin `Movie.Budget` gibi yeni bir alan eklemek istersen: migration'ı oluştur, `TmdbMovieDetail` modeline `Budget` alanını ekle, upsert bloğuna `movie.Budget = detail.Budget;` satırını ekle, ve aracı tekrar çalıştır — **var olan filmler de bu yeni alanla güncellenir**, hiçbir veri kaybı olmaz.

### Küratör listelerini gerçek verilerle kurma
İçe aktarılan TMDB filmlerinden **10 tür bazlı liste** oluşturmak (ve varsa eski küratör listelerini sıfırlamak) için:

```bash
dotnet run --project src/UFMDb.Tools.TmdbImporter -- rebuild-curated-lists
```

Bu komut önce tüm mevcut küratör listelerini (ve öğelerini) siler, sonra şu 10 listeyi türe/puana göre otomatik oluşturur: Tüm Zamanların En İyileri, Zihin Bükücü Bilim Kurgu, Ödüllük Dramalar, Nefes Kesen Gerilimler, Suç Klasikleri, Keyifli Komediler, Korku İkonları, Animasyon Başyapıtları, Epik Maceralar, Zamansız Romantikler. İstediğin zaman tekrar çalıştırıp yeni içe aktarılan filmlerle güncelleyebilirsin (idempotent — her çalıştırmada listeler sıfırdan, o anki en güncel verilerle kurulur).

## 🧪 Sonraki Adımlar (Prod Öncesi Kontrol Listesi)

- [ ] JWT secret'ı ve connection string'i ortam değişkenlerine / user-secrets'a taşıyın (appsettings.json'ı sunucuya elle koymak yerine)
- [x] Refresh token rotation + revoke endpoint'i ekleyin
- [x] Rate limiting (login/register için IP bazlı, `Microsoft.AspNetCore.RateLimiting`) ekleyin — bkz. `UFMDb.API/RateLimiting`
- [x] Backend'e test projesi ekleyin (`backend/tests/UFMDb.Tests`, xUnit)
- [x] Admin kullanıcı yönetimi için `Users` feature'ına liste/rol-değiştir endpoint'leri ekleyin — bkz. `UsersController`
- [ ] Email doğrulama (register sonrası hesabın gerçekten o email'e ait olduğunu doğrulama)
- [ ] CI/CD pipeline'ında `dotnet ef database update` (veya başlangıçtaki otomatik migration) adımını doğrulayın
- [ ] Görsel varlıklar (poster/backdrop) için gerçek bir CDN/object storage entegre edin (yükleme klasörü şu an sunucu diskinde tutuluyor, bkz. `UploadsController`)
- [ ] Yapılandırılmış loglama/izleme ekleyin (şu an sadece konsol logging)
