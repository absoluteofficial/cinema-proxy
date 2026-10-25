const axios = require('axios');

module.exports = async (req, res) => {
    // Allow your app to talk to this server
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    
    if (req.method === 'OPTIONS') return res.status(200).end();

    const videoUrl = req.query.url;
    if (!videoUrl) return res.status(400).send('URL required');

    const fakeReferer = 'https://morencius.com/'; 

    // 1. If it's an embed link, try to extract the direct .m3u8 or .mp4
    if (!videoUrl.match(/\.(mp4|m3u8)/i)) {
        try {
            const response = await axios.get(videoUrl, {
                headers: { 
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                    'Referer': fakeReferer
                }
            });
            const html = response.data;
            
            const m3u8Match = html.match(/(https?:\/\/[^"']+\.m3u8[^"']*)/i);
            const mp4Match = html.match(/(https?:\/\/[^"']+\.mp4[^"']*)/i);
            
            // If we found a direct link, redirect the video player to use that instead!
            if (m3u8Match) return res.redirect(m3u8Match[0]);
            if (mp4Match) return res.redirect(mp4Match[0]);
            
            return res.status(404).send('No direct video found in this page.');
        } catch (error) {
            return res.status(500).send('Failed to extract video.');
        }
    }

    // 2. If it IS a direct link, proxy the video stream and spoof the Referer
    try {
        const response = await axios({
            method: 'get',
            url: videoUrl,
            responseType: 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Referer': fakeReferer
            }
        });

        // If it's an m3u8 (HLS), we must rewrite the internal segment links
        if (videoUrl.includes('.m3u8')) {
            let playlist = '';
            response.data.on('data', chunk => playlist += chunk);
            response.data.on('end', () => {
                const baseUrl = videoUrl.substring(0, videoUrl.lastIndexOf('/') + 1);
                const proxyBase = `https://${req.headers.host}`; // Your Vercel URL
                
                const proxiedPlaylist = playlist.split('\n').map(line => {
                    if (line.startsWith('#') || !line) return line;
                    const absoluteUrl = line.startsWith('http') ? line : baseUrl + line;
                    return `${proxyBase}?url=${encodeURIComponent(absoluteUrl)}`;
                }).join('\n');
                
                res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
                res.send(proxiedPlaylist);
            });
        } else {
            // MP4 Stream
            res.setHeader('Content-Type', 'video/mp4');
            response.data.pipe(res);
        }
    } catch (error) {
        res.status(500).send(`Proxy Error: ${error.message}`);
    }
};
