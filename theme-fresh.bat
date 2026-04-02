@echo off
echo ========================================
echo   SHOPIFY "SUPER FRESH" DEV SERVER
echo ========================================
echo.
echo 1. Cleaning local cache...
if exist .shopify ( rmdir /s /q .shopify )
if exist .tmp ( rmdir /s /q .tmp )

echo 2. Forcing IPv4 stability...
set NODE_OPTIONS=--dns-result-order=ipv4first

echo 3. Starting fresh dev sync...
echo (If prompted, choose to create a NEW development theme)
echo (Aggressively ignoring ALL assets for a stable baseline sync)
shopify theme dev --ignore assets/*

pause
