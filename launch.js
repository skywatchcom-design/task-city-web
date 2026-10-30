// The launch switch (launch kit, 26.10.2026). Every publish copies web_pages to the live site, so the landing page
// (soon/) and the store link page (get/) read this one file: until launch day they say "coming soon".
// On the day Apple approves SkyTasks, change `live` to true and publish the site (owner's approval), nothing else.
window.SKY = {
  live: true,
  // iPhone and iPad: public once Apple approves version 0.1.0.
  appStore: 'https://apps.apple.com/app/id6826658767',
  // Android stays a closed test (Alpha) until 12 testers have had it 14 days. Testers type their Gmail address on /get/
  // (owner, 30.10); the tester-request function emails it to us, we add it to the testers list in Play Console and reply
  // with the link. A mailto link was tried first and closed the tab on Android phones without a mail app set up.
  androidMail: 'skywatchcom@gmail.com',
  androidStore: 'https://play.google.com/store/apps/details?id=com.skywatchcom.skytasks',
  testerRequest: 'https://wlsvwtvinopzuodpmqsj.supabase.co/functions/v1/tester-request'
};
