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

                _logger.LogInformation($"Resume request for answer number {requestData?.AnswerNumber}");

                // 接続文字列取得
                var connectionString = Environment.GetEnvironmentVariable("SqlDbConnection", EnvironmentVariableTarget.Process);
                
                if (string.IsNullOrEmpty(connectionString))
                {
                    response.StatusCode = HttpStatusCode.InternalServerError;
                    await response.WriteAsJsonAsync(new { success = false, error = "Database connection not configured" });
                    return response;
                }

                if (string.IsNullOrWhiteSpace(requestData?.AnswerNumber))
                {
                    response.StatusCode = HttpStatusCode.BadRequest;
                    await response.WriteAsJsonAsync(new { 
                        success = false, 
                        error = "AnswerNumber is required" 
                    });
                    return response;
                }

                string? respondentId = null;
                string? registrationAndDownloadStatus = null;

                // アセスメント番号で回答者番号と回答者情報登録及びダウンロードを検索
                using (var connection = new SqlConnection(connectionString))
                {
                    await connection.OpenAsync();
                    
                    var selectCmd = new SqlCommand(@"
                        SELECT TOP 1 [回答者番号], [回答者情報登録及びダウンロード]
                        FROM [Respondent$]
                        WHERE [回答番号] = @AnswerNumber 
                        ORDER BY [作成日時] DESC", connection);
                    
                    selectCmd.Parameters.AddWithValue("@AnswerNumber", requestData.AnswerNumber);
                    
                    using (var reader = await selectCmd.ExecuteReaderAsync())
                    {
                        if (await reader.ReadAsync())
                        {
                            respondentId = reader["回答者番号"]?.ToString();
                            registrationAndDownloadStatus = reader["回答者情報登録及びダウンロード"]?.ToString();
                        }
                    }
                }

                if (string.IsNullOrEmpty(respondentId))
                {
                    response.StatusCode = HttpStatusCode.NotFound;
                    await response.WriteAsJsonAsync(new { 
                        success = false, 
                        error = "指定されたアセスメント番号に対応するアンケートが見つかりませんでした。" 
                    });
                    return response;
                }

                // 回答者情報登録及びダウンロードが「登録及びダウンロード済み」の場合は専用メッセージを返す
                if (registrationAndDownloadStatus == "登録及びダウンロード済み")
                {
                    response.StatusCode = HttpStatusCode.OK;
                    await response.WriteAsJsonAsync(new { 
                        success = false,
                        completed = true, 
                        error = "このアンケートは既に回答が完了しています。ご協力ありがとうございました。" 
                    });
                    return response;
                }

                // 回答ステータスが「一時保存」でない場合
                /*if (status != "一時保存" && status != "回答済")
                {
                    response.StatusCode = HttpStatusCode.BadRequest;
                    await response.WriteAsJsonAsync(new { 
                        success = false, 
                        error = "This survey is not available for resumption" 
                    });
                    return response;
                }*/

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
