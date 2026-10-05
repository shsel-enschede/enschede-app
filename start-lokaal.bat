@echo off
rem ============================================================
rem  Enschede app - lokale proefversie starten
rem  Dubbelklik dit bestand. De app opent in je browser op
rem  http://localhost:8000, met de foto's uit 'fotos-lokaal'.
rem  Stoppen: sluit dit venster.
rem  Uitleg: fotos-lokaal-LEESMIJ.md
rem ============================================================
title Enschede app - lokale proefversie
cd /d "%~dp0"

set POORT=8000
set ADRES=http://localhost:%POORT%

rem Draait de server al (bijvoorbeeld in een ander venster)? Dan alleen de browser openen.
netstat -ano | findstr /c:":%POORT% " | findstr LISTENING >nul
if not errorlevel 1 (
  echo De app draait al. Browser wordt geopend: %ADRES%
  start "" "%ADRES%"
  ping -n 3 127.0.0.1 >nul
  exit /b 0
)

rem Python zoeken: eerst 'python', anders de Windows-starter 'py'.
set PY=
where python >nul 2>nul && set PY=python
if not defined PY where py >nul 2>nul && set PY=py
if not defined PY (
  echo.
  echo Python is niet gevonden op deze computer.
  echo Installeer Python via https://www.python.org/downloads/
  echo en vink tijdens de installatie "Add python.exe to PATH" aan.
  echo.
  pause
  exit /b 1
)

echo.
echo  Enschede app - lokale proefversie
echo  ---------------------------------
echo  Adres:    %ADRES%
echo  Stoppen:  sluit dit venster
echo.
echo  Alleen deze computer kan de app zien (niet andere apparaten in het netwerk).
echo.

rem Browser openen zodra de server klaar is (na 2 seconden).
start "" /min cmd /c "ping -n 3 127.0.0.1 >nul & start %ADRES%"

rem Server starten. --bind 127.0.0.1: alleen bereikbaar vanaf deze computer.
%PY% -m http.server %POORT% --bind 127.0.0.1
if errorlevel 1 (
  echo.
  echo De server kon niet starten. Mogelijk is poort %POORT% al in gebruik.
  pause
)
