import { getInstantAdmin } from "@/lib/instantdb/admin";
import { InstantAuthError } from "@/lib/server/instant-errors";

export { InstantAuthError } from "@/lib/server/instant-errors";

export async function requireInstantUser(request: Request) {
  const user = await getInstantAdmin().auth.getUserFromRequest(request);

  if (!user) {
    throw new InstantAuthError();
  }

  return user;
}
