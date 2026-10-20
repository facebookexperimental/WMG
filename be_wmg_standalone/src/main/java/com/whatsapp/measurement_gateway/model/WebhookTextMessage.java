/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

package com.whatsapp.measurement_gateway.model;

public class WebhookTextMessage {

  private String body;

  public WebhookTextMessage() {}

  public WebhookTextMessage(String body) {
    this.body = body;
  }

  public String getBody() {
    return body;
  }

  public void setBody(String body) {
    this.body = body;
  }

  @Override
  public String toString() {
    return "WebhookTextMessage{" + "body='" + body + '\'' + '}';
  }
}
