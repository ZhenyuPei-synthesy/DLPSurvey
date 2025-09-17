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
    public class LoadAnswersTemporary
    {
        private readonly ILogger _logger;

        public LoadAnswersTemporary(ILoggerFactory loggerFactory)
        {
            _logger = loggerFactory.CreateLogger<LoadAnswersTemporary>();
        }

        [Function("LoadAnswersTemporary")]
        public async Task<HttpResponseData> Run(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get")] HttpRequestData req)
        {
            _logger.LogInformation("Load temporary answers request processed.");

            var response = req.CreateResponse();

            try
            {
                // クエリパラメータから回答者IDを取得
                var query = System.Web.HttpUtility.ParseQueryString(req.Url.Query);
                var respondentId = query["respondentId"];

                if (string.IsNullOrEmpty(respondentId))
                {
                    response.StatusCode = HttpStatusCode.BadRequest;
                    await response.WriteAsJsonAsync(new { 
                        success = false, 
                        error = "RespondentId is required" 
                    });
                    return response;
                }

                _logger.LogInformation($"Loading temporary answers for respondent {respondentId}");

                // 接続文字列取得
                var connectionString = Environment.GetEnvironmentVariable("SqlDbConnection", EnvironmentVariableTarget.Process);
                
                if (string.IsNullOrEmpty(connectionString))
                {
                    response.StatusCode = HttpStatusCode.InternalServerError;
                    await response.WriteStringAsync("Database connection not configured");
                    return response;
                }

                // データベースから一時保存されたデータを取得
                var answers = new List<SavedAnswer>();
                string? limitedDataApplicable = null;
                
                using (var connection = new SqlConnection(connectionString))
                {
                    await connection.OpenAsync();
                    
                    // まず回答者情報から限定提供データ該当状況を取得
                    var respondentCmd = new SqlCommand(@"
                        SELECT [限定提供データ該当状況]
                        FROM [Respondent$] 
                        WHERE [回答者番号] = @RespondentId", connection);
                    
                    respondentCmd.Parameters.AddWithValue("@RespondentId", respondentId);
                    
                    var respondentResult = await respondentCmd.ExecuteScalarAsync();
                    limitedDataApplicable = respondentResult?.ToString();
                    
                    // 一時保存された回答データを取得
                    var selectCmd = new SqlCommand(@"
                        SELECT [チェック項目番号], [中項目番号], [大項目], [中項目], [チェック項目], [対策評価_回答], [コメント]
                        FROM [Answers$] 
                        WHERE [回答者番号] = @RespondentId", connection);
                    
                    selectCmd.Parameters.AddWithValue("@RespondentId", respondentId);
                    
                    using (var reader = await selectCmd.ExecuteReaderAsync())
                    {
                        while (await reader.ReadAsync())
                        {
                            answers.Add(new SavedAnswer
                            {
                                QuestionNumber = reader["チェック項目番号"]?.ToString(),
                                ChuItemNumber = reader["中項目番号"]?.ToString(),
                                Category = reader["大項目"]?.ToString(),
                                Subcategory = reader["中項目"]?.ToString(),
                                Question = reader["チェック項目"]?.ToString(),
                                CountermeasureEvaluation = reader["対策評価_回答"]?.ToString(),
                                Comment = reader["コメント"]?.ToString()
                            });
                        }
                    }
                }

                response.StatusCode = HttpStatusCode.OK;
                await response.WriteAsJsonAsync(new { 
                    success = true, 
                    answers = answers,
                    limitedDataApplicable = limitedDataApplicable, // 限定提供データ該当状況を追加
                    count = answers.Count
                });
                
                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error loading temporary answers");
                response.StatusCode = HttpStatusCode.InternalServerError;
                await response.WriteAsJsonAsync(new { 
                    success = false, 
                    error = "Failed to load temporary answers" 
                });
                return response;
            }
        }

        public class SavedAnswer
        {
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
