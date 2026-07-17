export function projectRevisionComparisonUrl(input: {
  projectId: string;
  from: string;
  to: string;
}) {
  const params = new URLSearchParams({ from: input.from, to: input.to });
  return `/projects/${input.projectId}/revisions/compare?${params.toString()}`;
}
