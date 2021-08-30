FROM openjdk:slim

RUN set -ex \
	&& apt-get update \
	&& apt-get install -y curl \
	&& curl -sL https://deb.nodesource.com/setup_14.x | bash \
	&& apt-get install -y nodejs \
	&& npm install -g firebase-tools

COPY firebase.json firebase.json
COPY storage.rules storage.rules

# Emulator Suite UI
EXPOSE 4000
# Storage
EXPOSE 9199

ENTRYPOINT ["firebase"]
