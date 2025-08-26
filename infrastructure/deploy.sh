#!/bin/bash
# Azure DLP Survey Infrastructure Deployment Script

set -e

# 設定変数
RESOURCE_GROUP_NAME="rg-dlp-survey-prod"
LOCATION="East Asia"
DEPLOYMENT_NAME="dlp-survey-deployment-$(date +%Y%m%d%H%M%S)"
PARAMETERS_FILE="parameters.dev.json"  # または parameters.json

echo "🚀 DLP Survey Infrastructure Deployment Starting..."
echo "📍 Resource Group: $RESOURCE_GROUP_NAME"
echo "🌏 Location: $LOCATION"
echo "📋 Parameters File: $PARAMETERS_FILE"

# Azure CLI ログイン確認
echo "🔐 Checking Azure CLI login..."
if ! az account show > /dev/null 2>&1; then
    echo "❌ Azure CLI not logged in. Please run 'az login'"
    exit 1
fi

# リソースグループの作成
echo "📦 Creating resource group..."
az group create \
    --name "$RESOURCE_GROUP_NAME" \
    --location "$LOCATION" \
    --tags project="dlp-survey" environment="prod" deployedBy="IaC"

# Bicepテンプレートのデプロイ
echo "🏗️ Deploying infrastructure..."
az deployment group create \
    --resource-group "$RESOURCE_GROUP_NAME" \
    --template-file "main.bicep" \
    --parameters "@$PARAMETERS_FILE" \
    --name "$DEPLOYMENT_NAME" \
    --verbose

# デプロイ結果の取得
echo "📊 Getting deployment outputs..."
DEPLOYMENT_OUTPUTS=$(az deployment group show \
    --resource-group "$RESOURCE_GROUP_NAME" \
    --name "$DEPLOYMENT_NAME" \
    --query "properties.outputs" \
    --output json)

# 重要な情報を表示
echo "✅ Deployment completed successfully!"
echo ""
echo "📋 Deployment Summary:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

FUNCTION_APP_URL=$(echo $DEPLOYMENT_OUTPUTS | jq -r '.functionAppUrl.value // "N/A"')
STATIC_WEB_APP_URL=$(echo $DEPLOYMENT_OUTPUTS | jq -r '.staticWebAppUrl.value // "N/A"')
SQL_SERVER_NAME=$(echo $DEPLOYMENT_OUTPUTS | jq -r '.sqlServerName.value // "N/A"')
SQL_DATABASE_NAME=$(echo $DEPLOYMENT_OUTPUTS | jq -r '.sqlDatabaseName.value // "N/A"')

echo "🌐 Azure Functions URL: $FUNCTION_APP_URL"
echo "🌐 Static Web App URL: $STATIC_WEB_APP_URL"
echo "🗄️  SQL Server: $SQL_SERVER_NAME"
echo "🗄️  SQL Database: $SQL_DATABASE_NAME"
echo ""

# 次のステップの案内
echo "🔧 Next Steps:"
echo "1. Deploy Azure Functions code:"
echo "   cd api && func azure functionapp publish \$(echo $DEPLOYMENT_OUTPUTS | jq -r '.functionAppName.value')"
echo ""
echo "2. Initialize SQL Database:"
echo "   Run database/create-tables.sql against the SQL Database"
echo ""
echo "3. Update environment variables in GitHub Actions:"
echo "   VITE_APP_GET_SURVEY_API_URL: $FUNCTION_APP_URL/api/GetSurveyQuestions"
echo "   VITE_SUBMIT_SURVEY_API_URL: $FUNCTION_APP_URL/api/SubmitSurveyAnswers"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# オプション: 自動的にSQL Database初期化
read -p "🤔 Do you want to initialize the SQL Database now? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🗄️  Initializing SQL Database..."
    
    # SQL Database接続とテーブル作成
    sqlcmd -S "$SQL_SERVER_NAME.database.windows.net" \
           -d "$SQL_DATABASE_NAME" \
           -U "$SQL_ADMIN_USERNAME" \
           -P "$SQL_ADMIN_PASSWORD" \
           -i "../database/create-tables.sql"
    
    echo "✅ SQL Database initialized successfully!"
fi

echo "🎉 Infrastructure deployment completed!"
