import { resolveInstantRouteError } from "@/lib/server/instant-error-response";
import {
  InstantAuthError,
  InstantRouteBadRequestError,
  InstantRouteNotFoundError,
} from "@/lib/server/instant-errors";

describe("resolveInstantRouteError", () => {
  it("maps auth errors to 401", () => {
    expect(resolveInstantRouteError(new InstantAuthError())).toEqual({
      status: 401,
      payload: { error: "Authentication required." },
    });
  });

  it("maps bad request errors to 400", () => {
    expect(resolveInstantRouteError(new InstantRouteBadRequestError("bad input"))).toEqual({
      status: 400,
      payload: { error: "bad input" },
    });
  });

  it("maps not-found errors to 404", () => {
    expect(resolveInstantRouteError(new InstantRouteNotFoundError("missing"))).toEqual({
      status: 404,
      payload: { error: "missing" },
    });
  });

  it("maps unexpected errors to safe 500 response", () => {
    expect(resolveInstantRouteError(new Error("INSTANT_ADMIN_TOKEN missing"))).toEqual({
      status: 500,
      payload: { error: "Unexpected server error." },
    });
  });
});