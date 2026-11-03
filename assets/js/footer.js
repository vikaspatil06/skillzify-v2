/* Skillzify universal footer — single source of truth.
   Markup copied from dashboard.html (the reference footer).
   Every page mounts <div id="site-footer"></div> and loads this file
   (right after nav.js). Edit here once, updates everywhere. */
(function () {
  "use strict";
  var mount = document.getElementById("site-footer");
  if (!mount) return;
  mount.innerHTML =
    "<footer>\n" +
    '  <div class="container">\n' +
    '    <div class="footer-grid">\n' +
    '      <div class="footer-brand">\n' +
    '        <img data-logo src="assets/logo-light.png" alt="Skillzify logo">\n' +
    "        <p>Learn. Build. Shine. — an advanced, browser-first Python learning platform for students.</p>\n" +
    "      </div>\n" +
    "      <div>\n" +
    "        <h4>Learn</h4>\n" +
    '        <a href="learn.html">Beginner track</a>\n' +
    '        <a href="learn.html">Intermediate track</a>\n' +
    '        <a href="learn.html">Advanced track</a>\n' +
    "      </div>\n" +
    "      <div>\n" +
    "        <h4>Platform</h4>\n" +
    '        <a href="compiler.html">Code Studio</a>\n' +
    '        <a href="dashboard.html">Dashboard</a>\n' +
    '        <a href="auth.html">Login / Register</a>\n' +
    "      </div>\n" +
    "      <div>\n" +
    "        <h4>Company</h4>\n" +
    '        <a href="about.html">About us</a>\n' +
    '        <a href="contact.html">Contact</a>\n' +
    "      </div>\n" +
    "    </div>\n" +
    '    <div class="footer-bottom">© <span data-year>2026</span> Skillzify · Learn. Build. Shine.</div>\n' +
    "  </div>\n" +
    "</footer>\n";
})();
