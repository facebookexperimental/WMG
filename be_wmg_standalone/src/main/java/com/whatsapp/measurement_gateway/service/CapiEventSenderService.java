package com.whatsapp.measurement_gateway.service;

import com.facebook.ads.sdk.APIContext;
import com.facebook.ads.sdk.APIException;
import com.facebook.ads.sdk.serverside.ActionSource;
import com.facebook.ads.sdk.serverside.CustomData;
import com.facebook.ads.sdk.serverside.Event;
import com.facebook.ads.sdk.serverside.EventRequest;
import com.facebook.ads.sdk.serverside.EventResponse;
import com.facebook.ads.sdk.serverside.MessagingChannel;
import com.facebook.ads.sdk.serverside.UserData;
import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;
import com.whatsapp.measurement_gateway.data.CapiSignal;
import com.whatsapp.measurement_gateway.data.KeywordMapping;
import com.whatsapp.measurement_gateway.repository.CapiSignalRepository;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class CapiEventSenderService {
  Logger logger = LoggerFactory.getLogger(CapiEventSenderService.class);

  @Value("${wmg.capi.access_token:}")
  private String accessToken;

  @Value("${wmg.capi.enabled:false}")
  private boolean capiIntegrationEnabled;

  @Value("${wmg.capi.page_id:}")
  private String pageId;

  @Value("${wmg.capi.datasource_id:}")
  private String datasourceId;

  @Value("${wmg.capi.atrribution_window_in_days:7}")
  private Integer attributionWindowInDays;

  private static APIContext context;

  @Autowired private CapiSignalRepository capiSignalRepository;

  public void sendBusinesMessagingEvent(
      String businessPhoneNumberId,
      String consumerPhoneNumber,
      Instant messageTimestamp,
      KeywordMapping keywordMapping)
      throws RuntimeException {
    if (!capiIntegrationEnabled) {
      return;
    }

    List<CapiSignal> capiSignal =
        capiSignalRepository
            .findByBusinessPhoneNumberIdAndConsumerPhoneNumberOrderByEventTimestampDesc(
                businessPhoneNumberId, consumerPhoneNumber);
    if (capiSignal.isEmpty()) {
      return;
    }

    if (context == null) {
      context = new APIContext(accessToken);
    }

    CapiSignal capiSignalObj = capiSignal.get(0);

    if (!capiSignalObj
        .getEventTimestamp()
        .isAfter(Instant.now().minus(Duration.ofDays(attributionWindowInDays)))) {
      logger.info(
          "Event is older than "
              + attributionWindowInDays
              + " days, not sending to CAPI. Event timestamp : "
              + capiSignalObj.getEventTimestamp()
              + " Current timestamp : "
              + Timestamp.from(Instant.now()));
      return;
    }
    logger.info("Sending event to CAPI. Event timestamp : " + messageTimestamp);
    EventRequest eventRequest = new EventRequest(datasourceId, context);
    Event event = new Event();
    event.setEventName(keywordMapping.getCapiEvent());
    event.setEventTime(messageTimestamp.getEpochSecond());
    event.setActionSource(ActionSource.business_messaging);
    event.setMessagingChannel(MessagingChannel.whatsapp);
    UserData userData = (new UserData());
    userData.setCtwaClid(capiSignalObj.getCtwaClid());
    userData.setPageId(pageId);
    event.setUserData(userData);
    eventRequest.addDataItem(event);

    String customDataString = keywordMapping.getCapiEventCustomData();
    if (customDataString != null) {
      CustomData customData = new CustomData();
      Map<String, String> retMap =
          new Gson()
              .fromJson(
                  keywordMapping.getCapiEventCustomData(),
                  new TypeToken<HashMap<String, String>>() {}.getType());

      customData.setValue(Float.valueOf(retMap.get("value")));
      customData.setCurrency(retMap.get("currency"));
      event.setCustomData(customData);
    }

    try {
      logger.info(String.format("Request sent : %s ", eventRequest.getSerializedPayload()));
      EventResponse response = eventRequest.execute();
      logger.info(String.format("Server-Side API response : %s ", response));
    } catch (APIException e) {
      logger.error("Error while sending event to CAPI", e);
      throw new RuntimeException(e);
    }
  }
}
