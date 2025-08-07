import express from 'express';
import dotenv from 'dotenv';
import handler from './api/get-comps.js';
import getStaticMap from './api/map/get-static.js';
import getStreetView from './api/map/get-street-view.js';
import StaticProxy from './api/map/proxy-static.js';
import StreetViewProxy from './api/map/proxy-street-view.js';
import getNearestComps from './api/get-nearby-comps.js';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// 🏠 Main comps endpoint
app.post('/get-comps', (req, res) => {
  handler(req, res);
});

// 🗺️ Static Map endpoint
app.get('/api/map/get-static', (req, res) => {
  getStaticMap(req, res);
});

// 🚶 Street View endpoint
app.get('/api/map/get-street-view', (req, res) => {
  getStreetView(req, res);
});


// 🚶 Proxy Static View endpoint
app.get('/api/map/proxy-static', (req, res) => {
  StaticProxy(req, res);
});



// 🚶 Street View endpoint
app.get('/api/map/proxy-street-view', (req, res) => {
  StreetViewProxy(req, res);
});

// Top nearest comps
app.post('/api/get-nearby-comps', (req, res) => {
  getNearestComps(req, res);
});

app.listen(PORT, () => {
  console.log(`🔥 Local API running at:`);
  console.log(`→ http://localhost:${PORT}/get-comps`);
  console.log(`→ http://localhost:${PORT}/api/map/get-static`);
  console.log(`→ http://localhost:${PORT}/api/map/get-street-view`);
  console.log(`→ http://localhost:${PORT}/api/get-nearest-comps`);
});
