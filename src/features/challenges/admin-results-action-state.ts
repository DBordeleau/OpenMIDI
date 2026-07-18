export type AdminResultsActionState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export const initialAdminResultsActionState: AdminResultsActionState = {
  status: "idle",
};
