import express from 'express';
import dotenv from 'dotenv';
import handler from './api/get-comps.js';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Wrap the Vercel-style handler for local usage
app.post('/get-comps', (req, res) => {
  handler(req, res);
});

app.listen(PORT, () => {
  console.log(`🔥 Local API running at http://localhost:${PORT}/get-comps`);
});
