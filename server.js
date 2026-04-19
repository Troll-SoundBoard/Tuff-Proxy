const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const compression = require('compression');
const NodeCache = require('node-cache');
const path = require('path');
const https = require('https');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3000;

const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

app.use(compression({ level: 6, threshold: 1024 }));
app.use(express.json({ limit: '1mb' }));
app.use(express.static('public', { maxAge: '1d', etag: true, lastModified: true }));

const httpAgent = new http.Agent({
    keepAlive: true, keepAliveMsecs: 30000, maxSockets: 100, maxFreeSockets: 10
});

const httpsAgent = new https.Agent({
    keepAlive: true, keepAliveMsecs: 30000, maxSockets: 100, maxFreeSockets: 10,
    rejectUnauthorized: false
});

const BLOCKED_HEADERS = [
    'x-frame-options',
    'content-security-policy',
    'content-security-policy-report-only',
    'x-content-type-options',
    'cross-origin-opener-policy',
    'cross-origin-embedder-policy',
    'cross-origin-resource-policy'
];

// Ultra-fast direct proxy
app.use('/p/*', (req, res, next) => {
    const targetUrl = req.path.substring(3);

    if (!targetUrl) return res.status(400).send('Invalid URL');

    const cached = cache.get(targetUrl);
    if (cached) {
        res.set(cached.headers);
        return res.send(cached.body);
    }

    const isHttps = targetUrl.startsWith('https');
    const agent = isHttps ? httpsAgent : httpAgent;
    const protocol = isHttps ? https : http;

    const options = {
        agent,
        headers: {
            'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': req.headers['accept'] || '*/*',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive'
        },
        timeout: 5000
    };

    const proxyReq = protocol.get(targetUrl, options, (proxyRes) => {
        const chunks = [];

        Object.keys(proxyRes.headers).forEach(key => {
            if (!['content-encoding', 'transfer-encoding', ...BLOCKED_HEADERS].includes(key.toLowerCase())) {
                res.set(key, proxyRes.headers[key]);
            }
        });

        res.status(proxyRes.statusCode);

        proxyRes.on('data', (chunk) => {
            chunks.push(chunk);
            res.write(chunk);
        });

        proxyRes.on('end', () => {
            const body = Buffer.concat(chunks);
            if (proxyRes.statusCode === 200) {
                cache.set(targetUrl, { headers: proxyRes.headers, body });
            }
            res.end();
        });
    });

    proxyReq.on('error', (err) => {
        console.error('Proxy error:', err.message);
        res.status(500).send('Proxy Error');
    });

    proxyReq.on('timeout', () => {
        proxyReq.destroy();
        res.status(504).send('Gateway Timeout');
    });
});

// HTML rewriting proxy
app.get('/proxy', async (req, res) => {
    const targetUrl = req.query.url;

    if (!targetUrl) return res.status(400).send('URL required');

    try {
        const url = new URL(targetUrl.startsWith('http') ? targetUrl : 'https://' + targetUrl);

        const cached = cache.get(targetUrl);
        if (cached) return res.send(cached);

        const isHttps = url.protocol === 'https:';
        const agent = isHttps ? httpsAgent : httpAgent;
        const protocol = isHttps ? https : http;

        const options = {
            hostname: url.hostname,
            port: url.port || (isHttps ? 443 : 80),
            path: url.pathname + url.search,
            method: 'GET',
            agent,
            headers: {
                'Host': url.hostname,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            },
            timeout: 5000
        };

        const proxyReq = protocol.request(options, (proxyRes) => {
            // Strip frame-blocking headers
            Object.keys(proxyRes.headers).forEach(key => {
                if (!BLOCKED_HEADERS.includes(key.toLowerCase())) {
                    res.set(key, proxyRes.headers[key]);
                }
            });

            let body = '';
            proxyRes.setEncoding('utf8');
            proxyRes.on('data', (chunk) => { body += chunk; });

            proxyRes.on('end', () => {
                const contentType = proxyRes.headers['content-type'] || '';

                if (contentType.includes('text/html')) {
                    const baseUrl = url.origin;

                    body = body.replace(/<head>/i, `<head><base href="${baseUrl}/">`);

                    body = body.replace(/href=["']https?:\/\/[^"']+["']/gi, (match) => {
                        const hrefUrl = match.match(/href=["']([^"']+)["']/)[1];
                        return `href="/proxy?url=${encodeURIComponent(hrefUrl)}"`;
                    });

                    body = body.replace(/src=["']https?:\/\/[^"']+["']/gi, (match) => {
                        const srcUrl = match.match(/src=["']([^"']+)["']/)[1];
                        return `src="/p/${srcUrl}"`;
                    });

                    cache.set(targetUrl, body);
                }

                res.send(body);
            });
        });

        proxyReq.on('error', (err) => {
            console.error('Error:', err.message);
            res.status(500).send('Error fetching URL');
        });

        proxyReq.on('timeout', () => {
            proxyReq.destroy();
            res.status(504).send('Request timeout');
        });

        proxyReq.end();

    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).send('Invalid URL');
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const server = app.listen(PORT, () => {
    console.log(`🚀 Tuff Proxy running on port ${PORT}`);
    console.log(`📍 Local: http://localhost:${PORT}`);
});

server.setMaxListeners(0);
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;
