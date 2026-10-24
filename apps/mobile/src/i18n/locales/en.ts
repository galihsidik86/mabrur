// English. Istilah mengikuti tabel di dokumen permintaan revisi v2 (Permintaan 7);
// perlu diperiksa penutur asli sebelum rilis, termasuk istilah ibadah.
import type { TranslationKey } from './id';

export const en: Record<TranslationKey, string> = {
  // Language
  'lang.label': 'Language',
  'lang.id': 'Indonesia',
  'lang.en': 'English',

  // Login
  'login.tagline': 'Hajj & Umrah guide',
  'login.phone': 'Phone number',
  'login.password': 'Password',
  'login.password_placeholder': 'Enter password',
  'login.show_password': 'Show password',
  'login.hide_password': 'Hide password',
  'login.submit': 'Sign in',
  'login.required': 'Phone number and password are required',
  'login.failed': 'Sign-in failed',
  'login.footer': 'Contact your group admin to get an account.',

  // Bottom tabs
  'nav.home': 'Home',
  'nav.map': 'Map',
  'nav.guide': 'Guide',
  'nav.doa': "Du'a",
  'nav.schedule': 'Schedule',

  // Mode
  'mode.jamaah': 'Pilgrim',
  'mode.muthawwif': 'Muthawwif',
  'mode.muthawwif_title': 'Muthawwif (Group Leader) mode',

  // Home
  'home.greeting': "Assalamu'alaikum,",
  'home.hi': 'Hi, {name}',
  'home.ihram_status': 'IHRAM STATUS',
  'home.in_ihram': 'In Ihram',
  'home.not_ihram': 'Not yet in Ihram',
  'home.badge_active': 'ACTIVE',
  'home.badge_prepare': 'PREPARE',
  'home.nearest_miqat': 'NEAREST MIQAT',
  'home.waiting_gps': 'Waiting for GPS',
  'home.distance': 'DISTANCE TO BOUNDARY',
  'home.open_miqat_map': 'Open Miqat boundary map',
  'home.next_agenda': 'Upcoming agenda',
  'home.see_all': 'See all ›',
  'home.your_group': 'Your group',
  'home.members': '{count} members',
  'home.muthawwif': 'Muthawwif: {name}',

  // Quick menu
  'quick.guide': 'Guide',
  'quick.doa': "Du'a",
  'quick.schedule': 'Schedule',
  'quick.tools': 'Worship Tools',

  // Dates — short month names, comma separated
  'date.months_short': 'JAN,FEB,MAR,APR,MAY,JUN,JUL,AUG,SEP,OCT,NOV,DEC',

  // Miqat warning
  'miqat.warn_title': 'Put on Ihram now',
  'miqat.warn_sub': 'Miqat boundary is {distance} away',
  'miqat.ready_title': 'You are in Ihram',
  'miqat.ready_sub': 'Umrah intention has been made',
  'miqat.approach_title': 'Heading to Miqat',
  'miqat.approach_sub': 'Not yet in Ihram · still safe',
  'miqat.distance_label': 'Distance to Miqat line',
  'miqat.notif_title': 'Put on Ihram now!',
  'miqat.notif_body': 'You are {km} km from the {miqat} Miqat boundary. Enter Ihram and make your intention before crossing it.',

  // Numbers
  'number.decimal_sep': '.',

  // Location sharing (permission & background service notification)
  'loc.consent_title': 'Share your location with your Muthawwif',
  'loc.consent_body': 'Mabrur shares your location only with the Muthawwif of your group, including when the app is closed, so you are not left behind and can be found quickly if separated. Your location is also used for Miqat alerts.',
  'loc.consent_hint': 'On the next screen, choose "Allow all the time".',
  'loc.later': 'Later',
  'loc.continue': 'Continue',
  'loc.denied_title': 'Location permission not granted',
  'loc.denied_body': 'Open Settings → Permissions → Location and choose "Allow all the time" so your Muthawwif can see your position.',
  'loc.open_settings': 'Open Settings',
  'loc.gps_off_title': 'GPS is off',
  'loc.gps_off_body': 'Turn on GPS/Location on your phone so your group can see your position.',
  'loc.active_title': 'Location on',
  'loc.active_body': 'Thank you, your Muthawwif can now see your position.',
  'loc.service_body': 'Location shared with your group Muthawwif & used for Miqat alerts',

  // SOS
  'sos.header_label': 'EMERGENCY HELP',
  'sos.title': 'SOS',
  'sos.sent_title': 'Emergency signal sent',
  'sos.sent_sub': 'Your Muthawwif and group officers are receiving your location in real time. Stay where you are if possible.',
  'sos.sharing': 'Sharing your location',
  'sos.cancel': 'Cancel SOS',
  'sos.instruction': 'Choose the type of emergency, then press the SOS button.',
  'sos.cat.medis': 'Medical',
  'sos.cat.tersesat': 'Lost',
  'sos.cat.kehilangan': 'Missing item',
  'sos.photo_attached': 'Photo attached',
  'sos.photo_optional': 'Take a photo (optional)',
  'sos.send': 'Send SOS now',
  'sos.send_sub': 'Your location will be shared',
  'sos.contact_muthawwif': 'Muthawwif',
  'sos.emergency': 'Emergency {number}',
  'sos.hide': 'Hide',
  'sos.history': 'SOS history ({count})',
  'sos.status.active': 'Active',
  'sos.status.resolved': 'Resolved',
  'sos.status.cancelled': 'Cancelled',
  'sos.med_card': 'ID & medical card',
  'sos.med.name': 'NAME',
  'sos.med.kloter': 'GROUP CODE',
  'sos.med.blood': 'BLOOD TYPE',
  'sos.med.passport': 'PASSPORT NO.',
  'sos.med.history': 'MEDICAL HISTORY',
  'sos.err.title': 'Failed',
  'sos.err.send': 'Could not send SOS',
  'sos.err.cancel': 'Could not cancel SOS',
  'sos.err.no_number_title': 'Number not available',
  'sos.err.no_number': 'Muthawwif contact has not synced yet. Open the group menu while online.',
  'sos.err.phone': 'Could not open the phone app.',

  // Profile
  'profile.title': 'Profile',
  'profile.edit': 'Edit Profile',
  'profile.stats': 'Journey Stats',
  'profile.change_password': 'Change Password',
  'profile.logout': 'Sign out',

  // Common
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.loading': 'Loading...',
};
