package com.whatsapp.measurement_gateway.service;

import com.whatsapp.measurement_gateway.data.CapiSignal;
import com.whatsapp.measurement_gateway.data.KeywordMapping;
import com.whatsapp.measurement_gateway.model.WebhookMessage;
import com.whatsapp.measurement_gateway.model.WebhookMetadata;
import com.whatsapp.measurement_gateway.model.WebhookReferral;
import com.whatsapp.measurement_gateway.model.WebhookValue;
import com.whatsapp.measurement_gateway.repository.CapiSignalRepository;
import com.whatsapp.measurement_gateway.repository.KeywordRepository;
import java.time.Instant;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class WebhookMessageProcessorService {
  Logger logger = LoggerFactory.getLogger(WebhookMessageProcessorService.class);

  @Autowired private CapiSignalRepository capiSignalRepository;
  @Autowired private KeywordRepository keywordRepository;
  @Autowired private CapiEventSenderService capiEventSenderService;

  public void processWebhookValues(List<WebhookValue> webhookValues) throws RuntimeException {
    webhookValues.stream().forEach(this::processWebhookValue);
  }

  public void processWebhookValue(WebhookValue webhookValue) throws RuntimeException {
    WebhookMetadata metadata = webhookValue.getMetadata();

    String businessPhoneNumber = metadata.getPhoneNumberId();
    webhookValue.getMessages().stream()
        .forEach(message -> processWebhookMessage(businessPhoneNumber, message));
  }

  private void processWebhookMessage(String businessPhoneNumber, WebhookMessage webhookMessage)
      throws RuntimeException {
    if (!webhookMessage.getType().equals("text")) {
      return;
    }

    String message = webhookMessage.getText().getBody();
    WebhookReferral referral = webhookMessage.getReferral();
    String consumerPhoneNumber = webhookMessage.getFrom();
    Instant messageTimestamp = webhookMessage.getTimestamp();

    if (referral != null) {
      CapiSignal capiSignal =
          new CapiSignal.Builder()
              .setBusinessPhoneNumberId(businessPhoneNumber)
              .setConsumerPhoneNumber(consumerPhoneNumber)
              .setCtwaClid(referral.getCtwa_clid())
              .setSourceId(referral.getSource_id())
              .setRawPayload(referral.stringify())
              .setEventTimestamp(webhookMessage.getTimestamp())
              .build();

      capiSignalRepository.save(capiSignal);
    }

    Iterable<KeywordMapping> keywordMappings = keywordRepository.findAll();

    List<KeywordMapping> matchedKeywords =
        StreamSupport.stream(keywordMappings.spliterator(), true)
            .filter(keywordMapping -> message.contains(keywordMapping.getKeyword()))
            .collect(Collectors.toList());

    if (!matchedKeywords.isEmpty()) {
      logger.debug(
          "Matched keywords: "
              + matchedKeywords.stream()
                  .map(a -> a.getId() + ":" + a.getKeyword())
                  .reduce("", (a, b) -> a + ", " + b));
    }

    matchedKeywords.stream()
        .parallel()
        .forEach(
            keywordMapping ->
                capiEventSenderService.sendBusinesMessagingEvent(
                    businessPhoneNumber, consumerPhoneNumber, messageTimestamp, keywordMapping));
  }
}
