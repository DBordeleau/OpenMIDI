import { Container } from "@/components/layout/container";
import { Reveal } from "@/components/ui/reveal.client";
import { requireViewer } from "@/features/auth/guards";
import { AssetVerificationStatus } from "@/features/assets/asset-verification-status";
import { SourceUpload } from "@/features/assets/source-upload";
import { sourceVerificationFailureMessage } from "@/features/assets/types";
import { CreditConfirmationForm } from "@/features/assets/credit-confirmation-form";
import { listOwnedSourceAssets } from "@/server/repositories/assets";

export default async function UploadsPage() {
  await requireViewer("/uploads");
  const assets = await listOwnedSourceAssets();
  return (
    <main id="main-content">
      <Container className="py-12 sm:py-16">
        <Reveal>
          <p className="text-accent-2 font-mono text-xs font-semibold tracking-[0.2em] uppercase">
            Your source library
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-[-0.02em] sm:text-5xl">
            My uploads
          </h1>
          <p className="text-muted mt-3 max-w-2xl text-lg">
            Private, immutable source audio reserved against your storage quota.
          </p>
        </Reveal>
        <Reveal delay={0.08} className="mt-8">
          <SourceUpload />
        </Reveal>
        <Reveal delay={0.14} className="mt-10">
          <h2 className="text-xl font-semibold">Recent uploads</h2>
          <ul className="mt-4 space-y-3">
            {assets.map((asset) => (
              <li
                className="rounded-card border-subtle bg-surface border p-4"
                key={asset.id}
              >
                <div className="flex justify-between gap-4">
                  <span className="truncate font-medium">{asset.filename}</span>
                  <span className="text-muted capitalize">{asset.status}</span>
                </div>
                {asset.status === "ready" && (
                  <>
                    <p className="text-muted mt-1 text-sm">
                      {asset.mediaType} · {asset.byteSize?.toLocaleString()}{" "}
                      bytes · {asset.durationMs} ms · {asset.sampleRateHz} Hz ·{" "}
                      {asset.channels} ch
                    </p>
                    {asset.creditsConfirmedAt ? (
                      <p className="text-accent-2 mt-2 text-sm">
                        Credits confirmed:{" "}
                        {asset.credits
                          .map(
                            (credit) => `${credit.creditName} (${credit.role})`,
                          )
                          .join(", ")}
                      </p>
                    ) : (
                      <CreditConfirmationForm
                        assetId={asset.id}
                        suggestedName={
                          asset.credits[0]?.creditName ?? "Your credit name"
                        }
                      />
                    )}
                  </>
                )}
                {asset.status === "processing" && (
                  <AssetVerificationStatus assetId={asset.id} />
                )}
                {asset.failureCode && (
                  <p className="text-danger mt-1 text-sm">
                    {sourceVerificationFailureMessage(asset.failureCode)}
                  </p>
                )}
              </li>
            ))}
            {assets.length === 0 && (
              <li className="text-muted">No uploads yet.</li>
            )}
          </ul>
        </Reveal>
      </Container>
    </main>
  );
}
