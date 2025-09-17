using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Data.SqlClient;
using System.Text.Json;
using System.Net;

namespace DlpFunctions
{
    public class SaveAIAdviceEvaluation
    {
        private readonly ILogger _logger;

        public SaveAIAdviceEvaluation(ILoggerFactory loggerFactory)
        {
            _logger = loggerFactory.CreateLogger<SaveAIAdviceEvaluation>();
        }

        [Function("SaveAIAdviceEvaluation")]
        public async Task<HttpResponseData> Run([HttpTrigger(AuthorizationLevel.Function, "post")] HttpRequestData req)
        {
            _logger.LogInformation("SaveAIAdviceEvaluation function processed a request.");

            try
            {
                string requestBody = await new StreamReader(req.Body).ReadToEndAsync();
                var requestData = JsonSerializer.Deserialize<SaveAIAdviceRequest>(requestBody);

                if (requestData == null || string.IsNullOrEmpty(requestData.RespondentId))
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

                    // 中項目別の平均スコアを計算（限定提供データ管理は該当の場合のみ含める）
                    string averageScoreQuery = @"
                        SELECT AVG(CAST(sa.Score AS FLOAT)) as AverageScore
                        FROM SurveyAnswers sa
                        INNER JOIN SurveyQuestions sq ON sa.ItemId = sq.Id
                        WHERE sa.RespondentId = @RespondentId
                        AND sa.Score IS NOT NULL
                        AND sa.Score > 0
                        AND (sq.Category != '7. 限定提供データの管理' OR @IsLimitedDataApplicable = 1)";

                    using (var avgCmd = new SqlCommand(averageScoreQuery, connection))
                    {
                        avgCmd.Parameters.AddWithValue("@RespondentId", requestData.RespondentId);
                        avgCmd.Parameters.AddWithValue("@IsLimitedDataApplicable", requestData.IsLimitedDataApplicable);
                        
                        var avgResult = await avgCmd.ExecuteScalarAsync();
                        double averageScore = avgResult != DBNull.Value ? Convert.ToDouble(avgResult) : 0.0;

                        // AIAdvice_CHU$テーブルにデータを保存または更新
                        string upsertQuery = @"
                            MERGE AIAdvice_CHU$ AS target
                            USING (VALUES (@RespondentId, @AverageScore, @IsApplicable)) AS source (RespondentId, AverageScore, IsApplicable)
                            ON target.RespondentId = source.RespondentId
                            WHEN MATCHED THEN
                                UPDATE SET average_score = source.AverageScore, is_applicable = source.IsApplicable
                            WHEN NOT MATCHED THEN
                                INSERT (RespondentId, average_score, is_applicable)
                                VALUES (source.RespondentId, source.AverageScore, source.IsApplicable);";

                        using (var upsertCmd = new SqlCommand(upsertQuery, connection))
                        {
                            upsertCmd.Parameters.AddWithValue("@RespondentId", requestData.RespondentId);
                            upsertCmd.Parameters.AddWithValue("@AverageScore", averageScore);
                            upsertCmd.Parameters.AddWithValue("@IsApplicable", requestData.IsLimitedDataApplicable ? 1 : 0);

                            int rowsAffected = await upsertCmd.ExecuteNonQueryAsync();
                            
                            _logger.LogInformation($"AIAdvice_CHU$ updated for RespondentId: {requestData.RespondentId}, AverageScore: {averageScore}, IsApplicable: {(requestData.IsLimitedDataApplicable ? 1 : 0)}");

                            var response = req.CreateResponse(HttpStatusCode.OK);
                            var result = new
                            {
                                message = "AI評価データが正常に保存されました。",
                                respondentId = requestData.RespondentId,
                                averageScore = averageScore,
                                isApplicable = requestData.IsLimitedDataApplicable ? 1 : 0,
                                rowsAffected = rowsAffected
                            };
                            await response.WriteStringAsync(JsonSerializer.Serialize(result));
                            return response;
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "SaveAIAdviceEvaluation function encountered an error.");
                var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
                await errorResponse.WriteStringAsync($"エラーが発生しました: {ex.Message}");
                return errorResponse;
            }
        }
    }

    public class SaveAIAdviceRequest
    {
        public string RespondentId { get; set; } = string.Empty;
        public bool IsLimitedDataApplicable { get; set; }
    }
}