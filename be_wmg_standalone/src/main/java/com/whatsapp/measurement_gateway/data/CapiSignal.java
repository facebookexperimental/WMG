package com.whatsapp.measurement_gateway.data;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "capi_signals")
public class CapiSignal {
  @Id
  @GeneratedValue(strategy = GenerationType.AUTO)
  private Integer id;

  @Column(name = "business_phone_number_id", nullable = false)
  String businessPhoneNumberId;

  @Column(name = "consumer_phone_number", nullable = false)
  String consumerPhoneNumber;

  @Column(name = "ctwa_clid")
  String ctwaClid;

  @Column(name = "source_id")
  String sourceId;

  @Column(name = "raw_payload", length = 10000)
  String rawPayload;

  @Column(name = "event_timestamp")
  Instant eventTimestamp;

  private CapiSignal() {}

  public CapiSignal(
      Integer id,
      String businessPhoneNumberId,
      String consumerPhoneNumber,
      String ctwaClid,
      String sourceId,
      String rawPayload,
      Instant eventTimestamp) {
    this.id = id;
    this.businessPhoneNumberId = businessPhoneNumberId;
    this.consumerPhoneNumber = consumerPhoneNumber;
    this.ctwaClid = ctwaClid;
    this.sourceId = sourceId;
    this.rawPayload = rawPayload;
    this.eventTimestamp = eventTimestamp;
  }

  public Integer getId() {
    return id;
  }

  public void setId(Integer id) {
    this.id = id;
  }

  public String getBusinessPhoneNumberId() {
    return businessPhoneNumberId;
  }

  public void setBusinessPhoneNumberId(String businessPhoneNumberId) {
    this.businessPhoneNumberId = businessPhoneNumberId;
  }

  public String getConsumerPhoneNumber() {
    return consumerPhoneNumber;
  }

  public void setConsumerPhoneNumber(String consumerPhoneNumber) {
    this.consumerPhoneNumber = consumerPhoneNumber;
  }

  public String getCtwaClid() {
    return ctwaClid;
  }

  public void setCtwaClid(String ctwaClid) {
    this.ctwaClid = ctwaClid;
  }

  public String getSourceId() {
    return sourceId;
  }

  public void setSourceId(String sourceId) {
    this.sourceId = sourceId;
  }

  public String getRawPayload() {
    return rawPayload;
  }

  public void setRawPayload(String rawPayload) {
    this.rawPayload = rawPayload;
  }

  public Instant getEventTimestamp() {
    return eventTimestamp;
  }

  public void setEventTimestamp(Instant eventTimestamp) {
    this.eventTimestamp = eventTimestamp;
  }

  public static class Builder {
    private Integer id;
    private String businessPhoneNumberId;
    private String consumerPhoneNumber;
    private String ctwaClid;
    private String sourceId;
    private String rawPayload;
    private Instant eventTimestamp;

    public Builder setId(Integer id) {
      this.id = id;
      return this;
    }

    public Builder setBusinessPhoneNumberId(String businessPhoneNumberId) {
      this.businessPhoneNumberId = businessPhoneNumberId;
      return this;
    }

    public Builder setConsumerPhoneNumber(String consumerPhoneNumber) {
      this.consumerPhoneNumber = consumerPhoneNumber;
      return this;
    }

    public Builder setCtwaClid(String ctwaClid) {
      this.ctwaClid = ctwaClid;
      return this;
    }

    public Builder setSourceId(String sourceId) {
      this.sourceId = sourceId;
      return this;
    }

    public Builder setRawPayload(String rawPayload) {
      this.rawPayload = rawPayload;
      return this;
    }

    public Builder setEventTimestamp(Instant eventTimestamp) {
      this.eventTimestamp = eventTimestamp;
      return this;
    }

    public CapiSignal build() {
      return new CapiSignal(
          id,
          businessPhoneNumberId,
          consumerPhoneNumber,
          ctwaClid,
          sourceId,
          rawPayload,
          eventTimestamp);
    }
  }
}
