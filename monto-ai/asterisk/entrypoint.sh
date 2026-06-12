#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════════
# Asterisk container entrypoint
# Substitutes password placeholders with real values from env vars,
# then starts Asterisk.
# ══════════════════════════════════════════════════════════════════════════════
set -e

PARENT_PASS="${PARENT_SIP_PASSWORD:-parentpass123}"
MONTO_PASS="${MONTO_SIP_PASSWORD:-montopass123}"
AMI_SECRET="${ASTERISK_AMI_SECRET:-montoamisecret}"

echo "[entrypoint] Configuring Asterisk with env-provided credentials..."

# Substitute placeholders in sip.conf
sed -i "s/PARENT_SIP_PASSWORD_PLACEHOLDER/${PARENT_PASS}/g" /etc/asterisk/sip.conf
sed -i "s/MONTO_SIP_PASSWORD_PLACEHOLDER/${MONTO_PASS}/g"   /etc/asterisk/sip.conf

# Substitute placeholder in manager.conf
sed -i "s/ASTERISK_AMI_SECRET_PLACEHOLDER/${AMI_SECRET}/g"  /etc/asterisk/manager.conf

echo "[entrypoint] Config ready. Starting Asterisk..."
exec asterisk -f -C /etc/asterisk/asterisk.conf
