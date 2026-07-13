import { StemDownloadPanel } from "@/features/exports/stem-download-panel.client";

export function MemberStemDownloads({
  endpoint,
  assetIds,
}: {
  endpoint: string;
  assetIds: string[];
}) {
  return <StemDownloadPanel endpoint={endpoint} assetIds={assetIds} />;
}
