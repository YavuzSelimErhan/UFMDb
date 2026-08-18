# 🎬 UFMDb — Ultimate Film Database

Modern, ölçeklenebilir, Clean Architecture tabanlı film veritabanı uygulaması.

## 🏗️ Mimari

```
backend/
  src/
    UFMDb.Domain          → Entity'ler, enum'lar, ortak taban sınıflar (bağımlılık yok)
    UFMDb.Application     → CQRS (MediatR), DTO'lar, validasyon, arayüzler (Domain'e bağımlı)
    UFMDb.Infrastructure  → JWT, şifreleme, harici servisler (Application'a bağımlı)
    UFMDb.Persistence     → EF Core DbContext, konfigürasyonlar, seed (Application'a bağımlı)
    UFMDb.API             → Controller'lar, middleware, Program.cs (tüm katmanları birleştirir)
frontend/
  src/
    components/  pages/  features/  services/  store/  i18n/  types/  styles/
```

Bağımlılık yönü daima içe doğrudur: `API → Infrastructure/Persistence → Application → Domain`.
Application katmanı hiçbir zaman EF Core'a doğrudan bağımlı değildir; `IApplicationDbContext` soyutlaması üzerinden çalışır.

## ⚙️ Backend'i Çalıştırma

### Gereksinimler
- .NET 8 SDK
- SQL Server (LocalDB, Docker, veya Azure SQL)
- (Opsiyonel) `dotnet-ef` global tool: `dotnet tool install --global dotnet-ef`

### Adımlar

```bash
cd backend

# 1. Bağımlılıkları geri yükle
dotnet restore

# 2. Connection string'i güncelle
#    src/UFMDb.API/appsettings.json → ConnectionStrings:DefaultConnection

# 3. JWT secret'ı güncelle (production'da MUTLAKA değiştirin)
#    src/UFMDb.API/appsettings.json → JwtSettings:Secret (en az 32 karakter, rastgele)

# 4. İlk migration'ı oluştur (proje ilk kez klonlandığında bu adım gereklidir)
dotnet ef migrations add InitialCreate \
  --project src/UFMDb.Persistence \
  --startup-project src/UFMDb.API

# 5. API'yi çalıştır (migration + 50 film seed otomatik uygulanır, bkz. Program.cs)
dotnet run --project src/UFMDb.API
```

API varsayılan olarak `https://localhost:7001` üzerinde ayağa kalkar; Swagger UI `/swagger` altında görüntülenebilir.

**Varsayılan admin hesabı:** `admin@ufmdb.com` / `Admin123!` (ilk girişten sonra değiştirilmesi önerilir)

## 💻 Frontend'i Çalıştırma

```bash
cd frontend
npm install
npm run dev
```

`vite.config.ts` içindeki proxy ayarı `/api` isteklerini backend'e yönlendirir; backend portunuz farklıysa güncelleyin.

## 🔑 Öne Çıkan Tasarım Kararları

- **CQRS + MediatR**: Her endpoint tek bir Command/Query'ye karşılık gelir; okuma ve yazma yolları ayrıştırılmıştır.
- **Soft delete + global query filter**: `IsDeleted` alanı olan tüm entity'ler otomatik olarak sorgulardan filtrelenir.
- **Dinamik ortalama puan**: Review eklendiğinde/güncellendiğinde `Movie.AverageRating` anlık olarak yeniden hesaplanır (Letterboxd tarzı 0.5 adımlı puanlama).
- **JWT + Refresh Token**: Access token kısa ömürlü; refresh token tablo bazlı tutulur, ileride token rotation eklenebilir.
- **i18n altyapısı**: Hem backend (Genre.NameTr gibi alanlar) hem frontend (i18next) TR/EN'i destekler.
- **Sosyal özelliklere hazır mimari**: `Review.HelpfulCount`, ayrı `Like`/`WatchlistItem` tabloları gibi alanlar, takip/feed gibi özellikler eklenmek istendiğinde mevcut şemayı bozmadan genişletilebilir şekilde tasarlanmıştır.

## 🎬 Gerçek Film Verisi: TMDB Import Aracı

Proje, [The Movie Database (TMDB)](https://www.themoviedb.org/) API'sinden gerçek film/oyuncu verisi çekebilen ayrı bir console aracı içerir: `UFMDb.Tools.TmdbImporter`.

### Neden ayrı bir proje?
1000+ film çekmek dakikalar sürebilir (TMDB rate limit'ine takılmamak için istekler arasında bilinçli bekleme var) — bunu bir HTTP endpoint'i üzerinden yapmak timeout riski taşır. Bu yüzden bağımsız, terminalden çalıştırılan, ilerlemesini canlı gösteren bir console uygulaması olarak tasarlandı.

### Kurulum ve çalıştırma

```bash
cd backend

# 1. Yeni migration'ı oluştur (TmdbId kolonları eklendi, şema değişikliği var)
dotnet ef migrations add AddTmdbIdColumns --project src/UFMDb.Persistence --startup-project src/UFMDb.API

# 2. API anahtarını gir
#    src/UFMDb.Tools.TmdbImporter/appsettings.json → Tmdb:ApiKey alanına gerçek anahtarını yaz
#    (connection string'in ana API ile aynı olduğundan emin ol)

# 3. Import'u çalıştır (varsayılan: 1000 film, min. 100 oy)
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
- Aracı **istediğin zaman tekrar çalıştırabilirsin**: yeni film ekler, var olanları günceller, hiçbir review/like/watchlist verisine dokunmaz (onlar bizim Guid Id'lerimize bağlı).
- TMDB'nin 0-10'luk puan skalası, bizim 0-5'lik (yarım yıldız destekli) skalamıza **ikiye bölünerek** çevrilir. Bu değer başlangıç baseline'ıdır; gerçek kullanıcı review'ları geldikçe normal ortalama hesaplama mantığıyla güncellenmeye devam eder.
- Oyuncu biyografi/uyruk/doğum tarihi alanları TMDB'nin credits endpoint'inde gelmediği için boş bırakılır (binlerce ek API çağrısı gerektireceğinden performans amaçlı atlandı) — admin panelden istediğin oyuncuyu sonradan düzenleyebilirsin.

### İleride yeni kolon eklersen
Örneğin `Movie.Budget` gibi yeni bir alan eklemek istersen: migration'ı oluştur, `TmdbMovieDetail` modeline `Budget` alanını ekle, upsert bloğuna `movie.Budget = detail.Budget;` satırını ekle, ve aracı tekrar çalıştır — **var olan 1000 film de bu yeni alanla güncellenir**, hiçbir veri kaybı olmaz.

### Demo/seed verisini temizleme
TMDB import'unu çalıştırdıktan sonra, `DbInitializer` tarafından oluşturulan 50 sahte demo filmini (ve artık hiçbir gerçek filmde oynamayan demo aktörlerini) temizlemek için:

```bash
dotnet run --project src/UFMDb.Tools.TmdbImporter -- cleanup-demo
```

Bu, `TmdbId` değeri `NULL` olan (yani gerçek TMDB verisiyle eşleşmemiş) tüm filmleri ve yetim kalan aktörleri güvenli bir sırayla (ilişkili tabloları önce temizleyerek) siler. Gerçek TMDB verisine hiç dokunmaz.

**Not:** Demo veri, gerçek oyuncu isimleri (Leonardo DiCaprio, Tom Hanks vb.) kullandığı için TMDB import'u bu kişileri ayrıca (gerçek `TmdbId` ile) oluşturmuş olabilir — yani geçici olarak aynı isim iki kez görünmüş olabilir. `cleanup-demo` komutu, filmi olmayan (yetim) demo kopyalarını temizleyerek bunu da çözer.

### Küratör listelerini gerçek verilerle yeniden kurma
Demo veriyle oluşturulmuş eski küratör listelerini temizleyip, gerçek TMDB filmlerinden **10 tür bazlı liste** oluşturmak için:

```bash
dotnet run --project src/UFMDb.Tools.TmdbImporter -- rebuild-curated-lists
```

Bu komut önce tüm mevcut küratör listelerini (ve öğelerini) siler, sonra şu 10 listeyi türe/puana göre otomatik oluşturur: Tüm Zamanların En İyileri, Zihin Bükücü Bilim Kurgu, Ödüllük Dramalar, Nefes Kesen Gerilimler, Suç Klasikleri, Keyifli Komediler, Korku İkonları, Animasyon Başyapıtları, Epik Maceralar, Zamansız Romantikler. İstediğin zaman tekrar çalıştırıp yeni içe aktarılan filmlerle güncelleyebilirsin (idempotent — her çalıştırmada listeler sıfırdan, o anki en güncel verilerle kurulur).

## 🧪 Sonraki Adımlar (Prod Öncesi Kontrol Listesi)

- [ ] JWT secret'ı ve connection string'i ortam değişkenlerine / user-secrets'a taşıyın
- [ ] Refresh token rotation + revoke endpoint'i ekleyin
- [ ] Rate limiting (örn. `AspNetCoreRateLimit`) ekleyin
- [ ] Admin kullanıcı yönetimi için `Users` feature'ına liste/rol-değiştir endpoint'leri ekleyin
- [ ] CI/CD pipeline'ında `dotnet ef database update` adımını otomatikleştirin
- [ ] Görsel varlıklar (poster/backdrop) için gerçek bir CDN/object storage entegre edin (seed'de placeholder `picsum.photos` kullanılıyor)
