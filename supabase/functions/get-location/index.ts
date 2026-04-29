/**
 * Get Location Edge Function
 * 
 * Returns the user's location based on Cloudflare geolocation headers.
 * These headers are automatically provided by Deno Deploy/Supabase Edge.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Cloudflare/Deno Deploy provides these headers automatically
    // See: https://developers.cloudflare.com/workers/runtime-apis/request/#incomingrequestcfproperties
    const city = req.headers.get("cf-ipcity") || 
                 req.headers.get("x-vercel-ip-city") ||
                 null;
    
    const region = req.headers.get("cf-region") || 
                   req.headers.get("cf-region-code") ||
                   req.headers.get("x-vercel-ip-country-region") ||
                   null;
    
    const countryCode = req.headers.get("cf-ipcountry") ||
                        req.headers.get("x-vercel-ip-country") ||
                        null;
    
    const latitude = req.headers.get("cf-iplatitude") ||
                     req.headers.get("x-vercel-ip-latitude") ||
                     null;
    
    const longitude = req.headers.get("cf-iplongitude") ||
                      req.headers.get("x-vercel-ip-longitude") ||
                      null;

    // Format location string
    let location = null;
    if (city && region) {
      location = `${city}, ${region}`;
    } else if (city && countryCode) {
      location = `${city}, ${countryCode}`;
    } else if (city) {
      location = city;
    }

    return new Response(
      JSON.stringify({
        city,
        region,
        country_code: countryCode ? countryCode.toUpperCase() : null,
        country_name: null,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        location, // Formatted string ready for display
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error getting location:", error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || "Failed to get location",
        city: null,
        region: null,
        country_code: null,
        country_name: null,
        location: null
      }),
      { 
        status: 200, // Return 200 with null values instead of error
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
