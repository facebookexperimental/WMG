package com.whatsapp.measurement_gateway.security;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.www.BasicAuthenticationFilter;

@Configuration
public class SecurityConfig {

  @Autowired WMGSecurityTokenAuthFilter wmgSecurityTokenAuthFilter;

  @Bean
  public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
    http.csrf(AbstractHttpConfigurer::disable)
        .httpBasic(AbstractHttpConfigurer::disable)
        .sessionManagement(
            (session) -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .authorizeHttpRequests(
            request -> {
              request.requestMatchers("/webhook").permitAll();
              request.anyRequest().authenticated();
            })
        .addFilterAfter(wmgSecurityTokenAuthFilter, BasicAuthenticationFilter.class);
    return http.build();
  }
}
