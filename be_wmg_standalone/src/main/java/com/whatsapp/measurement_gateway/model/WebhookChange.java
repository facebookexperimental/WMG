package com.whatsapp.measurement_gateway.model;

public class WebhookChange {

  private String field;
  private WebhookValue value;

  public WebhookChange(String field, WebhookValue value) {
    this.field = field;
    this.value = value;
  }

  public String getField() {
    return field;
  }

  public void setField(String field) {
    this.field = field;
  }

  public WebhookValue getValue() {
    return value;
  }

  public void setValue(WebhookValue value) {
    this.value = value;
  }

  @Override
  public String toString() {
    return "WebhookChange{" + "field='" + field + '\'' + ", value=" + value + '}';
  }
}
