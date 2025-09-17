using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Data.SqlClient;
using System.Text.Json;
using System.Net;

namespace DlpFunctions
{
    public class GetAIAdviceEvaluation
    {
        private readonly ILogger _logger;

        public GetAIAdviceEvaluation(ILoggerFactory loggerFactory)
        {
            _logger = loggerFactory.CreateLogger<GetAIAdviceEvaluation>();
        }

        [Function("GetAIAdviceEvaluation")]
        public async Task<HttpResponseData> Run([HttpTrigger(AuthorizationLevel.Function, "get")] HttpRequestData req)
        {
            _logger.LogInformation("GetAIAdviceEvaluation function processed a request.");

            try
            {
                string? respondentId = req.Query["respondentId"];
                
                if (string.IsNullOrEmpty(respondentId))
                {
                    var errorResponse = req.CreateResponse(HttpStatusCode.BadRequest);
                    await errorResponse.WriteStringAsync("回答者IDが必要です。");
                    return errorResponse;
                }

                string? connectionString = Environment.GetEnvironmentVariable("SqlDbConnection", EnvironmentVariableTarget.Process);
                if (string.IsNullOrEmpty(connectionString))
                {
                    var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
                    await errorResponse.WriteStringAsync("データベース接続文字列が設定されていません。");
                    return errorResponse;
                }

                using (var connection = new SqlConnection(connectionString))
                {
                    await connection.OpenAsync();

                    // AIAdvice_CHU$テーブルからデータを取得
                    string query = @"
                        SELECT average_score, is_applicable
                        FROM AIAdvice_CHU$
                        WHERE RespondentId = @RespondentId";

                    using (var command = new SqlCommand(query, connection))
                    {
                        command.Parameters.AddWithValue("@RespondentId", respondentId);
                        
                        using (var reader = await command.ExecuteReaderAsync())
                        {
                            if (await reader.ReadAsync())
                            {
                                var response = req.CreateResponse(HttpStatusCode.OK);
                                var result = new
                                {
                                    success = true,
                                    aiAdviceData = new
                                    {
                                        averageScore = reader.IsDBNull(reader.GetOrdinal("average_score")) ? (double?)null : reader.GetDouble(reader.GetOrdinal("average_score")),
                                        isApplicable = reader.IsDBNull(reader.GetOrdinal("is_applicable")) ? (int?)null : reader.GetInt32(reader.GetOrdinal("is_applicable"))
                                    }
                                };
                                await response.WriteStringAsync(JsonSerializer.Serialize(result));
                                return response;
                            }
                            else
                            {
                                // データが存在しない場合
                                var response = req.CreateResponse(HttpStatusCode.OK);
                                var result = new
                                {
                                    success = false,
                                    message = "AI評価データが見つかりません。",
                                    aiAdviceData = (object)null
                                };
                                await response.WriteStringAsync(JsonSerializer.Serialize(result));
                                return response;
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "GetAIAdviceEvaluation function encountered an error.");
                                var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
                                await errorResponse.WriteStringAsync($"エラーが発生しました: {ex.Message}");
                                return errorResponse;
            }
        }
    }
}