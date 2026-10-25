const axios = require('axios');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    let targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send('URL required');
    targetUrl = decodeURIComponent(targetUrl);

    try {
        const response = await axios.get(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://morencius.com/',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
            }
        });

        let html = response.data;

        // 1. Strip Known Ad Scripts (In-line and External)
        const adKeywords = [
            'popads', 'propellerads', 'adsterra', 'monetag', 'onclickads', 
            'atOptions', 'window.open', 'clickadu', 'hilltopads', 'juicyads',
            'exoclick', 'trafficjunky', 'banner', 'popunder'
        ];
        
        // Remove external scripts with these keywords in the URL
        adKeywords.forEach(keyword => {
            const regex = new RegExp(`<script[^>]*src=["'][^"']*${keyword}[^"']*["'][^>]*>.*?</script>`, 'gi');
            html = html.replace(regex, '');
        });

        // Remove inline scripts containing these keywords
        html = html.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, function(match, content) {
            if (adKeywords.some(kw => content.toLowerCase().includes(kw))) {
                return ''; // Strip the script
            }
            return match;
        });

        // 2. Rewrite Relative URLs to Absolute (So CSS/JS/Images load correctly)
        const urlObj = new URL(targetUrl);
        const baseUrl = urlObj.origin;
        
        // Rewrite href and src attributes
        html = html.replace(/(href|src)=["'](?!https?:\/\/|\/\/)([^"']+)["']/g, (match, attr, link) => {
            return `${attr}="${baseUrl}/${link.replace(/^\//, '')}"`;
        });

        // 3. Send the cleaned HTML
        res.setHeader('Content-Type', 'text/html');
        res.send(html);

    } catch (error) {
        console.error('Proxy Error:', error.message);
        res.status(500).send(`Backend Proxy Error: ${error.message}`);
    }
};
