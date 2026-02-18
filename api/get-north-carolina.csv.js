// pages/api/get-north-carolina.csv.js

import axios from 'axios';

const HEADERS = [
  'ListingKey', 'Post Title', 'Post Content', 'Post Excerpt',
  'ListPrice', 'BedroomsTotal', 'BathroomsTotalInteger', 'LivingArea',
  'LotSizeSquareFeet', 'City', 'StateOrProvince', 'PostalCode',
  'Latitude', 'Longitude', 'PropertyType', 'PropertySubType',
  'MlsStatus', 'OnMarketDate', 'ListOfficeName', 'ListAgentFullName',
  'ListAgentEmail', 'PublicRemarks', 'Images'
];

function escapeCSV(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

export default async function handler(req, res) {
  try {
    const base = process.env.BASE_URL || `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`;
    const jsonRes = await axios.get(`${base}/api/get-north-carolina-24-hour`, {
      headers: { Accept: 'application/json' }
    });

    const listings = Array.isArray(jsonRes.data.listings) ? jsonRes.data.listings : [];

    const rows = [HEADERS.join(',')];

    for (const l of listings) {
      const title = l.title || l.UnparsedAddress || '';
      const images = Array.isArray(l.propertyImages) ? l.propertyImages.join('|') : (l.image || '');

      const row = [
        l.ListingKey, title, l.PublicRemarks, l.PublicRemarks,
        l.ListPrice, l.BedroomsTotal, l.BathroomsTotalInteger ?? l.BathroomsFull,
        l.LivingArea, l.LotSizeSquareFeet, l.City, l.StateOrProvince,
        l.PostalCode, l.Latitude, l.Longitude, l.PropertyType,
        l.PropertySubType, l.MlsStatus, l.OnMarketDate, l.ListOfficeName,
        l.ListAgentFullName, l.ListAgentEmail, l.PublicRemarks, images
      ].map(escapeCSV);

      rows.push(row.join(','));
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="north-carolina.csv"');
    return res.status(200).send(rows.join('\n'));

  } catch (err) {
    console.error(err);
    return res.status(500).send('Error generating CSV');
  }
}