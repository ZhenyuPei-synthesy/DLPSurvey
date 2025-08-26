# Azure DLP Survey Infrastructure Deployment Script (PowerShell)
param(
    [string]$ResourceGroupName = "rg-dlp-survey-prod",
    [string]$Location = "East Asia", 
    [string]$ParametersFile = "parameters.dev.json"
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 DLP Survey Infrastructure Deployment Starting..." -ForegroundColor Green
Write-Host "📍 Resource Group: $ResourceGroupName" -ForegroundColor Cyan
Write-Host "🌏 Location: $Location" -ForegroundColor Cyan
Write-Host "📋 Parameters File: $ParametersFile" -ForegroundColor Cyan

# Azure PowerShell ログイン確認
Write-Host "🔐 Checking Azure PowerShell login..." -ForegroundColor Yellow
try {
    $context = Get-AzContext
    if (!$context) {
        throw "Not logged in"
    }
    Write-Host "✅ Logged in as: $($context.Account.Id)" -ForegroundColor Green
} catch {
    Write-Host "❌ Azure PowerShell not logged in. Please run 'Connect-AzAccount'" -ForegroundColor Red
    exit 1
}

# リソースグループの作成
Write-Host "📦 Creating resource group..." -ForegroundColor Yellow
$resourceGroup = New-AzResourceGroup `
    -Name $ResourceGroupName `
    -Location $Location `
    -Tag @{project="dlp-survey"; environment="prod"; deployedBy="IaC"} `
    -Force

Write-Host "✅ Resource group created: $($resourceGroup.ResourceGroupName)" -ForegroundColor Green

# Bicepテンプレートのデプロイ
$deploymentName = "dlp-survey-deployment-$(Get-Date -Format 'yyyyMMddHHmmss')"
Write-Host "🏗️ Deploying infrastructure (Deployment: $deploymentName)..." -ForegroundColor Yellow

try {
    $deployment = New-AzResourceGroupDeployment `
        -ResourceGroupName $ResourceGroupName `
        -TemplateFile "main.bicep" `
        -TemplateParameterFile $ParametersFile `
        -Name $deploymentName `
        -Verbose

    Write-Host "✅ Deployment completed successfully!" -ForegroundColor Green
} catch {
    Write-Host "❌ Deployment failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# デプロイ結果の表示
Write-Host ""
Write-Host "📋 Deployment Summary:" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

$outputs = $deployment.Outputs
$functionAppUrl = $outputs.functionAppUrl.Value
$staticWebAppUrl = $outputs.staticWebAppUrl.Value
$sqlServerName = $outputs.sqlServerName.Value
$sqlDatabaseName = $outputs.sqlDatabaseName.Value
$functionAppName = $outputs.functionAppName.Value

Write-Host "🌐 Azure Functions URL: $functionAppUrl" -ForegroundColor Green
Write-Host "🌐 Static Web App URL: $staticWebAppUrl" -ForegroundColor Green
Write-Host "🗄️  SQL Server: $sqlServerName" -ForegroundColor Green
Write-Host "🗄️  SQL Database: $sqlDatabaseName" -ForegroundColor Green
Write-Host ""

# 次のステップの案内
Write-Host "🔧 Next Steps:" -ForegroundColor Yellow
Write-Host "1. Deploy Azure Functions code:" -ForegroundColor White
Write-Host "   cd api && func azure functionapp publish $functionAppName" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Initialize SQL Database:" -ForegroundColor White
Write-Host "   Run database/create-tables.sql against the SQL Database" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Update environment variables in GitHub Actions:" -ForegroundColor White
Write-Host "   VITE_APP_GET_SURVEY_API_URL: $functionAppUrl/api/GetSurveyQuestions" -ForegroundColor Gray
Write-Host "   VITE_SUBMIT_SURVEY_API_URL: $functionAppUrl/api/SubmitSurveyAnswers" -ForegroundColor Gray
Write-Host ""

# 環境変数ファイルの自動更新
Write-Host "🔄 Updating .env file with new URLs..." -ForegroundColor Yellow
$envContent = @"
VITE_APP_GET_SURVEY_API_URL=$functionAppUrl/api/GetSurveyQuestions
VITE_SUBMIT_SURVEY_API_URL=$functionAppUrl/api/SubmitSurveyAnswers
"@

$envContent | Out-File -FilePath "../.env" -Encoding UTF8
Write-Host "✅ .env file updated!" -ForegroundColor Green

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "🎉 Infrastructure deployment completed!" -ForegroundColor Green

# 出力値をJSONで保存
$outputJson = $outputs | ConvertTo-Json -Depth 3
$outputJson | Out-File -FilePath "deployment-outputs.json" -Encoding UTF8
Write-Host "📄 Deployment outputs saved to: deployment-outputs.json" -ForegroundColor Cyan
