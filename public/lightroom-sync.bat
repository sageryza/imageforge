@echo off
rem lightroom-sync.bat — double-click to send the necklace photos to the site.
rem Needs Python: if the line below says it is not found, open the Microsoft
rem Store, search "Python", install it, and double-click this again.
cd /d "%~dp0"
where py >nul 2>nul && (py -3 "%~dp0lightroom-sync.py" %* & goto done)
where python >nul 2>nul && (python "%~dp0lightroom-sync.py" %* & goto done)
echo Python is not installed. Open the Microsoft Store, search "Python", install it, then run this again.
:done
echo.
pause
