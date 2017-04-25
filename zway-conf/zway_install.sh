#!/bin/bash
# installer zway to raspberry

INSTALL_DIR=/opt
ZWAY_DIR=$INSTALL_DIR/z-way-server
TEMP_DIR=/tmp
BOXED=`[ -e /etc/z-way/box_type ] && echo yes`

if [[ $ZWAY_UPIF ]]; then
    write_upi() {
	echo -e $1 > $ZWAY_UPIF
    }
else
    write_upi() {
	true;
    }
fi

# Check if Z-Way was already installed in /opt/z-way-server
upgrade_zway="no"
if [[ -d $ZWAY_DIR ]]; then
	upgrade_zway="yes"
else
	echo "z-way-server new installation"
fi

# Check symlinks
if [[ ! -e /usr/lib/arm-linux-gnueabihf/libssl.so ]]
	then
	echo "Making symlinks to libssl.so"
	cd /usr/lib/arm-linux-gnueabihf/
	ln -s libssl.so.1.0.0 libssl.so
fi

if [[ ! -e /usr/lib/arm-linux-gnueabihf/libcrypto.so ]]
	then
	echo "Making symlinks to libcrypto.so"
	cd /usr/lib/arm-linux-gnueabihf/
	ln -s libcrypto.so.1.0.0 libcrypto.so
fi

# Check libarchive.so.12 exist
if [[ ! -e /usr/lib/arm-linux-gnueabihf/libarchive.so.12 ]]
then
	echo "Making link to libarchive.so.12"
	ln -s /usr/lib/arm-linux-gnueabihf/libarchive.so /usr/lib/arm-linux-gnueabihf/libarchive.so.12
fi

mkdir -p /etc/z-way
echo "v2.2.5" > /etc/z-way/VERSION
echo "razberry" > /etc/z-way/box_type

# Create Z-Way startup script
echo "Creating Z-Way startup script"
echo '#! /bin/sh
### BEGIN INIT INFO
# Provides:		  z-way-server
# Required-Start:
# Required-Stop:
# Default-Start:	 2 3 4 5
# Default-Stop:	  0 1 6
# Short-Description: RaZberry Z-Wave service
# Description:	   Start Z-Way server for to allow Raspberry Pi talk with Z-Wave devices using RaZberry
### END INIT INFO

# Description: RaZberry Z-Way server
# Author: Yurkin Vitaliy <aivs@z-wave.me>

PATH=/bin:/usr/bin:/sbin:/usr/sbin
NAME=z-way-server
DAEMON_PATH=/opt/z-way-server
PIDFILE=/var/run/$NAME.pid

# adding z-way libs to library path
export LD_LIBRARY_PATH=$LD_LIBRARY_PATH:/opt/z-way-server/libs

case "$1" in
  start)
	echo -n "Starting z-way-server: "
	start-stop-daemon --start  --pidfile $PIDFILE --make-pidfile  --background --no-close --chdir $DAEMON_PATH --exec $NAME > /dev/null 2>&1
	echo "done."
	;;
  stop)
	echo -n "Stopping z-way-server: "
	start-stop-daemon --stop --quiet --pidfile $PIDFILE
	rm $PIDFILE
	echo "done."
	;;
  restart)
	echo "Restarting z-way-server: "
	sh $0 stop
	sleep 10
	sh $0 start
	;;
  save)
	echo "Saving z-way-server configuration"
	PID=`sed s/[^0-9]//g $PIDFILE`
	/bin/kill -10 $PID
	;;
  *)
	echo "Usage: /etc/init.d/z-way-server {start|stop|restart|save}"
	exit 1
	;;
esac
exit 0' > /etc/init.d/z-way-server
chmod +x /etc/init.d/z-way-server

# Add z-way-server.log to logrotate
echo '/var/log/z-way-server.log {
        daily
        size=10M
        rotate 4
        compress
        nodelaycompress
        missingok
        notifempty
        postrotate
    		/usr/bin/killall -HUP z-way-server 2>/dev/null || true
		endscript
}' > /etc/logrotate.d/z-way-server

# Add Z-Way to autostart
# echo "Adding z-way-server to autostart"
# update-rc.d z-way-server defaults

# Stop and disable readKey if exist
# if [ -f /etc/init.d/readKey ];then
# 	/etc/init.d/readKey stop
# 	update-rc.d readKey remove
# fi

# Adding webserver to autostart
# echo "Adding mongoose to autostart"
# update-rc.d mongoose defaults

# Starting webserver mongoose
# echo "Start mongoose http server"
# /etc/init.d/mongoose start

# Prepare AMA0
# sed 's/console=ttyAMA0,115200//; s/kgdboc=ttyAMA0,115200//; s/console=serial0,115200//' /boot/cmdline.txt > /tmp/zway_install_cmdline.txt

if [[ -f /etc/inittab ]]
then
	sed 's|[^:]*:[^:]*:respawn:/sbin/getty[^:]*ttyAMA0[^:]*||' /etc/inittab > /tmp/zway_install_inittab
fi

# Transform old DevicesData.xml to new format
# (cd $ZWAY_DIR && test -x ./z-cfg-update && ls -1 config/zddx/*.xml | LD_LIBRARY_PATH=./libs xargs -l ./z-cfg-update)

# Make sure to save changes
sync

# Subscribe user to news
# if [[ "$BOXED" != "yes" ]]
# then
# 	echo "Do you want to receive emails with news about RaZberry project?"
# 	echo "! Please subscribe again if you did it before 30.03.2013"
# 	while true
# 	do
# 		echo -n "yes/no: "
# 		read ANSWER < /dev/tty
# 		case $ANSWER in
# 			yes)
# 				echo -n "Enter your email address: "
# 				read EMAIL < /dev/tty
# 				curl -d "email=$EMAIL" http://razberry.z-wave.me/subscribe.php
# 				break
# 				;;
# 			no)
# 				break
# 				;;
# 		esac
# 		echo "Please answer yes or no"
# 	done
# fi

echo "Thank you for using RaZberry!"

exit 0
