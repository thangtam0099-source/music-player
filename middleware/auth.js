// ───────────────────────────────────────────────
// Middleware kiểm tra đăng nhập
// ───────────────────────────────────────────────

/** Yêu cầu đăng nhập — nếu chưa thì về /login, kèm thông báo và link quay lại trang cũ */
function requireLogin(req, res, next) {
  if (req.session && req.session.user) return next();
  const returnTo = encodeURIComponent(req.originalUrl);
  res.redirect(`/login?message=Vui lòng đăng nhập để sử dụng tính năng này&returnTo=${returnTo}`);
}

/** Yêu cầu quyền admin */
function requireAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'admin') return next();
  res.redirect('/login');
}

/** Nếu đã đăng nhập, không cho vào login/register nữa */
function redirectIfLoggedIn(req, res, next) {
  if (req.session && req.session.user) {
    return req.session.user.role === 'admin' ? res.redirect('/admin') : res.redirect('/');
  }
  next();
}

module.exports = { requireLogin, requireAdmin, redirectIfLoggedIn };
