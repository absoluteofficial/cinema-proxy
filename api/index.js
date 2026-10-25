const axios = require('axios');

module.exports = async (req, res) => {
    // Allow your app to talk to this server
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const videoUrl = req.query.url;
    if (!videoUrl) return res.status(400).send('URL required');

    // We spoof the Referer to trick morencius.com
    const fakeReferer = 'https://morencius.com/'; 

    try {
        const response = await axios({
            method: 'get',
            url: videoUrl,
            responseType: 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': fakeReferer,
                'Origin': fakeReferer.replace(/\/$/, '')
            }
        });

        // If it's an M3U8 stream, we must rewrite the segments to also go through our proxy
        if (videoUrl.includes('.m3u8')) {
            let playlist = '';
            response.data.on('data', chunk => playlist += chunk);
            response.data.on('end', () => {
                const baseUrl = videoUrl.substring(0, videoUrl.lastIndexOf('/') + 1);
                const proxyBase = `https://${req.headers.host}/api`;
                
                const proxiedPlaylist = playlist.split('\n').map(line => {
                    if (line.startsWith('#') || !line) return line;
                    const absoluteUrl = line.startsWith('http') ? line : baseUrl + line;
                    return `${proxyBase}?url=${encodeURIComponent(absoluteUrl)}`;
                }).join('\n');
                
                res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
                res.send(proxiedPlaylist);
            });
        } else {
            res.setHeader('Content-Type', response.headers['content-type'] || 'video/mp4');
            response.data.pipe(res);
        }
    } catch (error) {
        res.status(500).send(`Proxy Error: ${error.message}`);
    }
};
