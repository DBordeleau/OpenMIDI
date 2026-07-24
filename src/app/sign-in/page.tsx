import { SignInContent } from "./_components/sign-in-content";
import { SignInModal } from "./_components/sign-in-modal.client";

export default function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  return (
    <main id="main-content">
      <SignInModal presentation="direct">
        <SignInContent searchParams={searchParams} />
      </SignInModal>
    </main>
  );
}
