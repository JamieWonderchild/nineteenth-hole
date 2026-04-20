#!/bin/bash
# Forward port 443 → 3443 for local HTTPS dev (local.playthepool.golf)
# Run once per boot before `npm run dev`

echo "rdr pass inet proto tcp from any to any port 443 -> 127.0.0.1 port 3443" | sudo pfctl -ef -
sudo sysctl -w net.inet.ip.forwarding=1
echo "Port forwarding active: 443 → 3443"
