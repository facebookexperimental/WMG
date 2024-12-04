package com.whatsapp.measurement_gateway.model;

import com.google.gson.Gson;

public class WebhookReferral {

  private String ctwa_clid;
  private String source_id;
  private String source_type;
  private String source_url;
  private String headline;
  private String body;
  private String media_type;
  private String image_url;
  private String video_url;
  private String thumbnail_url;

  public WebhookReferral(
      String ctwa_clid,
      String source_id,
      String source_type,
      String source_url,
      String headline,
      String body,
      String media_type,
      String image_url,
      String video_url,
      String thumbnail_url) {
    this.ctwa_clid = ctwa_clid;
    this.source_id = source_id;
    this.source_type = source_type;
    this.source_url = source_url;
    this.headline = headline;
    this.body = body;
    this.media_type = media_type;
    this.image_url = image_url;
    this.video_url = video_url;
    this.thumbnail_url = thumbnail_url;
  }

  public String getCtwa_clid() {
    return ctwa_clid;
  }

  public void setCtwa_clid(String ctwa_clid) {
    this.ctwa_clid = ctwa_clid;
  }

  public String getSource_id() {
    return source_id;
  }

  public void setSource_id(String source_id) {
    this.source_id = source_id;
  }

  public String getSource_type() {
    return source_type;
  }

  public void setSource_type(String source_type) {
    this.source_type = source_type;
  }

  public String getSource_url() {
    return source_url;
  }

  public void setSource_url(String source_url) {
    this.source_url = source_url;
  }

  public String getHeadline() {
    return headline;
  }

  public void setHeadline(String headline) {
    this.headline = headline;
  }

  public String getBody() {
    return body;
  }

  public void setBody(String body) {
    this.body = body;
  }

  public String getMedia_type() {
    return media_type;
  }

  public void setMedia_type(String media_type) {
    this.media_type = media_type;
  }

  public String getImage_url() {
    return image_url;
  }

  public void setImage_url(String image_url) {
    this.image_url = image_url;
  }

  public String getVideo_url() {
    return video_url;
  }

  public void setVideo_url(String video_url) {
    this.video_url = video_url;
  }

  public String getThumbnail_url() {
    return thumbnail_url;
  }

  public void setThumbnail_url(String thumbnail_url) {
    this.thumbnail_url = thumbnail_url;
  }

  // toString method
  @Override
  public String toString() {
    return "WebhookReferral{"
        + "ctwa_clid='"
        + ctwa_clid
        + '\''
        + ", source_id='"
        + source_id
        + '\''
        + ", source_type='"
        + source_type
        + '\''
        + ", source_url='"
        + source_url
        + '\''
        + ", headline='"
        + headline
        + '\''
        + ", body='"
        + body
        + '\''
        + ", media_type='"
        + media_type
        + '\''
        + ", image_url='"
        + image_url
        + '\''
        + ", video_url='"
        + video_url
        + '\''
        + ", thumbnail_url='"
        + thumbnail_url
        + '\''
        + '}';
  }

  public String stringify() {

    Gson gson = new Gson();
    return gson.toJson(this, WebhookReferral.class);
  }
}
