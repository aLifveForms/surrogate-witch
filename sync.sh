#!/usr/bin/env bash
EXCLUDEFLAGS="
--exclude sound_config.txt
--exclude configuration.sh
--exclude node_modules
--exclude script_praha.txt
--exclude .git
"
[ $# -le 0 ] && echo "$0 <ip>" && exit 1
#IP=192.168.4.1
IP=$1
set -x
rsync -avz $EXCLUDEFLAGS -e ssh ./ pi@${IP}:/home/pi/wwwserver/
set +x
