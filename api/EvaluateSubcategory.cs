using System;
using System.Net;
using System.Threading.Tasks;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Data.SqlClient;
using Newtonsoft.Json;

namespace Company.Function
{
    public class EvaluateSubcategory
    {
        private readonly ILogger _logger;

        public EvaluateSubcategory(ILoggerFactory loggerFactory)
        {
            _logger = loggerFactory.CreateLogger<EvaluateSubcategory>();
        }

        [Function("EvaluateSubcategory")]
        public async Task<HttpResponseData> Run(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", "options")] HttpRequestData req)
        {
            _logger.LogInformation("EvaluateSubcategory API called.");

            var response = req.CreateResponse();
            
            // CORS対応
            response.Headers.Add("Access-Control-Allow-Origin", "*");
            response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
            response.Headers.Add("Access-Control-Allow-Headers", "Content-Type");

            if (req.Method == "OPTIONS")
            {
                response.StatusCode = HttpStatusCode.OK;
                return response;
            }

            try
            {
                // リクエストボディを読み取り
                string requestBody = await req.ReadAsStringAsync() ?? "{}";
                var requestData = JsonConvert.DeserializeObject<EvaluationRequest>(requestBody);

                _logger.LogInformation($"評価リクエスト受信: RespondentId={requestData?.RespondentId}, SubcategoryId={requestData?.SubcategoryId}");

                if (requestData?.RespondentId == null || requestData?.SubcategoryId == null)
                {
                    response.StatusCode = HttpStatusCode.BadRequest;
                    await response.WriteAsJsonAsync(new { 
                        success = false, 
                        error = "RespondentId and SubcategoryId are required" 
                    });
                    return response;
                }

                var connectionString = Environment.GetEnvironmentVariable("SqlDbConnection", EnvironmentVariableTarget.Process);
                
                if (string.IsNullOrEmpty(connectionString))
                {
                    response.StatusCode = HttpStatusCode.InternalServerError;
                    await response.WriteAsJsonAsync(new { 
                        success = false, 
                        error = "Database connection not configured" 
                    });
                    return response;
                }

                using (var connection = new SqlConnection(connectionString))
                {
                    await connection.OpenAsync();
                    
                    using (var transaction = connection.BeginTransaction())
                    {
                        try
                        {
                            // AI評価テーブルにレコード作成または更新（statusをevaluatingに設定）
                            var upsertCmd = new SqlCommand(@"
                                IF EXISTS (SELECT 1 FROM [AIAdvice_CHU$] WHERE [回答者番号] = @RespondentId AND [中項目番号] = @SubcategoryId)
                                BEGIN
                                    UPDATE [AIAdvice_CHU$] 
                                    SET [status] = 'evaluating',
                                        [updated_at] = GETDATE()
                                    WHERE [回答者番号] = @RespondentId AND [中項目番号] = @SubcategoryId
                                END
                                ELSE
                                BEGIN
                                    INSERT INTO [AIAdvice_CHU$] ([回答者番号], [中項目番号], [status])
                                    VALUES (@RespondentId, @SubcategoryId, 'evaluating')
                                END", connection, transaction);
                            
                            upsertCmd.Parameters.AddWithValue("@RespondentId", requestData.RespondentId);
                            upsertCmd.Parameters.AddWithValue("@SubcategoryId", requestData.SubcategoryId);
                            
                            await upsertCmd.ExecuteNonQueryAsync();
                            
                            await transaction.CommitAsync();
                            
                            _logger.LogInformation($"AI評価開始: RespondentId={requestData.RespondentId}, SubcategoryId={requestData.SubcategoryId}");

                            // バックグラウンドでAI評価処理を開始（現在はモック実装）
                            _ = Task.Run(async () => await ProcessAIEvaluationAsync(requestData.RespondentId, requestData.SubcategoryId));

                            response.StatusCode = HttpStatusCode.OK;
                            await response.WriteAsJsonAsync(new { 
                                success = true,
                                status = "evaluating",
                                message = "AI evaluation started"
                            });
                            return response;
                        }
                        catch (Exception ex)
                        {
                            await transaction.RollbackAsync();
                            _logger.LogError(ex, "AI評価開始処理でエラーが発生しました");
                            throw;
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "EvaluateSubcategory API でエラーが発生しました");
                response.StatusCode = HttpStatusCode.InternalServerError;
                await response.WriteAsJsonAsync(new { 
                    success = false, 
                    error = ex.Message 
                });
                return response;
            }
        }

        private async Task ProcessAIEvaluationAsync(string respondentId, string subcategoryId)
        {
            try
            {
                _logger.LogInformation($"AI評価処理開始: RespondentId={respondentId}, SubcategoryId={subcategoryId}");

                // STEP 1: モック実装（5秒間の待機）
                await Task.Delay(5000);

                var connectionString = Environment.GetEnvironmentVariable("SqlDbConnection", EnvironmentVariableTarget.Process);
                
                using (var connection = new SqlConnection(connectionString))
                {
                    await connection.OpenAsync();

                    // STEP 2で実装予定: 実際のAI評価処理
                    // 現在はモックデータを設定
                    var mockEvaluation = $"[モック評価] 中項目 {subcategoryId} の評価を完了しました。";
                    var mockRecommendation = $"[モック推奨] 中項目 {subcategoryId} に対する推奨事項です。";

                    var updateCmd = new SqlCommand(@"
                        UPDATE [AIAdvice_CHU$] 
                        SET [status] = 'completed',
                            [evaluation_text] = @EvaluationText,
                            [recommendation_text] = @RecommendationText,
                            [updated_at] = GETDATE()
                        WHERE [回答者番号] = @RespondentId AND [中項目番号] = @SubcategoryId", connection);
                    
                    updateCmd.Parameters.AddWithValue("@RespondentId", respondentId);
                    updateCmd.Parameters.AddWithValue("@SubcategoryId", subcategoryId);
                    updateCmd.Parameters.AddWithValue("@EvaluationText", mockEvaluation);
                    updateCmd.Parameters.AddWithValue("@RecommendationText", mockRecommendation);
                    
                    await updateCmd.ExecuteNonQueryAsync();
                    
                    _logger.LogInformation($"AI評価完了: RespondentId={respondentId}, SubcategoryId={subcategoryId}");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"AI評価処理でエラーが発生しました: RespondentId={respondentId}, SubcategoryId={subcategoryId}");
                
                // エラー時のステータス更新
                try
                {
                    var connectionString = Environment.GetEnvironmentVariable("SqlDbConnection", EnvironmentVariableTarget.Process);
                    using (var connection = new SqlConnection(connectionString))
                    {
                        await connection.OpenAsync();
                        var errorUpdateCmd = new SqlCommand(@"
                            UPDATE [AIAdvice_CHU$] 
                            SET [status] = 'error',
                                [updated_at] = GETDATE()
                            WHERE [回答者番号] = @RespondentId AND [中項目番号] = @SubcategoryId", connection);
                        
                        errorUpdateCmd.Parameters.AddWithValue("@RespondentId", respondentId);
                        errorUpdateCmd.Parameters.AddWithValue("@SubcategoryId", subcategoryId);
                        
                        await errorUpdateCmd.ExecuteNonQueryAsync();
                    }
                }
                catch (Exception updateEx)
                {
                    _logger.LogError(updateEx, "エラーステータス更新に失敗しました");
                }
            }
        }

        public class EvaluationRequest
        {
            public string RespondentId { get; set; }
            public string SubcategoryId { get; set; }
        }
    }
}
