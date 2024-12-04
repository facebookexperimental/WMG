package com.whatsapp.measurement_gateway.controller;

import com.whatsapp.measurement_gateway.model.IncomingMessageWebhook;
import com.whatsapp.measurement_gateway.model.WebhookValue;
import com.whatsapp.measurement_gateway.service.WebhookMessageProcessorService;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/webhook")
public class WebhookController {
  Logger logger = LoggerFactory.getLogger(WebhookController.class);
  private final WebhookMessageProcessorService webhookMessageProcessorService;

  @Autowired
  public WebhookController(WebhookMessageProcessorService webhookMessageProcessorService) {
    this.webhookMessageProcessorService = webhookMessageProcessorService;
  }

  @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
  public ResponseEntity<Map<String, String>> sayHello(@RequestBody IncomingMessageWebhook webhook) {
    logger.info("Processing webhook -> " + webhook.toString());
    Map<String, String> result = new HashMap();

    if (webhook.isMessagesWebhook()) {
      List<WebhookValue> values = webhook.getWebhookValues();
      webhookMessageProcessorService.processWebhookValues(values);
      result.put("success", "true");
      result.put("messagePayload", "true");
      return new ResponseEntity<>(result, HttpStatus.OK);

    } else {
      result.put("success", "true");
      result.put("messagePayload", "false");
      return new ResponseEntity<>(result, HttpStatus.OK);
    }
  }

  @GetMapping
  public String sayHello(
      @RequestParam(value = "hub.mode", required = false) String mode,
      @RequestParam(value = "hub.challenge", required = false) String challenge,
      @RequestParam(value = "hub.verify_token", required = false) String verifyToken) {
    logger.info("Mode : " + mode + " Challenge : " + challenge + " Verify Token : " + verifyToken);
    return challenge;
  }
}
