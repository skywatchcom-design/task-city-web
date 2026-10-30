// The launch switch (launch kit, 26.10.2026). Every publish copies web_pages to the live site, so the landing page
// (soon/) and the store link page (get/) read this one file: until launch day they say "coming soon".
// On the day Apple approves SkyTasks, change `live` to true and publish the site (owner's approval), nothing else.
window.SKY = {
  live: true,
  // iPhone and iPad: public once Apple approves version 0.1.0.
  appStore: 'https://apps.apple.com/app/id6826658767',
  // Android stays a closed test (Alpha) until 12 testers have had it 14 days. Anyone who joins the Google Group
  // becomes a tester, as long as the group is added as testers of the Alpha track in Play Console.
  androidGroup: 'https://groups.google.com/g/skytasks-testers',
  androidOptIn: 'https://play.google.com/apps/testing/com.skywatchcom.skytasks',
  androidStore: 'https://play.google.com/store/apps/details?id=com.skywatchcom.skytasks'
};
