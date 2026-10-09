package com.drinkit.common;

/** An error that becomes a JSON response {"error": message} with the given HTTP status. */
public class HttpError extends RuntimeException {
  private final int status;

  public HttpError(int status, String message) {
    super(message);
    this.status = status;
  }

  public int getStatus() { return status; }

  public static HttpError badRequest(String m) { return new HttpError(400, m); }
  public static HttpError unauthorized(String m) { return new HttpError(401, m); }
  public static HttpError unauthorized() { return new HttpError(401, "Login required"); }
  public static HttpError forbidden(String m) { return new HttpError(403, m); }
  public static HttpError forbidden() { return new HttpError(403, "Forbidden"); }
  public static HttpError notFound(String m) { return new HttpError(404, m); }
  public static HttpError conflict(String m) { return new HttpError(409, m); }
  public static HttpError tooMany(String m) { return new HttpError(429, m); }
}
