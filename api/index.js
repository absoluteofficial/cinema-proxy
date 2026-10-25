const axios = require('axios');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    let videoUrl = req.query.url;
    if (!videoUrl) return res.status(400).send('URL required');
    videoUrl = decodeURIComponent(videoUrl);

    // The fake referer to trick morencius.com
    const fakeReferer = 'https://morencius.com/'; 

    try {
        const response = await axios({
            method: 'get',
            url: videoUrl,
            responseType: 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': fakeReferer,
                'Origin': 'https://morencius.com'
            }
        });

        // If it's an M3U8 (HLS), rewrite the playlist chunks to go through our proxy
        if (videoUrl.includes('.m3u8')) {
            let playlist = '';
            response.data.on('data', chunk => playlist += chunk);
            response.data.on('end', () => {
                const baseUrl = videoUrl.substring(0, videoUrl.lastIndexOf('/') + 1);
                const proxyBase = `https://${req.headers.host}/api?url=`; 
                
                const proxiedPlaylist = playlist.split('\n').map(line => {
                    if (line.startsWith('#') || !line) return line;
                    const absoluteUrl = line.startsWith('http') ? line : baseUrl + line;
                    return `${proxyBase}${encodeURIComponent(absoluteUrl)}`;
                }).join('\n');
                
                res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
                res.send(proxiedPlaylist);
            });
        } else {
            // Standard MP4
            res.setHeader('Content-Type', 'video/mp4');
            response.data.pipe(res);
        }
    } catch (error) {
        console.error('Proxy Error:', error.message);
        res.status(500).send(`Proxy Error: ${error.message}`);
    }
};
