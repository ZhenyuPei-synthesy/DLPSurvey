using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Data.SqlClient;
using System.Text.Json;
using System.Net;

namespace DlpFunctions
{
    public class UpdateRespondentStatus
    {
        private readonly ILogger _logger;

        public UpdateRespondentStatus(ILoggerFactory loggerFactory)
        {
            _logger = loggerFactory.CreateLogger<UpdateRespondentStatus>();
        }

        [Function("UpdateRespondentStatus")]
        public async Task<HttpResponseData> Run([HttpTrigger(AuthorizationLevel.Function, "post")] HttpRequestData req)
        {
            _logger.LogInformation("UpdateRespondentStatus function processed a request.");

            try
            {
                string requestBody = await new StreamReader(req.Body).ReadToEndAsync();
                var requestData = JsonSerializer.Deserialize<UpdateStatusRequest>(requestBody);

                if (requestData == null || string.IsNullOrEmpty(requestData.RespondentId))
                {
                    var errorResponse = req.CreateResponse(HttpStatusCode.BadRequest);
                    await errorResponse.WriteStringAsync("回答者IDが必要です。");
                    return errorResponse;
                }

                string connectionString = Environment.GetEnvironmentVariable("SqlDbConnection");
                if (string.IsNullOrEmpty(connectionString))
                {
                    var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
                    await errorResponse.WriteStringAsync("データベース接続文字列が設定されていません。");
                    return errorResponse;
                }

                using (var connection = new SqlConnection(connectionString))
                {
                    await connection.OpenAsync();

                    // Respondent$テーブルの回答ステータスを更新
                    string updateQuery = @"
                        UPDATE [Respondent$] 
                        SET [回答ステータス] = @Status,
                            [更新日時] = GETDATE()
                        WHERE [回答者番号] = @RespondentId";

                    using (var command = new SqlCommand(updateQuery, connection))
                    {
                        command.Parameters.AddWithValue("@RespondentId", requestData.RespondentId);
                        command.Parameters.AddWithValue("@Status", requestData.Status);

                        int rowsAffected = await command.ExecuteNonQueryAsync();
                        
                        _logger.LogInformation($"Updated respondent status for RespondentId: {requestData.RespondentId} to {requestData.Status}, rows affected: {rowsAffected}");

                        var response = req.CreateResponse(HttpStatusCode.OK);
                        var result = new
                        {
                            success = true,
                            message = "回答者ステータスが正常に更新されました。",
                            respondentId = requestData.RespondentId,
                            status = requestData.Status,
                            rowsAffected = rowsAffected
                        };
                        await response.WriteStringAsync(JsonSerializer.Serialize(result));
                        return response;
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "UpdateRespondentStatus function encountered an error.");
                var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
                await errorResponse.WriteStringAsync($"エラーが発生しました: {ex.Message}");
                return errorResponse;
            }
        }
    }

    public class UpdateStatusRequest
    {
        public string RespondentId { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
    }
}