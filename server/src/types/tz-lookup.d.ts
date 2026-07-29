// tz-lookup tidak menyertakan tipe. Fungsi tunggal: (lat, lon) → nama zona IANA.
declare module 'tz-lookup' {
  const tzlookup: (lat: number, lon: number) => string;
  export default tzlookup;
}
