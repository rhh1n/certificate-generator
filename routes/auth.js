const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');

const router = express.Router();

router.get('/login', (req, res) => {
  if (req.session.admin) {
    return res.redirect('/admin/dashboard');
  }

  return res.render('login', { title: 'Admin Login', old: {}, errors: [] });
});

router.post(
  '/login',
  [
    body('username').trim().isLength({ min: 3, max: 50 }).withMessage('Invalid username.'),
    body('password').isLength({ min: 8, max: 128 }).withMessage('Invalid password.')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    const { username, password } = req.body;

    if (!errors.isEmpty()) {
      return res.status(400).render('login', {
        title: 'Admin Login',
        old: { username },
        errors: errors.array()
      });
    }

    const expectedUsername = process.env.ADMIN_USERNAME;
    const hash = process.env.ADMIN_PASSWORD_HASH;
    const plainPassword = process.env.ADMIN_PASSWORD;

    const usernameMatches = username === expectedUsername;
    let passwordMatches = false;
    if (hash) {
      passwordMatches = await bcrypt.compare(password, hash);
    } else if (plainPassword) {
      passwordMatches = password === plainPassword;
    }

    if (!usernameMatches || !passwordMatches) {
      return res.status(401).render('login', {
        title: 'Admin Login',
        old: { username },
        errors: [{ msg: 'Invalid credentials.' }]
      });
    }

    req.session.regenerate((error) => {
      if (error) {
        return res.status(500).render('error', {
          title: 'Server Error',
          message: 'Could not create session. Please try again.'
        });
      }

      req.session.admin = { username };
      req.session.alert = { type: 'success', message: 'Logged in successfully.' };
      return res.redirect('/admin/dashboard');
    });
  }
);

router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('certi.sid');
    return res.redirect('/admin/login');
  });
});

module.exports = router;
