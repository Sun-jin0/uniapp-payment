const HomepageCard = require('../models/HomepageCard');
const { successResponse, errorResponse } = require('../utils/response');

exports.getPublicCards = async (req, res) => {
  try {
    const { category } = req.query;
    let cards;
    if (category) {
      cards = await HomepageCard.findByCategory(category);
    } else {
      cards = await HomepageCard.findAll();
    }
    res.json(successResponse(cards));
  } catch (err) {
    console.error('Get public cards error:', err);
    res.json(errorResponse('Failed to fetch cards'));
  }
};

exports.getAdminCards = async (req, res) => {
  try {
    const cards = await HomepageCard.findAllAdmin();
    res.json(successResponse(cards));
  } catch (err) {
    console.error('Get admin cards error:', err);
    res.json(errorResponse('Failed to fetch cards'));
  }
};

exports.createCard = async (req, res) => {
  try {
    const id = await HomepageCard.create(req.body);
    res.json(successResponse({ id, ...req.body }));
  } catch (err) {
    console.error('Create card error:', err);
    res.json(errorResponse('Failed to create card'));
  }
};

exports.updateCard = async (req, res) => {
  try {
    const { id } = req.params;
    await HomepageCard.update(id, req.body);
    res.json(successResponse({ id, ...req.body }));
  } catch (err) {
    console.error('Update card error:', err);
    res.json(errorResponse('Failed to update card'));
  }
};

exports.deleteCard = async (req, res) => {
  try {
    const { id } = req.params;
    await HomepageCard.delete(id);
    res.json(successResponse({ id }));
  } catch (err) {
    console.error('Delete card error:', err);
    res.json(errorResponse('Failed to delete card'));
  }
};
