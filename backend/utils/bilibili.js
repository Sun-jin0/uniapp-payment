const axios = require('axios');

class BilibiliAPI {
    constructor() {
        this.config = {
            aid: null,
            bvid: null,
            cid: null,
            epid: null,
            page: 1,
            quality: 80, // High quality
            type: 'video',
            format: 'mp4' // Prefer mp4 for uniapp video component
        };

        this.headers = {
            'Referer': 'https://www.bilibili.com/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        };
    }

    setConfig(config) {
        this.config = { ...this.config, ...config };
    }

    async resolveUrl(url) {
        if (!url) return null;
        
        // Handle short link b23.tv
        if (url.includes('b23.tv')) {
            const shortCode = url.split('/').pop().split('?')[0];
            const resolved = await this.resolveShortLink(shortCode);
            if (resolved) url = resolved;
        }

        const bvidMatch = url.match(/BV[a-zA-Z0-9]+/);
        const aidMatch = url.match(/av(\d+)/i);
        
        if (bvidMatch) return { bvid: bvidMatch[0] };
        if (aidMatch) return { aid: aidMatch[1] };
        
        return null;
    }

    async resolveShortLink(code) {
        try {
            const response = await axios.get(`https://b23.tv/${code}`, {
                headers: this.headers,
                maxRedirects: 0,
                validateStatus: status => status >= 200 && status < 400
            });
            return response.headers.location || response.request?.res?.responseUrl;
        } catch (error) {
            console.error('Resolve short link error:', error.message);
            return null;
        }
    }

    async getVideoInfo(aid, bvid) {
        try {
            const params = {};
            if (aid) params.aid = aid;
            if (bvid) params.bvid = bvid;

            const response = await axios.get('https://api.bilibili.com/x/web-interface/view', {
                params: params,
                headers: this.headers
            });

            if (response.data.code === 0) {
                const data = response.data.data;
                return {
                    code: 0,
                    data: {
                        title: data.title,
                        pic: data.pic,
                        desc: data.desc,
                        cid: data.cid,
                        bvid: data.bvid,
                        aid: data.aid
                    }
                };
            }
            return { code: 1, message: response.data.message || '获取视频信息失败' };
        } catch (error) {
            return { code: 1, message: error.message };
        }
    }

    async getVideoUrl(aid, bvid, cid) {
        try {
            const params = {
                avid: aid || '',
                bvid: bvid || '',
                cid: cid,
                qn: 80, // 1080P
                type: 'mp4',
                platform: 'html5',
                high_quality: 1
            };

            const response = await axios.get('https://api.bilibili.com/x/player/playurl', {
                params: params,
                headers: this.headers
            });

            if (response.data.code === 0 && response.data.data.durl) {
                return {
                    code: 0,
                    url: response.data.data.durl[0].url
                };
            }
            return { code: 1, message: '解析播放地址失败' };
        } catch (error) {
            return { code: 1, message: error.message };
        }
    }
}

module.exports = new BilibiliAPI();
