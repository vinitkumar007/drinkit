package com.drinkit.web;

import com.drinkit.common.HttpError;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

/** Turns every error into JSON: {"error": "message"}. */
@RestControllerAdvice
public class ApiExceptionHandler extends ResponseEntityExceptionHandler {
  private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

  private static ResponseEntity<Object> json(int status, String message) {
    Map<String, Object> body = new LinkedHashMap<>();
    body.put("error", message);
    return ResponseEntity.status(status).contentType(MediaType.APPLICATION_JSON).body(body);
  }

  @ExceptionHandler(HttpError.class)
  public ResponseEntity<Object> handleHttpError(HttpError e) {
    return json(e.getStatus(), e.getMessage());
  }

  @ExceptionHandler(Exception.class)
  public ResponseEntity<Object> handleAny(Exception e) {
    log.error("Unhandled error", e);
    return json(500, "Server error");
  }

  /** Errors raised by Spring itself (bad JSON, unknown file, wrong method ...). */
  @Override
  protected ResponseEntity<Object> handleExceptionInternal(Exception ex, Object body, HttpHeaders headers,
      HttpStatusCode statusCode, WebRequest request) {
    int status = statusCode.value();
    String message = switch (status) {
      case 400 -> "Invalid JSON";
      case 404 -> "Not found";
      case 405 -> "Method not allowed";
      case 415 -> "Content-Type must be application/json";
      default -> "Request failed";
    };
    return json(status, message);
  }
}
