@echo off
REM =====================================================
REM Batch MKV → MP4 converter using ffmpeg (Windows)
REM Replace ROOT_PATH below with your folder containing MKV files
REM =====================================================

SET ROOT_PATH=C:\Path\To\Your\TVSeries

REM ===== Convert all MKVs in all subfolders to MP4 =====
for /R "%ROOT_PATH%" %%f in (*.mkv) do (
    echo Converting "%%f"
    ffmpeg -i "%%f" -c:v libx264 -c:a aac "%%~dpnf.mp4"
)

echo.
echo All conversions completed!
pause
