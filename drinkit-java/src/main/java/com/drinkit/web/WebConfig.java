package com.drinkit.web;

import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.web.servlet.config.annotation.ViewControllerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** Makes /admin/ and /rider/ open their index.html (the customer app is served at / automatically). */
@Configuration
public class WebConfig implements WebMvcConfigurer {
  @Override
  public void addViewControllers(ViewControllerRegistry registry) {
    registry.addRedirectViewController("/admin", "/admin/").setStatusCode(HttpStatus.MOVED_PERMANENTLY);
    registry.addRedirectViewController("/rider", "/rider/").setStatusCode(HttpStatus.MOVED_PERMANENTLY);
    registry.addViewController("/admin/").setViewName("forward:/admin/index.html");
    registry.addViewController("/rider/").setViewName("forward:/rider/index.html");
  }
}
