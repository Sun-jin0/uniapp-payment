const PoliticsSection = require('../models/PoliticsSection');
const PublicBook = require('../models/PublicBook');
const { successResponse, errorResponse } = require('../utils/response');

// Public methods
exports.getSections = async (req, res) => {
  try {
    const sections = await PoliticsSection.find({ status: 1 });
    const sectionsWithBooks = await Promise.all(sections.map(async (section) => {
      const books = await PoliticsSection.getBooks(section.id);
      return { ...section, books };
    }));
    res.json(successResponse(sectionsWithBooks));
  } catch (error) {
    console.error('获取政治板块失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

// Admin methods
exports.adminGetSections = async (req, res) => {
  try {
    const sections = await PoliticsSection.find();
    res.json(successResponse(sections));
  } catch (error) {
    console.error('获取政治板块失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

exports.adminCreateSection = async (req, res) => {
  try {
    const section = await PoliticsSection.create(req.body);
    res.json(successResponse(section));
  } catch (error) {
    console.error('创建政治板块失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

exports.adminUpdateSection = async (req, res) => {
  try {
    const success = await PoliticsSection.update(req.params.id, req.body);
    if (success) {
      res.json(successResponse({ success: true }));
    } else {
      res.status(404).json(errorResponse('板块不存在'));
    }
  } catch (error) {
    console.error('更新政治板块失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

exports.adminDeleteSection = async (req, res) => {
  try {
    const success = await PoliticsSection.delete(req.params.id);
    if (success) {
      res.json(successResponse({ success: true }));
    } else {
      res.status(404).json(errorResponse('板块不存在'));
    }
  } catch (error) {
    console.error('删除政治板块失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

exports.getSectionBooks = async (req, res) => {
  try {
    const books = await PoliticsSection.getBooks(req.params.sectionId);
    res.json(successResponse(books));
  } catch (error) {
    console.error('获取板块书籍失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

exports.adminAddBookToSection = async (req, res) => {
  try {
    const { bookId, sort } = req.body;
    const success = await PoliticsSection.addBook(req.params.sectionId, bookId, sort);
    res.json(successResponse({ success }));
  } catch (error) {
    console.error('添加板块书籍失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};

exports.adminRemoveBookFromSection = async (req, res) => {
  try {
    const success = await PoliticsSection.removeBook(req.params.sectionId, req.params.bookId);
    res.json(successResponse({ success }));
  } catch (error) {
    console.error('移除板块书籍失败:', error);
    res.status(500).json(errorResponse('服务器错误'));
  }
};
