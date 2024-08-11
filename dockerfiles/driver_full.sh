#! /bin/sh

# if [ ! -e /mud/lib/secure/master.c ]; then
#     tar -zxf /mud/lib.tar.gz -C /mud/lib --no-same-owner
# fi

# Erstmal das Logfile linken (wird fuer den Fehlerbrowser gebraucht)
LOGFILE=log/sys/debug.`date +%s`
ln -sf $LOGFILE lib/UNItopia.debug.log

export LC_ALL=de_DE.UTF-8@sz
export PYTHONUNBUFFERED=1

# TELNET_CERT="`openssl x509 -in /UNItopia/mudadm/magyra/tls/keys/telnet.pem -noout -fingerprint -sha1 | sed -e 's/.*=//;'`"
# exec /usr/local/bin/ldmud --no-erq -m /mud/lib -M secure/master.c --python-script ../startup.pyz
#  --define TELNET_CERT="\"$TELNET_CERT\"" \
#  --define PORTAL_CERT='"00:CC:57:A3:12:39:95:5B:9B:EA:C6:28:69:1E:42:F8:5E:8E:9A:F3"' \
#   --tls-keydirectory   /UNItopia/mudadm/magyra/tls/keys  \
#   --tls-trustdirectory /UNItopia/mudadm/magyra/tls/trust \
#   --tls-crldirectory   /UNItopia/mudadm/magyra/tls/crl   \
#   [::ffff:172.17.0.2]:23    \
#   [::ffff:172.17.0.2]:992   \
#   [::ffff:172.17.0.2]:3333  \
#   [2a00:1828:2000:161::2]:23   \
#   [2a00:1828:2000:161::2]:992  \
#   [2a00:1828:2000:161::2]:3333 \
#   3332 4444 5555 8080          \
#   --define UNItopia \

exec /usr/local/bin/ldmud \
  --define AUTO_COUNTOB \
  --define UNION_TYPES \
  --define MONSTER_SCHIESSEN_IM_HEARTBEAT \
  --define MOVE_UMSTELLUNG \
  --define AUX_PORT=33033 \
  --mudlib /mud/lib \
  --master /secure/master.c \
  --hostname homemud \
  --hostaddr 172.17.0.2 \
  --no-erq \
  --python-script ../python.pyz \
  --eval-cost 1500000 \
  --max-file 100000 \
  --max-bytes 100000 \
  --max-mapping-keys 10000 \
  --max-array 10000 \
  --cleanup-time 5400 \
  --reset-time 2400 \
  --hard-malloc-limit 4294967296 \
  --min-malloc 268435456 \
  --min-small-malloc 134217728 \
  --reserve-user 8388608 \
  --reserve-master 2097152 \
  --reserve-system 4194304 \
  --swap-file /mud/UNItopia.swp \
  --swap-time -1 \
  --swap-variables -1 \
  --gcollect-outfd /mud/gcollect.out \
  --pidfile /mud/UNItopia.pid \
  --debug-file $LOGFILE \
  --strict-euids \
  --no-compat \
  --udp 3335 \
  [::ffff:172.17.0.2]:23    \
  [::ffff:172.17.0.2]:992   \
  [::ffff:172.17.0.2]:3333  \
  [::ffff:127.0.0.1]:23        \
  [::ffff:127.0.0.1]:992       \
  [::ffff:127.0.0.1]:3333      \
  [::1]:23                     \
  [::1]:992                    \
  [::1]:3333                   \
  33033 \
  "$@"
