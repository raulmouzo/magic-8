import "server-only";

// The only place that reads the key. `server-only` fails the build if a
// Client Component imports this, so the key can't end up in the browser.
export const getAiGatewayKey = () => process.env.AI_GATEWAY_API_KEY || null;
