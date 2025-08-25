using System;
using System.Collections.Generic;
using System.Net;
using System.Threading.Tasks;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Data.SqlClient;
using Newtonsoft.Json;
using Azure.Core; // ★ マネージドID認証用
using Azure.Identity; // ★ マネージドID認証用

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
            [HttpTrigger(AuthorizationLevel.Function, "get", "post")] HttpRequestData req)
        {
            _logger.LogInformation("C# HTTP trigger function processed a request.");

            // 接続文字列取得
            var connectionString = Environment.GetEnvironmentVariable("SqlDbConnection", EnvironmentVariableTarget.Process);
            var questions = new List<SurveyQuestion>();
            var response = req.CreateResponse();

            try
            {
                using (var connection = new SqlConnection(connectionString))
                {
                    // ★★★★★ ここからが修正箇所 ★★★★★
                    // マネージドIDを使って、データベースへのアクセストークンを取得します。
                    var credential = new DefaultAzureCredential();
                    var tokenRequestContext = new TokenRequestContext(new[] { "https://database.windows.net/.default" });
                    var accessToken = await credential.GetTokenAsync(tokenRequestContext);

                    // 取得したトークンを接続オブジェクトに設定します。
                    connection.AccessToken = accessToken.Token;
                    // ★★★★★ ここまで ★★★★★
                    await connection.OpenAsync();
                    var cmd = new SqlCommand("SELECT 大項目, 中項目, チェック項目, 対策評価, リスク FROM dbo.Servey", connection);
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
                response.Headers.Add("Content-Type", "application/json; charset=utf-8");
                await response.WriteAsJsonAsync(questions);
                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "DB取得またはトークン取得でエラーが発生しました。");
                response.StatusCode = HttpStatusCode.InternalServerError;
                return response;
            }
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
