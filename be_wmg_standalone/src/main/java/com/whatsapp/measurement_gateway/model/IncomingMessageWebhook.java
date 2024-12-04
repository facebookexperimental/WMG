package com.whatsapp.measurement_gateway.model;

import java.util.List;

public class IncomingMessageWebhook {
  private String object;
  private List<WebhookEntry> entry;

  public IncomingMessageWebhook(String object, List<WebhookEntry> entry) {
    this.object = object;
    this.entry = entry;
  }

  public String getObject() {
    return object;
  }

  public void setObject(String object) {
    this.object = object;
  }

  public List<WebhookEntry> getEntry() {
    return entry;
  }

  public void setEntry(List<WebhookEntry> entry) {
    this.entry = entry;
  }

  public List<WebhookValue> getWebhookValues() {
    List<WebhookValue> values =
        entry.stream()
            .flatMap(p -> p.getChanges().stream())
            .filter(p -> p.getField().equals("messages"))
            .map(p -> p.getValue())
            .toList();

    return values;
  }

  public List<WebhookMessage> getMessagePayloads() {
    List<WebhookMessage> messages =
        entry.stream()
            .flatMap(p -> p.getChanges().stream())
            .filter(p -> p.getField().equals("messages"))
            .map(p -> p.getValue())
            .filter(p -> p.getMessages() != null)
            .flatMap(mapper -> mapper.getMessages().stream())
            .toList();

    return messages;
  }

  public boolean isMessagesWebhook() {
    return entry.stream()
            .flatMap(p -> p.getChanges().stream())
            .filter(p -> p.getField().equals("messages"))
            .map(p -> p.getValue())
            .filter(p -> p.getMessages() != null)
            .count()
        > 0;
  }

  @Override
  public String toString() {
    return "IncomingMessageWebhook{" + "object='" + object + '\'' + ", entry=" + entry + '}';
  }
}
