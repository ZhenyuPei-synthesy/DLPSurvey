using System.Text.Json;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using System.Net;
using System.Text;
using System.Data.SqlClient;

namespace Company.Function
{
    public class EvaluateSubcategoryInsights
    {
        private readonly ILogger _logger;

        public EvaluateSubcategoryInsights(ILoggerFactory loggerFactory)
        {
            _logger = loggerFactory.CreateLogger<EvaluateSubcategoryInsights>();
        }

        [Function("EvaluateSubcategoryInsights")]
        public async Task<HttpResponseData> Run(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", "options")] HttpRequestData req)
        {
            _logger.LogInformation("C# HTTP trigger function processed a request.");

            if (req.Method == "OPTIONS")
            {
                var optionsResponse = req.CreateResponse(HttpStatusCode.OK);
                optionsResponse.Headers.Add("Access-Control-Allow-Origin", "*");
                optionsResponse.Headers.Add("Access-Control-Allow-Methods", "POST, OPTIONS");
                optionsResponse.Headers.Add("Access-Control-Allow-Headers", "Content-Type");
                return optionsResponse;
            }

            try
            {
                string requestBody = await new StreamReader(req.Body).ReadToEndAsync();
                _logger.LogInformation($"Request body: {requestBody}");

                var requestData = JsonSerializer.Deserialize<InsightsRequest>(requestBody, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });

                if (requestData == null || 
                    string.IsNullOrEmpty(requestData.RespondentId) ||
                    requestData.HighestSubcategory == null ||
                    requestData.LowestSubcategory == null)
                {
                    var badRequestResponse = req.CreateResponse(HttpStatusCode.BadRequest);
                    await badRequestResponse.WriteStringAsync("Invalid request data");
                    return badRequestResponse;
                }

                // Azure OpenAI設定を取得
                var azureOpenAiApiKey = Environment.GetEnvironmentVariable("AZURE_OPENAI_API_KEY");
                var azureOpenAiEndpoint = Environment.GetEnvironmentVariable("AZURE_OPENAI_ENDPOINT");
                var deploymentName = Environment.GetEnvironmentVariable("AZURE_OPENAI_DEPLOYMENT_NAME");

                if (string.IsNullOrEmpty(azureOpenAiApiKey) || 
                    string.IsNullOrEmpty(azureOpenAiEndpoint) || 
                    string.IsNullOrEmpty(deploymentName))
                {
                    _logger.LogError("Azure OpenAI configuration is missing");
                    var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
                    await errorResponse.WriteStringAsync("Azure OpenAI configuration is missing");
                    return errorResponse;
                }

                // AI評価を生成
                var insights = await GenerateInsightsAsync(
                    requestData.HighestSubcategory,
                    requestData.LowestSubcategory,
                    azureOpenAiApiKey,
                    azureOpenAiEndpoint,
                    deploymentName
                );

                var response = req.CreateResponse(HttpStatusCode.OK);
                response.Headers.Add("Content-Type", "application/json");
                response.Headers.Add("Access-Control-Allow-Origin", "*");
                
                await response.WriteStringAsync(JsonSerializer.Serialize(new
                {
                    success = true,
                    insights = insights
                }));

                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing subcategory insights request");
                var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
                await errorResponse.WriteStringAsync($"Error: {ex.Message}");
                return errorResponse;
            }
        }

        private async Task<SubcategoryInsights> GenerateInsightsAsync(
            SubcategoryInfo highest,
            SubcategoryInfo lowest,
            string apiKey,
            string endpoint,
            string deploymentName)
        {
            using var httpClient = new HttpClient();
            httpClient.DefaultRequestHeaders.Add("api-key", apiKey);

            var systemPrompt = @"
あなたは企業の情報漏洩対策に精通した専門コンサルタントです。
クライアントのDLP（データ損失防止）評価結果から、最高得点と最低得点の中項目を分析し、
建設的で実用的なフィードバックを提供してください。

評価の方針：
1. 最高得点項目：成果を認め、更なる向上への動機付けを行う
2. 最低得点項目：不足を指摘しつつも、前向きで実行可能な改善提案を行う
3. 両方とも具体的で実行可能なアドバイスを含める
4. 企業の実情を考慮した現実的な提案を行う

出力形式：
必ず以下のJSON形式で回答してください。
{
  ""highest_feedback"": {
    ""praise"": ""（優れている点の具体的な評価・称賛）"",
    ""next_step"": ""（この強みを活かした次のステップの提案）""
  },
  ""lowest_feedback"": {
    ""improvement_point"": ""（改善が必要な点の建設的な指摘）"",
    ""actionable_advice"": ""（明日から実行できる具体的なアドバイス）""
  }
}
";

            var userPrompt = $@"
以下のDLP評価結果を分析してフィードバックを生成してください：

【最高得点中項目】
項目名: {highest.SubcategoryName}
大項目: {highest.CategoryName}
得点: {highest.Score:F1}点

【最低得点中項目】
項目名: {lowest.SubcategoryName}
大項目: {lowest.CategoryName}
得点: {lowest.Score:F1}点

上記の情報に基づいて、建設的で実用的なフィードバックを生成してください。
";

            var requestBody = new
            {
                messages = new[]
                {
                    new { role = "system", content = systemPrompt },
                    new { role = "user", content = userPrompt }
                },
                max_tokens = 800,
                temperature = 0.3
            };

            var jsonContent = JsonSerializer.Serialize(requestBody);
            var content = new StringContent(jsonContent, Encoding.UTF8, "application/json");

            var apiUrl = $"{endpoint.TrimEnd('/')}/openai/deployments/{deploymentName}/chat/completions?api-version=2024-02-15-preview";
            
            _logger.LogInformation($"Calling Azure OpenAI API: {apiUrl}");
            
            var response = await httpClient.PostAsync(apiUrl, content);
            var responseString = await response.Content.ReadAsStringAsync();

            _logger.LogInformation($"Azure OpenAI response status: {response.StatusCode}");
            _logger.LogInformation($"Azure OpenAI response: {responseString}");

            if (!response.IsSuccessStatusCode)
            {
                throw new Exception($"Azure OpenAI API error: {response.StatusCode} - {responseString}");
            }

            var openAiResponse = JsonSerializer.Deserialize<OpenAIResponse>(responseString);
            var aiContent = openAiResponse?.choices?[0]?.message?.content;

            if (string.IsNullOrEmpty(aiContent))
            {
                throw new Exception("Azure OpenAI returned empty content");
            }

            // JSONレスポンスをパース
            try
            {
                var insightsResponse = JsonSerializer.Deserialize<InsightsResponse>(aiContent, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });

                return new SubcategoryInsights
                {
                    HighestFeedback = new FeedbackInfo
                    {
                        Praise = insightsResponse?.HighestFeedback?.Praise ?? "優れた取り組みが確認できます。",
                        NextStep = insightsResponse?.HighestFeedback?.NextStep ?? "この強みを更に活かしていきましょう。"
                    },
                    LowestFeedback = new FeedbackInfo
                    {
                        ImprovementPoint = insightsResponse?.LowestFeedback?.ImprovementPoint ?? "改善の余地があります。",
                        ActionableAdvice = insightsResponse?.LowestFeedback?.ActionableAdvice ?? "段階的な改善を進めていきましょう。"
                    }
                };
            }
            catch (JsonException ex)
            {
                _logger.LogWarning($"Failed to parse AI response as JSON: {ex.Message}. Raw content: {aiContent}");
                
                // JSONパースに失敗した場合のフォールバック
                return new SubcategoryInsights
                {
                    HighestFeedback = new FeedbackInfo
                    {
                        Praise = $"{highest.SubcategoryName}において優れた取り組みが確認できます。",
                        NextStep = "この強みを他の分野にも展開することを検討してみてください。"
                    },
                    LowestFeedback = new FeedbackInfo
                    {
                        ImprovementPoint = $"{lowest.SubcategoryName}において改善の余地があります。",
                        ActionableAdvice = "まずは現状の課題を整理し、優先順位をつけて取り組むことから始めましょう。"
                    }
                };
            }
        }

        // レスポンス用のクラス定義
        public class InsightsRequest
        {
            public string RespondentId { get; set; } = string.Empty;
            public SubcategoryInfo HighestSubcategory { get; set; } = new();
            public SubcategoryInfo LowestSubcategory { get; set; } = new();
        }

        public class SubcategoryInfo
        {
            public string SubcategoryName { get; set; } = string.Empty;
            public string CategoryName { get; set; } = string.Empty;
            public double Score { get; set; }
        }

        public class SubcategoryInsights
        {
            public FeedbackInfo HighestFeedback { get; set; } = new();
            public FeedbackInfo LowestFeedback { get; set; } = new();
        }

        public class FeedbackInfo
        {
            public string Praise { get; set; } = string.Empty;
            public string NextStep { get; set; } = string.Empty;
            public string ImprovementPoint { get; set; } = string.Empty;
            public string ActionableAdvice { get; set; } = string.Empty;
        }

        public class InsightsResponse
        {
            public HighestFeedbackResponse HighestFeedback { get; set; } = new();
            public LowestFeedbackResponse LowestFeedback { get; set; } = new();
        }

        public class HighestFeedbackResponse
        {
            public string Praise { get; set; } = string.Empty;
            public string NextStep { get; set; } = string.Empty;
        }

        public class LowestFeedbackResponse
        {
            public string ImprovementPoint { get; set; } = string.Empty;
            public string ActionableAdvice { get; set; } = string.Empty;
        }

        public class OpenAIResponse
        {
            public Choice[]? choices { get; set; }
        }

        public class Choice
        {
            public Message? message { get; set; }
        }

        public class Message
        {
            public string? content { get; set; }
        }
    }
}
