import express from 'express';
import dotenv from 'dotenv';
import handler from './api/get-comps.js';
import getNCRecent from './api/get-north-carolina-24-hour.js';
// import getStaticMap from './api/map/get-static.js';
// import getStreetView from './api/map/get-street-view.js';
// import StaticProxy from './api/map/proxy-static.js';
// import StreetViewProxy from './api/mkap/proxy-street-view.js';
import getNearestComps from './api/get-nearby-comps.js';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// 🏠 Main comps endpoint
app.post('/get-comps', handler);

// // 🗺️ Static Map endpoint
// app.get('/api/map/get-static', getStaticMap);

// // 🚶 Street View endpoint
// app.get('/api/map/get-street-view', getStreetView);

// // 🧭 Proxy Static Map endpoint
// app.get('/api/map/proxy-static', StaticProxy);

// // 🚶 Proxy Street View endpoint
// app.get('/api/map/proxy-street-view', StreetViewProxy);

// 📍 Nearby comps endpoint
app.post('/api/get-nearby-comps', getNearestComps);

// 🏷️ NC — recent 24-hour listings
app.post('/api/get-north-carolina-24-hour', getNCRecent);

// 🧰 Error handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err);
  res.status(500).json({ error: 'Internal Server Error', details: err.message });
});

app.listen(PORT, () => {
  console.log(`🔥 Local API running at:`);
  console.log(`→ http://localhost:${PORT}/get-comps`);
  console.log(`→ http://localhost:${PORT}/api/map/get-static`);
  console.log(`→ http://localhost:${PORT}/api/map/get-street-view`);
  console.log(`→ http://localhost:${PORT}/api/map/proxy-static`);
  console.log(`→ http://localhost:${PORT}/api/map/proxy-street-view`);
  console.log(`→ http://localhost:${PORT}/api/get-nearby-comps`);
  console.log(`→ http://localhost:${PORT}/api/get-north-carolina-24-hour`);
});
