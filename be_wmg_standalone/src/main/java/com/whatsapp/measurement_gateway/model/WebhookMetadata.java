package com.whatsapp.measurement_gateway.model;

public class WebhookMetadata {

  private String display_phone_number;
  private String phone_number_id;

  public WebhookMetadata(String display_phone_number, String phone_number_id) {
    this.display_phone_number = display_phone_number;
    this.phone_number_id = phone_number_id;
  }

  public String getDisplayPhoneNumber() {
    return display_phone_number;
  }

  public void setDisplayPhoneNumber(String display_phone_number) {
    this.display_phone_number = display_phone_number;
  }

  public String getPhoneNumberId() {
    return phone_number_id;
  }

  public void setPhoneNumberId(String phone_number_id) {
    this.phone_number_id = phone_number_id;
  }

  @Override
  public String toString() {
    return "WebhookMetadata{"
        + "display_phone_number='"
        + display_phone_number
        + '\''
        + ", phone_number_id='"
        + phone_number_id
        + '\''
        + '}';
  }
}
