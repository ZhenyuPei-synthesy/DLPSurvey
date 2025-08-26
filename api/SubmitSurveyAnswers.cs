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
                string requestBody = await req.ReadAsStringAsync();
                var answers = JsonConvert.DeserializeObject<Dictionary<string, AnswerData>>(requestBody);

                _logger.LogInformation($"Received {answers?.Count ?? 0} answers");

                // 接続文字列取得
                var connectionString = Environment.GetEnvironmentVariable("SqlDbConnection", EnvironmentVariableTarget.Process);
                
                if (string.IsNullOrEmpty(connectionString))
                {
                    response.StatusCode = HttpStatusCode.InternalServerError;
                    await response.WriteStringAsync("Database connection not configured");
                    return response;
                }

                // データベースに保存
                using (var connection = new SqlConnection(connectionString))
                {
                    await connection.OpenAsync();
                    
                    foreach (var answer in answers)
                    {
                        var insertCmd = new SqlCommand(
                            "INSERT INTO SurveyAnswers (ItemId, Score, Comment, SubmissionDate) VALUES (@ItemId, @Score, @Comment, @SubmissionDate)", 
                            connection);
                        
                        insertCmd.Parameters.AddWithValue("@ItemId", answer.Key);
                        insertCmd.Parameters.AddWithValue("@Score", answer.Value.Score ?? (object)DBNull.Value);
                        insertCmd.Parameters.AddWithValue("@Comment", answer.Value.Comment ?? (object)DBNull.Value);
                        insertCmd.Parameters.AddWithValue("@SubmissionDate", DateTime.UtcNow);
                        
                        await insertCmd.ExecuteNonQueryAsync();
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

        public class AnswerData
        {
            public int? Score { get; set; }
            public string Comment { get; set; }
        }
    }
}
