import { useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

interface Marker {
  lat: number;
  lng: number;
  name: string;
  color?: string;
}

interface Props {
  markers: Marker[];
  center?: { lat: number; lng: number };
  zoom?: number;
  height?: number;
}

export default function MapViewComponent({ markers, center, zoom = 13, height = 300 }: Props) {
  const c = center || (markers.length > 0 ? { lat: markers[0].lat, lng: markers[0].lng } : { lat: 21.4225, lng: 39.8262 });

  const markersJs = markers.map((m) =>
    `L.circleMarker([${m.lat},${m.lng}],{radius:8,color:'${m.color || '#8B2E2E'}',fillColor:'${m.color || '#8B2E2E'}',fillOpacity:0.8}).addTo(map).bindPopup('${m.name.replace(/'/g, "\\'")}');`
  ).join('\n');

  const html = `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>body{margin:0}#map{width:100%;height:100vh}</style>
</head><body>
<div id="map"></div>
<script>
var map=L.map('map').setView([${c.lat},${c.lng}],${zoom});
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
  attribution:'© OpenStreetMap',maxZoom:19}).addTo(map);
${markersJs}
</script>
</body></html>`;

  return (
    <View style={[styles.container, { height }]}>
      <WebView
        source={{ html }}
        style={styles.webview}
        scrollEnabled={false}
        javaScriptEnabled
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#ECE5D8' },
  webview: { flex: 1 },
});
