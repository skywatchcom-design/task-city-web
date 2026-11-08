// The launch switch (launch kit, 26.10.2026). Every publish copies web_pages to the live site, so the landing page
// (soon/) and the store link page (get/) read this one file: until launch day they say "coming soon".
// On the day Apple approves SkyTasks, change `live` to true and publish the site (owner's approval), nothing else.
window.SKY = {
  live: true,
  // iPhone and iPad: public once Apple approves version 0.1.0.
  appStore: 'https://apps.apple.com/app/id6826658767',
  // Apple's provider token (App Store Connect, Analytics, Acquisition, Campaigns: the "pt" of a campaign link). With it
  // every App Store link carries ct=<page>-<source>, and App Store Connect shows downloads per campaign. Empty: plain link.
  provider: '129671230',
  // Android stays a closed test (Alpha) until 12 testers have had it 14 days. Testers type their Gmail address on /get/
  // (owner, 30.10); the tester-request function emails it to us, we add it to the testers list in Play Console and reply
  // with the link. A mailto link was tried first and closed the tab on Android phones without a mail app set up.
  androidMail: 'skywatchcom@gmail.com',
  androidStore: 'https://play.google.com/store/apps/details?id=com.skywatchcom.skytasks',
  // Android in Google Play for everyone (production access granted 7.11.2026). Until the release is live in the store this
  // stays false and Android visitors get the tester form; true sends them straight to Google Play.
  androidLive: true,
  testerRequest: 'https://wlsvwtvinopzuodpmqsj.supabase.co/functions/v1/tester-request',
  visits: 'https://wlsvwtvinopzuodpmqsj.supabase.co/functions/v1/downloads'
};

// Where the visitor came from: ?s=fb in a post's link first, otherwise the site that sent them (a Google or Bing search,
// YouTube, Facebook...). Only the short name is kept, never the address. Empty when nothing says.
window.SKY.source = function () {
  try {
    var q = new URLSearchParams(location.search);
    // ?from= is an older form of the same code (a launch message, 1.11: /get/?from=fb-students counts as fbstudents).
    var s = (q.get('s') || q.get('from') || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
    if (s) return s;
    // AI assistants (geo, 6.11): ChatGPT adds utm_source=chatgpt.com to the links it gives and often sends no
    // referrer, Perplexity and Copilot do the same. The tag is read like a referring site.
    var utm = (q.get('utm_source') || '').toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
    var host = utm || (document.referrer ? new URL(document.referrer).hostname : '');
    host = host.replace(/^www\.|^m\.|^l\./, '');
    if (!host || host === location.hostname) return '';
    // Gemini before Google: gemini.google.com would otherwise count as a Google search.
    var known = [['gemini', /(^|\.)gemini(\.google\.com)?$/], ['google', /(^|\.)google\./], ['bing', /(^|\.)bing\.com$/], ['ddg', /(^|\.)duckduckgo\.com$/],
      ['chatgpt', /(^|\.)(chatgpt|openai)(\.com)?$/], ['perplexity', /(^|\.)perplexity(\.ai)?$/],
      ['claude', /(^|\.)claude(\.ai)?$/],
      ['copilot', /(^|\.)copilot(\.microsoft)?(\.com)?$/],
      ['yt', /(^|\.)(youtube\.com|youtu\.be)$/], ['fb', /(^|\.)facebook\.com$/],
      ['ig', /(^|\.)instagram\.com$/], ['x', /(^|\.)(x\.com|t\.co|twitter\.com)$/], ['github', /(^|\.)github\.io$/]];
    for (var i = 0; i < known.length; i++) if (known[i][1].test(host)) return known[i][0];
    return 'other';
  } catch (e) { return ''; }
};

// The App Store link for a page ('home', 'get'), tagged with the campaign <page>-<source> once `provider` is set.
window.SKY.store = function (page) {
  var S = window.SKY;
  if (!S.provider) return S.appStore;
  var ct = (page + '-' + (S.source() || 'direct')).slice(0, 40);
  return S.appStore + '?pt=' + encodeURIComponent(S.provider) + '&ct=' + encodeURIComponent(ct) + '&mt=8';
};

// The Google Play link for a page, tagged with utm_source=<source> and utm_campaign=<page> in the install referrer, so
// Play Console shows where installs came from (Acquisition reports).
window.SKY.playRef = function (page) {
  return 'utm_source=' + (window.SKY.source() || 'direct') + '&utm_campaign=' + page;
};
window.SKY.play = function (page) {
  var S = window.SKY;
  return S.androidStore + '&referrer=' + encodeURIComponent(S.playRef(page));
};

// The same, as an intent:// address that opens the Play Store app itself (store-links, 8.11). Inside Facebook's or
// Instagram's own browser on Android a play.google.com address can stay a web page in that browser; an intent:// address
// is handed to the phone. Without the Play Store app (some Huawei phones) the phone opens the web address instead.
window.SKY.playIntent = function (page) {
  var S = window.SKY;
  var id = (S.androidStore.split('id=')[1] || '').split('&')[0];
  return 'intent://details?id=' + id + '&referrer=' + encodeURIComponent(S.playRef(page)) +
    '#Intent;scheme=market;package=com.android.vending;S.browser_fallback_url=' + encodeURIComponent(S.play(page)) + ';end';
};

// True inside an app's own browser (Facebook, Instagram, Messenger, LinkedIn, TikTok, Snapchat, Telegram, LINE, WhatsApp,
// or any Android WebView, which says "; wv)"), where a jump to a store is less sure than in Chrome or Safari.
window.SKY.inApp = function () {
  var ua = navigator.userAgent || '';
  return /FBAN|FBAV|FB_IAB|FBIOS|FB4A|Instagram|Messenger|LinkedInApp|TikTok|musical_ly|BytedanceWebview|Snapchat|Telegram|Line\/|WhatsApp|; wv\)/i.test(ua);
};

// Counts one visit for the admin page's downloads tab: the page, the kind of phone, and where the visitor came from
// (SKY.source). A guide or a tool for Google passes its own code too (g12, t1). Only counts reach the server; nothing
// about the visitor is sent or kept.
window.SKY.hit = function (page, code) {
  try {
    var ua = navigator.userAgent || '';
    var os = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? 'ios' : /Android/.test(ua) ? 'android' : 'other';
    var src = window.SKY.source();
    var body = JSON.stringify({ action: 'hit', page: page, os: os, src: src || undefined, code: code || undefined });
    if (navigator.sendBeacon) navigator.sendBeacon(window.SKY.visits, new Blob([body], { type: 'text/plain' }));
    else fetch(window.SKY.visits, { method: 'POST', body: body, keepalive: true, headers: { 'Content-Type': 'text/plain' } });
  } catch (e) { /* counting never gets in the way of the page */ }
};
