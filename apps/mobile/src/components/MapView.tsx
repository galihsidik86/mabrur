import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

export interface MapMarker {
  lat: number;
  lng: number;
  name: string;
  color?: string;       // hex color
  icon?: string;        // emoji
  pulse?: boolean;      // animated pulse
  popup?: string;       // HTML popup content
}

export interface MapPolygon {
  coords: Array<{ lat: number; lng: number }>;
  color?: string;
  fillColor?: string;
  fillOpacity?: number;
  label?: string;
  dashArray?: string;
}

export interface MapCircle {
  lat: number;
  lng: number;
  radius: number;       // meters
  color?: string;
  fillColor?: string;
  fillOpacity?: number;
  label?: string;
}

interface Props {
  markers?: MapMarker[];
  polygons?: MapPolygon[];
  circles?: MapCircle[];
  userLocation?: { lat: number; lng: number } | null;
  center?: { lat: number; lng: number };
  zoom?: number;
  height?: number;
}

export default function MapViewComponent({
  markers = [], polygons = [], circles = [],
  userLocation, center, zoom = 15, height = 350,
}: Props) {
  const c = center || (markers.length > 0
    ? { lat: markers[0].lat, lng: markers[0].lng }
    : userLocation || { lat: 21.4225, lng: 39.8262 });

  const markersJs = markers.map((m) => {
    const popup = m.popup || m.name;
    if (m.icon) {
      return `L.marker([${m.lat},${m.lng}],{icon:L.divIcon({html:'<div style="font-size:24px;text-align:center">${m.icon}</div>',iconSize:[30,30],iconAnchor:[15,15],className:''})}).addTo(map).bindPopup('${popup.replace(/'/g, "\\'")}');`;
    }
    if (m.pulse) {
      return `(function(){var el=L.circleMarker([${m.lat},${m.lng}],{radius:8,color:'${m.color||'#8B2E2E'}',fillColor:'${m.color||'#8B2E2E'}',fillOpacity:1,className:'pulse-marker'}).addTo(map).bindPopup('${popup.replace(/'/g, "\\'")}');L.circleMarker([${m.lat},${m.lng}],{radius:18,color:'${m.color||'#8B2E2E'}',fillColor:'${m.color||'#8B2E2E'}',fillOpacity:0.2,weight:0}).addTo(map)})();`;
    }
    return `L.circleMarker([${m.lat},${m.lng}],{radius:7,color:'${m.color||'#8B2E2E'}',fillColor:'${m.color||'#8B2E2E'}',fillOpacity:0.85,weight:2}).addTo(map).bindPopup('${popup.replace(/'/g, "\\'")}');`;
  }).join('\n');

  const polygonsJs = polygons.map((p) => {
    const coords = p.coords.map((c) => `[${c.lat},${c.lng}]`).join(',');
    const opts = `{color:'${p.color||'#8B2E2E'}',fillColor:'${p.fillColor||p.color||'#8B2E2E'}',fillOpacity:${p.fillOpacity??0.15},weight:2${p.dashArray?`,dashArray:'${p.dashArray}'`:''}}`;
    let js = `L.polygon([${coords}],${opts}).addTo(map)`;
    if (p.label) js += `.bindPopup('${p.label.replace(/'/g, "\\'")}')`;
    return js + ';';
  }).join('\n');

  const circlesJs = circles.map((ci) => {
    const opts = `{radius:${ci.radius},color:'${ci.color||'#4A7C3A'}',fillColor:'${ci.fillColor||ci.color||'#4A7C3A'}',fillOpacity:${ci.fillOpacity??0.1},weight:2}`;
    let js = `L.circle([${ci.lat},${ci.lng}],${opts}).addTo(map)`;
    if (ci.label) js += `.bindPopup('${ci.label.replace(/'/g, "\\'")}')`;
    return js + ';';
  }).join('\n');

  const userJs = userLocation
    ? `L.circleMarker([${userLocation.lat},${userLocation.lng}],{radius:8,color:'#2563EB',fillColor:'#3B82F6',fillOpacity:1,weight:3}).addTo(map).bindPopup('Posisi Anda');L.circleMarker([${userLocation.lat},${userLocation.lng}],{radius:20,color:'#3B82F6',fillColor:'#3B82F6',fillOpacity:0.15,weight:0}).addTo(map);`
    : '';

  const html = `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
<style>
body{margin:0}
#map{width:100%;height:100vh}
.pulse-marker{animation:pulse 1.5s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
</style>
</head><body>
<div id="map"></div>
<script>
var map=L.map('map',{zoomControl:false}).setView([${c.lat},${c.lng}],${zoom});
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
  attribution:'© OSM',maxZoom:19}).addTo(map);
L.control.zoom({position:'bottomright'}).addTo(map);
${polygonsJs}
${circlesJs}
${markersJs}
${userJs}
<\/script>
</body></html>`;

  return (
    <View style={[styles.container, { height }]}>
      <WebView
        source={{ html }}
        style={styles.webview}
        scrollEnabled={false}
        javaScriptEnabled
        originWhitelist={['*']}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#ECE5D8' },
  webview: { flex: 1 },
});
