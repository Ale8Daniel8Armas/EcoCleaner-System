$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT') { throw 'Esta configuración utiliza DPAPI de Windows.' }
$taskConfigRoot = Join-Path $env:LOCALAPPDATA 'EcoCleaner\groq-live-local'
New-Item -ItemType Directory -Path $taskConfigRoot -Force | Out-Null
Write-Host 'Crea la clave en https://console.groq.com/keys y revisa el plan y los límites de openai/gpt-oss-20b en tu cuenta.'
Write-Host 'No pegues la clave en el chat ni la guardes en el repositorio. Esta herramienta la cifra con tu usuario de Windows.'
$taskFreeConfirmation = Read-Host 'Si verificaste que utilizarás el plan gratuito sin activar facturación, escribe GRATIS'
if ($taskFreeConfirmation -cne 'GRATIS') { throw 'No se confirmó el uso del plan gratuito. No se guardó ninguna clave.' }
function Read-PositiveLimit([string]$label) {
  $taskValue = Read-Host $label
  $taskNumber = 0
  if (-not [int]::TryParse($taskValue, [ref]$taskNumber) -or $taskNumber -le 0) {
    throw 'Introduce el límite numérico que muestra la consola, sin abreviaturas ni separadores.'
  }
  return $taskNumber
}
$taskLimits = @{
  requestsPerMinute = Read-PositiveLimit 'Solicitudes por minuto (RPM)'
  requestsPerDay = Read-PositiveLimit 'Solicitudes por día (RPD)'
  tokensPerMinute = Read-PositiveLimit 'Tokens por minuto (TPM)'
  tokensPerDay = Read-PositiveLimit 'Tokens por día (TPD)'
}
$taskRemaining = Read-PositiveLimit 'Presupuesto de tokens todavía disponible hoy que autorizas para esta prueba (como máximo el TPD)'
if ($taskRemaining -gt $taskLimits.tokensPerDay) { throw 'El presupuesto no puede superar el TPD.' }
$taskSecret = Read-Host 'GROQ_API_KEY (entrada oculta)' -AsSecureString
if ($taskSecret.Length -lt 20) { throw 'La clave está vacía o incompleta.' }
$taskCipher = ConvertFrom-SecureString $taskSecret
[IO.File]::WriteAllText((Join-Path $taskConfigRoot 'groq-key.dpapi'), $taskCipher)
$taskConfig = @{
  model = 'openai/gpt-oss-20b'
  freeTierConfirmedAt = [DateTimeOffset]::UtcNow.ToString('o')
  limits = $taskLimits
  authorizedTokenBudget = $taskRemaining
  maxGenerations = [Math]::Min(11, $taskLimits.requestsPerDay)
  syntheticOnly = $true
}
[IO.File]::WriteAllText((Join-Path $taskConfigRoot 'account.json'), ($taskConfig | ConvertTo-Json -Depth 5))
$taskSecret.Dispose()
Write-Host 'Configuración guardada fuera del repositorio. La clave quedó cifrada con DPAPI.'
Write-Host 'Todavía no se ha enviado ninguna solicitud de generación.'
