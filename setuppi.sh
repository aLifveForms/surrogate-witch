# setup pi

function usage() {
    cat <<USAGE
    $0 server

    root@ user assumed
USAGE
    exit 1
}

echo '
curl -k -sL https://deb.nodesource.com/setup_9.x | sudo -E bash -
it will not work on Wheezy (older raspbian) verions
'

test -n "$1" || usage

SERVER=$1
echo "$SERVER" | grep -q '@' || SERVER="root@$SERVER"

# FOR MASTER:
APDEV="wlan1"
APSSID="Protektorama"
APCHAN=9
APNETIP="192.168.0."
UPDEV="wlan9" # make a nonexistant inteface for master
INDEV="wlan0" # internal to Bad Muskau disabled

# BLAU:
MASTERHTTP="192.168.0.1"
APSSID="Protektorama"
APCHAN=5
APNETIP="192.168.5."
APDEV="wlan0"
UPDEV="wlan2" # to protektorama?
INDEV="wlan1" # internal to Bad Muskau disabled
#Little white
MASTERHTTP="192.168.0.1"
APSSID="Protektorama"
APCHAN=3
APNETIP="192.168.3."
APDEV="wlan1"
UPDEV="wlan2" # to protektorama?
INDEV="wlan0" # internal to Bad Muskau disabled

# DISABLE INTERNAL WIFI AND BLUETOOTH in boot/config.txt
#dtoverlay=pi3-disable-wifi
#dtoverlay=pi3-disable-bt
##disabling the drivers by editing the file /etc/modprobe.d/raspi-blacklist.conf and adding:
#blacklist brcmfmac
#blacklist brcmutil
echo -en "#disable wifi bluetooth\nblacklist brcmfmac\nblacklist brcmutil\n" >> /etc/modprobe.d/raspi-blacklist.conf

Alternatively, you could use crontab -e and add:

@reboot sudo ifdown wlan0

iw dev
# internal = b8:27:eb:...  74:da:38 external
vi /lib/udev/rules.d/75-persistent-net-generator.rules
echo 'add wlan* to "white list" from that file. Then reboot without external cards. then connect external cards and wait for  /etc/udev/rules.d/70-persistent-net.rules to appear'
udevadm control --reload-rules && udevadm trigger
echo "remove wifi cards"
halt # reboot
wcho "put in wifi cards after udev 70 rule appears"
cat <<EOF >/etc/udev/rules/71-godamitwlan.rules
# Unknown net device (/devices/platform/soc/3f300000.mmc/mmc_host/mmc1/mmc1:0001/mmc1:0001:1/net/wlan0) (brcmfmac_sdio)
SUBSYSTEM=="net", ACTION=="add", DRIVERS=="?*", ATTR{address}=="b8:27:eb:a1:3f:a7", ATTR{dev_id}=="0x0", ATTR{type}=="1", KERNEL=="wlan*", NAME="wlan0"
# USB device 0x:0x (rtl8192cu)
SUBSYSTEM=="net", ACTION=="add", DRIVERS=="?*", ATTR{address}=="74:da:38:2e:47:35", ATTR{dev_id}=="0x0", ATTR{type}=="1", KERNEL=="wlan*", NAME="wlan1"
# USB device 0x:0x (rtl8192cu)
SUBSYSTEM=="net", ACTION=="add", DRIVERS=="?*", ATTR{address}=="74:da:38:2e:46:d6", ATTR{dev_id}=="0x0", ATTR{type}=="1", KERNEL=="wlan*", NAME="wlan2"
EOF
# or to have it auto generated ad 'wlan*'

cat <<EOF > /etc/hostapd/hostapd.conf
interface=$APDEV
ssid=$APSSID
hw_mode=g
channel=$APCHAN
wmm_enabled=0
macaddr_acl=0
auth_algs=1
EOF
cat <<EOF > /etc/network/interfaces
auto lo
iface lo inet loopback
iface eth0 inet manual
#allow-hotplug $INDEV
iface $INDEV inet manual
#    wpa-conf /etc/wpa_supplicant/wpa_supplicant.conf
#    up iptables-restore < /etc/iptables.ipv4.nat # For Master only
#    post-down killall -q wpa_supplicant
allow-hotplug $APDEV
iface $APDEV inet static
    address ${APNETIP}1
    netmask 255.255.255.0
    network ${APNETIP}.0
    wpa-conf /etc/wpa_supplicant/wpa_supplicant1.conf
# Connecting to Master Protektorama
allow-hotplug $UPDEV
iface $UPDEV inet manual
wpa-conf /etc/wpa_supplicant/wpa_supplicant2.conf
    up iptables-restore < /etc/iptables.ipv4.nat
EOF

# https://elinux.org/RPI-Wireless-Hotspot
REMOTE=$UPDEV
LOCAL=$APDEV
iptables -t nat -A POSTROUTING -o $REMOTE -j MASQUERADE
iptables -A FORWARD -i $REMOTE -o $LOCAL -m state --state RELATED,ESTABLISHED -j ACCEPT
iptables -A FORWARD -i $LOCAL -o $REMOTE -j ACCEPT
# Force HTTP and DNS
iptables -t nat -A PREROUTING -p tcp --sport 53 -j DNAT --to-destination 127.0.0.1:53
iptables -t nat -A PREROUTING -p tcp --dport 443 -j DNAT --to-destination ${MASTERHTTP}:80
iptables -t nat -A PREROUTING -p tcp --dport 80 -j DNAT --to-destination ${MASTERHTTP}:80

iptables-save > /etc/iptables.ipv4.nat

sudo sh -c "iptables-save > /etc/iptables.ipv4.nat"

cat <<EOF > /etc/wpa_supplicant/wpa_supplicant2.conf
ctrl_interface=DIR=/var/run/wpa_supplicant GROUP=netdev
update_config=1
country=GB
network={
        ssid="Protektorama"
        key_mgmt=NONE
}
EOF
cat <<EOF > /etc/wpa_supplicant/wpa_supplicant.conf
ctrl_interface=DIR=/var/run/wpa_supplicant GROUP=netdev
update_config=1
country=GB
network={
        ssid="Bad Muskau"
        psk="BadMuskau24"
        key_mgmt=WPA-PSK
}
EOF


cat <<EOF > /etc/dnsmasq.conf
interface=$APDEV
dhcp-range=${APNETIP}2,${APNETIP}200,255.255.255.0,24h
# https://github.com/projectcalico/felix/issues/43
dhcp-authoritative
no-ping
# Forward all dns to master server
address=/ptxx/$MASTERHTTP
address=/ptx/$MASTERHTTP
address=/xx/$MASTERHTTP
address=/#/$MASTERHTTP
EOF
#grep '^#DNSMASQ_OPTS' && echo "DNSMASQ_OPTS=\"--no-ping --dhcp-authoritative\""
#gvigrep '^DNSMASQ_OPTS' && sed  -e 's/DNSMASQ_OPTS="\(.*\)"/\1/'


#DNSMASQ_OPTS=
sed -i -e "s/denyintefaces.*/denyinterfaces $APDEV/" -e 's/^static routers=/#static routers=/' /etc/dhcpcd.conf











echo "## USER SETUP"

# Nathans keys:
THINKPAD="ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQDXU7On3nO3YxThbdMtkWB4jb/ujGym9afk0e/BsOIbSs0/stbFfWBGLiTT2VTJEvU1r9o6xnP1n9YTEWeM3XU6Pa4H+yfixBScErg94RCEAjMt6VcAHxs6ZhHBr78i9dGmwXnVJloGmZrrIxw5jLGA4a/pw4nyjH7XWRUa8RKCZaF1HnpaXnqXHdJ8YiQGScGP3ydt/vkAjUn/k/saLaLFi0jSji8qUA7TTyDrAIHMVV5AkLm3cxG+1Ldt9MQjNha9p1svJTQ7sTe/UnEVS3B37Px65xIuQyabJC1QNeqL1cH9tOGRyAFpZl0dSOr9QqqRK+QiEA5YKin3x07T5oOV user@kalfu"
MAC="ssh-dss AAAAB3NzaC1kc3MAAACBAJUnmNtmfrJU5jvgZJqasQBk5orSQZYVZl3tRgLAN29GppIZMRUEczXY0lANfFKFrqBjrc32MNEncN+OzXZJJe2mCMt0+DeA40MqL8EYIIWIA7vE+glrN8vZx9LL2tGCzyPgBa4wEEVUSIHyMK5btNrXKsXcA2OcSJPw8KjyjWSnAAAAFQC8SL8wJ/xfjKODHlyWSPlZTYoVOwAAAIBEtyiL3PZ/gfHcSqbqfLppVc5RESzn/Vx8rlvxkIyDbOHrVvHdlW80sBFi20MCxGZAdr3meOBlWEiF2m7Y5NaPOJL5IaEL4wTdnO87EMXTUzfCsDWFc/MXWRWKuij/IJRefAJAu033UhqgdKDTH5Fnpn1n4u+iq2/3hGFpHj7IeAAAAIAqlYAONKbecAxrqAL4OMYTNSpJJ5/+TfQx7LgJq9Jv/6+/8SwQhKm9INRs5dC7Mx3N8hF3lAFP/z87Vwn63QdoUEVVKeTHVl7wN8JWkKX34KIKi+7T/dskHNz7YURWKo0+4lJQM8rCuImD4oJa+e+btyevItq2UgwY1jeXd+7ueA== cyphunk@localhost.local"
mkdir .ssh; chmod 700 .ssh
grep -q "$THINKPAD" .ssh/authorized_keys || echo "$THINKPAD" >> .ssh/authorized_keys
grep -q "$MAC" .ssh/authorized_keys || echo "$MAC" >> .ssh/authorized_keys
chmod 600 .ssh/authorized_keys

mkdir /home/pi/.ssh; chmod 700 /home/pi/.ssh;
cp ~/.ssh/authorized_keys > /home/pi/.ssh/.
chown -R pi:pi /home/pi/.ssh
