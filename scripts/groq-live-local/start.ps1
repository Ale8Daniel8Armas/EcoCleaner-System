param([ValidateRange(1024,65535)][int]$Port = 5187, [string]$ResumeDirectory, [switch]$App, [switch]$AllowAppData, [ValidateRange(1,2147483647)][int]$AuthorizedTokenBudget, [ValidateRange(1,1000)][int]$AuthorizedMaxGenerations, [switch]$ReviewedConfigurationFix)
$ErrorActionPreference = 'Stop'
if ($App -and -not $PSBoundParameters.ContainsKey('Port')) { $Port = 5173 }
$taskConfigRoot = Join-Path $env:LOCALAPPDATA 'EcoCleaner\groq-live-local'
$taskConfigPath = Join-Path $taskConfigRoot 'account.json'
if (-not (Test-Path -LiteralPath $taskConfigPath)) { throw 'Falta confirmar la cuenta y sus límites. Ejecuta configure.ps1.' }
$taskPreviousKey = $env:GROQ_API_KEY
$taskPreviousConfig = $env:ECOCLEANER_GROQ_ACCOUNT_FILE
$taskSecureKey = $null
$taskKeyPointer = [IntPtr]::Zero
try {
  if ([string]::IsNullOrWhiteSpace($env:GROQ_API_KEY)) {
    $taskKeyPath = Join-Path $taskConfigRoot 'groq-key.dpapi'
    if (-not (Test-Path -LiteralPath $taskKeyPath)) { throw 'Falta GROQ_API_KEY. Ejecuta configure.ps1.' }
    $taskSecureKey = ConvertTo-SecureString ([IO.File]::ReadAllText($taskKeyPath))
    $taskKeyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($taskSecureKey)
    $env:GROQ_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($taskKeyPointer)
  }
  $env:ECOCLEANER_GROQ_ACCOUNT_FILE = $taskConfigPath
  $taskRegisterUri = ([Uri](Join-Path $PSScriptRoot 'register.mjs')).AbsoluteUri
  $taskNodeArgs = @('--import', $taskRegisterUri, (Join-Path $PSScriptRoot 'server.mjs'), '--port', $Port)
  if (-not [string]::IsNullOrWhiteSpace($ResumeDirectory)) { $taskNodeArgs += @('--resume', $ResumeDirectory) }
  if ($App) { $taskNodeArgs += '--app' }
  if ($AllowAppData) { $taskNodeArgs += '--allow-app-data' }
  if ($PSBoundParameters.ContainsKey('AuthorizedTokenBudget')) { $taskNodeArgs += @('--budget', $AuthorizedTokenBudget) }
  if ($PSBoundParameters.ContainsKey('AuthorizedMaxGenerations')) { $taskNodeArgs += @('--max-generations', $AuthorizedMaxGenerations) }
  if ($ReviewedConfigurationFix) { $taskNodeArgs += '--reviewed-configuration' }
  & node @taskNodeArgs
  if ($LASTEXITCODE -ne 0) { throw 'La prueba local terminó con un error. Revisa el código controlado indicado.' }
} finally {
  $env:GROQ_API_KEY = $taskPreviousKey
  $env:ECOCLEANER_GROQ_ACCOUNT_FILE = $taskPreviousConfig
  if ($taskKeyPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($taskKeyPointer) }
  if ($null -ne $taskSecureKey) { $taskSecureKey.Dispose() }
}
