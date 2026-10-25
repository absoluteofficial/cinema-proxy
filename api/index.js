const axios = require('axios');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    let targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).json({ status: 'error', message: 'URL required' });
    targetUrl = decodeURIComponent(targetUrl);

    try {
        // Fetch the embed page HTML
        const response = await axios.get(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://morencius.com/',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
            }
        });

        let html = response.data;

        // Regex to find .m3u8 links (catches JWPlayer sources, eval scripts, etc.)
        const m3u8Regex = /(https?:\/\/[^"']+?\.m3u8[^"']*)/gi;
        const mp4Regex = /(https?:\/\/[^"']+?\.mp4[^"']*)/gi;
        
        let match = html.match(m3u8Regex) || html.match(mp4Regex);

        if (match && match.length > 0) {
            // Clean up the URL (remove surrounding quotes if any)
            let directUrl = match[0].replace(/["']/g, '');
            
            // If the URL is relative, make it absolute
            if (directUrl.startsWith('/')) {
                const urlObj = new URL(targetUrl);
                directUrl = urlObj.origin + directUrl;
            }
            
            return res.status(200).json({ status: 'ok', url: directUrl });
        }

        // If no direct link found, return error
        return res.status(404).json({ status: 'error', message: 'No direct video found' });

    } catch (error) {
        return res.status(500).json({ status: 'error', message: error.message });
    }
};
