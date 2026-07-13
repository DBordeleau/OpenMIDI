import { requireViewer } from "@/features/auth/guards";
import { SourceUpload } from "@/features/assets/source-upload";
import { listOwnedSourceAssets } from "@/server/repositories/assets";
export default async function UploadsPage() {
  await requireViewer("/uploads");
  const assets = await listOwnedSourceAssets();
  return (
    <main className="mx-auto max-w-4xl px-5 py-12">
      <h1 className="text-3xl font-bold">My uploads</h1>
      <p className="mt-2 text-zinc-300">
        Private, immutable source audio reserved against your storage quota.
      </p>
      <div className="mt-8">
        <SourceUpload />
      </div>
      <h2 className="mt-10 text-xl font-semibold">Recent uploads</h2>
      <ul className="mt-4 space-y-3">
        {assets.map((asset) => (
          <li className="rounded-xl border border-white/10 p-4" key={asset.id}>
            <div className="flex justify-between gap-4">
              <span className="truncate font-medium">{asset.filename}</span>
              <span className="capitalize">{asset.status}</span>
            </div>
            {asset.status === "ready" && (
              <p className="mt-1 text-sm text-zinc-400">
                {asset.mediaType} · {asset.byteSize?.toLocaleString()} bytes ·{" "}
                {asset.durationMs} ms · {asset.sampleRateHz} Hz ·{" "}
                {asset.channels} ch
              </p>
            )}
            {asset.status === "processing" && (
              <p className="mt-1 text-sm text-zinc-400">
                Uploaded; awaiting trusted verification.
              </p>
            )}
            {asset.failureCode && (
              <p className="mt-1 text-sm text-red-300">
                {asset.failureCode.replaceAll("_", " ")}
              </p>
            )}
          </li>
        ))}
        {assets.length === 0 && (
          <li className="text-zinc-400">No uploads yet.</li>
        )}
      </ul>
    </main>
  );
}
