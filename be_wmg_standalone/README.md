# WhatsApp Measurement Gateway - Standalone Setup

### Requirements:
- [Docker] (https://www.docker.com/)
- [Maven] (https://maven.apache.org/download.cgi) version  > 3.9.9
- [Jdk] (https://www.oracle.com/java/technologies/downloads/) version > 11.0
- [PostgreSQL] (https://hub.docker.com/_/postgres)

### Image Build

- mvn install
- mvn spring-boot:build-image -Dspring-boot.build-image.imageName={image-name}


### Environment variables

Variables exposed by docker image

- **wmg.security.token**
  - **required**
  - **Description:** Access token that will gate the public endpoints

- **spring.datasource.username**
  - **required**
  - **Description:** Admin username from PostgreSQL db
- **spring.datasource.password**
  - **required**
  - **Description:** Admin password from PostgreSQL db

- **wmg.capi.access_token**
  - **optional**
  - **Description:** CAPI access token used to send business messaging signals
- **wmg.capi.page_id**
  - **optional**
  - **Description:** Page id responsible for running CTWA campaigns
- **wmg.capi.datasource_id**
  - **optional**
  - **Description:** Busines Messaging datasource to receive signals

## Image output

Docker image expose the HTTP port 8081
