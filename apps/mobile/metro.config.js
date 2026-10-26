// Konfigurasi Metro bawaan Expo + ekstensi .db agar data Al-Qur'an (assets/quran/*.db) ikut dibundel.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('db');

module.exports = config;
