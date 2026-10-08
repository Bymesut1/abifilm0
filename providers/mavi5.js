async function search(query) {
    try {
        const response = await fetch(`https://www.wfilmizle.cam/?s=${encodeURIComponent(query)}`);
        const html = await response.text();
        const results = [];
        
        // Tarayıcı bağımlı DOMParser yerine güvenli Regex ayrıştırıcı
        const boxRegex = /<div class="listmovie">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g;
        let match;
        
        while ((match = boxRegex.exec(html)) !== null) {
            const box = match[1];
            
            const linkMatch = box.match(/href="([^"]+)">/);
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
    try {
        const response = await fetch(url);
        const html = await response.text();
        
        // Sayfadaki video iframe kaynağını bul
        const iframeMatch = html.match(/<div class="video-container[^>]*>[\s\S]*?<iframe[^>]+(?:data-src|src)="([^"]+)"/i);
        if (!iframeMatch) return [];
        
        let iframeUrl = iframeMatch[1];
        if (iframeUrl.startsWith("//")) {
            iframeUrl = "https:" + iframeUrl;
        }
        
        // Oynatıcı sağlayıcısının içine girerek ham video bağlantısını ara
        const subRes = await fetch(iframeUrl);
        const subHtml = await subRes.text();
        
        const streamMatch = subHtml.match(/(https:\/\/[^\s"'<>]+\.(?:m3u8|mp4)[^\s"'<>]*)/i);
        if (streamMatch) {
            const streamUrl = streamMatch[1];
            return [{
                title: "Wfilmizle - Doğrudan Akış",
                url: streamUrl,
                type: streamUrl.includes(".m3u8") ? "hls" : "mp4"
            }];
        }
        
        return [{
            title: "Wfilmizle - Web Kaynağı",
            url: iframeUrl
        }];
    } catch (err) {
        return [];
    }
}
