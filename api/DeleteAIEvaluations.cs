using System;
using System.Threading.Tasks;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Data.SqlClient;
using System.Net;

namespace Company.Function
{
    public class DeleteAIEvaluations
    {
        private readonly ILogger _logger;

        public DeleteAIEvaluations(ILoggerFactory loggerFactory)
        {
            _logger = loggerFactory.CreateLogger<DeleteAIEvaluations>();
        }

        [Function("DeleteAIEvaluations")]
        public async Task<HttpResponseData> Run(
            [HttpTrigger(AuthorizationLevel.Anonymous, "delete")] HttpRequestData req)
        {
            _logger.LogInformation("Delete AI evaluations request processed.");

            var response = req.CreateResponse();

            try
            {
                // クエリパラメータから取得
                var query = System.Web.HttpUtility.ParseQueryString(req.Url.Query);
                var respondentId = query["respondentId"];
                var categoryFilter = query["category"]; // オプション: 特定カテゴリのみ削除

                if (string.IsNullOrWhiteSpace(respondentId))
                {
                    response.StatusCode = HttpStatusCode.BadRequest;
                    await response.WriteAsJsonAsync(new { 
                        success = false, 
                        error = "RespondentId is required" 
                    });
                    return response;
                }

                var connectionString = Environment.GetEnvironmentVariable("SqlConnectionString");
                if (string.IsNullOrEmpty(connectionString))
                {
                    response.StatusCode = HttpStatusCode.InternalServerError;
                    await response.WriteAsJsonAsync(new { 
                        success = false, 
                        error = "Database connection string not configured" 
                    });
                    return response;
                }

                using var connection = new SqlConnection(connectionString);
                await connection.OpenAsync();

                // AI評価結果を削除
                string deleteSql;
                SqlCommand deleteCmd;

                if (!string.IsNullOrWhiteSpace(categoryFilter))
                {
                    // 特定カテゴリのみ削除（限定提供データの管理）
                    deleteSql = @"
                        DELETE er FROM [EvaluationResults$] er
                        INNER JOIN [Answers$] a ON er.[RespondentId] = a.[回答者番号] AND er.[SubcategoryId] = a.[中項目番号]
                        WHERE er.[RespondentId] = @RespondentId 
                        AND a.[大項目] = @Category";
                    
                    deleteCmd = new SqlCommand(deleteSql, connection);
                    deleteCmd.Parameters.AddWithValue("@RespondentId", respondentId);
                    deleteCmd.Parameters.AddWithValue("@Category", categoryFilter);
                }
                else
                {
                    // 全てのAI評価結果を削除
                    deleteSql = "DELETE FROM [EvaluationResults$] WHERE [RespondentId] = @RespondentId";
                    deleteCmd = new SqlCommand(deleteSql, connection);
                    deleteCmd.Parameters.AddWithValue("@RespondentId", respondentId);
                }

                var deletedCount = await deleteCmd.ExecuteNonQueryAsync();

                _logger.LogInformation($"Deleted {deletedCount} AI evaluation records for respondent {respondentId}");

                response.StatusCode = HttpStatusCode.OK;
                await response.WriteAsJsonAsync(new { 
                    success = true, 
                    deletedCount = deletedCount,
                    message = $"Deleted {deletedCount} AI evaluation records"
                });
                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting AI evaluations");
                response.StatusCode = HttpStatusCode.InternalServerError;
                await response.WriteAsJsonAsync(new { 
                    success = false, 
                    error = "Failed to delete AI evaluations" 
                });
                return response;
            }
        }
    }
}
