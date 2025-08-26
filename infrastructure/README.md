# DLP Survey - Infrastructure as Code (IaC)

このフォルダには、DLP Survey アプリケーションのAzureインフラストラクチャを自動デプロイするためのテンプレートが含まれています。

## 📋 構成サービス

| サービス | 説明 | SKU/プラン |
|----------|------|-----------|
| **Azure Functions** | .NET 8 バックエンドAPI | 従量課金プラン (Y1) |
| **Azure SQL Database** | データストレージ | Basic (5 DTU, 2GB) |
| **Azure Static Web Apps** | React フロントエンドホスティング | Free プラン |
| **Azure Storage Account** | Functions用ストレージ | Standard_LRS |
| **Application Insights** | アプリケーション監視 | - |

## 🚀 デプロイ方法

### 前提条件

1. **Azure CLI** または **Azure PowerShell** がインストール済み
2. **Bicep CLI** がインストール済み (`az bicep install`)
3. **Azureサブスクリプションへのログイン**
4. **GitHub Personal Access Token** (Static Web Apps デプロイ用)

### Option 1: PowerShell でのデプロイ (推奨)

```powershell
# Azureにログイン
Connect-AzAccount

# infrastructureフォルダに移動
cd infrastructure

# パラメータファイルを編集 (GitHub Token, SQL パスワードを設定)
# parameters.dev.json を編集してください

# デプロイ実行
.\Deploy.ps1 -ResourceGroupName "rg-dlp-survey-prod" -ParametersFile "parameters.dev.json"
```

### Option 2: Azure CLI でのデプロイ

```bash
# Azureにログイン
az login

# infrastructureフォルダに移動
cd infrastructure

# パラメータファイルを編集
# parameters.dev.json を編集してください

# デプロイ実行
chmod +x deploy.sh
./deploy.sh
```

### Option 3: Azure Portal でのデプロイ

1. Azure Portal で「リソースグループ」を作成
2. 「デプロイ」→「カスタムテンプレート」を選択
3. `main.bicep` の内容をコピー&ペースト
4. パラメータを入力してデプロイ

## 📁 ファイル構成

```
infrastructure/
├── main.bicep              # メインのBicepテンプレート
├── parameters.json         # 本番用パラメータファイル (Key Vault参照)
├── parameters.dev.json     # 開発用パラメータファイル
├── Deploy.ps1             # PowerShell デプロイスクリプト
├── deploy.sh              # Bash デプロイスクリプト
└── README.md              # この説明書
```

## ⚙️ パラメータ設定

### 必須パラメータ

| パラメータ | 説明 | 例 |
|-----------|------|-----|
| `sqlAdminPassword` | SQL Database管理者パスワード | `YourSecurePassword123!` |
| `githubToken` | GitHub Personal Access Token | `ghp_xxxxxxxxxxxx` |

### オプションパラメータ

| パラメータ | デフォルト値 | 説明 |
|-----------|-------------|------|
| `projectPrefix` | `dlp-survey` | リソース名プレフィックス |
| `environment` | `prod` | 環境名 (dev/staging/prod) |
| `location` | `East Asia` | デプロイ地域 |
| `repositoryUrl` | GitHub repo URL | リポジトリURL |
| `appBranch` | `2Branch` | デプロイ対象ブランチ |

## 🔐 セキュリティ設定

### 推奨事項

1. **Azure Key Vault** を使用してシークレットを管理
2. **Managed Identity** でSQL Database認証
3. **HTTPS Only** 設定が有効
4. **最小TLS 1.2** の強制

### Key Vault設定 (本番環境推奨)

```bash
# Key Vault作成
az keyvault create --name "kv-dlp-survey-secrets" --resource-group "rg-dlp-survey-shared"

# シークレット設定
az keyvault secret set --vault-name "kv-dlp-survey-secrets" --name "sql-admin-password" --value "YourSecurePassword123!"
az keyvault secret set --vault-name "kv-dlp-survey-secrets" --name "github-token" --value "ghp_xxxxxxxxxxxx"
```

## 🔄 デプロイ後の手順

### 1. Azure Functions コードデプロイ

```bash
cd api
func azure functionapp publish [FunctionAppName]
```

### 2. SQL Database初期化

- `database/create-tables.sql` を実行
- Azure Portal または SQL Server Management Studio を使用

### 3. GitHub Actions 環境変数更新

デプロイ出力に表示されるURLを使用して、以下を更新:

```yaml
env:
  VITE_APP_GET_SURVEY_API_URL: [Function App URL]/api/GetSurveyQuestions
  VITE_SUBMIT_SURVEY_API_URL: [Function App URL]/api/SubmitSurveyAnswers
```

## 🧹 リソースの削除

```powershell
# リソースグループごと削除
Remove-AzResourceGroup -Name "rg-dlp-survey-prod" -Force
```

## 🔍 トラブルシューティング

### よくある問題

1. **SQL Database接続エラー**
   - Managed Identity の権限設定を確認
   - ファイアウォール規則を確認

2. **Static Web Apps デプロイ失敗**
   - GitHub Token の権限を確認
   - リポジトリURLとブランチ名を確認

3. **Functions デプロイエラー**
   - Storage Account の接続文字列を確認
   - App Settings を確認

### ログ確認方法

```bash
# デプロイログ確認
az deployment group show --resource-group "rg-dlp-survey-prod" --name [DeploymentName]

# Functions ログ確認
func azure functionapp logstream [FunctionAppName]
```

## 📊 コスト見積もり

| サービス | 月額概算 (東アジア) |
|----------|-------------------|
| Azure Functions (従量課金) | $0-20 |
| SQL Database (Basic) | $5 |
| Static Web Apps (Free) | $0 |
| Storage Account | $1-2 |
| Application Insights | $0-5 |
| **合計** | **$6-32** |

---

> 💡 **ヒント**: 初回デプロイ後は、GitHub Actions が自動的にフロントエンドをデプロイし、Azure Functions も自動デプロイ設定が可能です。
