#!/usr/bin/env bash

# Script Configuration
IMAGEPATH="$HOME/Pictures"
IMAGENAME="ass"
FILE="${IMAGEPATH}/${IMAGENAME}.png"
LOG_DIR=$(pwd)
CONFIG_FILE="config.sh"

# Load configuration if available
# this is useful if you want to source keys from a secret file
if [ -f "$CONFIG_FILE" ]; then
	source "${CONFIG_FILE}"
fi

# Function to take Flameshot screenshots
takeFlameshot() {
	flameshot config -f "${IMAGENAME}"
	flameshot gui -r -p "${IMAGEPATH}" >/dev/null
}

# Function to take Wayland screenshots using grim + slurp
takeGrimshot() {
	grim -g "$(slurp)" "${FILE}" >/dev/null
}

# Function to remove the taken screenshot
removeTargetFile() {
	echo -en "Process complete.\nRemoving image.\n"
	rm -v "${FILE}"
}

# Function to upload target image to your ass instance
uploadScreenshot() {
	echo -en "KEY & DOMAIN are set. Attempting to upload to your ass instance.\n"
	URL=$(curl -X POST \
		-H "Content-Type: multipart/form-data" \
		-H "Accept: application/json" \
		-H "User-Agent: ShareX/13.4.0" \
		-H "Authorization: $KEY" \
		-F "file=@${FILE}" "https://$DOMAIN/" | grep -Po '(?<="resource":")[^"]+')
	if [[ "${XDG_SESSION_TYPE}" == x11 ]]; then
		printf "%s" "$URL" | xclip -sel clip
	elif [[ "${XDG_SESSION_TYPE}" == wayland ]]; then
		printf "%s" "$URL" | wl-copy
	else
		echo -en "Invalid desktop session!\nExiting.\n"
		exit 1
	fi
}

localScreenshot() {
	echo -en "KEY & DOMAIN variables are not set. Attempting local screenshot.\n"
	if [[ "${XDG_SESSION_TYPE}" == x11 ]]; then
		xclip -sel clip -target image/png <"${FILE}"
	elif [[ "${XDG_SESSION_TYPE}" == wayland ]]; then
		wl-copy <"${FILE}"
	else
		echo -en "Unknown display backend. Assuming Xorg and using xclip.\n"
		xclip -sel clip -target image/png <"${FILE}"
	fi
}

# Check if the screenshot tool based on display backend
if [[ "${XDG_SESSION_TYPE}" == x11 ]]; then
	echo -en "Display backend detected as Xorg (x11), using Flameshot\n"
	takeFlameshot
elif [[ "${XDG_SESSION_TYPE}" == wayland ]]; then
	echo -en "Display backend detected as Wayland, using grim & slurp\n"
	takeGrimshot
else
	echo -en "Unknown display backend. Assuming Xorg and using Flameshot\n"
	takeFlameshot >"${LOG_DIR}/flameshot.log"
	echo -en "Done. Make sure you check for any errors and report them.\nLogfile located in '${LOG_DIR}'\n"
fi

# Check if the screenshot file exists before proceeding
if [[ -f "${FILE}" ]]; then
	if [[ -n "$KEY" && -n "$DOMAIN" ]]; then
		# Upload the file to the ass instance
		uploadImage

		# Remove image
		removeTargetFile
	else
		# Take a screenshot locally
		localScreenshot

		# Remove image
		removeTargetFile
	fi
else
	echo -en "Target file ${FILE} was not found. Aborting screenshot.\n"
	exit 1
fi
