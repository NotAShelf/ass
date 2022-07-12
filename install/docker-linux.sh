#!/bin/bash

echo "Installing ass-docker for Linux..."

# Ensure that ./uploads/thumbnails/ exists
mkdir -p ./uploads/thumbnails/

# Ensure that ./share/ exists
mkdir -p ./share/

# Ensure that files config.json, auth.json, & data.json exist
for value in config.json auth.json data.json
do
	if [ ! -f $value ]; then
		touch $value
	fi
done

# Ensure proper file permissions for rootless
chown -R 1001:1001 config.json auth.json data.json uploads share
chmod -R 774 config.json data.json uploads share

# Wait for user to confirm
echo "Continuing will run docker compose. Continue? (Press Ctrl+C to abort)"
read -n 1 -s -r -p "Press any key to continue..."

echo Running setup...

# Bring up the container and run the setup
docker compose up -d && docker compose exec ass npm run setup && docker compose restart

# Done!
echo "ass-docker for Linux installed!"
echo "Run the following to view commands:"
echo "$ docker compose logs -f --tail=50 --no-log-prefix ass"
