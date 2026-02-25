const express = require('express');
const { body, validationResult } = require('express-validator');

const Certificate = require('../models/Certificate');

const router = express.Router();

function sanitizeId(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();
}

router.get('/', (req, res) => {
  return res.render('home', { title: 'Certificate Verification Portal' });
});

router.get('/verify', (req, res) => {
  return res.render('verify', {
    title: 'Verify Certificate',
    result: null,
    searchedId: ''
  });
});

router.post(
  '/verify',
  [body('certificateId').trim().isLength({ min: 6, max: 32 }).withMessage('Enter valid ID.')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      const searchedId = sanitizeId(req.body.certificateId);

      if (!errors.isEmpty()) {
        return res.status(400).render('verify', {
          title: 'Verify Certificate',
          result: { valid: false, reason: 'Please enter a valid certificate ID.' },
          searchedId
        });
      }

      const certificate = await Certificate.findOne({ certificateId: searchedId }).lean();

      if (!certificate) {
        return res.render('verify', {
          title: 'Verify Certificate',
          result: { valid: false, reason: 'Certificate not found in records.' },
          searchedId
        });
      }

      return res.render('verify', {
        title: 'Verify Certificate',
        result: { valid: true, certificate },
        searchedId
      });
    } catch (error) {
      return next(error);
    }
  }
);

router.get('/verify/:certificateId', async (req, res, next) => {
  try {
    const searchedId = sanitizeId(req.params.certificateId);
    const certificate = await Certificate.findOne({ certificateId: searchedId }).lean();

    if (!certificate) {
      return res.status(404).render('verify', {
        title: 'Verify Certificate',
        result: { valid: false, reason: 'Certificate not found in records.' },
        searchedId
      });
    }

    return res.render('verify', {
      title: 'Verify Certificate',
      result: { valid: true, certificate },
      searchedId
    });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;