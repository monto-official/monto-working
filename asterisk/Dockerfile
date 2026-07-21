################################################################################
# Monto AI — Asterisk Container (Ubuntu 22.04 + Asterisk 20 LTS)
################################################################################
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    asterisk \
    asterisk-core-sounds-en \
    asterisk-core-sounds-en-wav \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy config templates (passwords are placeholders, filled by entrypoint.sh)
COPY sip.conf        /etc/asterisk/sip.conf
COPY extensions.conf /etc/asterisk/extensions.conf
COPY http.conf       /etc/asterisk/http.conf
COPY manager.conf    /etc/asterisk/manager.conf
COPY entrypoint.sh   /entrypoint.sh

RUN chmod +x /entrypoint.sh && \
    chown -R asterisk:asterisk /etc/asterisk /var/lib/asterisk \
                               /var/log/asterisk /var/run/asterisk

# Ports:
#   5060/udp  — SIP (Pi)
#   8088/tcp  — WebSocket SIP (browser/JsSIP)
#   5038/tcp  — AMI (backend)
#   10000-20000/udp — RTP media
EXPOSE 5060/udp 5060/tcp 8088/tcp 5038/tcp

USER asterisk
ENTRYPOINT ["/entrypoint.sh"]
