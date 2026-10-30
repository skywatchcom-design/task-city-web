// The launch switch (launch kit, 26.10.2026). Every publish copies web_pages to the live site, so the landing page
// (soon/) and the store link page (get/) read this one file: until launch day they say "coming soon".
// On the day Apple approves SkyTasks, change `live` to true and publish the site (owner's approval), nothing else.
window.SKY = {
  live: true,
  // iPhone and iPad: public once Apple approves version 0.1.0.
  appStore: 'https://apps.apple.com/app/id6826658767',
  // Android stays a closed test (Alpha) until 12 testers have had it 14 days. Testers ask by email (owner, 30.10), we add
  // their Gmail address to the testers list in Play Console and reply with the link.
  androidMail: 'skywatchcom@gmail.com',
  androidStore: 'https://play.google.com/store/apps/details?id=com.skywatchcom.skytasks',
  testerMail: function (lang) {
    var he = lang === 'he';
    var subject = he ? 'SkyTasks: בקשה להצטרף לבדיקה באנדרואיד' : 'SkyTasks: joining the Android test';
    var body = he
      ? 'שלום,\nאשמח להצטרף לבדיקה של SkyTasks באנדרואיד.\nכתובת הג\'ימייל שלי בגוגל פליי: \n\nתודה!'
      : 'Hi,\nI would like to join the SkyTasks Android test.\nThe Gmail address I use on Google Play: \n\nThanks!';
    return 'mailto:' + this.androidMail + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  }
};
