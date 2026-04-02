// ─────────────────────────────────────────────────────────
// api/mcp.js  —  MCP Server for Comper (Streamable HTTP)
// Drop this file into your IDX_Custom-GPT/api/ folder
// alongside your existing get-comps.js and get-nearby-comps.js
// ─────────────────────────────────────────────────────────

import axios from 'axios';

const PROTOCOL_VERSION = '2024-11-05';
const SERVER_INFO = { name: 'comper-mcp', version: '1.0.0' };

// ── Tool definitions ──────────────────────────────────────
const TOOLS = [
  {
    name: 'search_property',
    description:
      'Search for a subject property by address and find nearby comparable sales (closed) from MLS data. ' +
      'Coverage: Tennessee Tri-Cities region — Kingsport, Johnson City, Bristol, Blountville, etc. ' +
      'Returns: subject property details (with photos) + nearby closed comps within the given radius and time window.',
    inputSchema: {
      type: 'object',
      properties: {
        address: {
          type: 'string',
          description: 'Full property address, e.g. "1800 Watauga St, Kingsport, TN 37664"'
        },
        radius: {
          type: 'number',
          description: 'Search radius in miles (default 10)',
          default: 10
        },
        days_sold: {
          type: 'integer',
          description: 'How many days back to look for closed sales (default 365)',
          default: 365
        },
        beds: {
          type: 'integer',
          description: 'Filter comps to exact bedroom count'
        },
        baths: {
          type: 'integer',
          description: 'Filter comps to exact full-bathroom count'
        },
        min_price: { type: 'number', description: 'Minimum list price' },
        max_price: { type: 'number', description: 'Maximum list price' },
        min_sqft: { type: 'number', description: 'Minimum living area sqft' },
        max_sqft: { type: 'number', description: 'Maximum living area sqft' },
        top: {
          type: 'integer',
          description: 'Max number of comps to return (default 10)',
          default: 10
        }
      },
      required: ['address']
    }
  },
  {
    name: 'get_comps',
    description:
      'Flexible MLS listing search with filters. Use this to find active, closed, or pending listings ' +
      'in the Tennessee Tri-Cities region. Supports filtering by status, city, ZIP, price range, size, ' +
      'year built, bed/bath count, and more. Great for market research, finding active inventory, etc.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          description: 'MLS status filter',
          enum: ['Active', 'Closed', 'Pending']
        },
        city: { type: 'string', description: 'City name, e.g. "Kingsport"' },
        postalCode: { type: 'string', description: 'ZIP code, e.g. "37664"' },
        state: { type: 'string', description: 'State abbreviation, e.g. "TN"' },
        beds: { type: 'integer', description: 'Exact bedroom count' },
        baths: { type: 'integer', description: 'Exact full-bath count' },
        min_beds: { type: 'integer', description: 'Minimum bedrooms' },
        max_beds: { type: 'integer', description: 'Maximum bedrooms' },
        min_price: { type: 'number', description: 'Minimum price' },
        max_price: { type: 'number', description: 'Maximum price' },
        min_sqft: { type: 'number', description: 'Minimum living area sqft' },
        max_sqft: { type: 'number', description: 'Maximum living area sqft' },
        min_year: { type: 'integer', description: 'Minimum year built' },
        max_year: { type: 'integer', description: 'Maximum year built' },
        days_sold: {
          type: 'integer',
          description: 'For Closed status — how many days back to include'
        },
        orderby: {
          type: 'string',
          description: 'Sort order, e.g. "CloseDate desc", "ListPrice asc"',
          default: 'CloseDate desc'
        },
        top: {
          type: 'integer',
          description: 'Max results to return (default 10)',
          default: 10
        }
      }
    }
  }
];

// ── JSON-RPC router ───────────────────────────────────────
async function handleMessage(msg) {
  // Notifications have no id — no response needed
  if (msg.id === undefined || msg.id === null) return null;

  switch (msg.method) {
    case 'initialize':
      return {
        jsonrpc: '2.0',
        id: msg.id,
        result: {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO
        }
      };

    case 'tools/list':
      return {
        jsonrpc: '2.0',
        id: msg.id,
        result: { tools: TOOLS }
      };

    case 'tools/call':
      return await executeTool(msg);

    case 'ping':
      return { jsonrpc: '2.0', id: msg.id, result: {} };

    default:
      return {
        jsonrpc: '2.0',
        id: msg.id,
        error: { code: -32601, message: `Method not found: ${msg.method}` }
      };
  }
}

// ── Tool execution ────────────────────────────────────────
async function executeTool(msg) {
  const { name, arguments: args = {} } = msg.params;

  // Resolve our own base URL so we can call sibling API routes
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.BASE_URL || 'https://idx-custom-gpt-iota.vercel.app';

  try {
    let endpoint;
    if (name === 'search_property') {
      endpoint = '/api/get-nearby-comps';
    } else if (name === 'get_comps') {
      endpoint = '/api/get-comps';
    } else {
      return {
        jsonrpc: '2.0',
        id: msg.id,
        error: { code: -32602, message: `Unknown tool: ${name}` }
      };
    }

    const response = await axios.post(`${baseUrl}${endpoint}`, args, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 25000
    });

    // Summarize the response so it's not too huge for Claude's context
    let resultText;
    if (name === 'search_property') {
      const { subjectData, nearbyData } = response.data;
      const summary = {
        subject: subjectData
          ? {
              address: subjectData.UnparsedAddress,
              city: subjectData.City,
              state: subjectData.StateOrProvince,
              zip: subjectData.PostalCode,
              listPrice: subjectData.ListPrice,
              closePrice: subjectData.ClosePrice,
              closeDate: subjectData.CloseDate,
              beds: subjectData.BedroomsTotal,
              bathsFull: subjectData.BathroomsFull,
              bathsHalf: subjectData.BathroomsHalf,
              sqft: subjectData.LivingArea,
              lotSqft: subjectData.LotSizeSquareFeet,
              yearBuilt: subjectData.YearBuilt,
              stories: subjectData.Stories,
              style: subjectData.ArchitecturalStyle,
              condition: subjectData.PropertyCondition,
              type: subjectData.PropertyType,
              subType: subjectData.PropertySubType,
              subdivision: subjectData.SubdivisionName,
              status: subjectData.MlsStatus,
              dom: subjectData.DaysOnMarket,
              heating: subjectData.Heating,
              cooling: subjectData.Cooling,
              parking: subjectData.ParkingFeatures,
              garageSpaces: subjectData.GarageSpaces,
              pool: subjectData.PoolFeatures,
              flooring: subjectData.Flooring,
              interiorFeatures: subjectData.InteriorFeatures,
              exteriorFeatures: subjectData.ExteriorFeatures,
              remarks: subjectData.PublicRemarks,
              images: subjectData.propertyImages || [],
              lat: subjectData.Latitude,
              lng: subjectData.Longitude
            }
          : null,
        comps: (nearbyData || []).map(c => ({
          address: c.UnparsedAddress,
          city: c.City,
          zip: c.PostalCode,
          listPrice: c.ListPrice,
          closePrice: c.ClosePrice,
          closeDate: c.CloseDate,
          beds: c.BedroomsTotal,
          baths: c.BathroomsTotalInteger || c.BathroomsFull,
          sqft: c.LivingArea,
          lotSqft: c.LotSizeSquareFeet,
          yearBuilt: c.YearBuilt,
          style: c.ArchitecturalStyle,
          condition: c.PropertyCondition,
          status: c.MlsStatus,
          lat: c.Latitude,
          lng: c.Longitude
        })),
        compCount: (nearbyData || []).length
      };
      resultText = JSON.stringify(summary, null, 2);
    } else {
      // get_comps — return trimmed listing data
      const comps = (response.data.comps || []).map(c => ({
        address: c.UnparsedAddress,
        city: c.City,
        zip: c.PostalCode,
        listPrice: c.ListPrice,
        closePrice: c.ClosePrice,
        closeDate: c.CloseDate,
        beds: c.BedroomsTotal,
        baths: c.BathroomsFull,
        sqft: c.LivingArea,
        yearBuilt: c.YearBuilt,
        lotSqft: c.LotSizeSquareFeet,
        type: c.PropertySubType,
        status: c.MlsStatus,
        lat: c.Latitude,
        lng: c.Longitude
      }));
      resultText = JSON.stringify({ comps, count: comps.length }, null, 2);
    }

    return {
      jsonrpc: '2.0',
      id: msg.id,
      result: {
        content: [{ type: 'text', text: resultText }]
      }
    };
  } catch (err) {
    console.error(`MCP tool error [${name}]:`, err.message);
    return {
      jsonrpc: '2.0',
      id: msg.id,
      result: {
        content: [
          {
            type: 'text',
            text: `Error calling ${name}: ${err.response?.data?.error || err.message}`
          }
        ],
        isError: true
      }
    };
  }
}

// ── Vercel handler ────────────────────────────────────────
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, mcp-session-id');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method === 'DELETE') return res.status(200).end();

  // GET = SSE stream — not needed for stateless Streamable HTTP
  if (req.method === 'GET') {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    // Send an initial comment to keep connection alive
    res.write(': connected\n\n');
    // For stateless Vercel, we just end — no persistent SSE
    return res.end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Method not allowed' }
    });
  }

  // Handle single or batch JSON-RPC messages
  const isBatch = Array.isArray(req.body);
  const messages = isBatch ? req.body : [req.body];
  const responses = [];

  for (const msg of messages) {
    const result = await handleMessage(msg);
    if (result) responses.push(result);
  }

  // No responses needed (all notifications)
  if (responses.length === 0) return res.status(202).end();

  // Return single or batch
  res.setHeader('Content-Type', 'application/json');
  if (isBatch) return res.json(responses);
  return res.json(responses[0]);
}