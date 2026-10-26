@echo off
rem scripts/probe.bat
rem Quick HTTP probe for local development.
curl -s -o NUL -w "HTTP %%{http_code} in %%{time_total}s\n" http://localhost:3000/api/health