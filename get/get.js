// The download page (/get/, and /get/en/ in English), shared by both (store-links, 8.11.2026).
//
// What every visitor gets, in this order, so nobody is left on a blank page:
//   1. the visit is counted (SKY.hit, a beacon that survives leaving the page);
//   2. the page is drawn: words, and big store buttons that already point at the right store;
//   3. a phone is sent on to its store. Inside Facebook, Instagram, LinkedIn, TikTok, Telegram or another app's own
//      browser on Android, a play.google.com address can open as a web page inside that browser (sign in to install, and
//      most people leave); there the page goes through intent:// to the Play Store app itself, with the web address as
//      the fallback (SKY.playIntent);
//   4. if the phone is still on the page after a moment (the app's browser blocked the jump), a line above the buttons
//      says to tap the button, and inside an app's browser how to open the page in the phone's own browser.
//
// Links already out there keep working as before: /get/, /get/?s=<code>, /get/?lang=en, /get/#android, /get/en/.
// New: ?to=ios or ?to=android (from the short links /ios/ and /android/) shows one store only.
//
//   <script src="get.js" data-up="../"></script>        data-up: the way back to the site root; data-lang="en" fixes the language
(function () {
  var S = window.SKY || {};
  var me = document.currentScript;
  var up = (me && me.getAttribute('data-up')) || '../';
  var fixed = me && me.getAttribute('data-lang');
  // Until launch day the store pages are not open yet: the landing page says "coming soon".
  if (!S.live) { location.replace(up + 'soon/'); return; }
  if (S.hit) S.hit('get');

  var $ = function (id) { return document.getElementById(id); };
  var q = new URLSearchParams(location.search);
  var to = (q.get('to') || '').toLowerCase();
  if (to !== 'ios' && to !== 'android') to = '';
  if (location.hash === '#android') to = 'android';
  var ua = navigator.userAgent || '';
  var apple = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  var android = /Android/.test(ua);
  var inApp = S.inApp ? S.inApp() : false;

  // The words first, so the page is never empty, whatever happens next.
  var r = document.documentElement, lang = 'he';
  function set(l) {
    lang = l; r.lang = l; r.dir = l === 'he' ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-he]').forEach(function (e) { e.textContent = e.getAttribute('data-' + l); });
    $('bHe').setAttribute('aria-pressed', l === 'he');
    $('bEn').setAttribute('aria-pressed', l === 'en');
    document.title = l === 'he' ? 'SkyTasks, להורדה' : 'SkyTasks, download';
  }
  var want = (q.get('lang') || '').toLowerCase();
  set(fixed || (want === 'en' || want === 'he' ? want : (/^(he|iw)/i.test(navigator.language || 'he') ? 'he' : 'en')));
  $('bHe').onclick = function () { set('he'); };
  $('bEn').onclick = function () { set('en'); };

  // The buttons.
  var appUrl = S.store ? S.store('get') : S.appStore;
  var playUrl = S.play ? S.play('get') : S.androidStore;
  var playGo = android && inApp && S.playIntent ? S.playIntent('get') : playUrl;
  $('appStore').href = appUrl;
  $('playStore').href = playGo;

  // Which cards: a phone sees its own store (or the one the link asked for), a computer sees both or the one asked for.
  var showIos, showPlay;
  if (apple) { showIos = to !== 'android'; showPlay = to === 'android'; }
  else if (android) { showIos = to === 'ios'; showPlay = to !== 'ios'; }
  else { showIos = to !== 'android'; showPlay = to !== 'ios'; }
  // Android still a closed test (launch.js androidLive false): the tester form instead of the Play button.
  var form = !S.androidLive && showPlay;
  if (!S.androidLive) showPlay = false;
  $('ios').hidden = !showIos;
  $('play').hidden = !showPlay;
  $('android').hidden = !form;
  $('lead').hidden = (showIos + showPlay + form) < 2;

  // A phone goes straight on to its store.
  var target = '';
  if (apple && showIos && !showPlay) target = appUrl;
  else if (android && showPlay && !showIos) target = playGo;
  if (target) {
    // Inside an app's browser the hint also says how to leave it.
    $('stuckApp').hidden = !inApp;
    $('stuckApp').setAttribute('data-he', apple ? 'עדיין לא? למעלה ב־⋯ בוחרים "לפתוח בדפדפן" (Safari), ומשם ל־App Store.' : 'עדיין לא? למעלה ב־⋮ בוחרים "לפתוח בדפדפן" (Chrome), ומשם ל־Google Play.');
    $('stuckApp').setAttribute('data-en', apple ? 'Still nothing? Tap ⋯ at the top, choose "Open in browser" (Safari), and go on from there.' : 'Still nothing? Tap ⋮ at the top, choose "Open in browser" (Chrome), and go on from there.');
    set(lang);
    var stuck = function () { if (document.visibilityState === 'visible') $('stuck').hidden = false; };
    // The beacon is already queued; a short pause still lets a slow in-app browser hand it over before the jump.
    setTimeout(function () { try { location.replace(target); } catch (e) { stuck(); } }, 60);
    setTimeout(stuck, 1600);
    // Back from the store (the page comes from the browser's memory): the buttons and the line are there at once.
    addEventListener('pageshow', function (e) { if (e.persisted) stuck(); });
  }

  // A computer cannot install the app: a QR code of this page for the phone, tagged "<source>qr" so we count who moved over.
  if (!apple && !android && location.hash !== '#android') {
    var src = ((S.source && S.source()) || 'pc').slice(0, 10) + 'qr';
    var url = 'https://skytasks.pages.dev/get/' + (fixed === 'en' ? 'en/' : '') + '?s=' + src + (to ? '&to=' + to : '');
    var qs = document.createElement('script');
    qs.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';
    qs.onload = function () {
      try {
        var c = qrcode(0, 'M'); c.addData(url); c.make();
        $('qrCode').innerHTML = c.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
        $('qr').hidden = false;
      } catch (e) { /* no QR, the buttons are still there */ }
    };
    document.head.appendChild(qs);
  }

  // The tester form (only while Android is a closed test): our server (tester-request) emails the address to us.
  var ask = $('ask'), mail = $('mail'), msg = $('msg'), send = $('send');
  function say(he, en) { msg.textContent = lang === 'he' ? he : en; }
  ask.onsubmit = function (e) {
    e.preventDefault();
    var v = mail.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v)) { mail.setAttribute('aria-invalid', 'true'); say('צריך כתובת מייל מלאה, למשל name@gmail.com', 'A full email address, like name@gmail.com'); mail.focus(); return; }
    mail.removeAttribute('aria-invalid'); msg.textContent = ''; send.disabled = true;
    fetch(S.testerRequest, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: v, lang: lang, website: $('website').value }) })
      .then(function (res) {
        if (!res.ok) throw res.status;
        ask.hidden = true; $('doneMail').textContent = v; $('done').hidden = false;
      })
      .catch(function () {
        send.disabled = false;
        say('לא הצלחנו לשלוח. נסו שוב, או כתבו לנו ל־skywatchcom@gmail.com', 'Could not send. Try again, or write to skywatchcom@gmail.com');
      });
  };
})();
