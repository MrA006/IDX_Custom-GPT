// pages/api/get-north-carolina-24-hour.xml.js
import axios from 'axios';

// helper to escape XML special chars
function escapeXml(unsafe) {
  if (unsafe === null || unsafe === undefined) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function listingToXml(listing) {
  // map fields you want exported to Houzez-friendly tags
  // adjust tags / names as your Houzez importer expects
  const parts = [];
  parts.push('  <property>');
  parts.push(`    <ListingKey>${escapeXml(listing.ListingKey)}</ListingKey>`);
  parts.push(`    <content>${escapeXml(listing.title || listing.UnparsedAddress)}</content>`);
  parts.push(`    <title>${escapeXml(listing.title || listing.UnparsedAddress)}</title>`);
  parts.push(`    <excerpt>${escapeXml(listing.title || listing.UnparsedAddress)}</excerpt>`);
  parts.push(`    <ListPrice>${escapeXml(listing.ListPrice ?? '')}</ListPrice>`);
  parts.push(`    <ClosePrice>${escapeXml(listing.ClosePrice ?? '')}</ClosePrice>`);
  parts.push(`    <BedroomsTotal>${escapeXml(listing.BedroomsTotal ?? '')}</BedroomsTotal>`);
  parts.push(`    <BathroomsTotalInteger>${escapeXml(listing.BathroomsTotalInteger ?? listing.BathroomsFull ?? '')}</BathroomsTotalInteger>`);
  parts.push(`    <LivingArea>${escapeXml(listing.LivingArea ?? '')}</LivingArea>`);
  parts.push(`    <LotSizeSquareFeet>${escapeXml(listing.LotSizeSquareFeet ?? '')}</LotSizeSquareFeet>`);
  parts.push(`    <City>${escapeXml(listing.City ?? '')}</City>`);
  parts.push(`    <StateOrProvince>${escapeXml(listing.StateOrProvince ?? '')}</StateOrProvince>`);
  parts.push(`    <PostalCode>${escapeXml(listing.PostalCode ?? '')}</PostalCode>`);
  parts.push(`    <Latitude>${escapeXml(listing.Latitude ?? '')}</Latitude>`);
  parts.push(`    <Longitude>${escapeXml(listing.Longitude ?? '')}</Longitude>`);
  parts.push(`    <PropertyType>${escapeXml(listing.PropertyType ?? '')}</PropertyType>`);
  parts.push(`    <PropertySubType>${escapeXml(listing.PropertySubType ?? '')}</PropertySubType>`);
  parts.push(`    <MlsStatus>${escapeXml(listing.MlsStatus ?? '')}</MlsStatus>`);
  parts.push(`    <OnMarketDate>${escapeXml(listing.OnMarketDate ?? '')}</OnMarketDate>`);
  parts.push(`    <ModificationTimestamp>${escapeXml(listing.ModificationTimestamp ?? '')}</ModificationTimestamp>`);
  parts.push(`    <ListOfficeName>${escapeXml(listing.ListOfficeName ?? '')}</ListOfficeName>`);
  parts.push(`    <ListAgentFullName>${escapeXml(listing.ListAgentFullName ?? '')}</ListAgentFullName>`);
  parts.push(`    <ListAgentEmail>${escapeXml(listing.ListAgentEmail ?? '')}</ListAgentEmail>`);
  parts.push(`    <PublicRemarks>${escapeXml(listing.PublicRemarks ?? '')}</PublicRemarks>`);
  // images - output multiple <image> elements
  const images = Array.isArray(listing.propertyImages) ? listing.propertyImages : [];
  if (images.length === 0 && listing.image) {
    // fallback if your JSON uses single `image`
    images.push(listing.image);
  }
  for (const img of images) {
    parts.push(`    <image>${escapeXml(img)}</image>`);
  }

  parts.push('  </property>');
  return parts.join('\n');
}

export default async function handler(req, res) {
  try {
    // call your JSON endpoint (same app) — use absolute URL if deployed
    // if running locally, ensure BASE_URL is set, or call internal function instead.
    const base = process.env.BASE_URL || `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`;
    const jsonUrl = `${base}/api/get-north-carolina-24-hour`;

    const jsonRes = await axios.get(jsonUrl, {
      headers: { Accept: 'application/json' },
      // if your JSON endpoint requires query params (e.g. days), pass them here
      params: {}
    });

    const listings = Array.isArray(jsonRes.data.listings) ? jsonRes.data.listings : [];

    // Build XML
    const xmlParts = [];
    xmlParts.push('<?xml version="1.0" encoding="UTF-8"?>');
    xmlParts.push('<properties>');

    for (const listing of listings) {
      xmlParts.push(listingToXml(listing));
    }

    xmlParts.push('</properties>');

    const xmlString = xmlParts.join('\n');

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    // Add caching headers if you like (optional)
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    return res.status(200).send(xmlString);
  } catch (err) {
    console.error('XML feed error:', err?.response?.data || err.message || err);
    res.status(500).setHeader('Content-Type', 'application/xml').send(
      `<?xml version="1.0" encoding="UTF-8"?><error>${escapeXml(err.message || 'Failed to build XML')}</error>`
    );
  }
}
