const axios = require('axios');

class BilibiliService {
    constructor() {
        this.headers = {
            'Referer': 'https://www.bilibili.com/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        };
    }

    /**
     * Parse Bilibili link (short or long) to extract BV/AV/EP
     * @param {string} text - Link text like "https://b23.tv/7lQyWOb" or "https://www.bilibili.com/video/BV1..."
     */
    async parseLink(text) {
        if (!text) return null;

        // Extract URL from text (in case it's like "【Title】 https://...")
        const urlMatch = text.match(/https?:\/\/[^\s]+/);
        if (!urlMatch) return null;
        let url = urlMatch[0];

        // Handle short link
        if (url.includes('b23.tv')) {
            try {
                // 尝试获取重定向地址
                const response = await axios.head(url, {
                    headers: this.headers,
                    maxRedirects: 0,
                    validateStatus: () => true // 接受所有状态码
                });
                
                // 如果有重定向地址，使用它
                if (response.headers.location) {
                    url = response.headers.location;
                } else if (response.status >= 300 && response.status < 400) {
                    // 3xx 重定向但没有 location header，尝试 GET 请求
                    const getRes = await axios.get(url, {
                        headers: this.headers,
                        maxRedirects: 5,
                        timeout: 10000
                    });
                    url = getRes.request?.res?.responseUrl || url;
                }
            } catch (error) {
                // 如果 head 请求失败，尝试使用 GET 请求跟随重定向
                try {
                    const res = await axios.get(url, {
                        headers: this.headers,
                        maxRedirects: 5,
                        timeout: 10000,
                        validateStatus: () => true
                    });
                    if (res.request?.res?.responseUrl) {
                        url = res.request.res.responseUrl;
                    }
                } catch (e) {
                    console.log('Failed to resolve b23.tv link:', e.message);
                }
            }
        }

        const result = { bv: null, av: null, ep: null, p: 1 };

        // Match BV
        const bvMatch = url.match(/BV([a-zA-Z0-9]+)/);
        if (bvMatch) result.bv = 'BV' + bvMatch[1];

        // Match AV
        const avMatch = url.match(/av([0-9]+)/i);
        if (avMatch) result.av = avMatch[1];

        // Match EP
        const epMatch = url.match(/ep([0-9]+)/i);
        if (epMatch) result.ep = epMatch[1];

        // Match Page
        const pMatch = url.match(/p=([0-9]+)/);
        if (pMatch) result.p = parseInt(pMatch[1]);

        return (result.bv || result.av || result.ep) ? result : null;
    }

    async getVideoUrl(params) {
        const { bv, av, ep, p = 1, quality = 80 } = params;
        
        try {
            let cid = null;
            if (ep) {
                const response = await axios.get('https://api.bilibili.com/pgc/view/web/season', {
                    params: { ep_id: ep },
                    headers: this.headers
                });
                if (response.data.code === 0) {
                    const episode = response.data.data.episodes.find(e => e.id === parseInt(ep)) || response.data.data.episodes[0];
                    cid = episode.cid;
                }
            } else {
                const infoParams = {};
                if (bv) infoParams.bvid = bv;
                else if (av) infoParams.aid = av;

                const response = await axios.get('https://api.bilibili.com/x/web-interface/view', {
                    params: infoParams,
                    headers: this.headers
                });
                if (response.data.code === 0) {
                    const pages = response.data.data.pages;
                    const targetPage = pages.find(page => page.page === p) || pages[0];
                    cid = targetPage.cid;
                }
            }

            if (!cid) throw new Error('Could not get CID');

            const playUrlApi = ep ? 
                'https://api.bilibili.com/pgc/player/web/playurl' : 
                'https://api.bilibili.com/x/player/playurl';

            const playParams = {
                bvid: bv || '',
                avid: av || '',
                cid: cid,
                qn: 80, // 80: 1080P, 64: 720P, 32: 480P
                otype: 'json',
                platform: 'android', // 改用 android 平台有时能获得更稳定的 MP4 链接
                high_quality: 1,
                fnver: 0,
                fnval: 1, // 优先请求 MP4 格式 (durl)
                fourk: 1
            };

            const playRes = await axios.get(playUrlApi, {
                params: playParams,
                headers: {
                    ...this.headers,
                    'User-Agent': 'Bilibili/1.1.2 (bbcallen@gmail.com)' // 使用 B 站客户端 UA
                }
            });

            console.log('Bilibili playUrl API Response:', JSON.stringify(playRes.data));

            const data = playRes.data.data || playRes.data.result || playRes.data;
            
            let videoUrl = '';
            if (data.durl && data.durl.length > 0) {
                // Prioritize the first durl (usually MP4)
                videoUrl = data.durl[0].url;
            } else if (data.dash) {
                // DASH often provides separate video and audio
                // For simplicity in <video> tag, we prefer durl (MP4)
                // If only DASH is available, we take the highest quality video
                if (data.dash.video && data.dash.video.length > 0) {
                    videoUrl = data.dash.video[0].baseUrl || data.dash.video[0].base_url;
                }
            }

            return videoUrl;
        } catch (error) {
            console.error('Bilibili resolve error:', error.message);
            return null;
        }
    }
}

module.exports = new BilibiliService();
