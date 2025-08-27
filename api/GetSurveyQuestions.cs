using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Threading.Tasks;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Data.SqlClient;
using Newtonsoft.Json;
using Azure.Core;
using Azure.Identity;

namespace Company.Function
{
    public class GetSurveyQuestions
    {
        private readonly ILogger _logger;

        public GetSurveyQuestions(ILoggerFactory loggerFactory)
        {
            _logger = loggerFactory.CreateLogger<GetSurveyQuestions>();
        }

        [Function("GetSurveyQuestions")]
        public async Task<HttpResponseData> Run(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", "post", "options")] HttpRequestData req)
        {
            _logger.LogInformation("C# HTTP trigger function processed a request.");

            var response = req.CreateResponse();

            // CORS プリフライトリクエスト（OPTIONS）の処理
            if (req.Method == "OPTIONS")
            {
                response.StatusCode = HttpStatusCode.OK;
                AddCorsHeaders(response, req);
                return response;
            }

            // 接続文字列取得
            var connectionString = Environment.GetEnvironmentVariable("SqlDbConnection", EnvironmentVariableTarget.Process);
            var questions = new List<SurveyQuestion>();

            try
            {
                using (var connection = new SqlConnection(connectionString))
                {
                    await connection.OpenAsync();
                    var cmd = new SqlCommand("SELECT 大項目, 中項目, チェック項目, 対策評価, リスク FROM dbo.Servey$", connection);
                    using (var reader = await cmd.ExecuteReaderAsync())
                    {
                        while (await reader.ReadAsync())
                        {
                            questions.Add(new SurveyQuestion
                            {
                                DaiItem = reader["大項目"].ToString(),
                                ChuItem = reader["中項目"].ToString(),
                                CheckItem = reader["チェック項目"].ToString(),
                                TargetEvaluation = reader["対策評価"].ToString(),
                                Risk = reader["リスク"].ToString()
                            });
                        }
                    }
                }

                response.StatusCode = HttpStatusCode.OK;
                AddCorsHeaders(response, req);
                await response.WriteAsJsonAsync(questions);
                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "DB取得またはトークン取得でエラーが発生しました。");
                response.StatusCode = HttpStatusCode.InternalServerError;
                AddCorsHeaders(response, req);
                return response;
            }
        }

        private void AddCorsHeaders(HttpResponseData response, HttpRequestData request)
        {
            // 許可するOriginのリスト
            var allowedOrigins = new[]
            {
                "http://localhost:3000",    // React開発サーバー
                "http://localhost:5173",    // Vite開発サーバー  
                "http://localhost:4280",    // SWA CLI開発サーバー
                "https://orange-pebble-0db3cdd00.1.azurestaticapps.net" // 本番環境
            };

            var origin = request.Headers.GetValues("Origin")?.FirstOrDefault();
            
            if (!string.IsNullOrEmpty(origin) && allowedOrigins.Contains(origin))
            {
                response.Headers.Add("Access-Control-Allow-Origin", origin);
            }
            else
            {
                // デフォルトで本番環境を許可（後方互換性のため）
                response.Headers.Add("Access-Control-Allow-Origin", "https://orange-pebble-0db3cdd00.1.azurestaticapps.net");
            }
            
            response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
            response.Headers.Add("Access-Control-Allow-Headers", "Content-Type, Authorization");
            response.Headers.Add("Access-Control-Allow-Credentials", "false");
        }

        public class SurveyQuestion
        {
            public string DaiItem { get; set; }
            public string ChuItem { get; set; }
            public string CheckItem { get; set; }
            public string TargetEvaluation { get; set; }
            public string Risk { get; set; }
        }
    }
}
