#!/bin/bash

# install updates
apt-get update -y

# install deps
apt-get remove -y docker docker-engine
apt-get install -y apt-transport-https ca-certificates curl software-properties-common

curl -fsSL https://download.docker.com/linux/debian/gpg | apt-key add -
add-apt-repository \
   "deb [arch=amd64] https://download.docker.com/linux/debian \
   $(lsb_release -cs) \
   stable"

apt-get update -y
apt-get install -y docker-ce

# Start Docker
service docker start

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/download/1.11.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
usermod -aG docker ec2-user

# Download data
mkdir -p /opt/data/maximum-temperature
nohup aws s3 cp --recursive s3://ncic/gridded-land-obs-daily/grid/netcdf/maximum-temperature /opt/data/maximum-temperature > /tmp/data_download.log &

