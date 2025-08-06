// /api/map/get-street-view.js
import axios from 'axios';
import { getLatLngFromAddress } from '../../utils/getLatLngFromAddress.js';

export default async function handler(req, res) {
  const { address, lat, lng } = req.body;

  try {
    let coords = lat && lng ? { lat, lng } : await getLatLngFromAddress(address);
    if (!coords) return res.json({ streetViewUrl: null });

    const metadataURL = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${coords.lat},${coords.lng}&key=${process.env.GOOGLE_MAPS_KEY}`;
    const metadataResp = await axios.get(metadataURL);

    if (metadataResp.data.status !== 'OK') {
      return res.json({ streetViewUrl: null });
    }

    const streetViewUrl = `https://maps.googleapis.com/maps/api/streetview?location=${coords.lat},${coords.lng}&size=600x300&key=${process.env.GOOGLE_MAPS_KEY}`;
    return res.json({ streetViewUrl });
  } catch (err) {
    console.error(err);
    return res.json({ streetViewUrl: null });
  }
}
