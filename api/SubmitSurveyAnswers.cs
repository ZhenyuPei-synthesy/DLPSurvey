using System;
using System.Collections.Generic;
using System.Net;
using System.Text;
using System.Threading.Tasks;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Data.SqlClient;
using Newtonsoft.Json;

namespace Company.Function
{
    public class SubmitSurveyAnswers
    {
        private readonly ILogger _logger;

        private DateTime GetJapanNow()
        {
            try
            {
                var tz = TimeZoneInfo.FindSystemTimeZoneById("Tokyo Standard Time");
                return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz);
            }
            catch
            {
                try
                {
                    var tz = TimeZoneInfo.FindSystemTimeZoneById("Asia/Tokyo");
                    return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz);
                }
                catch
                {
                    return DateTime.UtcNow.AddHours(9);
                }
            }
        }

        public SubmitSurveyAnswers(ILoggerFactory loggerFactory)
        {
            _logger = loggerFactory.CreateLogger<SubmitSurveyAnswers>();
        }

        [Function("SubmitSurveyAnswers")]
        public async Task<HttpResponseData> Run(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post")] HttpRequestData req)
        {
            _logger.LogInformation("Survey answers submission request processed.");

            var response = req.CreateResponse();

            try
            {
                // リクエストボディを読み取り
                string requestBody = await req.ReadAsStringAsync() ?? "{}";
                var submissionData = JsonConvert.DeserializeObject<SubmissionRequest>(requestBody);

                _logger.LogInformation($"Received submission for respondent {submissionData?.RespondentId} with {submissionData?.AnswerItems?.Count ?? 0} answers");

                // 接続文字列取得
                var connectionString = Environment.GetEnvironmentVariable("SqlDbConnection", EnvironmentVariableTarget.Process);
                
                if (string.IsNullOrEmpty(connectionString))
                {
                    response.StatusCode = HttpStatusCode.InternalServerError;
                    await response.WriteStringAsync("Database connection not configured");
                    return response;
                }

                if (submissionData?.AnswerItems == null || string.IsNullOrEmpty(submissionData.RespondentId))
                {
                    response.StatusCode = HttpStatusCode.BadRequest;
                    await response.WriteAsJsonAsync(new { 
                        success = false, 
                        error = "Invalid request data" 
                    });
                    return response;
                }

                // データベースに保存
                using (var connection = new SqlConnection(connectionString))
                {
                    await connection.OpenAsync();
                    
                    using (var transaction = connection.BeginTransaction())
                    {
                        try
                        {
                            // 既存の回答データを削除して最終回答を保存
                            var deleteCmd = new SqlCommand("DELETE FROM [Answers$] WHERE [回答者番号] = @RespondentId", connection, transaction);
                            deleteCmd.Parameters.AddWithValue("@RespondentId", submissionData.RespondentId);
                            await deleteCmd.ExecuteNonQueryAsync();
                            
                            foreach (var answerItem in submissionData.AnswerItems)
                            {
                                var insertCmd = new SqlCommand(@"
                                    INSERT INTO [Answers$] 
                                        ([回答者番号], [チェック項目番号], [中項目番号], [大項目], [中項目], [チェック項目], [対策評価_回答], [スコア], [コメント]) 
                                        VALUES 
                                        (@RespondentId, @ItemId, @ChuItemNumber, @Category, @Subcategory, @Question, @CountermeasureEvaluation, @Score, @Comment)", 
                                    connection, transaction);
                                
                                insertCmd.Parameters.AddWithValue("@RespondentId", submissionData.RespondentId ?? "");
                                insertCmd.Parameters.AddWithValue("@ItemId", (object)(string.IsNullOrWhiteSpace(answerItem.QuestionNumber) ? DBNull.Value : answerItem.QuestionNumber));
                                insertCmd.Parameters.AddWithValue("@ChuItemNumber", (object)(string.IsNullOrWhiteSpace(answerItem.ChuItemNumber) ? DBNull.Value : answerItem.ChuItemNumber));
                                insertCmd.Parameters.AddWithValue("@Category", (object)(string.IsNullOrWhiteSpace(answerItem.Category) ? DBNull.Value : answerItem.Category));
                                insertCmd.Parameters.AddWithValue("@Subcategory", (object)(string.IsNullOrWhiteSpace(answerItem.Subcategory) ? DBNull.Value : answerItem.Subcategory));
                                insertCmd.Parameters.AddWithValue("@Question", (object)(string.IsNullOrWhiteSpace(answerItem.Question) ? DBNull.Value : answerItem.Question));
                                
                                // CountermeasureEvaluationとScoreの処理
                                string? fullEvaluation = null;
                                int? score = null;
                                
                                if (!string.IsNullOrWhiteSpace(answerItem.CountermeasureEvaluation))
                                {
                                    if (answerItem.CountermeasureEvaluation == "該当なし")
                                    {
                                        fullEvaluation = "該当なし";
                                        score = 0;
                                    }
                                    else
                                    {
                                        // SurveyOptions$から完全な対策評価テキストと点数を取得
                                        fullEvaluation = await GetFullCountermeasureEvaluation(answerItem.QuestionNumber, answerItem.CountermeasureEvaluation, connection, transaction);
                                        score = await GetScoreFromCountermeasureEvaluation(answerItem.QuestionNumber, answerItem.CountermeasureEvaluation, connection, transaction);
                                    }
                                }
                                
                                insertCmd.Parameters.AddWithValue("@CountermeasureEvaluation", fullEvaluation ?? (object)DBNull.Value);
                                insertCmd.Parameters.AddWithValue("@Score", score ?? (object)DBNull.Value);
                                insertCmd.Parameters.AddWithValue("@Comment", (object)(string.IsNullOrWhiteSpace(answerItem.Comment) ? DBNull.Value : answerItem.Comment));
                                
                                await insertCmd.ExecuteNonQueryAsync();
                            }

                            // 回答者テーブルのステータスを「回答済」に更新し、回答時刻と限定提供データの該当状況を保存
                            var updateCmd = new SqlCommand(@"
                                UPDATE [Respondent$]
                                SET [回答ステータス] = @Status,
                                    [回答時刻] = @AnswerTime,
                                    [限定提供データ該当] = @LimitedDataApplicable
                                WHERE [回答者番号] = @RespondentId", connection, transaction);

                            updateCmd.Parameters.AddWithValue("@Status", "回答済");
                            updateCmd.Parameters.AddWithValue("@AnswerTime", GetJapanNow());
                            updateCmd.Parameters.AddWithValue("@LimitedDataApplicable", submissionData.LimitedDataApplicable);
                            updateCmd.Parameters.AddWithValue("@RespondentId", submissionData.RespondentId);

                            await updateCmd.ExecuteNonQueryAsync();
                            
                            transaction.Commit();
                        }
                        catch
                        {
                            transaction.Rollback();
                            throw;
                        }
                    }
                }

                response.StatusCode = HttpStatusCode.OK;
                await response.WriteAsJsonAsync(new { 
                    success = true, 
                    message = "Survey answers submitted successfully",
                    submissionId = Guid.NewGuid().ToString()
                });
                
                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error submitting survey answers");
                response.StatusCode = HttpStatusCode.InternalServerError;
                await response.WriteAsJsonAsync(new { 
                    success = false, 
                    error = "Failed to submit survey answers" 
                });
                return response;
            }
        }

        private async Task<string?> GetFullCountermeasureEvaluation(string? questionNumber, string? partialText, SqlConnection connection, SqlTransaction transaction)
        {
            if (string.IsNullOrWhiteSpace(questionNumber) || string.IsNullOrWhiteSpace(partialText))
                return partialText;

            var sql = @"
                SELECT TOP 1 [対策評価] 
                FROM [SurveyOptions$] 
                WHERE [チェック項目番号] = @QuestionNumber 
                AND ([対策評価] LIKE '%' + @PartialText + '%' OR [対策評価] = @PartialText)
                ORDER BY LEN([対策評価])";

            using var cmd = new SqlCommand(sql, connection, transaction);
            cmd.Parameters.AddWithValue("@QuestionNumber", questionNumber);
            cmd.Parameters.AddWithValue("@PartialText", partialText);
            
            var result = await cmd.ExecuteScalarAsync();
            return result?.ToString() ?? partialText;
        }

        private async Task<int?> GetScoreFromCountermeasureEvaluation(string? questionNumber, string? evaluationText, SqlConnection connection, SqlTransaction transaction)
        {
            if (string.IsNullOrWhiteSpace(questionNumber) || string.IsNullOrWhiteSpace(evaluationText))
                return null;

            var sql = @"
                SELECT TOP 1 [スコア] 
                FROM [SurveyOptions$] 
                WHERE [チェック項目番号] = @QuestionNumber 
                AND ([対策評価] LIKE '%' + @EvaluationText + '%' OR [対策評価] = @EvaluationText)";

            using var cmd = new SqlCommand(sql, connection, transaction);
            cmd.Parameters.AddWithValue("@QuestionNumber", questionNumber);
            cmd.Parameters.AddWithValue("@EvaluationText", evaluationText);
            
            var result = await cmd.ExecuteScalarAsync();
            if (result != null && result != DBNull.Value && int.TryParse(result.ToString(), out var score))
                return score;
                
            return null;
        }

        public class SubmissionRequest
        {
            public string? RespondentId { get; set; }
            public List<AnswerItem>? AnswerItems { get; set; }
            public bool LimitedDataApplicable { get; set; } = true; // 限定提供データの該当状況
        }

        public class AnswerItem
        {
            public string? ItemId { get; set; }
            public string? QuestionNumber { get; set; }
            public string? ChuItemNumber { get; set; }
            public string? Category { get; set; }
            public string? Subcategory { get; set; }
            public string? Question { get; set; }
            public string? CountermeasureEvaluation { get; set; }
            public string? Comment { get; set; }
        }
    }
}
