package com.whatsapp.measurement_gateway.data;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Temporal;
import jakarta.persistence.TemporalType;
import jakarta.validation.constraints.NotNull;
import java.util.Date;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

@Entity
@Table(name = "keywords")
public class KeywordMapping {
  @Id
  @GeneratedValue(strategy = GenerationType.AUTO)
  private Integer id;

  @Column(name = "keyword", nullable = false)
  @NotNull(message = "keyword cannot be null")
  private String keyword;

  @Column(name = "capi_event", nullable = false)
  @NotNull(message = "capi_event cannot be null")
  private String capiEvent;

  @Column(name = "capi_event_custom_data")
  private String capiEventCustomData;

  @CreationTimestamp
  @Temporal(TemporalType.TIMESTAMP)
  @Column(name = "create_date", updatable = false)
  private Date createDate;

  @UpdateTimestamp
  @Temporal(TemporalType.TIMESTAMP)
  @Column(name = "modify_date")
  private Date modifyDate;

  private KeywordMapping() {}

  public KeywordMapping(
      Integer id,
      String keyword,
      String capiEvent,
      String capiEventCustomData,
      Date createDate,
      Date modifyDate) {
    this.id = id;
    this.keyword = keyword;
    this.capiEvent = capiEvent;
    this.capiEventCustomData = capiEventCustomData;
    this.createDate = createDate;
    this.modifyDate = modifyDate;
  }

  // Get methods for all fields
  public Integer getId() {
    return id;
  }

  public String getKeyword() {
    return keyword;
  }

  public String getCapiEvent() {
    return capiEvent;
  }

  public String getCapiEventCustomData() {
    return capiEventCustomData;
  }

  public Date getCreateDate() {
    return createDate;
  }

  public Date getModifyDate() {
    return modifyDate;
  }

  public void setId(Integer id) {
    this.id = id;
  }

  public void setKeyword(String keyword) {
    this.keyword = keyword;
  }

  public void setCapiEvent(String capiEvent) {
    this.capiEvent = capiEvent;
  }

  public void setCapiEventCustomData(String capiEventCustomData) {
    this.capiEventCustomData = capiEventCustomData;
  }

  public void setCreateDate(Date createDate) {
    this.createDate = createDate;
  }

  public void setModifyDate(Date modifyDate) {
    this.modifyDate = modifyDate;
  }
}
