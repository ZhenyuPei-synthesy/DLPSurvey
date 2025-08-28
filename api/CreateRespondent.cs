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
    public class CreateRespondent
    {
        private readonly ILogger _logger;

        public CreateRespondent(ILoggerFactory loggerFactory)
        {
            _logger = loggerFactory.CreateLogger<CreateRespondent>();
        }

        [Function("CreateRespondent")]
        public async Task<HttpResponseData> Run([HttpTrigger(AuthorizationLevel.Anonymous, "post")] HttpRequestData req)
        {
            var response = req.CreateResponse();
            _logger.LogInformation("CreateRespondent invoked");
            try
            {
                string body = await req.ReadAsStringAsync();
                _logger.LogInformation("Raw request body: {body}", body ?? "(null)");

                // guard against null for deserialization
                var safeBody = body ?? "{}";
                dynamic data = JsonConvert.DeserializeObject(safeBody);

                var company = (string)(data?.company ?? string.Empty);
                var department = (string)(data?.department ?? string.Empty);
                var jobTitle = (string)(data?.jobTitle ?? string.Empty);
                var name = (string)(data?.name ?? string.Empty);
                var email = (string)(data?.email ?? string.Empty);
                var phone = (string)(data?.phone ?? string.Empty);

                _logger.LogInformation("Parsed fields - company:{company}, department:{department}, jobTitle:{jobTitle}, name:{name}, email:{email}, phone:{phone}",
                    company, department, jobTitle, name, email, phone);

                var connectionString = Environment.GetEnvironmentVariable("SqlDbConnection", EnvironmentVariableTarget.Process);
                _logger.LogInformation("SqlDbConnection present: {present}", !string.IsNullOrEmpty(connectionString));
                if (string.IsNullOrEmpty(connectionString))
                {
                    response.StatusCode = HttpStatusCode.InternalServerError;
                    await response.WriteStringAsync("Database connection not configured");
                    return response;
                }

                using (var conn = new SqlConnection(connectionString))
                {
                    _logger.LogInformation("Opening SQL connection to {connStr}", connectionString?.Split(';')[0] ?? "(unknown)");
                    await conn.OpenAsync();
                    _logger.LogInformation("SQL connection opened");

                    var sql = @"
SET XACT_ABORT ON;
BEGIN TRAN;
DECLARE @next BIGINT;
-- compute next sequential id with exclusive table lock to avoid races
SELECT @next = ISNULL(MAX(TRY_CAST([回答者番号] AS BIGINT)), 0) + 1
FROM [dbo].[Respondent$] WITH (TABLOCKX, HOLDLOCK);

-- insert sequential respondent number into [回答者番号] and answer number into [回答番号]
INSERT INTO [dbo].[Respondent$] ([回答者番号],[企業名],[部署名],[役職名],[氏名],[メールアドレス],[電話番号],[作成日時],[回答時刻],[回答番号],[回答ステータス])
VALUES (@next,@company,@department,@jobTitle,@name,@email,@phone,@created,@answerTime,@answerNumber,@status);

COMMIT;
SELECT @next;
";
                    var cmd = new SqlCommand(sql, conn);

                    // generate answer number with 'SY' prefix + 12 digit random number
                    string answerNumber;
                    try
                    {
                        var buffer = new byte[8];
                        System.Security.Cryptography.RandomNumberGenerator.Fill(buffer);
                        ulong rnd = BitConverter.ToUInt64(buffer, 0);
                        var val = rnd % 1000000000000UL; // 12 digits
                        answerNumber = "SY" + val.ToString("D12");
                    }
                    catch
                    {
                        var rnd = new Random();
                        answerNumber = "SY" + (rnd.Next(0, 1000000).ToString("D6") + rnd.Next(0, 1000000).ToString("D6"));
                    }

                    cmd.Parameters.AddWithValue("@company", string.IsNullOrEmpty(company) ? (object)DBNull.Value : company);
                    cmd.Parameters.AddWithValue("@department", string.IsNullOrEmpty(department) ? (object)DBNull.Value : department);
                    cmd.Parameters.AddWithValue("@jobTitle", string.IsNullOrEmpty(jobTitle) ? (object)DBNull.Value : jobTitle);
                    cmd.Parameters.AddWithValue("@name", string.IsNullOrEmpty(name) ? (object)DBNull.Value : name);
                    cmd.Parameters.AddWithValue("@email", string.IsNullOrEmpty(email) ? (object)DBNull.Value : email);
                    cmd.Parameters.AddWithValue("@phone", string.IsNullOrEmpty(phone) ? (object)DBNull.Value : phone);
                    // insert current UTC time for creation, answer time and mark status as '回答中'
                    cmd.Parameters.AddWithValue("@created", DateTime.UtcNow);
                    cmd.Parameters.AddWithValue("@answerTime", DateTime.UtcNow);
                    cmd.Parameters.AddWithValue("@answerNumber", string.IsNullOrEmpty(answerNumber) ? (object)DBNull.Value : answerNumber);
                    cmd.Parameters.AddWithValue("@status", "回答中");

                    _logger.LogInformation("Executing SQL: {sql}", sql);
                    foreach (SqlParameter p in cmd.Parameters)
                    {
                        _logger.LogInformation("Param {name} = {value}", p.ParameterName, p.Value == DBNull.Value ? "<DBNULL>" : p.Value);
                    }

                    var insertedNext = await cmd.ExecuteScalarAsync();
                    _logger.LogInformation("SQL executed, next id: {val}", insertedNext ?? "(null)");

                    response.StatusCode = HttpStatusCode.OK;
                    await response.WriteAsJsonAsync(new { success = true, respondentId = insertedNext, answerNumber = answerNumber });
                    return response;
                }
            }
            catch (SqlException sqlEx)
            {
                _logger.LogError(sqlEx, "SQL Exception (Number={Number})", sqlEx.Number);
                response.StatusCode = HttpStatusCode.InternalServerError;
                await response.WriteAsJsonAsync(new { success = false, error = sqlEx.Message, code = sqlEx.Number });
                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unhandled exception creating respondent");
                response.StatusCode = HttpStatusCode.InternalServerError;
                await response.WriteAsJsonAsync(new { success = false, error = ex.Message });
                return response;
            }
        }
    }
}
