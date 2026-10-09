package com.drinkit.web;

import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Any /api/... URL that no other controller handles gets a JSON 404 (instead of an HTML page). */
@RestController
public class ApiFallbackController {
  @RequestMapping("/api/**")
  public ResponseEntity<Map<String, Object>> notFound() {
    return ResponseEntity.status(404).body(Map.of("error", "Not found"));
  }
}
