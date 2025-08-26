// DLP Survey - Infrastructure as Code
// すべてのリソースを新規作成してデプロイ可能な完全なテンプレート

@description('プロジェクトの接頭辞（リソース名に使用）')
param projectPrefix string = 'dlp-survey'

@description('デプロイ環境（dev, staging, prod）')
@allowed(['dev', 'staging', 'prod'])
param environment string = 'prod'

@description('リソースのデプロイ場所')
param location string = resourceGroup().location

@description('SQL Admin ユーザー名')
param sqlAdminUsername string = 'sqladmin'

@description('SQL Admin パスワード')
@secure()
param sqlAdminPassword string

@description('GitHub リポジトリトークン')
@secure()
param githubToken string

@description('GitHub リポジトリ URL')
param repositoryUrl string = 'https://github.com/ZhenyuPei-synthesy/DLPSurvey'

@description('Static Web Apps のブランチ名')
param appBranch string = '2Branch'

// 一意な名前のサフィックス
var uniqueSuffix = substring(uniqueString(resourceGroup().id), 0, 6)
var resourceNamePrefix = '${projectPrefix}-${environment}'

// Storage Account (Azure Functions用)
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: '${replace(resourceNamePrefix, '-', '')}st${uniqueSuffix}'
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    allowBlobPublicAccess: false
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
  }
}

// Application Insights
resource applicationInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${resourceNamePrefix}-ai-${uniqueSuffix}'
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    Flow_Type: 'Redfield'
    Request_Source: 'IbizaAIExtension'
  }
}

// App Service Plan (Azure Functions用)
resource appServicePlan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: '${resourceNamePrefix}-asp-${uniqueSuffix}'
  location: location
  sku: {
    name: 'Y1'
    tier: 'Dynamic'
    size: 'Y1'
    family: 'Y'
    capacity: 0
  }
  properties: {
    computeMode: 'Dynamic'
  }
}

// SQL Server
resource sqlServer 'Microsoft.Sql/servers@2023-05-01-preview' = {
  name: '${resourceNamePrefix}-sqlsv-${uniqueSuffix}'
  location: location
  properties: {
    administratorLogin: sqlAdminUsername
    administratorLoginPassword: sqlAdminPassword
    version: '12.0'
    publicNetworkAccess: 'Enabled'
  }
  
  // ファイアウォール規則（Azure サービスからのアクセス許可）
  resource allowAzureServices 'firewallRules@2023-05-01-preview' = {
    name: 'AllowAllWindowsAzureIps'
    properties: {
      startIpAddress: '0.0.0.0'
      endIpAddress: '0.0.0.0'
    }
  }
}

// SQL Database
resource sqlDatabase 'Microsoft.Sql/servers/databases@2023-05-01-preview' = {
  parent: sqlServer
  name: '${resourceNamePrefix}-sqldb'
  location: location
  sku: {
    name: 'Basic'
    tier: 'Basic'
    capacity: 5
  }
  properties: {
    collation: 'SQL_Latin1_General_CP1_CI_AS'
    maxSizeBytes: 2147483648 // 2GB
    catalogCollation: 'SQL_Latin1_General_CP1_CI_AS'
  }
}

// Azure Functions App
resource functionApp 'Microsoft.Web/sites@2023-01-01' = {
  name: '${resourceNamePrefix}-fc-${uniqueSuffix}'
  location: location
  kind: 'functionapp'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      ftpsState: 'FtpsOnly'
      minTlsVersion: '1.2'
      cors: {
        allowedOrigins: [
          'https://*.azurestaticapps.net'
          'https://portal.azure.com'
        ]
        supportCredentials: false
      }
      appSettings: [
        {
          name: 'AzureWebJobsStorage'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${storageAccount.listKeys().keys[0].value}'
        }
        {
          name: 'WEBSITE_CONTENTAZUREFILECONNECTIONSTRING'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${storageAccount.listKeys().keys[0].value}'
        }
        {
          name: 'WEBSITE_CONTENTSHARE'
          value: toLower('${resourceNamePrefix}-fc-${uniqueSuffix}')
        }
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: 'dotnet-isolated'
        }
        {
          name: 'APPINSIGHTS_INSTRUMENTATIONKEY'
          value: applicationInsights.properties.InstrumentationKey
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: applicationInsights.properties.ConnectionString
        }
      ]
      connectionStrings: [
        {
          name: 'SqlDbConnection'
          connectionString: 'Server=tcp:${sqlServer.properties.fullyQualifiedDomainName},1433;Initial Catalog=${sqlDatabase.name};Authentication=Active Directory Managed Identity;'
          type: 'SQLAzure'
        }
      ]
    }
  }
}

// Azure Static Web Apps
resource staticWebApp 'Microsoft.Web/staticSites@2023-01-01' = {
  name: '${resourceNamePrefix}-swa-${uniqueSuffix}'
  location: 'East Asia'  // Static Web Apps は限定的な地域でのみ利用可能
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    repositoryUrl: repositoryUrl
    branch: appBranch
    repositoryToken: githubToken
    buildProperties: {
      appLocation: '/'
      apiLocation: ''  // 別のAzure Functions を使用するため空
      outputLocation: 'dist'
    }
  }
}

// SQL Database への権限付与（Function App の Managed Identity用）
resource sqlRoleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(sqlDatabase.id, functionApp.id, 'SqlDbContributor')
  scope: sqlDatabase
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '9b7fa17d-e63e-47b0-bb0a-15c516ac86ec') // SQL DB Contributor
    principalId: functionApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// 出力値
output resourceGroupName string = resourceGroup().name
output functionAppName string = functionApp.name
output functionAppUrl string = 'https://${functionApp.properties.defaultHostName}'
output staticWebAppName string = staticWebApp.name
output staticWebAppUrl string = 'https://${staticWebApp.properties.defaultHostname}'
output sqlServerName string = sqlServer.name
output sqlDatabaseName string = sqlDatabase.name
output storageAccountName string = storageAccount.name
output applicationInsightsName string = applicationInsights.name
