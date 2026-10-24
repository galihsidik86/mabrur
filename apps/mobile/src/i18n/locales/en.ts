// English. Istilah mengikuti tabel di dokumen permintaan revisi v2 (Permintaan 7);
// perlu diperiksa penutur asli sebelum rilis, termasuk istilah ibadah.
import type { TranslationKey } from './id';
import { toolsEn } from './parts/tools';
import { monitorEn } from './parts/monitor';
import { accountEn } from './parts/account';
import { contentEn } from './parts/content';
import { prayerEn } from './parts/prayer';
import { quranEn } from './parts/quran';

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
  'quick.tools': 'Worship Tools',
  'quick.prayer': 'Prayer & Qibla',
  'quick.quran': "Qur'an",
  'quick.phrases': 'Arabic Phrases',

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

  // Currency
  'kurs.from': 'From',
  'kurs.to': 'To',
  'kurs.swap': 'Swap conversion direction',
  'kurs.amount_placeholder': 'Amount in {code}',
  'kurs.rate_line': '1 {from} = {rate} {to}',
  'kurs.updated': 'Rates updated {time}',
  'kurs.offline': 'Offline — using the last saved rates',
  'kurs.fallback': 'Estimated rate: the rate source cannot be reached yet',
  'kurs.no_data': 'Rates are not available yet. Connect to the internet once to download them.',
  'kurs.disclaimer': 'Rates are indicative. Money changers may use different rates.',
  'kurs.attribution': 'Rates by Exchange Rate API (open.er-api.com)',
  'kurs.select_title': 'Choose currency',
  'kurs.search': 'Search name or code (e.g. USD, Ringgit)',

  // Arabic phrases
  'phrase.empty': 'Phrases are not available yet. Connect to the internet once to download them.',
  'phrase.cat.salam': 'Greetings & courtesy',
  'phrase.cat.arah': 'Directions & places',
  'phrase.cat.transportasi': 'Transport',
  'phrase.cat.belanja': 'Shopping',
  'phrase.cat.darurat': 'Emergency',
  'phrase.cat.makanan': 'Food & drink',

  // Taxi Card
  'sos.taxi_card': 'Taxi Card',
  'sos.taxi_card_sub': 'Show your hotel address to the driver or police',
  'taxi.title': 'Taxi Card',
  'taxi.subtitle': 'Show this screen to the taxi driver or police',
  'taxi.emergency_title': 'Saudi emergency numbers',
  'taxi.emergency.unified': 'Emergency',
  'taxi.emergency.police': 'Police',
  'taxi.emergency.ambulance': 'Ambulance',
  'taxi.emergency.fire': 'Fire',
  'taxi.leader_title': 'Muthawwif / group leader',
  'taxi.call': 'Call',
  'taxi.whatsapp': 'WhatsApp',
  'taxi.whatsapp_failed': 'Could not open WhatsApp.',
  'taxi.city.makkah': 'Makkah hotel',
  'taxi.city.madinah': 'Madinah hotel',
  'taxi.hotel_phone': 'Hotel phone',
  'taxi.room_line': 'Room {room} · Group: {group}',
  'taxi.group_line': 'Group: {group}',
  'taxi.choose_phrase': 'Choose the sentence shown on the card',
  'taxi.phrase.take_me': 'Please take me to this hotel.',
  'taxi.phrase.lost': 'I am on Umrah and have lost my group. Please help me get to this hotel or call my group leader.',
  'taxi.phrase.call': 'Please call this number.',
  'taxi.phrase.medical': 'I need medical help.',
  'taxi.missing': 'Card details are incomplete ({fields}). Contact your Muthawwif. The sentences and emergency numbers still work.',
  'taxi.missing.hotel': 'hotel',
  'taxi.missing.hotel_phone': 'hotel phone',
  'taxi.missing.room': 'room number',
  'taxi.missing.leader': 'Muthawwif contact',
  'taxi.offline': 'Offline — using the last saved card details',
  'taxi.no_group': 'You are not registered in a group yet. Contact your travel admin.',

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
  'common.back': 'Back',

  // Per-feature parts (locales/parts/*)
  ...toolsEn,
  ...monitorEn,
  ...accountEn,
  ...contentEn,
  ...prayerEn,
  ...quranEn,
};
