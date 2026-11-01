// Secrets.example.h: the shape of Secrets.h. This file is a TEMPLATE and holds no real values.
//
// No Secrets.h at all: the sketch builds the standalone show (UFO_NET 0, no radio code). That is the default.
// To turn on Wi-Fi + password-protected OTA (and, optionally, MQTT control):
//   cp Secrets.example.h Secrets.h      (Secrets.h is git-ignored; never commit it)
//   then fill in every value below.
//
// The compiled .bin carries these values, so treat the build output as a secret too.
#pragma once

#define UFO_WIFI_SSID          "your-network-name"
#define UFO_WIFI_PASSWORD      "your-wifi-password"

// MD5 of the board's OTA password, 32 lowercase hex characters (for example: printf '%s' 'pw' | md5).
// The image holds only the hash. The build refuses to compile until this is a real 32-hex value,
// so OTA never runs open. Pick a long random password and keep it in a password manager.
#define UFO_OTA_PASSWORD_MD5   ""

// Optional: portal control over MQTT (docs/MQTT.md). Leave UFO_MQTT_HOST commented out to build without it.
// #define UFO_MQTT_HOST       "broker.local"        // host name or dotted IPv4 address of your broker
// #define UFO_MQTT_PORT       1883
// #define UFO_MQTT_USER       "ufo"
// #define UFO_MQTT_PASSWORD   "your-broker-password"
