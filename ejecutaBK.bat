@echo off
setlocal enableDelayedExpansion

echo ===========================================
echo INICIO DEL SCRIPT DE BACKUP (XCOPY - ULTIMA VERSION)
echo ===========================================

:: PASO 1: Capturando Fecha y Hora y Nombre de Carpeta
echo.
echo === PASO 1: Capturando Fecha y Hora y Nombre de Carpeta ===

:: Obtener fecha usando wmic para formato consistente
for /f "tokens=2 delims==" %%a in ('wmic OS Get localdatetime /value') do set "dt=%%a"
set "YY=%dt:~0,4%"
set "MM=%dt:~4,2%"
set "DD=%dt:~6,2%"
set "HH=%dt:~8,2%"
set "Min=%dt:~10,2%"
set "SS=%dt:~12,2%"

set "TIMESTAMP=%YY%%MM%%DD%%HH%%Min%%SS%"

:: Obtener el nombre de la carpeta de origen (el ultimo elemento de la ruta SOURCE_DIR)
for %%F in ("%~dp0.") do set "SOURCE_FOLDER_NAME=%%~nxF"

:: Nombre del backup con el nombre de la carpeta al final
set "BACKUP_NAME=%TIMESTAMP%_respaldo_%SOURCE_FOLDER_NAME%"

echo TIMESTAMP: %TIMESTAMP%
echo SOURCE_FOLDER_NAME: %SOURCE_FOLDER_NAME%
echo BACKUP_NAME: %BACKUP_NAME%
::pause

:: PASO 2: Definiendo y Verificando Directorios
echo.
echo === PASO 2: Definiendo y Verificando Directorios ===
set "SOURCE_DIR=%~dp0"
set "FINAL_BACKUP_ROOT_DIR=D:\bk_desarrollos"
set "DESTINATION_DIR=%FINAL_BACKUP_ROOT_DIR%\%BACKUP_NAME%"

echo Directorios definidos:
echo   SOURCE_DIR: "%SOURCE_DIR%"
echo   FINAL_BACKUP_ROOT_DIR: "%FINAL_BACKUP_ROOT_DIR%"
echo   DESTINATION_DIR: "%DESTINATION_DIR%"
::pause

:: PASO 3: Crear la carpeta raiz 'bk_desarrollos' si no existe
echo.
echo === PASO 3: Creando carpeta de destino raiz 'bk_desarrollos' si no existe ===
echo Verificando si existe: "%FINAL_BACKUP_ROOT_DIR%"
if not exist "%FINAL_BACKUP_ROOT_DIR%" (
    echo La carpeta 'bk_desarrollos' NO existe. Creando...
    mkdir "%FINAL_BACKUP_ROOT_DIR%"
    if exist "%FINAL_BACKUP_ROOT_DIR%" (
        echo Carpeta 'bk_desarrollos' creada exitosamente.
    ) else (
        echo ERROR: No se pudo crear la carpeta 'bk_desarrollos'. Verifique permisos.
        goto :end_script
    )
) else (
    echo La carpeta 'bk_desarrollos' YA existe.
)
::pause

:: PASO 4: Creando la carpeta de destino del backup
echo.
echo === PASO 4: Creando la carpeta de destino del backup ===
echo Creando directorio de backup: "%DESTINATION_DIR%"
mkdir "%DESTINATION_DIR%"
if exist "%DESTINATION_DIR%" (
    echo Directorio de backup creado exitosamente.
) else (
    echo ERROR: No se pudo crear el directorio de backup. Verifique permisos.
    goto :end_script
)
::pause

:: PASO 5: Copiar archivos y directorios con XCOPY
echo.
echo === PASO 5: Copiando archivos y directorios con XCOPY ===
echo Origen: "%SOURCE_DIR%"
echo Destino: "%DESTINATION_DIR%"
echo Opciones: /E (incluye subdirectorios vacios) /I (asume destino es directorio) /Y (sobrescribir sin preguntar)
echo Opciones: /D (copia archivos modificados en o despues de la fecha)
echo **Importante: XCOPY no excluye directorios. Las exclusiones se haran limpiando el destino.**

:: XCOPY:
:: /E: Copia directorios y subdirectorios, incluyendo los vacíos.
:: /I: Si el destino no existe y se copian varios archivos, asume que el destino es un directorio.
:: /Y: Suprime la petición para sobrescribir archivos existentes.
:: /D: Copia archivos que han cambiado en o después de la fecha del archivo de destino.
:: Es lo más cercano a "solo modificados" con XCOPY sin complicar demasiado.

xcopy "%SOURCE_DIR%*.*" "%DESTINATION_DIR%" /E /I /Y /D

echo.
echo XCOPY ERRORLEVEL: %ERRORLEVEL%
echo.

if %ERRORLEVEL% equ 0 (
    echo XCOPY completado exitosamente.
) else if %ERRORLEVEL% equ 1 (
    echo XCOPY: No se encontraron archivos para copiar.
) else if %ERRORLEVEL% equ 2 (
    echo XCOPY: La operacion de copia fue terminada por el usuario.
) else if %ERRORLEVEL% equ 4 (
    echo ERROR: XCOPY: Error de inicializacion (espacio, memoria o sintaxis).
) else if %ERRORLEVEL% equ 5 (
    echo ERROR: XCOPY: Error de acceso (permisos).
) else (
    echo ERROR: XCOPY encontro un problema desconocido. ERRORLEVEL: %ERRORLEVEL%
)

:: Manejar la exclusion de "ejecutaBK.bat" y la carpeta "backup" manualmente
echo.
echo === PASO 5.1: Excluyendo archivos/directorios especificos del backup ===
if exist "%DESTINATION_DIR%\ejecutaBK.bat" (
    del "%DESTINATION_DIR%\ejecutaBK.bat"
    echo Archivo 'ejecutaBK.bat' eliminado del backup.
)
if exist "%DESTINATION_DIR%\backup" (
    rmdir /s /q "%DESTINATION_DIR%\backup"
    echo Carpeta 'backup' eliminada del backup.
)
::pause

:: PASO 6: Verificacion final del backup creado
echo.
echo === PASO 6: Verificacion final del backup creado ===
if exist "%DESTINATION_DIR%" (
    dir "%DESTINATION_DIR%" /A:D /B | findstr . >nul && (
        echo La carpeta de backup "%DESTINATION_DIR%" contiene subdirectorios.
    ) || (
        dir "%DESTINATION_DIR%" /A:-D /B | findstr . >nul && (
            echo La carpeta de backup "%DESTINATION_DIR%" contiene archivos.
        ) || (
            echo WARNING: La carpeta de backup "%DESTINATION_DIR%" esta vacia o solo contiene directorios vacios.
        )
    )
    echo ¡Backup en carpeta completado exitosamente!
    echo La carpeta de backup se encuentra en: "%DESTINATION_DIR%"
) else (
    echo ERROR: La carpeta de backup NO se encontro en la ruta esperada.
)
::pause

:end_script
echo.
echo ===========================================
echo FIN DEL SCRIPT DE BACKUP
echo ===========================================
endlocal
pause