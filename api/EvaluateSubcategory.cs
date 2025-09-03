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

        [Function("EvaluateSubcategory")] // Corrected misplaced brackets
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
                        await ProcessAIEvaluationAsync(requestData.RespondentId, requestData.SubcategoryId, requestData.CurrentAnswers);
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
                                            await ProcessAIEvaluationAsync(requestData.RespondentId, requestData.SubcategoryId, requestData.CurrentAnswers);
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

        private async Task ProcessAIEvaluationAsync(string respondentId, string subcategoryId, List<CurrentAnswer>? currentAnswers)
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

                // Azure OpenAI APIへのHTTPリクエスト（リトライ機能付き）
                using var httpClient = new HttpClient();
                httpClient.Timeout = TimeSpan.FromSeconds(60); // 60秒タイムアウト
                httpClient.DefaultRequestHeaders.Add("api-key", azureOpenAiApiKey);
                
                // レート制限対応のためのリトライ設定
                int maxRetries = 3;
                int baseDelayMs = 1000;
                
                _logger.LogInformation($"Azure OpenAI API Key (first 10 chars): {azureOpenAiApiKey.Substring(0, Math.Min(10, azureOpenAiApiKey.Length))}");
                Console.WriteLine($"[INFO] Azure OpenAI API Key (first 10 chars): {azureOpenAiApiKey.Substring(0, Math.Min(10, azureOpenAiApiKey.Length))}");

                // データベースから必要なデータを取得
                string evaluationData;
                try
                {
                    evaluationData = await BuildEvaluationDataFromAnswers(respondentId, subcategoryId, currentAnswers, connectionString);
                    _logger.LogInformation($"評価データ取得完了 (length: {evaluationData.Length})");
                    Console.WriteLine($"[INFO] 評価データ取得完了 (length: {evaluationData.Length})");
                }
                catch (Exception dataEx)
                {
                    string errorMsg = $"評価データの取得に失敗しました: {dataEx.Message}";
                    _logger.LogError(dataEx, errorMsg);
                    Console.WriteLine($"[ERROR] {errorMsg}");
                    await UpdateStatusToError(respondentId, subcategoryId, errorMsg);
                    return;
                }

                var systemPrompt = @"
役割
あなたは、データ保護と情報セキュリティを専門とする、経験豊富で共感能力の高いビジネスコンサルタントです。あなたの役割は、クライアントが提出した自己評価データを分析し、単に弱点を指摘するだけでなく、彼らが次の一歩を踏み出すための、前向きで具体的、かつ実行可能なアドバイスを提供することです。あなたは専門家であると同時に、クライアントのビジネスパートナーでもあります。

最終目的
提供されたクライアントの回答データと、定義された「あるべき姿」を基に、以下の2つを生成してください。

1. クライアントの現状を正確に反映し、背景事情も考慮した**「現状評価」**
2. ギャップを埋めるための、優先順位を付けた**「具体的な推奨事項」**

最終的なゴールは、クライアントが自社の状況を客観的に理解し、改善に向けた明確なアクションプランを手に入れることです。

思考プロセス
以下のステップで思考し、最終的なアウトプットを生成してください。

1. 基準の理解: まず、ideal_stateを精読し、この中項目で達成すべき完璧な状態を完全に理解します。
2. 定量的分析: 次に、questions配列内の各質問のselected_optionのscoreを確認し、この項目におけるクライアントの全体的な成熟度を定量的に把握します。
3. ギャップ分析: 上記1〜2で得た情報を統合します。まず、scoreを見て、あるべき姿におけるscoreに達している想定で評価（認めてあげる）してください。でも、実際回答からあるべき姿におけるscoreに達しているかどうかが判断できない部分に関しては、判断できなかった旨を伝えつつ、もしやっていない場合やるようにとソフトに伝えてください。
4. 解決策の立案: あるべき姿における回答者のscoreレベルまで達成できている前提で次の段階（あるべき姿の全部の要件を満たしている状態ではなく、今のScoreから見た次のステップ）に向けた改善提案を１つ立案してください。
   
 --- IGNORE ---

出力形式
必ず以下のJSON形式で出力してください。

{
  ""evaluation_summary"": ""（現状評価のサマリーを2〜3文で記述。）"",
  ""maturity_level"": ""（スコアの平均点から、「リスク未管理」「基礎的な防御」「管理された防御」「予測的な防御」の4段階で判定）"",
  ""recommendations"": [
    {
      ""title"": ""（推奨事項1の短いタイトル）"",
      ""description"": ""（この推奨事項が必要な理由と、具体的な内容を記述）"",
      ""first_step"": ""（明日からでも始められる最初の具体的な一歩を記述）""
    }
  ]
}

重要指示とトーン
- パートナーとしての視点: クライアントの状況を理解し、改善をサポートするパートナーとしての、協力的で前向きなトーンを維持してください。
- パーソナライズ: user_commentの内容を積極的に引用・参照し、生成する文章がクライアント個人のためのものであることを明確に示してください。
- 具体的かつ実践的に: 「頑張る」「意識する」といった精神論ではなく、具体的な行動につながる言葉で推奨事項を記述してください。
- 回答者を”貴社”と表現し、親しみやすく丁寧な口調で記述してください。";

                var userPrompt = $"以下のデータに基づいて、この中項目の現状評価と推奨事項を生成してください：\n\n{evaluationData}";

                var requestBody = new
                {
                    messages = new[]
                    {
                        new { role = "system", content = systemPrompt },
                        new { role = "user", content = userPrompt }
                    },
                    max_tokens = 2000,
                    temperature = 0.3
                };

                var json = JsonConvert.SerializeObject(requestBody);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                // Azure OpenAI のエンドポイント形式
                var apiUrl = $"{azureOpenAiEndpoint.TrimEnd('/')}/openai/deployments/{deploymentName}/chat/completions?api-version=2024-02-15-preview";
                
                _logger.LogInformation($"Calling Azure OpenAI API: {apiUrl}");
                _logger.LogInformation($"Request body: {json}");
                Console.WriteLine($"[INFO] Calling Azure OpenAI API: {apiUrl}");
                Console.WriteLine($"[INFO] Request body: {json}");
                
                HttpResponseMessage? response = null;
                Exception? lastException = null;
                
                // リトライ機能付きでAzure OpenAI APIを呼び出し
                for (int attempt = 0; attempt < maxRetries; attempt++)
                {
                    try
                    {
                        if (attempt > 0)
                        {
                            int delay = baseDelayMs * (int)Math.Pow(2, attempt - 1);
                            _logger.LogInformation($"Retrying Azure OpenAI API call after {delay}ms delay (attempt {attempt + 1}/{maxRetries})");
                            await Task.Delay(delay);
                        }
                        
                        Console.WriteLine($"[DEBUG] About to make HTTP POST request (attempt {attempt + 1})...");
                        response = await httpClient.PostAsync(apiUrl, content);
                        Console.WriteLine($"[DEBUG] HTTP POST completed. Status: {response.StatusCode}");
                        
                        // 成功した場合はループを抜ける
                        break;
                    }
                    catch (HttpRequestException httpEx)
                    {
                        lastException = httpEx;
                        string errorMsg = $"HTTP request exception when calling Azure OpenAI (attempt {attempt + 1}/{maxRetries}): {httpEx.Message}";
                        _logger.LogWarning(httpEx, errorMsg);
                        Console.WriteLine($"[WARNING] {errorMsg}");
                        
                        if (attempt == maxRetries - 1)
                        {
                            _logger.LogError(httpEx, "All retry attempts failed for Azure OpenAI API call");
                            Console.WriteLine($"[ERROR] All retry attempts failed: {httpEx.Message}");
                            await UpdateStatusToError(respondentId, subcategoryId, $"HTTP request failed after {maxRetries} attempts: {httpEx.Message}");
                            return;
                        }
                    }
                    catch (TaskCanceledException tcEx)
                    {
                        lastException = tcEx;
                        string errorMsg = $"Azure OpenAI API call timed out (attempt {attempt + 1}/{maxRetries}): {tcEx.Message}";
                        _logger.LogWarning(tcEx, errorMsg);
                        Console.WriteLine($"[WARNING] {errorMsg}");
                        
                        if (attempt == maxRetries - 1)
                        {
                            _logger.LogError(tcEx, "All retry attempts failed due to timeout");
                            Console.WriteLine($"[ERROR] All timeout retries failed: {tcEx.Message}");
                            await UpdateStatusToError(respondentId, subcategoryId, $"Azure OpenAI API timeout after {maxRetries} attempts");
                            return;
                        }
                    }
                }

                // レスポンスがnullの場合（リトライがすべて失敗）
                if (response == null)
                {
                    string errorMsg = $"All attempts to call Azure OpenAI API failed. Last exception: {lastException?.Message}";
                    _logger.LogError(errorMsg);
                    Console.WriteLine($"[ERROR] {errorMsg}");
                    await UpdateStatusToError(respondentId, subcategoryId, errorMsg);
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
                    Console.WriteLine($"[INFO] Raw Azure OpenAI response: {responseContent}");
                    
                    dynamic? apiResponse = JsonConvert.DeserializeObject(responseContent);
                    aiResponse = apiResponse?.choices?[0]?.message?.content?.ToString() ?? "Azure OpenAI API response was empty";
                    _logger.LogInformation($"Azure OpenAI response received (length: {aiResponse.Length})");
                    Console.WriteLine($"[INFO] Azure OpenAI response received (length: {aiResponse.Length})");
                }
                
                // データベース接続タイムアウトを含む接続文字列を構成
                var connectionStringBuilder = new SqlConnectionStringBuilder(connectionString)
                {
                    ConnectTimeout = 30,
                    CommandTimeout = 60
                };
                
                _logger.LogInformation($"Attempting database connection for status update");
                Console.WriteLine("[INFO] Attempting database connection for status update");
                using (var connection = new SqlConnection(connectionStringBuilder.ConnectionString))
                {
                    await connection.OpenAsync();
                    _logger.LogInformation($"Database connection opened successfully");
                    Console.WriteLine("[INFO] Database connection opened successfully");

                    // AIレスポンスをJSONとしてパース
                    string evaluationText = "";
                    string recommendationText = "";
                    
                    // デバッグ: AIレスポンスの内容を詳しく確認
                    _logger.LogInformation($"AI Response Debug - Length: {aiResponse.Length}");
                    _logger.LogInformation($"AI Response Debug - First 500 chars: {aiResponse.Substring(0, Math.Min(500, aiResponse.Length))}");
                    Console.WriteLine($"[DEBUG] AI Response - Length: {aiResponse.Length}");
                    Console.WriteLine($"[DEBUG] AI Response - First 500 chars: {aiResponse.Substring(0, Math.Min(500, aiResponse.Length))}");
                    
                    try
                    {
                        // AIレスポンスからJSON部分を抽出
                        string jsonContent = aiResponse;
                        
                        // JSONの開始位置を見つける（{で始まる部分）
                        int jsonStart = aiResponse.IndexOf('{');
                        if (jsonStart >= 0)
                        {
                            // JSONの終了位置を見つける（最後の}）
                            int jsonEnd = aiResponse.LastIndexOf('}');
                            if (jsonEnd >= jsonStart)
                            {
                                jsonContent = aiResponse.Substring(jsonStart, jsonEnd - jsonStart + 1);
                                _logger.LogInformation($"Extracted JSON content: {jsonContent.Substring(0, Math.Min(200, jsonContent.Length))}...");
                                Console.WriteLine($"[INFO] Extracted JSON content: {jsonContent.Substring(0, Math.Min(200, jsonContent.Length))}...");
                            }
                        }
                        
                        // 抽出されたJSONをパース
                        var aiResponseJson = JsonConvert.DeserializeObject<dynamic>(jsonContent);
                        
                        // maturity_levelとevaluation_summaryをevaluation_textに保存
                        var evaluationSummary = aiResponseJson?.evaluation_summary?.ToString() ?? "";
                        var maturityLevel = aiResponseJson?.maturity_level?.ToString() ?? "";
                        evaluationText = string.IsNullOrEmpty(maturityLevel) ? evaluationSummary : $"【{maturityLevel}】<br>{evaluationSummary}";
                        
                        // recommendationsの内容をrecommendation_textに保存
                        var recommendations = aiResponseJson?.recommendations;
                        if (recommendations != null)
                        {
                            var recommendationsList = new List<string>();
                            foreach (var rec in recommendations)
                            {
                                var priority = rec?.priority?.ToString() ?? "";
                                var title = rec?.title?.ToString() ?? "";
                                var description = rec?.description?.ToString() ?? "";
                                var firstStep = rec?.first_step?.ToString() ?? "";

                                // HTMLタグを使って文字列を構築
                                recommendationsList.Add($"【{title}】<br>{description}<br><b>Next Action:</b><br>{firstStep}");
                            }
                            // 複数の推奨事項がある場合、<br>タグで間隔をあけて連結
                            recommendationText = string.Join("<br><br>", recommendationsList);
                        }
                         
                        _logger.LogInformation($"Successfully parsed AI response JSON");
                        Console.WriteLine("[INFO] Successfully parsed AI response JSON");
                    }
                    catch (JsonException jsonEx)
                    {
                        _logger.LogWarning(jsonEx, "AI response is not valid JSON, using raw response");
                        Console.WriteLine($"[WARNING] AI response is not valid JSON, using raw response: {jsonEx.Message}");
                        Console.WriteLine($"[WARNING] JSON Error Details: {jsonEx.ToString()}");
                        Console.WriteLine($"[WARNING] Full AI Response: {aiResponse}");
                        
                        // JSONでない場合は、生のレスポンスを使用
                        evaluationText = "AI評価（テキスト形式）";
                        recommendationText = aiResponse;
                    }
                    
                    _logger.LogInformation($"Generated evaluation data (evaluation: {evaluationText.Length} chars, recommendation: {recommendationText.Length} chars)");
                    Console.WriteLine($"[INFO] Generated evaluation data (evaluation: {evaluationText.Length} chars, recommendation: {recommendationText.Length} chars)");

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
                    Console.WriteLine("[INFO] Executing SQL UPDATE command");
                    int rowsAffected = await updateCmd.ExecuteNonQueryAsync();
                    _logger.LogInformation($"Status updated to completed for RespondentId={respondentId}, SubcategoryId={subcategoryId}, RowsAffected={rowsAffected}");
                    Console.WriteLine($"[INFO] Status updated to completed for RespondentId={respondentId}, SubcategoryId={subcategoryId}, RowsAffected={rowsAffected}");
                    
                    _logger.LogInformation($"AI評価完了: RespondentId={respondentId}, SubcategoryId={subcategoryId}");
                    Console.WriteLine($"[INFO] AI評価完了: RespondentId={respondentId}, SubcategoryId={subcategoryId}");
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

        private async Task<string> BuildEvaluationDataFromAnswers(string respondentId, string subcategoryId, List<CurrentAnswer>? currentAnswers, string connectionString)
        {
            try
            {
                using var connection = new SqlConnection(connectionString);
                await connection.OpenAsync();
                _logger.LogInformation($"Database connection opened for evaluation data preparation: RespondentId={respondentId}, SubcategoryId={subcategoryId}");

                // 1. 中項目の「あるべき姿」を取得
                var idealStateSql = @"
                    SELECT [あるべき姿]
                    FROM [dbo].[SurveyCategoryTemplate$]
                    WHERE [中項目番号] = @SubcategoryId";

                string idealState;
                using (var idealStateCmd = new SqlCommand(idealStateSql, connection))
                {
                    idealStateCmd.Parameters.AddWithValue("@SubcategoryId", subcategoryId);
                    var result = await idealStateCmd.ExecuteScalarAsync();
                    idealState = result?.ToString() ?? "あるべき姿の情報が見つかりません。";
                    _logger.LogInformation($"Retrieved ideal state (length: {idealState.Length})");
                }

                // 2. 中項目名を取得
                var subcategoryNameSql = @"
                    SELECT [中項目]
                    FROM [dbo].[SurveyCategoryTemplate$]
                    WHERE [中項目番号] = @SubcategoryId";

                string subcategoryName;
                using (var subcategoryNameCmd = new SqlCommand(subcategoryNameSql, connection))
                {
                    subcategoryNameCmd.Parameters.AddWithValue("@SubcategoryId", subcategoryId);
                    var result = await subcategoryNameCmd.ExecuteScalarAsync();
                    subcategoryName = result?.ToString() ?? $"中項目{subcategoryId}";
                }

                // 3. フロントエンドから受信した回答データを使用
                var questions = new List<object>();
                string userComment = "";

                if (currentAnswers != null && currentAnswers.Count > 0)
                {
                    foreach (var answer in currentAnswers)
                    {
                        questions.Add(new
                        {
                            question_text = answer.QuestionText ?? "",
                            selected_option = new
                            {
                                text = answer.SelectedAnswerText ?? "",
                                score = answer.Score
                            }
                        });

                        // コメントを統合（複数のコメントがある場合は改行で区切り）
                        if (!string.IsNullOrEmpty(answer.Comment))
                        {
                            if (!string.IsNullOrEmpty(userComment))
                                userComment += "\n";
                            userComment += answer.Comment;
                        }
                    }
                }

                // 4. JSONデータを構築
                var evaluationData = new
                {
                    subcategory_name = subcategoryName,
                    ideal_state = idealState,
                    user_comment = userComment,
                    questions = questions
                };

                _logger.LogInformation($"Evaluation data prepared successfully for RespondentId={respondentId}, SubcategoryId={subcategoryId}");
                return JsonConvert.SerializeObject(evaluationData, Formatting.Indented);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error building evaluation data: RespondentId={respondentId}, SubcategoryId={subcategoryId}, Error={ex.Message}");
                throw new Exception($"評価データの構築に失敗: {ex.Message}", ex);
            }
        }

        public class CurrentAnswer
        {
            public string? QuestionText { get; set; }
            public string? SelectedAnswerText { get; set; }
            public int Score { get; set; }
            public string? Comment { get; set; }
        }

        public class EvaluationRequest
        {
            public string? RespondentId { get; set; }
            public string? SubcategoryId { get; set; }
            public List<CurrentAnswer>? CurrentAnswers { get; set; }
        }
    }
}
