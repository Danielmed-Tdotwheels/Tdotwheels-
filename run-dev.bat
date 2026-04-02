@echo off
echo Starting Shopify Dev Server with IPv4 Network Fix...
set NODE_OPTIONS=--dns-result-order=ipv4first
shopify theme dev
