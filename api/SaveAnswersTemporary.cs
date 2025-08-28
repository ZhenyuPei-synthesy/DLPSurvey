using System;
using System.Collections.Generic;
using System.Net;
using System.Threading.Tasks;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Data.SqlClient;
using Newtonsoft.Json;

namespace Company.Function
{
    public class SaveAnswersTemporary
    {
        private readonly ILogger _logger;

        public SaveAnswersTemporary(ILoggerFactory loggerFactory)
        {
            _logger = loggerFactory.CreateLogger<SaveAnswersTemporary>();
        }

        [Function("SaveAnswersTemporary")]
        public async Task<HttpResponseData> Run(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post")] HttpRequestData req)
        {
            _logger.LogInformation("Temporary save request processed.");

            var response = req.CreateResponse();

            try
            {
                // リクエストボディを読み取り
                string requestBody = await req.ReadAsStringAsync() ?? "{}";
                var requestData = JsonConvert.DeserializeObject<SaveAnswersRequest>(requestBody);

                _logger.LogInformation($"Received temporary save for respondent {requestData?.RespondentId} with {requestData?.AnswerItems?.Count ?? 0} answers");

                // 接続文字列取得
                var connectionString = Environment.GetEnvironmentVariable("SqlDbConnection", EnvironmentVariableTarget.Process);
                
                if (string.IsNullOrEmpty(connectionString))
                {
                    response.StatusCode = HttpStatusCode.InternalServerError;
                    await response.WriteStringAsync("Database connection not configured");
                    return response;
                }

                if (requestData?.AnswerItems == null)
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
                    
                    // 既存の一時保存データを削除
                    var deleteCmd = new SqlCommand("DELETE FROM [Answers$] WHERE [回答者番号] = @RespondentId", connection);
                    deleteCmd.Parameters.AddWithValue("@RespondentId", requestData.RespondentId ?? "");
                    await deleteCmd.ExecuteNonQueryAsync();
                    
                    // 新しいデータを挿入
                    foreach (var answerItem in requestData.AnswerItems)
                    {
                        var insertCmd = new SqlCommand(@"
                            INSERT INTO [Answers$] 
                                ([回答者番号], [チェック項目番号], [中項目番号], [大項目], [中項目], [チェック項目], [対策評価_回答]) 
                                VALUES 
                                (@RespondentId, @ItemId, @ChuItemNumber, @Category, @Subcategory, @Question, @CountermeasureEvaluation)", 
                            connection);
                        
                        insertCmd.Parameters.AddWithValue("@RespondentId", requestData.RespondentId ?? "");
                        insertCmd.Parameters.AddWithValue("@ItemId", answerItem.QuestionNumber ?? "");
                        insertCmd.Parameters.AddWithValue("@Category", answerItem.Category ?? (object)DBNull.Value);
                        insertCmd.Parameters.AddWithValue("@Subcategory", answerItem.Subcategory ?? (object)DBNull.Value);
                        insertCmd.Parameters.AddWithValue("@ChuItemNumber", answerItem.ChuItemNumber ?? (object)DBNull.Value);
                        insertCmd.Parameters.AddWithValue("@Question", answerItem.Question ?? (object)DBNull.Value);
                        insertCmd.Parameters.AddWithValue("@CountermeasureEvaluation", answerItem.CountermeasureEvaluation ?? (object)DBNull.Value);
                        
                        await insertCmd.ExecuteNonQueryAsync();
                    }

                    // 回答者テーブルのステータスを「一時保存」に更新
                    try
                    {
                        var updateCmd = new SqlCommand(@"
                            UPDATE [Respondent$]
                            SET [回答ステータス] = @Status
                            WHERE [回答者番号] = @RespondentId", connection);

                        updateCmd.Parameters.AddWithValue("@Status", "一時保存");
                        updateCmd.Parameters.AddWithValue("@RespondentId", requestData.RespondentId ?? "");

                        await updateCmd.ExecuteNonQueryAsync();
                    }
                    catch (Exception ex)
                    {
                        // ステータス更新が失敗しても一時保存自体は成功として扱うがログは残す
                        _logger.LogWarning(ex, "Failed to update respondent status to 一時保存 for {RespondentId}", requestData?.RespondentId);
                    }
                }

                response.StatusCode = HttpStatusCode.OK;
                await response.WriteAsJsonAsync(new { 
                    success = true, 
                    message = "Answers saved temporarily",
                    saveId = Guid.NewGuid().ToString()
                });
                
                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error saving answers temporarily");
                response.StatusCode = HttpStatusCode.InternalServerError;
                await response.WriteAsJsonAsync(new { 
                    success = false, 
                    error = "Failed to save answers temporarily" 
                });
                return response;
            }
        }

        public class SaveAnswersRequest
        {
            public string? RespondentId { get; set; }
            public List<AnswerItem>? AnswerItems { get; set; }
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
        }
    }
}
