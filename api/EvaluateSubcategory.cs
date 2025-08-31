using System;
using System.Net;
using System.Threading.Tasks;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Data.SqlClient;
using Newtonsoft.Json;
using System.Text;
using System.Net.Http;

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
                            var upsertSql = @"
                                IF EXISTS (SELECT 1 FROM [AIAdvice_CHU$] WITH (UPDLOCK, HOLDLOCK) WHERE [回答者番号] = @RespondentId AND [中項目番号] = @SubcategoryId)
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
                                END";

                            var upsertCmd = new SqlCommand(upsertSql, connection, transaction);
                            upsertCmd.Parameters.AddWithValue("@RespondentId", requestData.RespondentId);
                            upsertCmd.Parameters.AddWithValue("@SubcategoryId", requestData.SubcategoryId);

                            try
                            {
                                await upsertCmd.ExecuteNonQueryAsync();
                                await transaction.CommitAsync();

                                _logger.LogInformation($"AI評価開始: RespondentId={requestData.RespondentId}, SubcategoryId={requestData.SubcategoryId}");

                // バックグラウンドでAI評価処理を開始（現在はモック実装）
                _ = Task.Run(async () => {
                    try 
                    {
                        _logger.LogInformation($"Background task STARTED for RespondentId={requestData.RespondentId}, SubcategoryId={requestData.SubcategoryId}");
                        Console.WriteLine($"[INFO] Background task STARTED for RespondentId={requestData.RespondentId}, SubcategoryId={requestData.SubcategoryId}");
                        await ProcessAIEvaluationAsync(requestData.RespondentId, requestData.SubcategoryId);
                        _logger.LogInformation($"Background task COMPLETED for RespondentId={requestData.RespondentId}, SubcategoryId={requestData.SubcategoryId}");
                        Console.WriteLine($"[INFO] Background task COMPLETED for RespondentId={requestData.RespondentId}, SubcategoryId={requestData.SubcategoryId}");
                    }
                    catch (Exception bgEx)
                    {
                        _logger.LogError(bgEx, $"Background ProcessAIEvaluationAsync failed: RespondentId={requestData.RespondentId}, SubcategoryId={requestData.SubcategoryId}, Error={bgEx.Message}");
                        Console.WriteLine($"[ERROR] Background ProcessAIEvaluationAsync failed: RespondentId={requestData.RespondentId}, SubcategoryId={requestData.SubcategoryId}, Error={bgEx.Message}");
                        Console.WriteLine($"[ERROR] Stack trace: {bgEx.StackTrace}");
                        
                        // エラー時にステータスを更新
                        try
                        {
                            await UpdateStatusToError(requestData.RespondentId, requestData.SubcategoryId, bgEx.Message);
                            _logger.LogInformation($"Status updated to error for RespondentId={requestData.RespondentId}, SubcategoryId={requestData.SubcategoryId}");
                            Console.WriteLine($"[INFO] Status updated to error for RespondentId={requestData.RespondentId}, SubcategoryId={requestData.SubcategoryId}");
                        }
                        catch (Exception updateEx)
                        {
                            _logger.LogError(updateEx, $"Failed to update status to error for RespondentId={requestData.RespondentId}, SubcategoryId={requestData.SubcategoryId}");
                            Console.WriteLine($"[ERROR] Failed to update status to error: {updateEx.Message}");
                        }
                    }
                }).ContinueWith(task =>
                {
                    if (task.IsFaulted)
                    {
                        var ex = task.Exception?.GetBaseException();
                        _logger.LogError($"Background task itself faulted for RespondentId={requestData.RespondentId}, SubcategoryId={requestData.SubcategoryId}: {ex?.Message}");
                        Console.WriteLine($"[ERROR] Background task faulted: {ex?.Message}");
                        Console.WriteLine($"[ERROR] Task fault stack trace: {ex?.StackTrace}");
                    }
                }, TaskContinuationOptions.OnlyOnFaulted);                                response.StatusCode = HttpStatusCode.OK;
                                await response.WriteAsJsonAsync(new { 
                                    success = true,
                                    status = "evaluating",
                                    message = "AI evaluation started"
                                });
                                return response;
                            }
                            catch (SqlException sqlEx) when (sqlEx.Number == 2627)
                            {
                                // PK 重複エラーが発生した場合、別のスレッドが既に挿入したとみなして UPDATE を試みる
                                _logger.LogWarning(sqlEx, "PK duplicate detected during upsert, attempting UPDATE fallback");
                                try
                                {
                                    var fallbackCmd = new SqlCommand(@"
                                        UPDATE [AIAdvice_CHU$]
                                        SET [status] = 'evaluating', [updated_at] = GETDATE()
                                        WHERE [回答者番号] = @RespondentId AND [中項目番号] = @SubcategoryId", connection, transaction);
                                    fallbackCmd.Parameters.AddWithValue("@RespondentId", requestData.RespondentId);
                                    fallbackCmd.Parameters.AddWithValue("@SubcategoryId", requestData.SubcategoryId);
                                    await fallbackCmd.ExecuteNonQueryAsync();
                                    await transaction.CommitAsync();

                                    _logger.LogInformation($"AI評価開始(フォールバック): RespondentId={requestData.RespondentId}, SubcategoryId={requestData.SubcategoryId}");

                                    _ = Task.Run(async () => {
                                        try 
                                        {
                                            _logger.LogInformation($"Background FALLBACK task STARTED for RespondentId={requestData.RespondentId}, SubcategoryId={requestData.SubcategoryId}");
                                            Console.WriteLine($"[INFO] Background FALLBACK task STARTED for RespondentId={requestData.RespondentId}, SubcategoryId={requestData.SubcategoryId}");
                                            await ProcessAIEvaluationAsync(requestData.RespondentId, requestData.SubcategoryId);
                                            _logger.LogInformation($"Background FALLBACK task COMPLETED for RespondentId={requestData.RespondentId}, SubcategoryId={requestData.SubcategoryId}");
                                            Console.WriteLine($"[INFO] Background FALLBACK task COMPLETED for RespondentId={requestData.RespondentId}, SubcategoryId={requestData.SubcategoryId}");
                                        }
                                        catch (Exception bgEx)
                                        {
                                            _logger.LogError(bgEx, $"Background ProcessAIEvaluationAsync fallback failed: RespondentId={requestData.RespondentId}, SubcategoryId={requestData.SubcategoryId}, Error={bgEx.Message}");
                                            Console.WriteLine($"[ERROR] Background ProcessAIEvaluationAsync fallback failed: RespondentId={requestData.RespondentId}, SubcategoryId={requestData.SubcategoryId}, Error={bgEx.Message}");
                                            Console.WriteLine($"[ERROR] Fallback stack trace: {bgEx.StackTrace}");
                                        }
                                    });

                                    response.StatusCode = HttpStatusCode.OK;
                                    await response.WriteAsJsonAsync(new { success = true, status = "evaluating", message = "AI evaluation started (fallback)" });
                                    return response;
                                }
                                catch (Exception fbEx)
                                {
                                    try { await transaction.RollbackAsync(); } catch (Exception rbEx) { _logger.LogError(rbEx, "Rollback failed after fallback failure"); }
                                    _logger.LogError(fbEx, "Fallback UPDATE failed");
                                    response.StatusCode = HttpStatusCode.InternalServerError;
                                    await response.WriteAsJsonAsync(new { success = false, error = "Fallback update failed" });
                                    return response;
                                }
                            }
                            catch (Exception ex)
                            {
                                try { await transaction.RollbackAsync(); } catch (Exception rbEx) { _logger.LogError(rbEx, "Rollback failed"); }
                                _logger.LogError(ex, "AI評価開始処理でエラーが発生しました");
                                response.StatusCode = HttpStatusCode.InternalServerError;
                                await response.WriteAsJsonAsync(new { success = false, error = ex.Message });
                                return response;
                            }
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
                Console.WriteLine($"[INFO] AI評価処理開始: RespondentId={respondentId}, SubcategoryId={subcategoryId}");

                var connectionString = Environment.GetEnvironmentVariable("SqlDbConnection", EnvironmentVariableTarget.Process);
                if (string.IsNullOrEmpty(connectionString))
                {
                    _logger.LogError("SqlDbConnection is null or empty in ProcessAIEvaluationAsync");
                    Console.WriteLine("[ERROR] SqlDbConnection is null or empty in ProcessAIEvaluationAsync");
                    return;
                }
                _logger.LogInformation($"Connection string is available (length: {connectionString.Length})");
                Console.WriteLine($"[INFO] Connection string is available (length: {connectionString.Length})");

                // Azure OpenAI APIキーとエンドポイントの取得
                var azureOpenAiApiKey = Environment.GetEnvironmentVariable("AZURE_OPENAI_API_KEY", EnvironmentVariableTarget.Process);
                var azureOpenAiEndpoint = Environment.GetEnvironmentVariable("AZURE_OPENAI_ENDPOINT", EnvironmentVariableTarget.Process);
                var deploymentName = Environment.GetEnvironmentVariable("AZURE_OPENAI_DEPLOYMENT_NAME", EnvironmentVariableTarget.Process);
                
                Console.WriteLine($"[DEBUG] Azure OpenAI Config Check:");
                Console.WriteLine($"[DEBUG] - ApiKey: {(string.IsNullOrEmpty(azureOpenAiApiKey) ? "MISSING" : "Present")}");
                Console.WriteLine($"[DEBUG] - Endpoint: {(string.IsNullOrEmpty(azureOpenAiEndpoint) ? "MISSING" : azureOpenAiEndpoint)}");
                Console.WriteLine($"[DEBUG] - Deployment: {(string.IsNullOrEmpty(deploymentName) ? "MISSING" : deploymentName)}");
                
                if (string.IsNullOrEmpty(azureOpenAiApiKey) || string.IsNullOrEmpty(azureOpenAiEndpoint) || string.IsNullOrEmpty(deploymentName))
                {
                    string errorMsg = $"Azure OpenAI configuration missing: ApiKey={!string.IsNullOrEmpty(azureOpenAiApiKey)}, Endpoint={!string.IsNullOrEmpty(azureOpenAiEndpoint)}, Deployment={!string.IsNullOrEmpty(deploymentName)}";
                    _logger.LogError(errorMsg);
                    Console.WriteLine($"[ERROR] {errorMsg}");
                    await UpdateStatusToError(respondentId, subcategoryId, "Azure OpenAI configuration missing");
                    return;
                }

                _logger.LogInformation($"Azure OpenAI config available - Endpoint: {azureOpenAiEndpoint}, Deployment: {deploymentName}");
                Console.WriteLine($"[INFO] Azure OpenAI config available - Endpoint: {azureOpenAiEndpoint}, Deployment: {deploymentName}");

                // Azure OpenAI APIへのHTTPリクエスト
                using var httpClient = new HttpClient();
                httpClient.Timeout = TimeSpan.FromSeconds(30); // 30秒タイムアウト
                httpClient.DefaultRequestHeaders.Add("api-key", azureOpenAiApiKey);
                
                _logger.LogInformation($"Azure OpenAI API Key (first 10 chars): {azureOpenAiApiKey.Substring(0, Math.Min(10, azureOpenAiApiKey.Length))}");
                Console.WriteLine($"[INFO] Azure OpenAI API Key (first 10 chars): {azureOpenAiApiKey.Substring(0, Math.Min(10, azureOpenAiApiKey.Length))}");

                var requestBody = new
                {
                    messages = new[]
                    {
                        new { role = "system", content = "あなたは親切なアシスタントです。" },
                        new { role = "user", content = "今日の天気について教えてください" }
                    },
                    max_tokens = 150,
                    temperature = 0.7
                };

                var json = JsonConvert.SerializeObject(requestBody);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                // Azure OpenAI のエンドポイント形式
                var apiUrl = $"{azureOpenAiEndpoint.TrimEnd('/')}/openai/deployments/{deploymentName}/chat/completions?api-version=2024-02-15-preview";
                
                _logger.LogInformation($"Calling Azure OpenAI API: {apiUrl}");
                _logger.LogInformation($"Request body: {json}");
                Console.WriteLine($"[INFO] Calling Azure OpenAI API: {apiUrl}");
                Console.WriteLine($"[INFO] Request body: {json}");
                
                HttpResponseMessage response;
                try
                {
                    Console.WriteLine("[DEBUG] About to make HTTP POST request...");
                    response = await httpClient.PostAsync(apiUrl, content);
                    Console.WriteLine($"[DEBUG] HTTP POST completed. Status: {response.StatusCode}");
                }
                catch (HttpRequestException httpEx)
                {
                    string errorMsg = $"HTTP request exception when calling Azure OpenAI: {httpEx.Message}";
                    _logger.LogError(httpEx, errorMsg);
                    Console.WriteLine($"[ERROR] {errorMsg}");
                    Console.WriteLine($"[ERROR] HttpRequestException stack trace: {httpEx.StackTrace}");
                    await UpdateStatusToError(respondentId, subcategoryId, $"HTTP request failed: {httpEx.Message}");
                    return;
                }
                catch (TaskCanceledException tcEx)
                {
                    string errorMsg = $"Azure OpenAI API call timed out: {tcEx.Message}";
                    _logger.LogError(tcEx, errorMsg);
                    Console.WriteLine($"[ERROR] {errorMsg}");
                    Console.WriteLine($"[ERROR] TaskCanceledException stack trace: {tcEx.StackTrace}");
                    await UpdateStatusToError(respondentId, subcategoryId, "Azure OpenAI API timeout");
                    return;
                }

                string aiResponse;
                if (!response.IsSuccessStatusCode)
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    _logger.LogError($"Azure OpenAI API call failed: {response.StatusCode}, Error: {errorContent}");
                    _logger.LogError($"Request URL: {apiUrl}");
                    _logger.LogError($"Request Headers: {string.Join(", ", httpClient.DefaultRequestHeaders.Select(h => $"{h.Key}={string.Join(",", h.Value)}"))}");
                    _logger.LogError($"Request Body: {json}");
                    
                    // エラーの場合は処理を停止してエラーステータスを設定
                    await UpdateStatusToError(respondentId, subcategoryId, $"Azure OpenAI API error: {response.StatusCode} - {errorContent}");
                    return;
                }
                else
                {
                    var responseContent = await response.Content.ReadAsStringAsync();
                    _logger.LogInformation($"Raw Azure OpenAI response: {responseContent}");
                    dynamic? apiResponse = JsonConvert.DeserializeObject(responseContent);
                    
                    aiResponse = apiResponse?.choices?[0]?.message?.content?.ToString() ?? "Azure OpenAI API response was empty";
                    _logger.LogInformation($"Azure OpenAI response received (length: {aiResponse.Length})");
                }
                
                _logger.LogInformation($"Attempting database connection for status update");
                using (var connection = new SqlConnection(connectionString))
                {
                    await connection.OpenAsync();
                    _logger.LogInformation($"Database connection opened successfully");

                    // OpenAI APIの結果をデータベースに保存
                    var evaluationText = $"[OpenAI評価] 中項目 {subcategoryId} の評価を完了しました。";
                    var recommendationText = aiResponse; // OpenAI APIからの回答を推奨事項として使用
                    
                    _logger.LogInformation($"Generated OpenAI evaluation data (evaluation: {evaluationText.Length} chars, recommendation: {recommendationText.Length} chars)");

                    var updateCmd = new SqlCommand(@"
                        UPDATE [AIAdvice_CHU$] 
                        SET [status] = 'completed',
                            [evaluation_text] = @EvaluationText,
                            [recommendation_text] = @RecommendationText,
                            [updated_at] = GETDATE()
                        WHERE [回答者番号] = @RespondentId AND [中項目番号] = @SubcategoryId", connection);
                    
                    updateCmd.Parameters.AddWithValue("@RespondentId", respondentId);
                    updateCmd.Parameters.AddWithValue("@SubcategoryId", subcategoryId);
                    updateCmd.Parameters.AddWithValue("@EvaluationText", evaluationText);
                    updateCmd.Parameters.AddWithValue("@RecommendationText", recommendationText);
                    
                    _logger.LogInformation($"Executing SQL UPDATE command");
                    int rowsAffected = await updateCmd.ExecuteNonQueryAsync();
                    _logger.LogInformation($"Status updated to completed for RespondentId={respondentId}, SubcategoryId={subcategoryId}, RowsAffected={rowsAffected}");
                    
                    _logger.LogInformation($"AI評価完了: RespondentId={respondentId}, SubcategoryId={subcategoryId}");
                }
            }
            catch (Exception ex)
            {
                string errorMsg = $"AI評価処理でエラーが発生しました: RespondentId={respondentId}, SubcategoryId={subcategoryId}, Error={ex.Message}";
                _logger.LogError(ex, errorMsg);
                Console.WriteLine($"[ERROR] {errorMsg}");
                Console.WriteLine($"[ERROR] Full exception details:");
                Console.WriteLine($"[ERROR] Type: {ex.GetType().Name}");
                Console.WriteLine($"[ERROR] Message: {ex.Message}");
                Console.WriteLine($"[ERROR] Stack trace: {ex.StackTrace}");
                if (ex.InnerException != null)
                {
                    Console.WriteLine($"[ERROR] Inner exception: {ex.InnerException.Message}");
                    Console.WriteLine($"[ERROR] Inner stack trace: {ex.InnerException.StackTrace}");
                }
                
                // エラー時のステータス更新
                await UpdateStatusToError(respondentId, subcategoryId, ex.Message);
            }
        }

        private async Task UpdateStatusToError(string respondentId, string subcategoryId, string errorMessage)
        {
            try
            {
                var connectionString = Environment.GetEnvironmentVariable("SqlDbConnection", EnvironmentVariableTarget.Process);
                if (string.IsNullOrEmpty(connectionString))
                {
                    _logger.LogError("SqlDbConnection is null or empty in UpdateStatusToError");
                    Console.WriteLine("[ERROR] SqlDbConnection is null or empty in UpdateStatusToError");
                    return;
                }
                
                _logger.LogInformation($"Updating error status for RespondentId={respondentId}, SubcategoryId={subcategoryId}, Error={errorMessage}");
                Console.WriteLine($"[INFO] Updating error status for RespondentId={respondentId}, SubcategoryId={subcategoryId}, Error={errorMessage}");
                using (var connection = new SqlConnection(connectionString))
                {
                    await connection.OpenAsync();
                    var errorUpdateCmd = new SqlCommand(@"
                        UPDATE [AIAdvice_CHU$] 
                        SET [status] = 'error',
                            [recommendation_text] = @ErrorMessage,
                            [updated_at] = GETDATE()
                        WHERE [回答者番号] = @RespondentId AND [中項目番号] = @SubcategoryId", connection);
                    
                    errorUpdateCmd.Parameters.AddWithValue("@RespondentId", respondentId);
                    errorUpdateCmd.Parameters.AddWithValue("@SubcategoryId", subcategoryId);
                    errorUpdateCmd.Parameters.AddWithValue("@ErrorMessage", $"エラー: {errorMessage}");
                    
                    await errorUpdateCmd.ExecuteNonQueryAsync();
                    _logger.LogInformation($"Error status updated for RespondentId={respondentId}, SubcategoryId={subcategoryId}");
                }
            }
            catch (Exception updateEx)
            {
                _logger.LogError(updateEx, $"エラーステータス更新に失敗しました: {updateEx.Message}, StackTrace: {updateEx.StackTrace}");
            }
        }

        public class EvaluationRequest
        {
            public string? RespondentId { get; set; }
            public string? SubcategoryId { get; set; }
        }
    }
}
