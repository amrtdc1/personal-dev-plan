import {
  InstantAuthError,
  InstantRouteBadRequestError,
  InstantRouteNotFoundError,
} from "@/lib/server/instant-errors";

type RouteErrorPayload = {
  error: string;
};

export function resolveInstantRouteError(error: unknown): {
  status: number;
  payload: RouteErrorPayload;
} {
  if (error instanceof InstantAuthError) {
    return {
      status: 401,
      payload: { error: error.message },
    };
  }

  if (error instanceof InstantRouteNotFoundError) {
    return {
      status: 404,
      payload: { error: error.message },
    };
  }

  if (error instanceof InstantRouteBadRequestError) {
    return {
      status: 400,
      payload: { error: error.message },
    };
  }

  return {
    status: 500,
    payload: { error: "Unexpected server error." },
  };
}