package com.whatsapp.measurement_gateway.model;

import java.util.List;

public class WebhookValue {

  private String messaging_product;
  private WebhookMetadata metadata;
  private List<WebhookMessage> messages;

  public WebhookValue(
      String messaging_product, WebhookMetadata metadata, List<WebhookMessage> messages) {
    this.messaging_product = messaging_product;
    this.metadata = metadata;
    this.messages = messages;
  }

  public String getMessaging_product() {
    return messaging_product;
  }

  public void setMessaging_product(String messaging_product) {
    this.messaging_product = messaging_product;
  }

  public WebhookMetadata getMetadata() {
    return metadata;
  }

  public void setMetadata(WebhookMetadata metadata) {
    this.metadata = metadata;
  }

  public List<WebhookMessage> getMessages() {
    return messages;
  }

  public void setMessages(List<WebhookMessage> messages) {
    this.messages = messages;
  }

  @Override
  public String toString() {
    return "WebhookValue{"
        + "messaging_product='"
        + messaging_product
        + '\''
        + ", metadata="
        + metadata
        + ", messages="
        + messages
        + '}';
  }
}
