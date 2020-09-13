#!/usr/bin/env bash
EXCLUDEFLAGS="
--exclude sound_config.txt
--exclude configuration.sh
--exclude node_modules
--exclude script_praha.txt
--exclude script_current.txt
--exclude scripts
--exclude files
--exclude .git
"
[ $# -le 0 ] && echo "$0 <ip>" && exit 1
#IP=192.168.4.1
IP=$1
set -x
#rsync -avz $EXCLUDEFLAGS -e ssh ./ pi@${IP}:/home/pi/wwwserver/
rsync -avz $EXCLUDEFLAGS -e ssh ./ pi@${IP}:/home/pi/surrogate-witch/
set +x
