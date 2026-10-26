import React from 'react';
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { validCoordinates, type Coordinates } from '@/features/location/locationService';
import { MAP_ATTRIBUTION, MAP_DEFAULT, MAP_TILES } from './mapConfig';

export interface MapPickerProps { location?: Coordinates; onLocationChange(coords: Coordinates): void; disabled?: boolean; height?: number; centerRequest?: number }
// A Leaflet WebView avoids requiring a Google Maps key or billing on Android.
const documentHtml = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="strict-origin-when-cross-origin"><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin=""><style>html,body,#map{height:100%;margin:0;background:#dce5d7}.leaflet-control-zoom a{width:48px;height:48px;line-height:48px;font-size:26px;color:#15231c;background:#fffef4}</style></head><body><div id="map"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script><script>
const send = value => window.ReactNativeWebView.postMessage(JSON.stringify(value));
if(!window.L) send({type:'error'}); else {
const map = L.map('map',{worldCopyJump:true}).setView([${MAP_DEFAULT.lat},${MAP_DEFAULT.lng}],5);
L.tileLayer(${JSON.stringify(MAP_TILES)},{maxZoom:19,attribution:${JSON.stringify(MAP_ATTRIBUTION)},updateWhenIdle:true,keepBuffer:1}).on('loading',()=>send({type:'tiles',loading:true})).on('load',()=>send({type:'tiles',loading:false})).on('tileerror',()=>send({type:'error'})).addTo(map);
let marker, disabled=false;
const select = point => { if(!disabled) send({type:'pin',lat:point.lat,lng:point.wrap().lng}); };
window.updatePin = (point,locked) => { disabled=locked; if(!point){if(marker)map.removeLayer(marker);marker=null;return;} if(!marker){marker=L.marker([point.lat,point.lng],{draggable:!disabled}).on('dragend',()=>select(marker.getLatLng())).addTo(map);}else marker.setLatLng([point.lat,point.lng]);if(disabled)marker.dragging.disable();else marker.dragging.enable();if(!map.getBounds().pad(-0.2).contains([point.lat,point.lng])||map.getZoom()<10)map.setView([point.lat,point.lng],Math.max(13,map.getZoom()));};
window.selectCenter = () => select(map.getCenter());
window.centerPin = () => { if(marker)map.setView(marker.getLatLng(),15);else map.setView([-30.5595,22.9375],5); };
map.on('click',event=>select(event.latlng));send({type:'ready'});
}
</script></body></html>`;
export function MapPicker({ location, onLocationChange, disabled = false, height = 300, centerRequest = 0 }: MapPickerProps) {
  const ref = React.useRef<WebView>(null);
  const [ready, setReady] = React.useState(false);
  const [tilesLoading, setTilesLoading] = React.useState(true);
  const [error, setError] = React.useState('');
  const [attempt, retry] = React.useReducer(value => value + 1, 0);
  React.useEffect(() => { if (ready) ref.current?.injectJavaScript(`window.updatePin && window.updatePin(${JSON.stringify(validCoordinates(location) ? location : null)},${disabled});true;`); }, [location, disabled, ready]);
  React.useEffect(() => { if (ready && centerRequest) ref.current?.injectJavaScript('window.centerPin && window.centerPin();true;'); }, [centerRequest, ready]);
  React.useEffect(() => { const timer = setTimeout(() => { if (!ready || tilesLoading) setError('The map could not load. Check your connection or enter coordinates.'); }, 15000); return () => clearTimeout(timer); }, [ready, tilesLoading, attempt]);
  return <View style={{ gap: 8 }}>
    <View style={{ height, borderRadius: 16, overflow: 'hidden' }}><WebView key={attempt} ref={ref} source={{ html: documentHtml }} originWhitelist={['*']} applicationNameForUserAgent="WeedGrow/1.0" javaScriptEnabled domStorageEnabled setSupportMultipleWindows={false} onShouldStartLoadWithRequest={request => { if (request.url === 'about:blank' || request.url.startsWith('about:blank#')) return true; if (request.url.startsWith('https://www.openstreetmap.org/copyright')) void Linking.openURL(request.url); return false; }} onError={() => setError('The map could not load. Retry or enter coordinates.')} onMessage={event => { try { const data = JSON.parse(event.nativeEvent.data); if (data.type === 'ready') setReady(true); else if (data.type === 'tiles') setTilesLoading(data.loading === true); else if (data.type === 'error') setError('Some map tiles could not load. Retry or enter coordinates.'); else if (data.type === 'pin' && !disabled && validCoordinates(data)) onLocationChange({ lat: data.lat, lng: data.lng }); } catch { /* Ignore unrecognised bridge messages. */ } }} />{(!ready || tilesLoading) && !error && <View pointerEvents="none" accessibilityLiveRegion="polite" style={{ position: 'absolute', top: 12, right: 12, padding: 10, borderRadius: 10, backgroundColor: '#1c2c22', flexDirection: 'row', gap: 8 }}><ActivityIndicator size="small" color="#d2e4a2" /><Text style={{ color: '#edf0e3', fontSize: 13 }}>{ready ? 'Loading map imagery…' : 'Opening map…'}</Text></View>}</View>
    {!!error && <><Text accessibilityRole="alert" style={{ color: '#f0bb8b' }}>{error}</Text><Pressable accessibilityRole="button" disabled={disabled} onPress={() => { setReady(false); setTilesLoading(true); setError(''); retry(); }} style={{ padding: 12 }}><Text style={{ color: '#d2e4a2' }}>Retry map</Text></Pressable></>}
    <Pressable accessibilityRole="button" disabled={!ready || disabled} onPress={() => ref.current?.injectJavaScript('window.selectCenter && window.selectCenter();true;')} style={{ minHeight: 48, paddingVertical: 12 }}><Text style={{ color: '#d2e4a2' }}>Place pin at map center</Text></Pressable>
  </View>;
}
