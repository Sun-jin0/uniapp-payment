
const pool = require('../config/mysql');
const fs = require('fs');
const path = require('path');
const { successResponse, errorResponse } = require('../utils/response');

const medAdminController = {
  // 获取西医题库文件列表
  getMedFiles: async (req, res) => {
    try {
      const medDir = path.join('F:', 'Code', 'uniapp', 'demo', '数据库相关', '西医题库');
      const files = fs.readdirSync(medDir);
      const jsonFiles = files.filter(f => f.endsWith('.json') && !f.includes('结构'));
      
      const fileList = jsonFiles.map(f => {
        const stats = fs.statSync(path.join(medDir, f));
        return {
          filename: f,
          size: (stats.size / 1024).toFixed(2) + ' KB',
          mtime: stats.mtime
        };
      });
      
      res.json(successResponse(fileList));
    } catch (error) {
      console.error('getMedFiles error:', error);
      res.status(500).json(errorResponse('获取文件列表失败'));
    }
  },

  // 导入指定的西医题库文件
  importMedFile: async (req, res) => {
    const { filename, jsonData } = req.body;
    
    // 如果提供了 jsonData，则直接使用；否则从文件系统中读取
    let data;
    if (jsonData) {
      data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
    } else {
      if (!filename) return res.status(400).json(errorResponse('文件名不能为空'));
      const filePath = path.join('F:', 'Code', 'uniapp', 'demo', '数据库相关', '西医题库', filename);
      if (!fs.existsSync(filePath)) return res.status(404).json(errorResponse('找不到该文件'));
      data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const { courseId, courseName, chapterId, chapterName, questions } = data;
      const targetName = filename || courseName || '上传数据';

      // 1. 确保课程存在
      await connection.query(
        'INSERT INTO med_courses (course_id, name) VALUES (?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name)',
        [courseId, courseName]
      );

      // 2. 确保章节存在
      await connection.query(
        'INSERT INTO med_chapters (chapter_id, course_id, name) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name), course_id=VALUES(course_id)',
        [chapterId, courseId, chapterName]
      );

      // 3. 导入题目
      let importedCount = 0;
      for (const q of questions) {
        // 处理 content 字段，如果它是字符串数组，解析内部的 JSON 字符串
        let processedContent = q.content;
        if (Array.isArray(q.content)) {
          processedContent = q.content.map(item => {
            if (typeof item === 'string' && item.startsWith('{')) {
              try {
                return JSON.parse(item);
              } catch (e) {
                return item;
              }
            }
            return item;
          });
        }

        await connection.query(
          `INSERT INTO med_questions 
          (question_id, course_id, chapter_id, type, topic, topic_image, content, answer, analysis, basic_analysis, basic_analysis_image, itemize_analysis, itemize_analysis_image, video_url, comparison_summary, comparison_images, mind_map, mind_map_image, knowledge_image, year, number, score, score_describe, question_type_option, column_id, sort) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
          ON DUPLICATE KEY UPDATE 
          type=VALUES(type), topic=VALUES(topic), topic_image=VALUES(topic_image), content=VALUES(content), answer=VALUES(answer), 
          analysis=VALUES(analysis), basic_analysis=VALUES(basic_analysis), basic_analysis_image=VALUES(basic_analysis_image),
          itemize_analysis=VALUES(itemize_analysis), itemize_analysis_image=VALUES(itemize_analysis_image),
          video_url=VALUES(video_url), 
          comparison_summary=VALUES(comparison_summary),
          comparison_images=VALUES(comparison_images),
          mind_map=VALUES(mind_map),
          mind_map_image=VALUES(mind_map_image), 
          knowledge_image=VALUES(knowledge_image),
          year=VALUES(year), number=VALUES(number), 
          score=VALUES(score), score_describe=VALUES(score_describe), 
          question_type_option=VALUES(question_type_option), column_id=VALUES(column_id), sort=VALUES(sort)`,
          [
            q.questionId, courseId, chapterId, q.questionBankType, q.topic, q.topicImage,
            JSON.stringify(processedContent), q.answer, q.examCenterRestore, q.basicAnalysis, q.basicAnalysisImage,
            q.itemizeAnalysis, q.itemizeAnalysisImage,
            q.videoAnalysis, q.comparisonSummary, 
            Array.isArray(q.comparisonImages) ? JSON.stringify(q.comparisonImages) : q.comparisonImages,
            q.mindMap, q.mindMapImage, q.knowledgeImage,
            q.year, q.number, q.score || 0, q.scoreDescribe,
            q.questionTypeOption, q.columnId, q.sortNumber || 0
          ]
        );
        importedCount++;
      }

      await connection.commit();
      res.json(successResponse({ importedCount }, `成功导入 ${targetName}，共 ${importedCount} 道题`));
    } catch (error) {
      await connection.rollback();
      console.error('importMedFile error:', error);
      res.status(500).json(errorResponse('导入失败: ' + error.message));
    } finally {
      connection.release();
    }
  }
};

module.exports = medAdminController;
