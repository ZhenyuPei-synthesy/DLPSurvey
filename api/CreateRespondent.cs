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

        private DateTime GetJapanNow()
        {
            try
            {
                // Windows timezone id
                var tz = TimeZoneInfo.FindSystemTimeZoneById("Tokyo Standard Time");
                return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz);
            }
            catch
            {
                try
                {
                    // Linux/macOS timezone id
                    var tz = TimeZoneInfo.FindSystemTimeZoneById("Asia/Tokyo");
                    return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz);
                }
                catch
                {
                    // fallback: add 9 hours to UTC
                    return DateTime.UtcNow.AddHours(9);
                }
            }
        }

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
                string body = await req.ReadAsStringAsync() ?? "";
                _logger.LogInformation("Raw request body: {body}", body);

                // guard against null for deserialization
                var safeBody = body ?? "{}";
                dynamic? data = JsonConvert.DeserializeObject(safeBody);

                var respondentId = (string)(data?.respondentId ?? string.Empty);
                var company = (string)(data?.company ?? string.Empty);
                var department = (string)(data?.department ?? string.Empty);
                var jobTitle = (string)(data?.jobTitle ?? string.Empty);
                var name = (string)(data?.name ?? string.Empty);
                var email = (string)(data?.email ?? string.Empty);
                var phone = (string)(data?.phone ?? string.Empty);
                var expertConsultation = (string)(data?.expertConsultation ?? string.Empty); // 詳細提案希望要否
                var benchmarkReport = (string)(data?.benchmarkReport ?? string.Empty); // ベンチマーク統計協力有無
                var registrationAndDownloadStatus = (string)(data?.registrationAndDownloadStatus ?? string.Empty); // 回答者情報登録及びダウンロード

                _logger.LogInformation("Parsed fields - respondentId:{respondentId}, company:{company}, department:{department}, jobTitle:{jobTitle}, name:{name}, email:{email}, phone:{phone}",
                    respondentId, company, department, jobTitle, name, email, phone);

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

                    // Check if respondentId is provided for update
                    if (!string.IsNullOrEmpty(respondentId))
                    {
                        // Update existing respondent
                        var updateSql = @"
UPDATE [dbo].[Respondent$] 
SET [企業名] = @company,
    [部署名] = @department,
    [役職名] = @jobTitle,
    [氏名] = @name,
    [メールアドレス] = @email,
    [電話番号] = @phone,
    [詳細提案希望要否] = @expertConsultation,
    [ベンチマーク統計協力有無] = @benchmarkReport,
    [回答者情報登録及びダウンロード] = @registrationAndDownloadStatus,
    [回答時刻] = @answerTime
WHERE [回答者番号] = @respondentId;
";
                        var updateCmd = new SqlCommand(updateSql, conn);
                        updateCmd.Parameters.AddWithValue("@respondentId", respondentId);
                        updateCmd.Parameters.AddWithValue("@company", string.IsNullOrEmpty(company) ? (object)DBNull.Value : company);
                        updateCmd.Parameters.AddWithValue("@department", string.IsNullOrEmpty(department) ? (object)DBNull.Value : department);
                        updateCmd.Parameters.AddWithValue("@jobTitle", string.IsNullOrEmpty(jobTitle) ? (object)DBNull.Value : jobTitle);
                        updateCmd.Parameters.AddWithValue("@name", string.IsNullOrEmpty(name) ? (object)DBNull.Value : name);
                        updateCmd.Parameters.AddWithValue("@email", string.IsNullOrEmpty(email) ? (object)DBNull.Value : email);
                        updateCmd.Parameters.AddWithValue("@phone", string.IsNullOrEmpty(phone) ? (object)DBNull.Value : phone);
                        updateCmd.Parameters.AddWithValue("@expertConsultation", string.IsNullOrEmpty(expertConsultation) ? (object)DBNull.Value : expertConsultation);
                        updateCmd.Parameters.AddWithValue("@benchmarkReport", string.IsNullOrEmpty(benchmarkReport) ? (object)DBNull.Value : benchmarkReport);
                        updateCmd.Parameters.AddWithValue("@registrationAndDownloadStatus", string.IsNullOrEmpty(registrationAndDownloadStatus) ? (object)DBNull.Value : registrationAndDownloadStatus);
                        updateCmd.Parameters.AddWithValue("@answerTime", GetJapanNow());

                        _logger.LogInformation("Executing UPDATE SQL: {sql}", updateSql);
                        foreach (SqlParameter p in updateCmd.Parameters)
                        {
                            _logger.LogInformation("Param {name} = {value}", p.ParameterName, p.Value == DBNull.Value ? "<DBNULL>" : p.Value);
                        }

                        var rowsAffected = await updateCmd.ExecuteNonQueryAsync();
                        _logger.LogInformation("UPDATE executed, rows affected: {rows}", rowsAffected);

                        if (rowsAffected > 0)
                        {
                            response.StatusCode = HttpStatusCode.OK;
                            await response.WriteAsJsonAsync(new { success = true, respondentId = respondentId, updated = true });
                            return response;
                        }
                        else
                        {
                            _logger.LogWarning("No rows updated for respondentId: {respondentId}", respondentId);
                            response.StatusCode = HttpStatusCode.NotFound;
                            await response.WriteAsJsonAsync(new { success = false, error = "Respondent not found for update" });
                            return response;
                        }
                    }
                    else
                    {
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

                        // Insert new respondent with auto-generated values based on respondent ID
                        // Use a transaction to get next ID and insert in one operation

                        var sql = @"
SET XACT_ABORT ON;
BEGIN TRAN;
DECLARE @next BIGINT;
DECLARE @nextStr NVARCHAR(50);
-- compute next sequential id with exclusive table lock to avoid races
SELECT @next = ISNULL(MAX(TRY_CAST([回答者番号] AS BIGINT)), 0) + 1
FROM [dbo].[Respondent$] WITH (TABLOCKX, HOLDLOCK);

-- convert to string for use in company, name, and email
SET @nextStr = CAST(@next AS NVARCHAR(50));

-- insert sequential respondent number and auto-generated values
INSERT INTO [dbo].[Respondent$] (
    [回答者番号], [企業名], [部署名], [役職名], [氏名], [メールアドレス], [電話番号],
    [詳細提案希望要否], [ベンチマーク統計協力有無], [回答者情報登録及びダウンロード],
    [作成日時], [回答時刻], [回答番号], [回答ステータス])
VALUES (
    @next, @nextStr, @department, @jobTitle, @nextStr, @nextStr + '@.tmp.co.jp', @phone,
    @expertConsultation, @benchmarkReport, @registrationAndDownloadStatus,
    @created, @answerTime, @answerNumber, @status);

COMMIT;
SELECT @next;
";
                        var cmd = new SqlCommand(sql, conn);

                        // Set parameters - only the ones we pass from C#
                        cmd.Parameters.AddWithValue("@department", string.IsNullOrEmpty(department) ? (object)DBNull.Value : department);
                        cmd.Parameters.AddWithValue("@jobTitle", string.IsNullOrEmpty(jobTitle) ? (object)DBNull.Value : jobTitle);
                        cmd.Parameters.AddWithValue("@phone", string.IsNullOrEmpty(phone) ? (object)DBNull.Value : phone);
                        cmd.Parameters.AddWithValue("@expertConsultation", string.IsNullOrEmpty(expertConsultation) ? (object)DBNull.Value : expertConsultation);
                        cmd.Parameters.AddWithValue("@benchmarkReport", string.IsNullOrEmpty(benchmarkReport) ? (object)DBNull.Value : benchmarkReport);
                        cmd.Parameters.AddWithValue("@registrationAndDownloadStatus", string.IsNullOrEmpty(registrationAndDownloadStatus) ? (object)DBNull.Value : registrationAndDownloadStatus);
                        // insert current Japan time for creation, answer time and mark status as '回答中'
                        var japanNow = GetJapanNow();
                        cmd.Parameters.AddWithValue("@created", japanNow);
                        cmd.Parameters.AddWithValue("@answerTime", japanNow);
                        cmd.Parameters.AddWithValue("@answerNumber", string.IsNullOrEmpty(answerNumber) ? (object)DBNull.Value : answerNumber);
                        cmd.Parameters.AddWithValue("@status", "回答中");

                        _logger.LogInformation("Executing INSERT SQL: {sql}", sql);
                        foreach (SqlParameter p in cmd.Parameters)
                        {
                            _logger.LogInformation("Param {name} = {value}", p.ParameterName, p.Value == DBNull.Value ? "<DBNULL>" : p.Value);
                        }

                        var result = await cmd.ExecuteScalarAsync();
                        var newRespondentId = result?.ToString() ?? "1";
                        _logger.LogInformation("INSERT executed successfully, respondent ID: {val}", newRespondentId);

                        response.StatusCode = HttpStatusCode.OK;
                        await response.WriteAsJsonAsync(new { success = true, respondentId = newRespondentId, answerNumber = answerNumber });
                        return response;
                    }
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
