#!/usr/bin/env python3
# opens a HTTP and HTTPS server
port = 8083
portssl = 8443

# NGINX Setup in sites-enabled:
"""
test -e /etc/nginx/sites-available/captiveportal_http \
|| cat <<EOF > /etc/nginx/sites-available/captiveportal_http
server {
  server_name
    clients3.google.com clients.l.google.com connectivitycheck.android.com connectivitycheck.gstatic.com play.googleapis.com www.google.com
    apple.com captive.apple.com www.apple.com
    detectportal.firefox.com
    www.msftncsi.com
    ;
  listen 80;
  location / {
    proxy_set_header X-Forwarded-For \$remote_addr;
    proxy_set_header Host \$host;
    proxy_pass http://127.0.0.1:8083;
  }
}
EOF
ln -s /etc/nginx/sites-available/captiveportal_http /etc/nginx/sites-enabled/.
# NGINX Setup in nginx.conf or as /etc/nginx/modules-available/99-captiveportal_https.conf with link in enabled folder
test -e /etc/nginx/modules-available/99-captiveportal_https.conf \
|| cat <<EOF > /etc/nginx/modules-available/99-captiveportal_https.conf
stream {
  upstream captiveserver {
    server 127.0.0.1:8443;
  }
  server {
    listen 443;
    proxy_pass captiveserver;
  }
}
EOF
ln -s /etc/nginx/modules-available/99-captiveportal_https.conf /etc/nginx/modules-enabled/.
"""

## Use dnsmasq to force all requests to come to us:
# --address=/#/${HOTSPOT_IP}
## If using wifi_hotspot.sh set HOTSPOT_FORCEDNS=1

## Use NAT to force requests to http to forward to us:
#iptables -t nat -A PREROUTING -p tcp --dport 80 -j DNAT --to-destination ${HOTSPOT_IP}:80
## If using wifi_hotspot.sh set HOTSPOT_FORCEHTTP=1
## might also need to enable natting and routing for that to even hit
# sysctl -w net.ipv4.ip_forward=1
# iptables -A FORWARD -i ${HOTSPOT_DEV} -s ${NETPREFIX}.0/24 -m conntrack --ctstate NEW -j ACCEPT
# iptables -A FORWARD -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
# iptables -t nat -A POSTROUTING  -j MASQUERADE
## If using wifi_hotspot.sh set HOTSPOT_USENAT=1




# The method here tracks IP's when they connect
# IF a entry for IP does not exist or timestamp is *old* then return 302
#  this causes android to see a login request
# IF a entry for IP exists and timestamp is not *old* then return 204
#  this indicates to android it has internet
#
# This convoluted setup is required because some androids send sever 204 requests and
# the first block of 204 requests all should get 302 returns and then therafter
# they should all get 204's, so we maintain a state

wifis = {} #ip: timestamp

secondstoforget=60 
# after N seconds any new 204 requests are assumed from a new client request
# actually this may be problematic as we noticed recently that some androids
# when they come back from sleep, or flight mode, claim the old wifi connection
# and again send a 204. If it gets a 302 request it will not this time around
# ask for a login but just ask if user wants to connect still to this broken
# network. Usability wise this is significantly worse.


from http.server import HTTPServer, SimpleHTTPRequestHandler
import ssl
import os.path
import sys
import time
import json
import threading
try:
    from StringIO import StringIO ## for Python 2
except ImportError:
    from io import StringIO ## for Python 3


# handle nginx proxying. For this need to add to nginx server location config:
#    proxy_set_header X-Forwarded-For $remote_addr;


##############################
#####
##### ANDROID SECTION
#####
##### https://developer.android.com/about/versions/11/features/captive-portal
##### This reference is rather unclear and not followed closely
##############################
# Setup
# option a: on linux router use iptables to force all http out request to here
# option b: setup nginx for captive domains and use dnsmasq on router to return this ip
# Also
# "Android 11 supports dhcp option 111" (Which is actually 114, and used to be 160. FUN!)
# officially option 114, used to also be 160. Fun!
# see rfc7710bis section

# address=/hotspot.localnet/192.168.24.1
# address=/connectivitycheck.gstatic.com/216.58.206.131
# address=/www.gstatic.com/216.58.206.99
# address=/www.apple.com/2.16.21.112
# address=/captive.apple.com/17.253.35.204
# address=/clients3.google.com/216.58.204.46
# address=/www.msftconnecttest.com/13.107.4.52

##############################
#####
##### APPLE SECTION
#####
##### https://developer.apple.com/news/?id=q78sq5rv
##############################
# New DHCP options. FUN!
# appears to follow rfc 7710bis for all
# DHCP Option: 114 (Captive-Portal)
#     Length: 38
#     Value: https://example.org/captive-portal/api
# DHCPv6 Option: 103 (Captive-Portal)
#     Length: 38
#     Value: https://example.org/captive-portal/api
# IPv6 RA Option: 37 (Captive-Portal)
#     Length: 38
#     Value: https://example.org/captive-portal/api

#dhcp-option=160,http://THISIP:THISPORT/rfc7710bis
#dhcp-option=114,http://THISIP:THISPORT/rfc7710bis
# And just in case some phone developers take android documentation literally:
#dhcp-option=111,http://THISIP:THISPORT/rfc7710bis
#dhcp-option=103,http://THISIP:THISPORT/rfc7710bis
#dhcp-option=37,http://THISIP:THISPORT/rfc7710bis

##############################
#####
##### MICROSOFT SECTION
#####
##### https://docs.microsoft.com/en-us/windows-hardware/drivers/mobilebroadband/captive-portals#cch
##### https://docs.microsoft.com/en-us/previous-versions/windows/it-pro/windows-vista/cc766017(v=ws.10)?redirectedfrom=MSDN
##### https://blog.superuser.com/2011/05/16/windows-7-network-awareness/
##############################
# "When a captive portal is detected, these tests are periodically repeated until the captive portal is released."
# checks http://www.msftncsi.com/ncsi.txt which = "Microsoft NCSI" with no terminating newline
# Transmission protocol and port: NCSI uses HTTP over port 80.
# checks dns dns.msftncsi.com = 131.107.255.255. If it is not os assumes bad connection

##############################
#####
##### rfc7710bis SECTION
#####
##### https://tools.ietf.org/html/draft-ietf-capport-api-08#section-6
##############################
# For android:
#dnsmasq options for future implemantation of rfc 7710bis
#dhcp-option=160,http://THISIP:THISPORT/rfc7710bis
#dhcp-option=114,http://THISIP:THISPORT/rfc7710bis
# And just in case some phone developers take android documentation literally:
#dhcp-option=111,http://THISIP:THISPORT/rfc7710bis
# For Apple:
#dhcp-option=114,http://THISIP:THISPORT/rfc7710bis
#dhcp-option=103,http://THISIP:THISPORT/rfc7710bis
#dhcp-option=37,http://THISIP:THISPORT/rfc7710bis
#
# "Allcommunication between the clients and the API server MUST be encrypted."
# "Your Captive Portal API server must be running on a host with TLS encryption."
# We will try selfsigned anyway and first as above shows we return http but could later change it to https



def my_do_get(self):
  now = time.time()
  if 'X-Forwarded-For' in self.headers:
    clientip = self.headers['X-Forwarded-For']
  else:
    clientip = self.client_address[0] #'127.0.0.1'

  print(self.headers['Host'], self.path, clientip)

  if self.path.startswith('/captiveportalok'):
    elems = self.path.split('/')
    if len(elems) > 2:
      clientip = elems[2]
    wifis[clientip] = time.time()
    response = """<html><head><title>Success</title><meta http-equiv="refresh" content="0;url=/captiveportal204"></head><body>Success</body></html>"""
    self.send_response(200)
    self.send_header('Content-type', 'text/html')           
    self.send_header('Content-length', str(len(response)))
    self.end_headers()
    bytelikeobject = response.encode()
    self.wfile.write(bytelikeobject)

  elif self.path.startswith('/generate_204') \
    or self.path.startswith('/gen_204'):
    if clientip in wifis and now < wifis[clientip]+secondstoforget:
      self.send_response(204)
      self.end_headers()
    else:
      self.send_response(301)
      # self.send_header('Location', 'http://ptxx.cc/captiveportalok/'+clientip)
      self.send_header('Location', 'http://'+self.headers['Host']+'/captiveportalok/'+clientip)
      self.end_headers()

  elif self.path.startswith('/captiveportal204'):
      self.send_response(204)
      self.end_headers()

  elif self.path.startswith('/rfc7710bis'):
    # Just assume we always say we are NOT captive
    response = json.dump({
      'captive': False,
      'user-portal-url': 'http://'+self.headers['Host']+'/captiveportalok/'+clientip,
      'venue-info-url': 'http://'+self.headers['Host'],
      'seconds-remaining': 326,
      'can-extend-session': True })
    self.send_response(200)
    self.send_header('Content-type', 'application/json')           
    self.send_header('Content-length', str(len(response)))
    self.end_headers()
    self.wfile.write(response)
    # Alternative as specified by spec:
    # if clientip in wifis and now < wifis[clientip]+secondstoforget:
    #   response = json.dumps({
    #     'captive': False,
    #     'user-portal-url': 'http://'+self.headers['Host']+'/captiveportalok/'+clientip,
    #     'venue-info-url': 'http://'+self.headers['Host'],
    #     'seconds-remaining': 326,
    #     'can-extend-session': True })
    #   self.send_response(200)
    #   self.send_header('Content-type', 'application/json')           
    #   self.send_header('Content-length', str(len(response)))
    #   self.end_headers()
    #   self.wfile.write(response)
    # else:
    #   response = json.dumps(
    #     { 'captive': True, 
    #       'user-portal-url': 'http://'+self.headers['Host']+'/captiveportalok/'+clientip })
    #   self.send_response(200)
    #   self.send_header('Content-type', 'application/json')           
    #   self.send_header('Content-length', str(len(response)))
    #   self.end_headers()
    #   self.wfile.write(response)
  elif self.headers['Host'].find('apple.com') >= 0: 
    #and self.path.startswith('/index.htm'): 
      response = "<HTML><HEAD><TITLE>Success</TITLE></HEAD><BODY>Success</BODY></HTML>"
      self.send_response(200)
      self.send_header('Content-type', 'text/html')           
      self.send_header('Content-length', str(len(response)))
      self.end_headers()
      bytelikeobject = response.encode()
      self.wfile.write(bytelikeobject)
  elif self.headers['Host'].find('firefox.com') >= 0:
    #and self.path == '/success.txt':
      self.send_response(200)
      self.send_header('Content-type', 'text/html')           
      self.send_header('Content-length', str(len(response)))
      self.end_headers()
      self.wfile.write("success".encode())
  elif self.headers['Host'].find('msftncsi.com') >= 0:
    #and self.path == '/ncsi.txt':
      self.send_response(200)
      self.send_header('Content-type', 'text/html')           
      self.send_header('Content-length', str(len(response)))
      self.end_headers()
      self.wfile.write("Microsoft NCSI".encode())


class MyRequestHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
      my_do_get(self)
      #return SimpleHTTPServer.SimpleHTTPRequestHandler.do_GET(self)

Handler = MyRequestHandler

if len(sys.argv) > 1:
  p = int(sys.argv[1])
  port = p

# GET or MAKE SELFSIGNED KEY
if not os.path.exists('captiveportal.key'):
  import subprocess 
  subprocess.call('openssl req -x509 -newkey rsa:4096 -keyout captiveportal.key -out captiveportal.pem -days 365 -nodes', shell=True)

def start_server(port, use_ssl=False):
  print("serving on port {0} (ssl={0})".format(port,use_ssl))
  httpd = HTTPServer(('0.0.0.0', port), Handler)
  if use_ssl:
    httpd.socket = ssl.wrap_socket(httpd.socket, keyfile='captiveportal.key',
                                  certfile='captiveportal.pem', server_side=True)
  httpd.serve_forever()
  httpd.server_close()

srvhttp = threading.Thread(name='http_server', target=start_server, args=(port, False))
srvhttp.setDaemon(True) # Set as a daemon so it will be killed once the main thread is dead.
srvhttp.start()
srvhttps = threading.Thread(name='https_server', target=start_server, args=(portssl, True))
srvhttps.setDaemon(True)
srvhttps.start()

# server = SocketServer.TCPServer(('0.0.0.0', port), Handler)
# server.serve_forever()
while 1:
    time.sleep(10)

srvhttp.stop()
srvhttps.stop()