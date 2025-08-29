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
                    
                    using (var transaction = connection.BeginTransaction())
                    {
                        try
                        {
                            // 既存の一時保存データを削除
                            var deleteCmd = new SqlCommand("DELETE FROM [Answers$] WHERE [回答者番号] = @RespondentId", connection, transaction);
                            deleteCmd.Parameters.AddWithValue("@RespondentId", requestData.RespondentId ?? "");
                            await deleteCmd.ExecuteNonQueryAsync();
                            
                            // 新しいデータを挿入（全項目、未回答も含む）
                            foreach (var answerItem in requestData.AnswerItems)
                            {
                                var insertCmd = new SqlCommand(@"
                                    INSERT INTO [Answers$] 
                                        ([回答者番号], [チェック項目番号], [中項目番号], [大項目], [中項目], [チェック項目], [対策評価_回答], [コメント]) 
                                        VALUES 
                                        (@RespondentId, @ItemId, @ChuItemNumber, @Category, @Subcategory, @Question, @CountermeasureEvaluation, @Comment)", 
                                    connection, transaction);
                                
                                insertCmd.Parameters.AddWithValue("@RespondentId", requestData.RespondentId ?? "");
                                insertCmd.Parameters.AddWithValue("@ItemId", answerItem.QuestionNumber ?? "");
                                insertCmd.Parameters.AddWithValue("@Category", answerItem.Category ?? (object)DBNull.Value);
                                insertCmd.Parameters.AddWithValue("@Subcategory", answerItem.Subcategory ?? (object)DBNull.Value);
                                insertCmd.Parameters.AddWithValue("@ChuItemNumber", answerItem.ChuItemNumber ?? (object)DBNull.Value);
                                insertCmd.Parameters.AddWithValue("@Question", answerItem.Question ?? (object)DBNull.Value);
                                insertCmd.Parameters.AddWithValue("@CountermeasureEvaluation", answerItem.CountermeasureEvaluation ?? (object)DBNull.Value);
                                insertCmd.Parameters.AddWithValue("@Comment", answerItem.Comment ?? (object)DBNull.Value);
                                
                                await insertCmd.ExecuteNonQueryAsync();
                            }

                            // 回答者テーブルのステータスを「一時保存」に更新し、回答時刻を上書きする
                            try
                            {
                                var updateCmd = new SqlCommand(@"
                                    UPDATE [Respondent$]
                                    SET [回答ステータス] = @Status,
                                        [回答時刻] = @AnswerTime
                                    WHERE [回答者番号] = @RespondentId", connection, transaction);

                                // use explicit parameter types to avoid type-inference issues
                                updateCmd.Parameters.Add(new SqlParameter("@Status", System.Data.SqlDbType.NVarChar, 50) { Value = "一時保存" });
                                updateCmd.Parameters.Add(new SqlParameter("@AnswerTime", System.Data.SqlDbType.DateTime2) { Value = GetJapanNow() });

                                // Try to pass RespondentId as INT when possible (common schema), otherwise fall back to string
                                SqlParameter respondentParam = new SqlParameter("@RespondentId", System.Data.SqlDbType.Int);
                                if (int.TryParse(requestData?.RespondentId, out var rid))
                                {
                                    respondentParam.Value = rid;
                                }
                                else if (!string.IsNullOrEmpty(requestData?.RespondentId))
                                {
                                    // if schema uses string keys, pass as NVARCHAR via conversion to object
                                    respondentParam = new SqlParameter("@RespondentId", System.Data.SqlDbType.NVarChar, 100) { Value = requestData.RespondentId };
                                }
                                else
                                {
                                    respondentParam.Value = DBNull.Value;
                                }

                                updateCmd.Parameters.Add(respondentParam);

                                var rows = await updateCmd.ExecuteNonQueryAsync();
                                if (rows == 0)
                                {
                                    _logger.LogWarning("Update affected 0 rows when setting status to 一時保存 for RespondentId={RespondentId}", requestData?.RespondentId);
                                }
                            }
                            catch (Exception ex)
                            {
                                // ステータス/時刻更新が失敗しても一時保存自体は成功として扱うがログは残す
                                _logger.LogWarning(ex, "Failed to update respondent status/timestamp to 一時保存 for {RespondentId}. Exception: {Message}", requestData?.RespondentId, ex.Message);
                            }
                            
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
            public string? Comment { get; set; } // コメント追加
        }
    }
}
