import { connection } from "next/server";
import { Home } from "./home";

export default async function Page() {
  // Read the key per request, not at build time, so adding or removing it
  // takes effect without a rebuild. Only whether it's set reaches the client.
  await connection();
  return <Home aiConfigured={Boolean(process.env.AI_GATEWAY_API_KEY)} />;
}
