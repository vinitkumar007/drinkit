package com.drinkit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;

/**
 * Starts the whole app on a random port with a fresh database and walks through the real flow over HTTP:
 * customer orders -> admin accepts and packs -> rider picks up and delivers -> customer sees "delivered".
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class OrderFlowTest {
  static {
    System.setProperty("DB_FILE", "target/test-db-" + System.nanoTime() + "/drinkit");
    System.setProperty("IGNORE_STORE_HOURS", "1");
    System.setProperty("STAFF_PASSWORD", "test-staff-pass");
    System.setProperty("AUTH_RATE_MAX", "100000");
    System.setProperty("STAFF_RATE_MAX", "100000");
    System.setProperty("JWT_SECRET", "test-secret-test-secret-test-secret");
  }

  @LocalServerPort
  int port;

  private final ObjectMapper json = new ObjectMapper();
  private final HttpClient http = HttpClient.newHttpClient();

  private JsonNode call(String method, String path, String token, Object body, int expectStatus) throws Exception {
    HttpRequest.Builder b = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
        .header("Content-Type", "application/json");
    if (token != null) b.header("Authorization", "Bearer " + token);
    b.method(method, body == null ? HttpRequest.BodyPublishers.noBody()
        : HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body)));
    HttpResponse<String> r = http.send(b.build(), HttpResponse.BodyHandlers.ofString());
    assertEquals(expectStatus, r.statusCode(), method + " " + path + " -> " + r.body());
    return json.readTree(r.body());
  }

  @Test
  void webAppsAreServed() throws Exception {
    for (String p : List.of("/", "/admin/", "/rider/", "/shared/api.js")) {
      HttpResponse<String> r = http.send(HttpRequest.newBuilder(URI.create("http://localhost:" + port + p)).build(),
          HttpResponse.BodyHandlers.ofString());
      assertEquals(200, r.statusCode(), p);
    }
    // unknown API urls answer with JSON, not an HTML page
    assertEquals("Not found", call("GET", "/api/nope", null, null, 404).path("error").asText());
  }

  @Test
  void fullOrderFlow() throws Exception {
    assertTrue(call("GET", "/api/health", null, null, 200).path("ok").asBoolean());
    JsonNode svc = call("GET", "/api/serviceability?lat=28.633&lng=77.218", null, null, 200);
    assertTrue(svc.path("serviceable").asBoolean());
    int storeId = svc.path("store").path("id").asInt();
    assertEquals(36, call("GET", "/api/products?store_id=" + storeId, null, null, 200).size());

    // customer login (OTP is shown outside production) + age gate
    JsonNode otp = call("POST", "/api/auth/request-otp", null, Map.of("phone", "9812345678"), 200);
    String code = otp.path("dev_otp").asText();
    assertFalse(code.isEmpty());
    String customer = call("POST", "/api/auth/verify-otp", null, Map.of("phone", "9812345678", "otp", code, "name", "Test"), 200)
        .path("token").asText();
    call("POST", "/api/auth/age", customer, Map.of("dob", LocalDate.now().minusYears(30).toString(), "state", "Delhi"), 200);

    JsonNode order = call("POST", "/api/orders", customer, Map.of(
        "items", List.of(Map.of("product_id", 10, "qty", 2)),
        "address", "12 Test Road, Connaught Place, New Delhi", "lat", 28.633, "lng", 77.218), 201);
    long id = order.path("id").asLong();
    String deliveryOtp = order.path("delivery_otp").asText();
    assertEquals("placed", order.path("status").asText());
    assertEquals(4, deliveryOtp.length());

    // admin logs in with the staff password
    call("POST", "/api/auth/staff-login", null, Map.of("phone", "9000000001", "password", "wrong-password"), 401);
    String admin = call("POST", "/api/auth/staff-login", null, Map.of("phone", "9000000001", "password", "test-staff-pass"), 200)
        .path("token").asText();
    call("GET", "/api/admin/stats", customer, null, 403); // customers can not use admin APIs
    call("PATCH", "/api/admin/orders/" + id + "/status", admin, Map.of("status", "accepted"), 200);
    JsonNode packed = call("PATCH", "/api/admin/orders/" + id + "/status", admin, Map.of("status", "packed"), 200);
    assertFalse(packed.has("delivery_otp")); // only the customer sees the OTP

    // rider: sees the job, cannot deliver without ID check / OTP
    String rider = call("POST", "/api/auth/staff-login", null, Map.of("phone", "9000000002", "password", "test-staff-pass"), 200)
        .path("token").asText();
    JsonNode jobs = call("GET", "/api/rider/orders", rider, null, 200);
    assertEquals(1, jobs.size());
    call("POST", "/api/rider/orders/" + id + "/pickup", rider, Map.of(), 200);
    call("POST", "/api/rider/orders/" + id + "/deliver", rider, Map.of("otp", deliveryOtp), 400);
    call("POST", "/api/rider/orders/" + id + "/deliver", rider,
        Map.of("otp", "0000".equals(deliveryOtp) ? "1111" : "0000", "id_checked", true), 400);
    call("POST", "/api/rider/orders/" + id + "/deliver", rider, Map.of("otp", deliveryOtp, "id_checked", true), 200);

    JsonNode done = call("GET", "/api/orders/" + id, customer, null, 200);
    assertEquals("delivered", done.path("status").asText());
    assertNotNull(done.path("delivery_otp").textValue());
  }
}
