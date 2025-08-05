require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json());

const haversineDistance = (a, b) => {
  const toRad = deg => deg * (Math.PI / 180);
  const R = 3958.8; // miles
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const aVal = Math.sin(dLat/2)**2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
};

app.post('/get-comps', async (req, res) => {
  const {
    days_sold = 180,
    min_beds, max_beds,
    min_baths, max_baths,
    min_price, max_price,
    min_sqft, max_sqft,
    min_year, max_year,
    postalCode,
    address,
    status = 'Closed'
  } = req.body;

  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days_sold);
  const isoDate = fromDate.toISOString().split('T')[0];

  let odata = [`CloseDate ge ${isoDate}`, `MlsStatus eq '${status}'`];
  if (postalCode) odata.push(`PostalCode eq '${postalCode}'`);
  if (min_beds) odata.push(`BedroomsTotal ge ${min_beds}`);
  if (max_beds) odata.push(`BedroomsTotal le ${max_beds}`);
  if (min_baths) odata.push(`BathroomsFull ge ${min_baths}`);
  if (max_baths) odata.push(`BathroomsFull le ${max_baths}`);
  if (min_price) odata.push(`ClosePrice ge ${min_price}`);
  if (max_price) odata.push(`ClosePrice le ${max_price}`);
  if (min_sqft) odata.push(`LivingArea ge ${min_sqft}`);
  if (max_sqft) odata.push(`LivingArea le ${max_sqft}`);
  if (min_year) odata.push(`YearBuilt ge ${min_year}`);
  if (max_year) odata.push(`YearBuilt le ${max_year}`);

  const url = `${process.env.REPLICATION_BASE}/Property`;
  const filterString = odata.join(' and ');

  try {
    const idxRes = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${process.env.SPARK_ACCESS_TOKEN}`,
        Accept: 'application/json'
      },
      params: {
        $filter: filterString,
        $orderby: 'CloseDate desc',
        $top: 50,
        $select: [
          'ListingKey','UnparsedAddress','StateOrProvince','PostalCode','ListPrice','ClosePrice','CloseDate',
          'BedroomsTotal','BathroomsFull','LivingArea','YearBuilt','Latitude','Longitude'
        ].join(',')
      }
    });

    let listings = Array.isArray(idxRes.data.value) ? idxRes.data.value : [];

    let comps = [];
    if (address) {
      const geoResp = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
        params: { address, key: process.env.GOOGLE_MAPS_KEY }
      });
      const { lat, lng } = geoResp.data.results[0].geometry.location;

      listings = listings.filter(p => p.Latitude && p.Longitude);

      const withDist = listings.map(p => {
        const dist = haversineDistance({ lat, lng }, { lat: p.Latitude, lng: p.Longitude });
        return { ...p, distanceMiles: dist };
      }).sort((a, b) => a.distanceMiles - b.distanceMiles);

      comps = withDist.slice(0, 3).map(p => {
        const pricePerSqft = p.LivingArea ? p.ClosePrice / p.LivingArea : null;
        const arv = p.ClosePrice ? p.ClosePrice * 1.1 : null;
        return {
          listingKey: p.ListingKey,
          address: p.UnparsedAddress,
          state: p.StateOrProvince,
          postalCode: p.PostalCode,
          closePrice: p.ClosePrice,
          listPrice: p.ListPrice,
          closeDate: p.CloseDate,
          beds: p.BedroomsTotal,
          baths: p.BathroomsFull,
          sqft: p.LivingArea,
          yearBuilt: p.YearBuilt,
          pricePerSqft: pricePerSqft ? Number(pricePerSqft.toFixed(2)) : null,
          distanceMiles: Number(p.distanceMiles.toFixed(2)),
          arv: arv ? Number(arv.toFixed(0)) : null,
          imageURL: null,
          staticMap: `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(p.UnparsedAddress)}&zoom=15&size=600x300&key=${process.env.GOOGLE_MAPS_KEY}`
        };
      });
    }

    return res.json({ comps });
  } catch (err) {
    console.error('IDX API error:', err.response?.data || err.message);
    return res.status(500).json({ error: 'Failed to fetch comps' });
  }
});

app.listen(PORT, () => {
  console.log(`✨ /get-comps listening at http://localhost:${PORT}`);
});
