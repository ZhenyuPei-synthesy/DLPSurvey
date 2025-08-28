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
    public class ResumeSurvey
    {
        private readonly ILogger _logger;

        public ResumeSurvey(ILoggerFactory loggerFactory)
        {
            _logger = loggerFactory.CreateLogger<ResumeSurvey>();
        }

        [Function("ResumeSurvey")]
        public async Task<HttpResponseData> Run(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post")] HttpRequestData req)
        {
            _logger.LogInformation("Resume survey request processed.");

            var response = req.CreateResponse();

            try
            {
                // リクエストボディを読み取り
                string requestBody = await req.ReadAsStringAsync() ?? "{}";
                var requestData = JsonConvert.DeserializeObject<ResumeRequest>(requestBody);

                _logger.LogInformation($"Resume request for email {requestData?.Email} with answer number {requestData?.AnswerNumber}");

                // 接続文字列取得
                var connectionString = Environment.GetEnvironmentVariable("SqlDbConnection", EnvironmentVariableTarget.Process);
                
                if (string.IsNullOrEmpty(connectionString))
                {
                    response.StatusCode = HttpStatusCode.InternalServerError;
                    await response.WriteStringAsync("Database connection not configured");
                    return response;
                }

                if (string.IsNullOrWhiteSpace(requestData?.Email) || string.IsNullOrWhiteSpace(requestData?.AnswerNumber))
                {
                    response.StatusCode = HttpStatusCode.BadRequest;
                    await response.WriteAsJsonAsync(new { 
                        success = false, 
                        error = "Email and AnswerNumber are required" 
                    });
                    return response;
                }

                string? respondentId = null;

                // Email + 回答番号で回答者番号を検索（回答ステータスが「一時保存」のもの）
                using (var connection = new SqlConnection(connectionString))
                {
                    await connection.OpenAsync();
                    
                    var selectCmd = new SqlCommand(@"
                        SELECT TOP 1 [回答者番号] 
                        FROM [Respondent$]
                        WHERE [メールアドレス] = @Email 
                          AND [回答番号] = @AnswerNumber 
                          AND [回答ステータス] = '一時保存'
                        ORDER BY [作成日時] DESC", connection);
                    
                    selectCmd.Parameters.AddWithValue("@Email", requestData.Email);
                    selectCmd.Parameters.AddWithValue("@AnswerNumber", requestData.AnswerNumber);
                    
                    var result = await selectCmd.ExecuteScalarAsync();
                    respondentId = result?.ToString();
                }

                if (string.IsNullOrEmpty(respondentId))
                {
                    response.StatusCode = HttpStatusCode.NotFound;
                    await response.WriteAsJsonAsync(new { 
                        success = false, 
                        error = "No temporary save found for the provided email and answer number" 
                    });
                    return response;
                }

                response.StatusCode = HttpStatusCode.OK;
                await response.WriteAsJsonAsync(new { 
                    success = true, 
                    respondentId = respondentId,
                    message = "Resume data found"
                });
                
                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error resuming survey");
                response.StatusCode = HttpStatusCode.InternalServerError;
                await response.WriteAsJsonAsync(new { 
                    success = false, 
                    error = "Failed to resume survey" 
                });
                return response;
            }
        }

        public class ResumeRequest
        {
            public string? Email { get; set; }
            public string? AnswerNumber { get; set; }
        }
    }
}
