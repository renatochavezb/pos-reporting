@echo off
cd /d "%~dp0"
echo ---------------------------------------------- >> merma_cron.log
echo Corrida: %date% %time% >> merma_cron.log
node extraer_merma.mjs >> merma_cron.log 2>&1
echo Fin: %date% %time% >> merma_cron.log
