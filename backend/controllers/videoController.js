
const VideoResource = require('../models/VideoResource');
const VideoSubject = require('../models/VideoSubject');
const VideoRedeem = require('../models/VideoRedeem');
const UserVideo = require('../models/UserVideo');
const VideoCollection = require('../models/VideoCollection');
const pool = require('../config/mysql');
const bilibiliService = require('../services/BilibiliService');
const { encrypt } = require('../utils/videoEncryption');
const https = require('https');
const http = require('http');
const axios = require('axios');

class VideoController {
  // Public: Get Subjects tree
  static async getSubjects(req, res) {
    try {
      const tree = await VideoSubject.getTree();
      res.json({ code: 0, data: tree });
    } catch (e) {
      res.json({ code: 500, message: e.message });
    }
  }

  // Public: Get Video List
  static async getVideos(req, res) {
    try {
      const userId = req.user ? req.user.id : null;
      const query = req.query;
      console.log('getVideos query:', query);
      query.status = 1; 
      query.is_public = 1; 
      
      // Get public videos
      const publicList = await VideoResource.find(query);
      console.log('publicList count:', publicList.length);
      
      // If user is logged in, also get their redeemed videos
      let userVideos = [];
      if (userId) {
        // Get individual redeemed videos
        const [redeemedRows] = await pool.query(`
          SELECT DISTINCT r.*, 1 as has_redeemed_access
          FROM video_resources r
          JOIN user_videos uv ON r.id = uv.resource_id
          WHERE uv.user_id = ? AND uv.has_access = 1 AND r.status = 1
          AND (uv.collection_id IS NULL OR uv.collection_id = 0)
        `, [userId]);
        
        // Get collection videos that user has access to
        const [collectionVideos] = await pool.query(`
          SELECT DISTINCT r.*, vc.id as collection_id, vc.name as collection_name, 1 as has_redeemed_access
          FROM video_resources r
          JOIN collection_videos cv ON r.id = cv.resource_id
          JOIN user_videos uv ON cv.collection_id = uv.collection_id
          JOIN video_collections vc ON vc.id = cv.collection_id
          WHERE uv.user_id = ? AND uv.has_access = 1 AND r.status = 1 AND vc.is_active = 1
        `, [userId]);
        
        userVideos = [...redeemedRows, ...collectionVideos];
      }
      
      // Merge lists, removing duplicates (user videos take precedence)
      const videoMap = new Map();
      
      // Add public videos first
      publicList.forEach(v => {
        videoMap.set(v.id, { ...v, has_redeemed_access: 0 });
      });
      
      // Add/overwrite with user redeemed videos
      userVideos.forEach(v => {
        videoMap.set(v.id, { ...v, has_redeemed_access: 1 });
      });
      
      const list = Array.from(videoMap.values());
      
      // Sort: redeemed videos first, then by sort order
      list.sort((a, b) => {
        if (a.has_redeemed_access !== b.has_redeemed_access) {
          return b.has_redeemed_access - a.has_redeemed_access;
        }
        return (a.sort || 0) - (b.sort || 0);
      });
      
      res.json({ code: 0, data: list });
    } catch (e) {
      res.json({ code: 500, message: e.message });
    }
  }

  // Public/User: Get Detail
  static async getVideoDetail(req, res) {
    try {
      const { vid } = req.params;
      const userId = req.user ? req.user.id : null;
      
      const resource = await VideoResource.findByVid(vid);
      if (!resource) return res.json({ code: 404, message: 'Not found' });

      let hasAccess = !resource.requires_redemption;
      let isFavorite = false;
      let collectionInfo = null;

      if (userId) {
        if (!hasAccess) {
            hasAccess = await UserVideo.hasAccess(userId, resource.id);
        }
        isFavorite = await UserVideo.isFavorite(userId, resource.id);
        
        // Get collection access info if user has access through collection
        if (hasAccess) {
            collectionInfo = await UserVideo.getCollectionAccessInfo(userId, resource.id);
        }
      }

      // If no access, hide URLs
      if (!hasAccess && resource.requires_redemption) {
          if (resource.items) {
              resource.items.forEach(item => {
                  item.url = null;
                  if (item.bili_link) item.bili_link = null;
              });
          }
          if (resource.bili_link) resource.bili_link = null;
      } else {
          // Encrypt URLs for security
          if (resource.items) {
              resource.items.forEach(item => {
                  if (item.url) item.url = encrypt(item.url);
                  if (item.bili_link) item.bili_link = encrypt(item.bili_link);
              });
          }
          if (resource.bili_link) resource.bili_link = encrypt(resource.bili_link);
      }

      // Get user's progress for each item if they have access
      let itemsProgress = [];
      if (hasAccess && userId && resource.items) {
        const VideoProgress = require('../models/VideoProgress');
        for (let i = 0; i < resource.items.length; i++) {
          const progress = await VideoProgress.getProgress(userId, resource.id, i);
          if (progress) {
            itemsProgress.push({
              index: i,
              progressSeconds: progress.progress_seconds,
              durationSeconds: progress.duration_seconds,
              progressPercent: parseFloat(progress.progress_percent),
              isCompleted: progress.is_completed === 1
            });
          }
        }
        // Attach progress to items
        if (itemsProgress.length > 0) {
          resource.items.forEach((item, index) => {
            const progress = itemsProgress.find(p => p.index === index);
            if (progress) {
              item.progress = progress;
            }
          });
        }
      }

      res.json({ code: 0, data: { ...resource, hasAccess, isFavorite, collectionInfo } });
    } catch (e) {
      console.error('getVideoDetail error:', e);
      res.json({ code: 500, message: e.message });
    }
  }

  // Public: Parse Bilibili Link
  static async parseBiliLink(req, res) {
    try {
      const { url } = req.query;
      if (!url) return res.json({ code: 400, message: 'URL required' });

      const biliParams = await bilibiliService.parseLink(url);
      if (!biliParams) return res.json({ code: 400, message: 'Invalid Bilibili link' });

      // Get basic info (title)
      const info = await bilibiliService.getVideoUrl(biliParams); // Just to verify it's playable
      
      // We also want the title, let's use the internal getVideoInfo if needed, 
      // but parseLink already does some work. Let's get more info from Bilibili API.
      const infoRes = await axios.get('https://api.bilibili.com/x/web-interface/view', {
          params: { bvid: biliParams.bv, aid: biliParams.av },
          headers: { 'Referer': 'https://www.bilibili.com/' }
      });

      if (infoRes.data.code === 0) {
          const data = infoRes.data.data;
          res.json({
              code: 0,
              data: {
                  title: data.title,
                  bili_link: url,
                  cover_url: data.pic,
                  description: data.desc
              }
          });
      } else {
          res.json({ code: 0, data: { bili_link: url } });
      }
    } catch (e) {
      res.json({ code: 500, message: e.message });
    }
  }

  // Get stream URL for a specific item
  static async getPlayUrl(req, res) {
    try {
      const { vid, index } = req.params;
      const userId = req.user.id;

      const resource = await VideoResource.findByVid(vid);
      if (!resource) return res.json({ code: 404, message: 'Not found' });

      // Check access
      let hasAccess = !resource.requires_redemption;
      if (!hasAccess) {
        hasAccess = await UserVideo.hasAccess(userId, resource.id);
      }

      if (!hasAccess) return res.json({ code: 403, message: 'No access' });

      const item = resource.items[parseInt(index)];
      if (!item) return res.json({ code: 404, message: 'Item not found' });

      // Prioritize Bilibili link
      let playUrl = null;
      const biliLink = item.bili_link || (resource.bili_link && resource.type === 'single' ? resource.bili_link : null) || (item.url && (item.url.includes('bilibili.com') || item.url.includes('b23.tv')) ? item.url : null);
      
      if (biliLink) {
        console.log('Attempting to play Bilibili link:', biliLink);
        const biliParams = await bilibiliService.parseLink(biliLink);
        console.log('Bilibili params parsed:', biliParams);
        if (biliParams) {
          try {
            const directUrl = await bilibiliService.getVideoUrl(biliParams);
            console.log('Bilibili direct URL:', directUrl);
            if (directUrl) {
              playUrl = `/api/video/proxy?url=${encodeURIComponent(directUrl)}`;
            }
          } catch (error) {
            console.error('Bilibili resolution failed:', error.message);
          }
        }
        
        // If Bilibili resolution failed but we have a biliLink, use the embedded player link as a fallback
        // ONLY for H5, for Mini Program we'll let it fallback to biliLink which triggers web-view
        if (!playUrl && biliLink) {
          console.log('Falling back to Bilibili embedded player/page');
          if (biliParams && (biliParams.bv || biliParams.av)) {
            const idParam = biliParams.bv ? `bvid=${biliParams.bv}` : `aid=${biliParams.av}`;
            playUrl = `https://player.bilibili.com/player.html?${idParam}&page=${biliParams.p || 1}&high_quality=1&autoplay=1`;
          } else {
            playUrl = biliLink;
          }
        }
      }

      // Fallback to item.url if no playUrl yet
      if (!playUrl) {
        playUrl = item.url;
      }

      // Proxy only if it's a direct video link (not Bilibili page or embedded player)
      if (playUrl && (playUrl.startsWith('http://') || playUrl.startsWith('https://'))) {
        const isBiliPage = playUrl.includes('bilibili.com/video/') || playUrl.includes('b23.tv');
        const isBiliEmbed = playUrl.includes('player.bilibili.com');
        if (!isBiliPage && !isBiliEmbed) {
          playUrl = `/api/video/proxy?url=${encodeURIComponent(playUrl)}`;
        }
      }

      // Get user's last progress for this video
      const VideoProgress = require('../models/VideoProgress');
      const progress = await VideoProgress.getProgress(userId, resource.id, parseInt(index));
      
      res.json({ 
        code: 0, 
        data: { 
          url: playUrl,
          progressSeconds: progress ? progress.progress_seconds : 0,
          durationSeconds: progress ? progress.duration_seconds : 0,
          isCompleted: progress ? progress.is_completed === 1 : false
        } 
      });
    } catch (e) {
      console.error('getPlayUrl error:', e);
      res.json({ code: 500, message: e.message });
    }
  }

  // Proxy video stream to bypass referer/cors
  static async proxyVideo(req, res) {
    try {
      const { url } = req.query;
      if (!url) return res.status(400).send('URL required');

      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      const isBili = hostname.includes('bilibili.com') || 
                     hostname.includes('hdslb.com') || 
                     hostname.includes('bilivideo.com') ||
                     hostname.includes('bilivideo.cn') ||
                     hostname.includes('acgvideo.com');
      
      const options = {
        hostname: hostname,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: {
          'Referer': isBili ? 'https://www.bilibili.com/' : urlObj.origin,
          'User-Agent': isBili ? 
            'Bilibili/1.1.2 (bbcallen@gmail.com)' : 
            'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1',
          'Range': req.headers.range || 'bytes=0-',
          'Connection': 'keep-alive',
          'Accept': '*/*'
        }
      };

      const lib = url.startsWith('https') ? https : http;
      const proxyReq = lib.request(options, (proxyRes) => {
         // Forward essential headers
         const headers = {
           'Content-Type': proxyRes.headers['content-type'] || 'video/mp4',
           'Content-Length': proxyRes.headers['content-length'],
           'Accept-Ranges': 'bytes',
           'Access-Control-Allow-Origin': '*',
           'Access-Control-Allow-Methods': 'GET, OPTIONS',
           'Access-Control-Allow-Headers': 'Range, User-Agent, Referer',
           'Cache-Control': 'public, max-age=3600'
         };

         if (proxyRes.headers['content-range']) {
           headers['Content-Range'] = proxyRes.headers['content-range'];
         }
         
         res.writeHead(proxyRes.statusCode, headers);
         proxyRes.pipe(res);
       });

      proxyReq.on('error', (e) => {
        console.error('Proxy error:', e);
        if (!res.headersSent) {
          res.status(500).send(e.message);
        }
      });

      req.on('close', () => {
        proxyReq.destroy();
      });

      proxyReq.end();

    } catch (e) {
      if (!res.headersSent) {
        res.status(500).send(e.message);
      }
    }
  }

  // User: Redeem
  static async redeem(req, res) {
    try {
      const { code } = req.body;
      const userId = req.user.id;
      if (!code) return res.json({ code: 400, message: 'Code required' });
  
      const result = await VideoRedeem.redeem(userId, code);
      res.json({ code: 0, message: 'Redeemed successfully', data: result });
    } catch (e) {
      res.json({ code: 500, message: e.message });
    }
  }

  // User: Toggle Favorite
  static async toggleFavorite(req, res) {
    try {
      const { resourceId } = req.body;
      const userId = req.user.id;
      const isFav = await UserVideo.toggleFavorite(userId, resourceId);
      res.json({ code: 0, data: { isFavorite: isFav } });
    } catch (e) {
      res.json({ code: 500, message: e.message });
    }
  }

  // User: Submit Feedback/Recommendation
  static async submitFeedback(req, res) {
    try {
      const { resourceId, type, content } = req.body;
      const userId = req.user.id;
      
      const [result] = await pool.query(
        'INSERT INTO video_feedback (user_id, resource_id, type, content) VALUES (?, ?, ?, ?)',
        [userId, resourceId, type || 'feedback', content]
      );
      
      res.json({ code: 0, message: '提交成功' });
    } catch (e) {
      res.json({ code: 500, message: e.message });
    }
  }

  // User: My Videos
  static async getMyVideos(req, res) {
    try {
      const { type } = req.query; // 'redeemed' or 'favorite'
      const userId = req.user.id;
      const list = await UserVideo.getUserVideos(userId, type);
      res.json({ code: 0, data: list });
    } catch (e) {
      res.json({ code: 500, message: e.message });
    }
  }

  // Public: Get Collections
  static async getCollections(req, res) {
    try {
      const list = await VideoCollection.findAll();
      res.json({ code: 0, data: list });
    } catch (e) {
      res.json({ code: 500, message: e.message });
    }
  }

  // Public: Get Collection Detail
  static async getCollectionDetail(req, res) {
    try {
      const collection = await VideoCollection.getCollectionWithVideos(req.params.id);
      if (!collection) return res.json({ code: 404, message: 'Collection not found' });
      res.json({ code: 0, data: collection });
    } catch (e) {
      res.json({ code: 500, message: e.message });
    }
  }

  // User: My Collections
  static async getMyCollections(req, res) {
    try {
      const userId = req.user.id;
      const list = await VideoCollection.getUserCollections(userId);
      res.json({ code: 0, data: list });
    } catch (e) {
      res.json({ code: 500, message: e.message });
    }
  }

  // User: Get Collection Videos
  static async getCollectionVideos(req, res) {
    try {
      const userId = req.user.id;
      const collectionId = req.params.id;
      
      // Check if user has access to this collection
      const [accessRows] = await pool.query(
        'SELECT id FROM user_videos WHERE user_id = ? AND collection_id = ? AND has_access = 1 LIMIT 1',
        [userId, collectionId]
      );
      
      if (accessRows.length === 0) {
        return res.json({ code: 403, message: 'No access to this collection' });
      }
      
      // Get videos in collection
      const [videos] = await pool.query(`
        SELECT r.*, cv.sort as collection_sort
        FROM video_resources r
        JOIN collection_videos cv ON r.id = cv.resource_id
        WHERE cv.collection_id = ? AND r.status = 1
        ORDER BY cv.sort ASC, cv.created_at ASC
      `, [collectionId]);
      
      // Get user's progress for each video
      const VideoProgress = require('../models/VideoProgress');
      for (const video of videos) {
        const progress = await VideoProgress.getProgress(userId, video.id, 0);
        if (progress) {
          video.progress = {
            progressSeconds: progress.progress_seconds,
            durationSeconds: progress.duration_seconds,
            progressPercent: parseFloat(progress.progress_percent),
            isCompleted: progress.is_completed === 1,
            lastPlayedAt: progress.last_played_at
          };
        } else {
          video.progress = null;
        }
      }
      
      res.json({ code: 0, data: videos });
    } catch (e) {
      res.json({ code: 500, message: e.message });
    }
  }
  
  // User: Update Video Progress
  static async updateProgress(req, res) {
    try {
      const userId = req.user.id;
      const { resourceId, itemIndex, progressSeconds, durationSeconds, progressPercent, isCompleted } = req.body;
      
      if (!resourceId) {
        return res.json({ code: 400, message: 'Resource ID required' });
      }
      
      const VideoProgress = require('../models/VideoProgress');
      await VideoProgress.updateProgress(userId, resourceId, itemIndex || 0, {
        progressSeconds: progressSeconds || 0,
        durationSeconds: durationSeconds || 0,
        progressPercent: progressPercent || 0,
        isCompleted: isCompleted || false
      });
      
      res.json({ code: 0, message: 'Progress updated' });
    } catch (e) {
      res.json({ code: 500, message: e.message });
    }
  }

  // User: Recommend Video
  static async recommendVideo(req, res) {
    try {
      const { title, url } = req.body;
      const userId = req.user.id;
      if (!url) return res.json({ code: 400, message: 'URL required' });

      await pool.query(
        'INSERT INTO video_recommendations (user_id, title, url) VALUES (?, ?, ?)',
        [userId, title, url]
      );

      res.json({ code: 0, message: '推荐成功，感谢您的分享' });
    } catch (e) {
      res.json({ code: 500, message: e.message });
    }
  }
}

module.exports = VideoController;
