import { getAiGatewayKey } from "@/lib/ai-gateway";
import { Home } from "./home";

export default function Page() {
  // Read at build time, so the page stays static; on Vercel a changed key
  // needs a redeploy anyway. A key revoked later is caught by the first
  // question. Only whether it's set reaches the client.
  return <Home aiConfigured={getAiGatewayKey() !== null} />;
}
