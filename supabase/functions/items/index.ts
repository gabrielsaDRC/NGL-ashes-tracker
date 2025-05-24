import { corsHeaders } from '../_shared/cors.ts';

interface ItemResponse {
  items: Array<{
    itemName: string;
    description: string;
    level: number;
    rarityMin: string;
    rarityMax: string;
    displayIcon: string;
    guid: string;
  }>;
  total: number;
  page: number;
  perPage: number;
}

Deno.serve(async (req) => {
  try {
    // Handle CORS
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders,
      });
    }

    const url = new URL(req.url);
    const page = url.searchParams.get('page') || '1';
    const perPage = url.searchParams.get('per_page') || '30';
    const itemType = url.searchParams.get('itemType') || 'resource';

    // Construct the Ashes Codex API URL
    const apiUrl = `https://api.ashescodex.com/items?itemType=${itemType}&page=${page}&per_page=${perPage}&sortColumn=name&sortDir=asc`;

    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API responded with status ${response.status}`);
    }

    const data: ItemResponse = await response.json();

    // Transform the data to match our frontend needs
    const transformedData = {
      items: data.items.map(item => ({
        id: item.guid,
        name: item.itemName,
        description: item.description,
        level: item.level,
        rarity: item.rarityMin,
        maxRarity: item.rarityMax,
        icon: item.displayIcon,
      })),
      total: data.total,
      page: data.page,
      perPage: data.perPage,
    };

    return new Response(JSON.stringify(transformedData), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error fetching items:', error);
    
    return new Response(
      JSON.stringify({
        error: 'Failed to fetch items',
        details: error.message,
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});