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
                results.push({
                    id: linkMatch[1],
                    title: titleMatch[1].replace(" izle", "").trim(),
                    url: linkMatch[1],
                    poster: imgMatch ? imgMatch[1] : null,
                    year: yearMatch ? parseInt(yearMatch[1], 10) : null,
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
        if (!response.ok) return [{ title: "Wfilmizle - Alternatif", url: url }];
        const html = await response.text();
        
        const iframeMatch = html.match(/<div class="video-container[^>]*>[\s\S]*?<iframe[^>]+(?:data-src|src)="([^"]+)"/i);
        if (!iframeMatch) return [{ title: "Wfilmizle - Sayfa", url: url }];
        
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
                    return [{
                        title: "Wfilmizle - Doğrudan Akış (1080p)",
                        url: streamUrl,
                        type: streamUrl.includes(".m3u8") ? "hls" : "mp4"
                    }];
                }
            }
        } catch (subErr) {}
        
        return [{
            title: "Wfilmizle - Web Oynatıcı",
            url: iframeUrl
        }];
    } catch (err) {
        return [{ title: "Wfilmizle - Güvenli Bağlantı", url: url }];
    }
}

// UYGULAMANIN FONKSİYONLARI GÖREBİLMESİ İÇİN ŞART OLAN DIŞA AKTARMA (EXPORT)
module.exports = {
    search,
    getStream
};
