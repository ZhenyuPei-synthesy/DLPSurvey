using System;
using System.Net;
using System.Threading.Tasks;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Data.SqlClient;
using Newtonsoft.Json;
using System.Collections.Generic;

namespace Company.Function
{
    public class GetEvaluationStatus
    {
        private readonly ILogger _logger;

        public GetEvaluationStatus(ILoggerFactory loggerFactory)
        {
            _logger = loggerFactory.CreateLogger<GetEvaluationStatus>();
        }

        [Function("GetEvaluationStatus")]
        public async Task<HttpResponseData> Run(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", "options")] HttpRequestData req)
        {
            _logger.LogInformation("GetEvaluationStatus API called.");

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
                // クエリパラメータから回答者番号を取得
                var queryParams = System.Web.HttpUtility.ParseQueryString(req.Url.Query);
                var respondentId = queryParams["respondentId"];

                if (string.IsNullOrEmpty(respondentId))
                {
                    _logger.LogError("GetEvaluationStatus: RespondentId is required");
                    response.StatusCode = HttpStatusCode.BadRequest;
                    await response.WriteAsJsonAsync(new { 
                        success = false, 
                        error = "RespondentId is required" 
                    });
                    return response;
                }

                _logger.LogInformation($"GetEvaluationStatus: Getting statuses for RespondentId={respondentId}");

                var connectionString = Environment.GetEnvironmentVariable("SqlDbConnection", EnvironmentVariableTarget.Process);
                
                if (string.IsNullOrEmpty(connectionString))
                {
                    _logger.LogError("GetEvaluationStatus: SqlDbConnection is null or empty");
                    response.StatusCode = HttpStatusCode.InternalServerError;
                    await response.WriteAsJsonAsync(new { 
                        success = false, 
                        error = "Database connection not configured" 
                    });
                    return response;
                }

                _logger.LogInformation($"Connection string is available (length: {connectionString.Length})");
                var evaluationStatuses = new List<EvaluationStatusResult>();

                using (var connection = new SqlConnection(connectionString))
                {
                    await connection.OpenAsync();
                    _logger.LogInformation($"Database connection opened successfully");

                    var selectCmd = new SqlCommand(@"
                        SELECT [中項目番号], [status], [evaluation_text], [recommendation_text], [updated_at]
                        FROM [AIAdvice_CHU$] 
                        WHERE [回答者番号] = @RespondentId", connection);
                    
                    selectCmd.Parameters.AddWithValue("@RespondentId", respondentId);
                    
                    using (var reader = await selectCmd.ExecuteReaderAsync())
                    {
                        while (await reader.ReadAsync())
                        {
                            var status = new EvaluationStatusResult
                            {
                                SubcategoryId = reader["中項目番号"]?.ToString(),
                                Status = reader["status"]?.ToString(),
                                EvaluationText = reader["evaluation_text"]?.ToString(),
                                RecommendationText = reader["recommendation_text"]?.ToString(),
                                UpdatedAt = reader["updated_at"] as DateTime?
                            };
                            evaluationStatuses.Add(status);
                            _logger.LogInformation($"Found evaluation status: SubcategoryId={status.SubcategoryId}, Status={status.Status}");
                        }
                    }
                }

                _logger.LogInformation($"Returning {evaluationStatuses.Count} evaluation statuses for RespondentId={respondentId}");
                response.StatusCode = HttpStatusCode.OK;
                await response.WriteAsJsonAsync(new { 
                    success = true,
                    evaluations = evaluationStatuses
                });
                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "GetEvaluationStatus API でエラーが発生しました");
                response.StatusCode = HttpStatusCode.InternalServerError;
                await response.WriteAsJsonAsync(new { 
                    success = false, 
                    error = ex.Message 
                });
                return response;
            }
        }

        public class EvaluationStatusResult
        {
            public string? SubcategoryId { get; set; }
            public string? Status { get; set; }
            public string? EvaluationText { get; set; }
            public string? RecommendationText { get; set; }
            public DateTime? UpdatedAt { get; set; }
        }
    }
}
