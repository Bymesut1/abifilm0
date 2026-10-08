const BASE_URL = "https://www.wfilmizle.cam";
const TMDB_API_KEY = "000316508321ce461cf81e7c6815eec7";

// --- VİDEO ÇÖZÜCÜ (EXTRACTOR) MOTORU ---
const VideoExtractor = {
    async getRawStream(iframeUrl) {
        try {
            // Güvenlik engeline takılmamak için iframe kaynağına istek atıyoruz
            const response = await fetch(iframeUrl);
            const html = await response.text();

            // 1. Yöntem: Genel .m3u8 veya .mp4 yakalayıcı (Çoğu player kaynağı sayfaya gömer)
            const streamRegex = /(https:\/\/[^\s"'<>]+\.(?:m3u8|mp4)[^\s"'<>]*)/ig;
            const matches = html.match(streamRegex);

            if (matches && matches.length > 0) {
                // İçinde 'blank', 'ad' (reklam) veya 'gif' geçen gereksiz linkleri filtrele
                const validStreams = matches.filter(url => !url.includes("blank") && !url.includes("ad") && !url.includes("gif"));
                
                if (validStreams.length > 0) {
                    // İlk geçerli akışı döndür
                    return validStreams[0]; 
                }
            }

            // 2. Yöntem: Sık kullanılan sunucular (Örn: Vidmoly) için özel yakalayıcı
            if (iframeUrl.includes("vidmoly")) {
                const vidmolyRegex = /file:"(.*?\.m3u8.*?)"/i;
                const match = html.match(vidmolyRegex);
                if (match && match[1]) return match[1];
            }

            return null;
        } catch (error) {
            console.error(`Iframe çözülemedi: ${iframeUrl}`, error);
            return null;
        }
    }
};

const WfilmizleProvider = {
    
    // TMDB'den yüksek kaliteli film detaylarını çeken yardımcı fonksiyon
    async getTmdbData(title, year) {
        try {
            let tmdbUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}&language=tr-TR`;
            if (year) tmdbUrl += `&primary_release_year=${year}`;
            
            const response = await fetch(tmdbUrl);
            const data = await response.json();
            
            if (data.results && data.results.length > 0) {
                const movie = data.results[0];
                return {
                    tmdbId: movie.id,
                    poster: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
                    backdrop: movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : null,
                    overview: movie.overview,
                    rating: movie.vote_average
                };
            }
            return null;
        } catch (error) {
            return null;
        }
    },

    // 1. Arama Sonuçlarını Çekme
    async search(query) {
        try {
            const response = await fetch(`${BASE_URL}/?s=${encodeURIComponent(query)}`);
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");
            
            const results = [];
            const movieBoxes = doc.querySelectorAll("div.movie-box");
            
            for (const box of movieBoxes) {
                const titleElem = box.querySelector("div.film-ismi a");
                if (!titleElem) continue;
                
                const rawTitle = titleElem.textContent.replace(" izle", "").trim();
                const url = titleElem.getAttribute("href");
                
                const imgElem = box.querySelector("div.poster img");
                let sitePoster = imgElem ? (imgElem.getAttribute("data-src") || imgElem.getAttribute("src")) : null;
                
                const yearElem = box.querySelector("div.film-yil");
                const year = yearElem ? parseInt(yearElem.textContent.replace(/[^0-9]/g, ""), 10) : null;
                
                const tmdbData = await this.getTmdbData(rawTitle, year);
                
                results.push({ 
                    title: rawTitle, 
                    url: url, 
                    year: year,
                    poster: (tmdbData && tmdbData.poster) ? tmdbData.poster : sitePoster,
                    backdrop: tmdbData ? tmdbData.backdrop : null,
                    description: tmdbData ? tmdbData.overview : "",
                    tmdbRating: tmdbData ? tmdbData.rating : null
                });
            }
            return results;
        } catch (error) {
            console.error("Arama hatası:", error);
            return [];
        }
    },

    // 2. Film Sayfasından Oynatıcıyı ve Ham Akışı (Stream) Yakalama
    async getStream(movieUrl) {
        try {
            const response = await fetch(movieUrl);
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, "text/html");
            
            const streams = [];
            
            // Site içindeki iframe'i bul
            const iframe = doc.querySelector("div.video-container iframe");
            
            if (iframe) {
                let iframeSrc = iframe.getAttribute("data-src") || iframe.getAttribute("src");
                
                // Eğer iframe adresi 'http' veya '//' ile başlıyorsa düzelt
                if (iframeSrc.startsWith("//")) {
                    iframeSrc = "https:" + iframeSrc;
                }

                // Extractor motoruna iframe'i gönderip ham linki çıkartıyoruz
                const rawStreamUrl = await VideoExtractor.getRawStream(iframeSrc);
                
                if (rawStreamUrl) {
                    streams.push({
                        title: "1080p / 720p (Akış Çözüldü)",
                        url: rawStreamUrl,
                        type: rawStreamUrl.includes(".m3u8") ? "hls" : "mp4" // Oynatıcının dosya türünü anlaması için
                    });
                } else {
                    // Çözülemezse iframe'i web kaynağı olarak gönder
                    streams.push({
                        title: "Web Oynatıcı (Çözülemedi)",
                        url: iframeSrc
                    });
                }
            }
            
            return streams; // Kaynak 1 olarak döner, oynatıcı doğrudan bu linki çalıştırır.
            
        } catch (error) {
            console.error("Akış yakalama hatası:", error);
            return [];
        }
    }
};

export default WfilmizleProvider;
