package com.whatsapp.measurement_gateway.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.BearerTokenAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class WMGSecurityTokenAuthFilter extends OncePerRequestFilter {

  @Value("${wmg.security.token}")
  private String securityToken;

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
      throws ServletException, IOException {
    String authHeader = request.getHeader("WMG-Security-Token");
    if (authHeader != null) {
      String accessToken = authHeader;
      if (!accessToken.equals(securityToken)) {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        return;
      } else {
        Authentication authenticationToken = new BearerTokenAuthenticationToken(accessToken);
        authenticationToken.setAuthenticated(true);
        SecurityContextHolder.getContext().setAuthentication(authenticationToken);
      }
    }

    filterChain.doFilter(request, response);
  }
}
