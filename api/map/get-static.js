// /api/map/get-static.js
import { getLatLngFromAddress } from '../../utils/getLatLngFromAddress.js';

export default async function handler(req, res) {
  const { address, lat, lng } = req.body;

  try {
    let coords = lat && lng ? { lat, lng } : await getLatLngFromAddress(address);
    if (!coords) return res.json({ staticMapUrl: null });

    const staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${coords.lat},${coords.lng}&zoom=15&size=600x300&markers=color:red|label:A|${coords.lat},${coords.lng}&key=${process.env.GOOGLE_MAPS_KEY}`;
    
    return res.json({ staticMapUrl });
  } catch (err) {
    console.error(err);
    return res.json({ staticMapUrl: null });
  }
}
