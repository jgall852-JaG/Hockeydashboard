@echo off
setlocal

set "APP_ROOT=%~dp0"
for %%I in ("%APP_ROOT%..\..") do set "REPO_ROOT=%%~fI"
set "DATA_ROOT=%REPO_ROOT%\Data"
set "PORT=8123"

if not exist "%DATA_ROOT%" (
  echo Data folder not found: "%DATA_ROOT%"
  pause
  exit /b 1
)

start "" powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -Command ^
  "$appRoot = '%APP_ROOT%';" ^
  "$repoRoot = '%REPO_ROOT%';" ^
  "$dataRoot = '%DATA_ROOT%';" ^
  "$listener = [System.Net.HttpListener]::new();" ^
  "$listener.Prefixes.Add('http://127.0.0.1:%PORT%/');" ^
  "$listener.Start();" ^
  "try {" ^
  "  while ($listener.IsListening) {" ^
  "    $context = $listener.GetContext();" ^
  "    $requestPath = [Uri]::UnescapeDataString($context.Request.Url.AbsolutePath);" ^
  "    if ($requestPath -eq '/') { $requestPath = '/index.html' }" ^
  "    if ($requestPath.StartsWith('/Data/')) {" ^
  "      $filePath = Join-Path $dataRoot $requestPath.Substring(6);" ^
  "    } else {" ^
  "      $filePath = Join-Path $appRoot $requestPath.TrimStart('/');" ^
  "    }" ^
  "    if (Test-Path $filePath -PathType Leaf) {" ^
  "      $bytes = [System.IO.File]::ReadAllBytes($filePath);" ^
  "      $context.Response.StatusCode = 200;" ^
  "      switch ([System.IO.Path]::GetExtension($filePath).ToLower()) {" ^
  "        '.html' { $context.Response.ContentType = 'text/html' }" ^
  "        '.js' { $context.Response.ContentType = 'text/javascript' }" ^
  "        '.css' { $context.Response.ContentType = 'text/css' }" ^
  "        '.csv' { $context.Response.ContentType = 'text/csv' }" ^
  "        '.md' { $context.Response.ContentType = 'text/markdown' }" ^
  "        default { $context.Response.ContentType = 'application/octet-stream' }" ^
  "      }" ^
  "      $context.Response.OutputStream.Write($bytes, 0, $bytes.Length);" ^
  "    } else {" ^
  "      $context.Response.StatusCode = 404;" ^
  "      $buffer = [Text.Encoding]::UTF8.GetBytes('Not found');" ^
  "      $context.Response.OutputStream.Write($buffer, 0, $buffer.Length);" ^
  "    }" ^
  "    $context.Response.OutputStream.Close();" ^
  "  }" ^
  "} finally { $listener.Stop(); $listener.Close() }"

timeout /t 1 /nobreak >nul
start "" "http://127.0.0.1:%PORT%/index.html"

echo Hockey Dashboard is starting in your browser.
echo Close the hidden PowerShell server from Task Manager if you want to stop it.

endlocal
