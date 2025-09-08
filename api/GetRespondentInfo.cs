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
    public class GetRespondentInfo
    {
        private readonly ILogger _logger;

        public GetRespondentInfo(ILoggerFactory loggerFactory)
        {
            _logger = loggerFactory.CreateLogger<GetRespondentInfo>();
        }

        [Function("GetRespondentInfo")]
        public async Task<HttpResponseData> Run([HttpTrigger(AuthorizationLevel.Anonymous, "get")] HttpRequestData req)
        {
            var response = req.CreateResponse();
            _logger.LogInformation("GetRespondentInfo invoked");

            try
            {
                var query = System.Web.HttpUtility.ParseQueryString(req.Url.Query);
                var respondentId = query["respondentId"];

                if (string.IsNullOrEmpty(respondentId))
                {
                    response.StatusCode = HttpStatusCode.BadRequest;
                    await response.WriteAsJsonAsync(new { success = false, error = "respondentId is required" });
                    return response;
                }

                var connectionString = Environment.GetEnvironmentVariable("SqlDbConnection", EnvironmentVariableTarget.Process);
                if (string.IsNullOrEmpty(connectionString))
                {
                    response.StatusCode = HttpStatusCode.InternalServerError;
                    await response.WriteAsJsonAsync(new { success = false, error = "Database connection not configured" });
                    return response;
                }

                using (var conn = new SqlConnection(connectionString))
                {
                    await conn.OpenAsync();
                    
                    var sql = @"
SELECT 
    [企業名],
    [部署名], 
    [役職名],
    [氏名],
    [メールアドレス],
    [電話番号],
    [詳細提案希望要否],
    [ベンチマーク統計協力有無],
    [回答者情報登録及びダウンロード]
FROM [dbo].[Respondent$] 
WHERE [回答者番号] = @respondentId";

                    var cmd = new SqlCommand(sql, conn);
                    cmd.Parameters.AddWithValue("@respondentId", respondentId);

                    using (var reader = await cmd.ExecuteReaderAsync())
                    {
                        if (await reader.ReadAsync())
                        {
                            var respondentInfo = new
                            {
                                company = reader["企業名"] as string ?? "",
                                department = reader["部署名"] as string ?? "",
                                jobTitle = reader["役職名"] as string ?? "",
                                name = reader["氏名"] as string ?? "",
                                email = reader["メールアドレス"] as string ?? "",
                                phone = reader["電話番号"] as string ?? "",
                                expertConsultation = reader["詳細提案希望要否"] as string ?? "",
                                benchmarkReport = reader["ベンチマーク統計協力有無"] as string ?? "",
                                registrationAndDownloadStatus = reader["回答者情報登録及びダウンロード"] as string ?? ""
                            };

                            response.StatusCode = HttpStatusCode.OK;
                            await response.WriteAsJsonAsync(new { success = true, respondentInfo });
                            return response;
                        }
                        else
                        {
                            response.StatusCode = HttpStatusCode.NotFound;
                            await response.WriteAsJsonAsync(new { success = false, error = "Respondent not found" });
                            return response;
                        }
                    }
                }
            }
            catch (SqlException sqlEx)
            {
                _logger.LogError(sqlEx, "SQL Exception in GetRespondentInfo");
                response.StatusCode = HttpStatusCode.InternalServerError;
                await response.WriteAsJsonAsync(new { success = false, error = sqlEx.Message });
                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unhandled exception in GetRespondentInfo");
                response.StatusCode = HttpStatusCode.InternalServerError;
                await response.WriteAsJsonAsync(new { success = false, error = ex.Message });
                return response;
            }
        }
    }
}
