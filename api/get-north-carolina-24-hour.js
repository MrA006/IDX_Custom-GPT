// /api/get-recent-nc-listings.js

import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const top = 5;
  
  const filters = [];
  const now = new Date();
  const twoMinutesAgo = new Date(now.getTime() - 24 * 60 * 60 * 60 * 1000);
  const isoDate = twoMinutesAgo.toISOString(); // e.g., "2025-11-09T19:58:00.000Z"

  filters.push(`ModificationTimestamp ge ${isoDate}`);
  filters.push(`StateOrProvince eq 'NC'`);
  filters.push(`MlsStatus eq 'active'`);

  // filters.push(`ModificationTimestamp ge ${isoTimestamp}`);
  // filters.push(`OnMarketDate ge ${isoDate}`);

  const filterString = filters.join(' and ');
  const url = `${process.env.REPLICATION_BASE}/Property`;

  try {
    const idxRes = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${process.env.SPARK_ACCESS_TOKEN}`,
        Accept: 'application/json'
      },
      params: {
        $filter: filterString,
        $top: top,
        $orderby: 'ModificationTimestamp desc',
        $select: [
          'ListingKey',
          'UnparsedAddress',
          'City',
          'StateOrProvince',
          'PostalCode',
          'ListPrice',
          'ClosePrice',
          'OnMarketDate',
          'CloseDate',
          'BedroomsTotal',
          'BathroomsFull',
          'BathroomsHalf',
          'BathroomsTotalInteger',
          'LivingArea',
          'LotSizeSquareFeet',
          'YearBuilt',
          'PropertySubType',
          'PropertyType',
          'SubdivisionName',
          'PropertyCondition',
          'ParkingFeatures',
          'GarageSpaces',
          'MlsStatus',
          'Latitude',
          'Longitude',
          'PublicRemarks',
          'VirtualTourURLUnbranded',
          'ListAgentFullName', 
          'ListAgentEmail',    
          'ListOfficeName',
          'ModificationTimestamp'
        ].join(',')
      }
    });

    const listings = Array.isArray(idxRes.data.value)
      ? idxRes.data.value
      : [];

    // 🔥 FETCH MEDIA FOR EACH LISTING
    for (let listing of listings) {
      try {
        const listingKeyEscaped = encodeURIComponent(
          String(listing.ListingKey)
        );

        const mediaUrl = `${process.env.REPLICATION_BASE}/Property('${listingKeyEscaped}')/Media`;

        const mediaRes = await axios.get(mediaUrl, {
          headers: {
            Authorization: `Bearer ${process.env.SPARK_ACCESS_TOKEN}`,
            Accept: 'application/json'
          }
        });

        const mediaItems = Array.isArray(mediaRes.data.value)
          ? mediaRes.data.value
          : [];

        const imageUrls = mediaItems
          .map(m => m && (m.MediaURL || m.Uri || null))
          .filter(Boolean);

        listing.propertyImages = imageUrls;
      } catch (mediaErr) {
        console.warn(
          `Media fetch failed for ${listing.ListingKey}`
        );
        listing.propertyImages = [];
      }

      // ✅ Add Title for WP / Houzez
      listing.title = listing.UnparsedAddress
        ? `${listing.UnparsedAddress}, ${listing.City}`
        : `Listing ${listing.ListingKey}`;
    }

    return res.json({ listings });

  } catch (err) {
    console.error(
      'IDX API error:',
      err.response?.data || err.message
    );

    return res.status(500).json({
      error: 'Failed to fetch listings',
      detail: err.response?.data || err.message
    });
  }
}
