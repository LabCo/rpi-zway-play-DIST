#!/bin/bash

# create a directory in /data for zddx if does not exists
if [[ ! -d /data/zddx ]]
	then
	echo "Creating /data/zddx"
	mkdir /data/zddx || echo "could not create /data/zddx"
else
	echo "/data/zddx already exists"
fi

# create a symlink from z-way-server/automation/storage to /data/storage so the data gets persisted
echo "Creating symlink from z-way-server/automation/storage to /data/storage"
mv /opt/z-way-server/automation/storage /opt/z-way-server/automation/storage-old
ln -s /data/storage /opt/z-way-server/automation/storage || echo "could not link /data/storage to /opt/z-way-server/automation/storage"

# create a symlink from z-way-server/config/zddx to /data/zddx so the data gets persisted
echo "Creating symlink from z-way-server/config/zddx to /data/zddx"
mv /opt/z-way-server/config/zddx /opt/z-way-server/config/zddx-old
ln -s /data/zddx /opt/z-way-server/config/zddx || echo "could not link /data/zdds to /opt/z-way-server/config/zddx"

# always copy over config file if does not exist
# config file stores all the names for the zway virtual devices, deleting it smashes those values
if [[ ! -f /data/storage/configjson-06b2d3b23dce96e1619d2b53d6c947ec.json ]]
then
	echo "Copying config to /data/storage"
	cp zway-conf/configjson-06b2d3b23dce96e1619d2b53d6c947ec.json /data/storage/ || echo "could not copy configjson to /data/storage"
else
	echo "Config already exists in /data/storage"
fi

echo "starting service"
/etc/init.d/mongoose start || echo "could not start mongoose"
/etc/init.d/z-way-server start || echo "could not start z-way"
/etc/init.d/postgresql start || echo "could not start postgres"
/etc/init.d/nginx start || echo "could not start nginx"

./rpi-zway-play/bin/rpi-zway-play -J-Xmx512m -Dpidfile.path=/dev/null