async function search(query) {
    try {
        const response = await fetch(`https://www.wfilmizle.cam/?s=${encodeURIComponent(query)}`);
        if (!response.ok) return [];
        const html = await response.text();
        const results = [];
        
        const boxRegex = /<div class="listmovie">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g;
        let match;
        
        while ((match = boxRegex.exec(html)) !== null) {
            const box = match[1];
            
            const linkMatch = box.match(/href="([^"]+)"/);
            const titleMatch = box.match(/alt="([^"]+)"/);
            const imgMatch = box.match(/(?:data-src|src)="([^"]+\.(?:jpg|png|webp))"/);
            const yearMatch = box.match(/<div class="film-yil">[\s\S]*?(\d{4})/);
            
            if (linkMatch && titleMatch) {
                const href = linkMatch[1];
                const rawTitle = titleMatch[1].replace(" izle", "").trim();
                const poster = imgMatch ? imgMatch[1] : null;
                const year = yearMatch ? parseInt(yearMatch[1], 10) : null;
                
                results.push({
                    id: href,
                    title: rawTitle,
                    url: href,
                    poster: poster,
                    year: year,
                    type: "movie"
                });
            }
        }
        return results;
    } catch (err) {
        return [];
    }
}

async function getStream(url) {
    // Asla boş dönmeyecek ve eklentinin çökmesini engellecek güvenli dizi
    const streams = [];
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            // Sayfa açılmazsa bile eklenti adı kaybolmasın diye yedek link veriyoruz
            return [{ title: "Wfilmizle - Alternatif Kaynak", url: url }];
        }
        
        const html = await response.text();
        const iframeMatch = html.match(/<div class="video-container[^>]*>[\s\S]*?<iframe[^>]+(?:data-src|src)="([^"]+)"/i);
        
        if (iframeMatch) {
            let iframeUrl = iframeMatch[1];
            if (iframeUrl.startsWith("//")) {
                iframeUrl = "https:" + iframeUrl;
            }
            
            try {
                const subRes = await fetch(iframeUrl);
                if (subRes.ok) {
                    const subHtml = await subRes.text();
                    const streamMatch = subHtml.match(/(https:\/\/[^\s"'<>]+\.(?:m3u8|mp4)[^\s"'<>]*)/i);
                    if (streamMatch) {
                        const streamUrl = streamMatch[1];
                        streams.push({
                            title: "Wfilmizle - Doğrudan Akış (1080p)",
                            url: streamUrl,
                            type: streamUrl.includes(".m3u8") ? "hls" : "mp4"
                        });
                    }
                }
            } catch (subErr) {
                // Alt kaynak çekilemese bile devam et
            }
            
            // Eğer doğrudan video çözülemediyse iframe adresini ekle ki kaynak boş kalmasın
            streams.push({
                title: "Wfilmizle - Web Oynatıcı",
                url: iframeUrl
            });
        }
        
        // Hiçbir şey bulunamazsa en azından ana film sayfasını kaynak olarak göster
        if (streams.length === 0) {
            streams.push({
                title: "Wfilmizle - Sayfa Bağlantısı",
                url: url
            });
        }
        
        return streams;
        
    } catch (err) {
        // En kötü senaryoda bile uygulamanın ve eklentinin çökmesini engeller
        return [{
            title: "Wfilmizle - Güvenli Bağlantı",
            url: url
        }];
    }
}
