import AeroShards from "@/components/aero-shards";

export default function Home() {
  return (
    <>
      <div className="fixed inset-0 -z-10">
        <AeroShards />
      </div>
      <main className="flex flex-1 items-center justify-center text-white">
        <h1 className="text-3xl font-semibold">8-magic ball starts here :)</h1>
      </main>
    </>
  );
}
