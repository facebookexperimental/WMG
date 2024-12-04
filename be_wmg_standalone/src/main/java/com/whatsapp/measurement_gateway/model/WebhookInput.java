package com.whatsapp.measurement_gateway.model;

import java.util.List;

public class WebhookInput {
  private String object;
  private List<WebhookEntry> entry;

  public WebhookInput(String object, List<WebhookEntry> entry) {
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
}
