import axios from 'axios';
import { getLatLngFromAddress } from '../../utils/getLatLngFromAddress.js';

export default async function handler(req, res) {
  const { address, lat, lng } = req.query || req.body || {};
  console.log('📍 Street View Request:', { address, lat, lng });

  if (!address && !(lat && lng)) {
    return res.status(400).json({ error: 'Missing address and lat/lng both' });
  }

  try {
    const coords = lat && lng ? { lat, lng } : await getLatLngFromAddress(address);
    if (!coords  || !coords.lat || !coords.lng) {
      return res.status(400).json({ error: 'Could not resolve coordinates from address' });
    }

    const metadataURL = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${coords.lat},${coords.lng}&key=${process.env.GOOGLE_MAPS_KEY}`;
    const metadataResp = await axios.get(metadataURL);

    if (metadataResp.data.status !== 'OK') {
      console.warn('❌ No Street View available');
      return res.status(404).json({ streetViewAvailable: false });
    }

    const streetViewUrl = `https://maps.googleapis.com/maps/api/streetview?location=${coords.lat},${coords.lng}&size=600x300&key=${process.env.GOOGLE_MAPS_KEY}`;
    const imageResp = await fetch(streetViewUrl);

    if (!imageResp.ok) {
      console.warn('❌ Failed to fetch Street View image');
      return res.status(404).json({ streetViewAvailable: false });
    }

    res.setHeader('Content-Type', 'image/jpeg');
    const buffer = await imageResp.arrayBuffer();
    return res.send(Buffer.from(buffer));

  } catch (err) {
    console.error('❗ Street View Error:', err);
    return res.status(500).json({ error: 'Failed to fetch street view' });
  }
}
