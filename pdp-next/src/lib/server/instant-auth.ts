import { getInstantAdmin } from "@/lib/instantdb/admin";

export async function requireInstantUser(request: Request) {
  const user = await getInstantAdmin().auth.getUserFromRequest(request);

  if (!user) {
    throw new InstantAuthError();
  }

  return user;
}

export class InstantAuthError extends Error {
  constructor(message = "Authentication required.") {
    super(message);
    this.name = "InstantAuthError";
  }
}