export class InstantAuthError extends Error {
  constructor(message = "Authentication required.") {
    super(message);
    this.name = "InstantAuthError";
  }
}

export class InstantRouteBadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InstantRouteBadRequestError";
  }
}

export class InstantRouteNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InstantRouteNotFoundError";
  }
}