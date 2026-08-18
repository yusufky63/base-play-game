const serviceId = process.env.RENDER_SERVICE_ID;
const apiKey = process.env.RENDER_API_KEY;

if (!serviceId || !apiKey) {
  throw new Error("Set RENDER_SERVICE_ID and RENDER_API_KEY before deploying to Render.");
}

const response = await fetch(`https://api.render.com/v1/services/${serviceId}/deploys`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    Accept: "application/json"
  },
  body: JSON.stringify({ clearCache: "do_not_clear" })
});

const body = await response.text();

if (!response.ok) {
  throw new Error(`Render deploy failed: ${response.status} ${body}`);
}

console.log(body);
