import { SignInContent } from "@/app/sign-in/_components/sign-in-content";
import { SignInModal } from "@/app/sign-in/_components/sign-in-modal.client";

export default function InterceptedSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  return (
    <SignInModal presentation="intercepted">
      <SignInContent searchParams={searchParams} />
    </SignInModal>
  );
}
