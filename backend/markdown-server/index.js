const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const mathjax = require('mathjax-node');

const app = express();
const HTTP_PORT = 8001;
const HTTPS_PORT = 8443;

const SSL_CERT_PATH = '/www/server/panel/vhost/cert/backend';

mathjax.config({
    MathJax: {
        tex2jax: { 
            inlineMath: [['$', '$'], ['\\(', '\\)']] 
        },
        SVG: {
            font: 'TeX'
        }
    }
});

mathjax.start();

function processColorInSvg(svg, color) {
    if (!color) return svg;
    return svg
        .replace(/stroke="currentColor"/g, `stroke="#${color}"`)
        .replace(/fill="currentColor"/g, `fill="#${color}"`);
}

app.get('/', async (req, res) => {
    const tex = req.query.tex;
    const yuml = req.query.yuml;
    
    if (tex) {
        try {
            let processedTex = tex;
            let color = null;
            
            const colorMatch = tex.match(/^\\color\{#([0-9A-Fa-f]{6})\}\s*\{/);
            if (colorMatch) {
                color = colorMatch[1];
                let depth = 0;
                let contentStart = colorMatch[0].length - 1;
                let contentEnd = contentStart;
                
                for (let i = contentStart; i < tex.length; i++) {
                    if (tex[i] === '{') depth++;
                    else if (tex[i] === '}') depth--;
                    
                    if (depth === 0) {
                        contentEnd = i;
                        break;
                    }
                }
                
                processedTex = tex.substring(contentStart + 1, contentEnd).trim();
            }
            
            processedTex = processedTex.replace(/\\bold\{/g, '\\mathbf{');
            
            const result = await mathjax.typeset({
                math: processedTex,
                format: 'TeX',
                svg: true,
                ex: 6,
                width: 100
            });
            
            let svg = result.svg;
            
            if (color) {
                svg = processColorInSvg(svg, color);
            }
            
            res.setHeader('Content-Type', 'image/svg+xml');
            res.send(svg);
        } catch (error) {
            console.error('LaTeX render error:', error);
            res.status(500).send('LaTeX render error');
        }
    } else if (yuml) {
        res.setHeader('Content-Type', 'image/svg+xml');
        res.send(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><text x="10" y="50" font-size="14">yuml: ${yuml.substring(0, 20)}...</text></svg>`);
    } else {
        res.send('Hello');
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

http.createServer(app).listen(HTTP_PORT, '0.0.0.0', () => {
    console.log(`HTTP server is running on port ${HTTP_PORT}`);
});

const httpsOptions = {
    key: fs.readFileSync(path.join(SSL_CERT_PATH, 'privkey.pem')),
    cert: fs.readFileSync(path.join(SSL_CERT_PATH, 'fullchain.pem'))
};

https.createServer(httpsOptions, app).listen(HTTPS_PORT, '0.0.0.0', () => {
    console.log(`HTTPS server is running on port ${HTTPS_PORT}`);
    console.log(`Test: https://yizhancs.cn:${HTTPS_PORT}/?tex=hello`);
});
