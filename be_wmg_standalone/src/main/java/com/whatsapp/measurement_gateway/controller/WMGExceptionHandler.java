package com.whatsapp.measurement_gateway.controller;

import jakarta.validation.ConstraintViolationException;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.context.request.WebRequest;

@ControllerAdvice
public class WMGExceptionHandler {

  Logger logger = LoggerFactory.getLogger(WMGExceptionHandler.class);

  @ExceptionHandler(ConstraintViolationException.class)
  public ResponseEntity<?> handleConstraintViolationException(ConstraintViolationException ex) {
    List<ErrorDetail> details =
        ex.getConstraintViolations().stream()
            .map(e -> new ErrorDetail(e.getPropertyPath().toString(), e.getMessage()))
            .toList();
    return new ResponseEntity<>(details, HttpStatus.BAD_REQUEST);
  }

  @ExceptionHandler
  ResponseEntity<?> handleUncaughtException(WebRequest request, RuntimeException e) {
    logger.error("Handling uncaught controller exception for {" + e.getLocalizedMessage() + "}", e);
    return new ResponseEntity<>("Internal Server Error", HttpStatus.INTERNAL_SERVER_ERROR);
  }

  private static class ErrorDetail {
    private String property;
    private String message;

    public ErrorDetail(String property, String message) {
      this.property = property;
      this.message = message;
    }

    public String getProperty() {
      return property;
    }

    public void setProperty(String property) {
      this.property = property;
    }

    public String getMessage() {
      return message;
    }

    public void setMessage(String message) {
      this.message = message;
    }

    @Override
    public String toString() {
      return "ErrorDetail{" + "property='" + property + '\'' + ", message='" + message + '\'' + '}';
    }
  }
}
