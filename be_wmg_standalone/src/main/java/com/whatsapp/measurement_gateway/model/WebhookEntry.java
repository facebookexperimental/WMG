package com.whatsapp.measurement_gateway.model;

import java.util.List;

public class WebhookEntry {

  private String id;
  private List<WebhookChange> changes;

  public WebhookEntry(String id, List<WebhookChange> changes) {
    this.id = id;
    this.changes = changes;
  }

  public String getId() {
    return id;
  }

  public void setId(String id) {
    this.id = id;
  }

  public List<WebhookChange> getChanges() {
    return changes;
  }

  public void setChanges(List<WebhookChange> changes) {
    this.changes = changes;
  }

  @Override
  public String toString() {
    return "WebhookEntry{" + "id='" + id + '\'' + ", changes=" + changes + '}';
  }
}
