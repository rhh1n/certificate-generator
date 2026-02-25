function requireAuth(req, res, next) {
  if (!req.session.admin) {
    req.session.alert = { type: 'error', message: 'Please login to continue.' };
    return res.redirect('/admin/login');
  }

  next();
}

module.exports = { requireAuth };