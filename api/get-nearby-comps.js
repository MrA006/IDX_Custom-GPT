// /api/get-nearby-comps.js

import axios from 'axios';
import { getLatLngFromAddress } from '../utils/getLatLngFromAddress.js';

function normalizeStreetSuffix(addr) {
  const mapping = {
    'aly': 'Alley', 'allee': 'Alley', 'ally': 'Alley',
    'anx': 'Annex', 'annx': 'Annex', 'anex': 'Annex',
    'arc': 'Arcade',
    'ave': 'Avenue', 'av': 'Avenue', 'aven': 'Avenue', 'avenu': 'Avenue', 'avn': 'Avenue', 'avnu': 'Avenue',
    'bch': 'Beach',
    'blvd': 'Boulevard', 'boulv': 'Boulevard', 'blv': 'Boulevard',
    'br': 'Branch', 'brnch': 'Branch',
    'brg': 'Bridge', 'brdge': 'Bridge',
    'brk': 'Brook', 'brks': 'Brooks',
    'byp': 'Bypass', 'bypa': 'Bypass', 'byps': 'Bypass', 'bypas': 'Bypass',
    'ct': 'Court', 'crt': 'Court',
    'ctr': 'Center', 'cntr': 'Center',
    'cir': 'Circle', 'circ': 'Circle',
    'clfs': 'Cliffs', 'clf': 'Cliff',
    'cv': 'Cove', 'cvs': 'Coves',
    'cres': 'Crescent', 'crsent': 'Crescent',
    'dr': 'Drive', 'drv': 'Drive', 'driv': 'Drive',
    'ext': 'Extension', 'extn': 'Extension', 'extnsn': 'Extension',
    'fld': 'Field', 'flds': 'Fields',
    'frk': 'Fork', 'frks': 'Forks',
    'frd': 'Ford', 'frds': 'Fords',
    'frst': 'Forest',
    'fwy': 'Freeway', 'freewy': 'Freeway', 'frway': 'Freeway',
    'gdn': 'Garden', 'gardn': 'Garden', 'grdn': 'Garden',
    'grn': 'Green', 'grvs': 'Groves', 'grv': 'Grove',
    'hwy': 'Highway',
    'hts': 'Heights',
    'hw': 'Hill', 'hllw': 'Hollow',
    'inlt': 'Inlet',
    'is': 'Island', 'iss': 'Islands',
    'jct': 'Junction', 'jctn': 'Junction', 'jcts': 'Junctions',
    'lk': 'Lake', 'lks': 'Lakes',
    'ln': 'Lane', 'la': 'Lane',
    'lck': 'Lock',
    'lck': 'Lock', 'ldg': 'Lodge', 'lge': 'Lodge',
    'loop': 'Loop',
    'mall': 'Mall',
    'mnr': 'Manor', 'mnrs': 'Manors',
    'mt': 'Mount', 'mtn': 'Mountain', 'mtns': 'Mountains',
    'pkwy': 'Parkway', 'pkway': 'Parkway',
    'pl': 'Place', 'plza': 'Plaza', 'plz': 'Plaza',
    'pt': 'Point', 'pts': 'Points',
    'rd': 'Road', 'rds': 'Roads',
    'rte': 'Route',
    'row': 'Row',
    'sq': 'Square', 'sqr': 'Square', 'sqre': 'Square', 'sqs': 'Squares',
    'ter': 'Terrace', 'terr': 'Terrace',
    'trl': 'Trail', 'trly': 'Alley', // example correction
    'trce': 'Trace',
    'trk': 'Track', 'trak': 'Track',
    'tpke': 'Turnpike', 'tpk': 'Turnpike',
    'tunl': 'Tunnel',
    'un': 'Union',
    'valley': 'Valley', 'vly': 'Valley',
    'vlgs': 'Villages', 'vlg': 'Village', 'ville': 'Ville',
    'vis': 'Vista', 'vw': 'View', 'vws': 'Views',
    'way': 'Way',
    'wy': 'Way'
  };

  return addr.split(' ').map(word => {
    const w = word.toLowerCase().replace('.', '');
    return mapping[w] || word;
  }).join(' ');
}


export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST method is allowed' });
  }

  const {
    address,
    lat,
    lng,
    radius = 10,        // miles
    days_sold = 365,    // for Closed listings
    includeActivePending = false,
    beds,
    baths,
    sqft,
    year,
    min_price,
    max_price,
    min_sqft,
    max_sqft,
    propertyType,
    top = 10 // default to 200 results
  } = req.body;

  try {
    let subjectData = null;
    let subjectCoords = { lat, lng };

    // If address is given, fetch subject property details
    if (address) {
      // Fetch subject property by address (flexible match)
      const subjectUrl = `${process.env.REPLICATION_BASE}/Property`;
      // const subjectFilter = `contains(UnparsedAddress, '${address}') `;
      const shortAddress = address.split(',')[0]; // e.g. "5912 Cochise Trl"
      const norm = normalizeStreetSuffix(shortAddress);
      const subjectFilter = `contains(UnparsedAddress, '${norm}')`;


      const subjectSelect = [
        'ListingKey', 'UnparsedAddress', 'City', 'StateOrProvince', 'PostalCode',
        'ListPrice', 'ClosePrice', 'CloseDate', 'OnMarketDate',
        'BedroomsTotal', 'BathroomsFull', 'LivingArea','BathroomsHalf', 'BathroomsTotalInteger',
        'YearBuilt', 'LotSizeSquareFeet', 'BuildingAreaTotal', 'PoolFeatures', 'Heating', 'Cooling',
        'Sewer', 'WaterSource', 'PropertySubType', 'PropertyType','Fencing','ParkingFeatures',
        'GarageSpaces', 'FireplacesTotal',
        'SubdivisionName', 'MlsStatus', 'Latitude', 'Longitude',
        'BathroomsTotalInteger', 'Stories', 'ArchitecturalStyle',
        'PropertyCondition', 'Flooring', 'InteriorFeatures',
        'ExteriorFeatures', 'PublicRemarks',
        'DaysOnMarket'
      ];

      console.log('Subject property filter:', subjectFilter);
      const subjectRes = await axios.get(subjectUrl, {
        headers: {
          Authorization: `Bearer ${process.env.SPARK_ACCESS_TOKEN}`,
          Accept: 'application/json'
        },
        params: {
          $filter: subjectFilter,
          $top: 1,
          $select: subjectSelect.join(',')
        }
      });
      subjectData = Array.isArray(subjectRes.data.value) && subjectRes.data.value.length > 0 ? subjectRes.data.value[0] : null;

      // If subjectData is found but missing lat/lng, get from Google API
      if (subjectData && (!subjectData.Latitude || !subjectData.Longitude)) {
        const coordsFromGoogle = await getLatLngFromAddress(subjectData.UnparsedAddress || address);
        subjectData.Latitude = coordsFromGoogle.lat;
        subjectData.Longitude = coordsFromGoogle.lng;
      }

      // If subjectData exists, attempt to fetch property images from Spark Media endpoint
      if (subjectData && subjectData.ListingKey) {
        try {
          // Build Media endpoint URL for this listing
          // Example: /Property('20250609141731805387000000')/Media
          const listingKeyEscaped = encodeURIComponent(String(subjectData.ListingKey));
          const mediaUrl = `${process.env.REPLICATION_BASE}/Property('${listingKeyEscaped}')/Media`;
          const mediaRes = await axios.get(mediaUrl, {
            headers: {
              Authorization: `Bearer ${process.env.SPARK_ACCESS_TOKEN}`,
              Accept: 'application/json'
            }
          });

          // Extract MediaURL from returned media items
          const mediaItems = Array.isArray(mediaRes.data.value) ? mediaRes.data.value : [];
          const imageUrls = mediaItems
            .map(m => m && (m.MediaURL || m.MediaUrl || m.Uri || null))
            .filter(Boolean);

          subjectData.propertyImages = imageUrls;
        } catch (mediaErr) {
          console.warn('Failed to fetch subject property media:', mediaErr?.message || mediaErr);
          // Always include propertyImages (empty array) to keep response shape consistent
          subjectData.propertyImages = subjectData.propertyImages || [];
        }
      }

      // Use subjectData's lat/lng for nearby search if available
      if (subjectData && subjectData.Latitude && subjectData.Longitude) {
        subjectCoords = { lat: subjectData.Latitude, lng: subjectData.Longitude };
      } else if (!subjectCoords.lat || !subjectCoords.lng) {
        // If still missing, try Google API from address
        const coordsFromGoogle = await getLatLngFromAddress(address);
        subjectCoords = { lat: coordsFromGoogle.lat, lng: coordsFromGoogle.lng };
      }
      console.log('Subject coordinates used for nearby search:', subjectCoords);
    }

    // If no coordinates, error
    if (!subjectCoords.lat || !subjectCoords.lng) {
      return res.status(400).json({ error: 'Invalid or missing coordinates' });
    }

    // Build filters for nearby comps
    const filters = [];
    filters.push(`geo.distance(Location, geography'POINT(${subjectCoords.lng} ${subjectCoords.lat})') le ${radius}`);
    if (!includeActivePending) {
      filters.push(`MlsStatus eq 'Closed'`);
      if (days_sold) {
        const fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - days_sold);
        const isoDate = fromDate.toISOString().split('T')[0];
        filters.push(`CloseDate ge ${isoDate}`);
      }
    } else {
      filters.push(`(MlsStatus eq 'Closed' or MlsStatus eq 'Active' or MlsStatus eq 'Pending')`);
    }
    if (min_price) filters.push(`ListPrice ge ${min_price}`);
    if (max_price) filters.push(`ListPrice le ${max_price}`);
    if (min_sqft) filters.push(`LivingArea ge ${min_sqft}`);
    if (max_sqft) filters.push(`LivingArea le ${max_sqft}`);
    if (beds) filters.push(`BedroomsTotal eq ${beds}`);
    if (baths) filters.push(`BathroomsFull eq ${baths}`);
    if (sqft) filters.push(`LivingArea eq ${sqft}`);
    if (year) filters.push(`YearBuilt eq ${year}`);
    if (propertyType)
      filters.push(`PropertyType eq '${propertyType}'`);

    const url = `${process.env.REPLICATION_BASE}/Property`;
    const filterString = filters.join(' and ');
    const orderby = 'CloseDate desc';
    const topFilter = top;
    const select = [
      'ListingKey', 'UnparsedAddress', 'City', 'StateOrProvince', 'PostalCode',
      'ListPrice', 'ClosePrice', 'CloseDate',
      'BedroomsTotal', 'BathroomsFull', 'LivingArea',
      'YearBuilt', 'LotSizeSquareFeet',
      'PropertySubType', 'PropertyType',
      'SubdivisionName', 'MlsStatus', 'Latitude', 'Longitude',
      'BathroomsTotalInteger', 'Stories', 'ArchitecturalStyle',
      'PropertyCondition', 'Flooring', 'InteriorFeatures',
      'ExteriorFeatures', 'PublicRemarks'
    ];

    console.log('Nearby comps filter:', filterString);
    console.log('Spark API request:', url);
    console.log('Params:', { $filter: filterString, $orderby: orderby, $top: topFilter, $select: select.join(',') });
    const idxRes = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${process.env.SPARK_ACCESS_TOKEN}`,
        Accept: 'application/json'
      },
      params: {
        $filter: filterString,
        $orderby: orderby,
        $top: topFilter,
        $select: select.join(',')
      }
    });
    const listings = Array.isArray(idxRes.data.value) ? idxRes.data.value : [];

    // Response structure
    if (address) {
      return res.json({ subjectData, nearbyData: listings });
    } else {
      return res.json({ comps: listings });
    }
  } catch (err) {
    console.error('❗ Comps API error:', err);
    return res.status(500).json({ error: 'Failed to fetch comps', detail: err.message });
  }
}
