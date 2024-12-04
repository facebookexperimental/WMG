package com.whatsapp.measurement_gateway.model;

import java.time.Instant;

public class WebhookMessage {

  private String from;
  private String id;
  private Instant timestamp;
  private WebhookTextMessage text;
  private WebhookReferral referral;
  private String type;

  public WebhookMessage(
      String from,
      String id,
      Instant timestamp,
      WebhookTextMessage text,
      WebhookReferral referral,
      String type) {
    this.from = from;
    this.id = id;
    this.timestamp = timestamp;
    this.text = text;
    this.type = type;
    this.referral = referral;
  }

  public String getFrom() {
    return from;
  }

  public void setFrom(String from) {
    this.from = from;
  }

  public String getId() {
    return id;
  }

  public void setId(String id) {
    this.id = id;
  }

  public Instant getTimestamp() {
    return timestamp;
  }

  public void setTimestamp(Instant timestamp) {
    this.timestamp = timestamp;
  }

  public WebhookTextMessage getText() {
    return text;
  }

  public void setText(WebhookTextMessage text) {
    this.text = text;
  }

  public String getType() {
    return type;
  }

  public void setType(String type) {
    this.type = type;
  }

  public WebhookReferral getReferral() {
    return referral;
  }

  public void setReferral(WebhookReferral referral) {
    this.referral = referral;
  }

  @Override
  public String toString() {
    return "WebhookMessage{"
        + "from='"
        + from
        + '\''
        + ", id='"
        + id
        + '\''
        + ", timestamp='"
        + timestamp
        + '\''
        + ", text="
        + text
        + ", type='"
        + type
        + '\''
        + ", referral='"
        + referral
        + '\''
        + '}';
  }
}
