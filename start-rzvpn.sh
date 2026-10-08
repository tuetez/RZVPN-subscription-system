#!/data/data/com.termux/files/usr/bin/bash
cd ~/RZVPN-subscription-system
pm2 start ecosystem.config.cjs
pm2 save
