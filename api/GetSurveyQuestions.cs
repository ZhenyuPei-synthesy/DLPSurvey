using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Threading.Tasks;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Data.SqlClient;
using Newtonsoft.Json;
using System.Text.RegularExpressions;
using Azure.Core;
using Azure.Identity;

namespace Company.Function
{
    public class GetSurveyQuestions
    {
        private readonly ILogger _logger;

        public GetSurveyQuestions(ILoggerFactory loggerFactory)
        {
            _logger = loggerFactory.CreateLogger<GetSurveyQuestions>();
        }

        [Function("GetSurveyQuestions")]
        public async Task<HttpResponseData> Run(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", "post", "options")] HttpRequestData req)
        {
            _logger.LogInformation("C# HTTP trigger function processed a request.");

            var response = req.CreateResponse();

            // CORS プリフライトリクエスト（OPTIONS）の処理
            if (req.Method == "OPTIONS")
            {
                response.StatusCode = HttpStatusCode.OK;
                AddCorsHeaders(response, req);
                return response;
            }

            // 接続文字列取得
            var connectionString = Environment.GetEnvironmentVariable("SqlDbConnection", EnvironmentVariableTarget.Process);
            // If running functions locally (Development), force local DB (master) to avoid connecting to Azure DB
            var functionsEnv = Environment.GetEnvironmentVariable("AZURE_FUNCTIONS_ENVIRONMENT") ?? Environment.GetEnvironmentVariable("AzureWebJobsEnvironment");
            if (!string.IsNullOrEmpty(functionsEnv) && functionsEnv.Equals("Development", StringComparison.OrdinalIgnoreCase))
            {
                if (!string.IsNullOrWhiteSpace(connectionString))
                {
                    // replace Database=... or Initial Catalog=... with Database=master
                    connectionString = Regex.Replace(connectionString, "(?i)(Database|Initial Catalog)\\s*=\\s*[^;]+", "Database=master");
                    _logger.LogInformation("Local environment detected: using local DB 'master' for SqlDbConnection.");
                }
            }
            var questions = new List<SurveyQuestion>();

            // Helper local functions
            int? ParseLeadingNumber(string s)
            {
                if (string.IsNullOrWhiteSpace(s)) return null;
                // normalize full-width digits to ASCII
                var sb = new System.Text.StringBuilder(s.Length);
                foreach (var ch in s)
                {
                    // full-width digits ０(65296)〜９(65305)
                    if (ch >= '０' && ch <= '９') sb.Append((char)('0' + (ch - '０')));
                    else sb.Append(ch);
                }
                var normalized = sb.ToString();
                var m = Regex.Match(normalized, "^\\s*(\\d{1,2})\\s*[\\.．\\)）、:-]*\\s*(.*)$");
                if (m.Success && int.TryParse(m.Groups[1].Value, out var n)) return n;
                // fallback: find first ascii digit run
                var m2 = Regex.Match(normalized, "(\\d{1,2})");
                if (m2.Success && int.TryParse(m2.Groups[1].Value, out var n2)) return n2;
                return null;
            }

            string ExtractTextWithoutLeadingNumber(string s)
            {
                if (string.IsNullOrWhiteSpace(s)) return s ?? string.Empty;
                var sb = new System.Text.StringBuilder(s.Length);
                foreach (var ch in s)
                {
                    if (ch >= '０' && ch <= '９') sb.Append((char)('0' + (ch - '０')));
                    else sb.Append(ch);
                }
                var normalized = sb.ToString();
                var m = Regex.Match(normalized, "^\\s*(\\d{1,2})\\s*[\\.．\\)）、:-]*\\s*(.*)$");
                if (m.Success) return m.Groups[2].Value.Trim();
                return normalized.Trim();
            }

            try
            {
                                using (var connection = new SqlConnection(connectionString))
                                {
                                        await connection.OpenAsync();

                                        // Simplified: always use 'チェック項目番号' as the join / question identifier
                                        var templateTable = "SurveyTemplate$";
                                        var optionsTable = "SurveyOptions$";
                                        var joinCol = "チェック項目番号";

                                        var sql = $@"
SELECT 
    t.[{joinCol}] AS QuestionNumber,
    t.[大項目] AS DaiItem,
    t.[中項目] AS ChuItem,
    t.[チェック項目] AS CheckItem,
    t.[リスク] AS Risk,
    o.[対策評価] AS OptionRaw
FROM dbo.[{templateTable}] t
LEFT JOIN dbo.[{optionsTable}] o ON t.[{joinCol}] = o.[{joinCol}]
ORDER BY t.[{joinCol}], o.[対策評価]";

                                        var cmd = new SqlCommand(sql, connection);
                    using (var reader = await cmd.ExecuteReaderAsync())
                    {
                        // aggregate by question number
                        var map = new Dictionary<string, SurveyQuestion>();
                        while (await reader.ReadAsync())
                        {
                            var qnum = reader["QuestionNumber"]?.ToString() ?? string.Empty;
                                if (!map.TryGetValue(qnum, out var q))
                                {
                                    q = new SurveyQuestion
                                    {
                                        QuestionNumber = qnum,
                                        DaiItem = reader["DaiItem"]?.ToString() ?? string.Empty,
                                        ChuItem = reader["ChuItem"]?.ToString() ?? string.Empty,
                                        CheckItem = reader["CheckItem"]?.ToString() ?? string.Empty,
                                        Risk = reader["Risk"]?.ToString() ?? string.Empty,
                                        Options = new List<Option>()
                                    };
                                    map[qnum] = q;
                                }

                            var optRaw = reader["OptionRaw"] == DBNull.Value ? null : reader["OptionRaw"].ToString();
                            if (!string.IsNullOrWhiteSpace(optRaw))
                            {
                                var score = ParseLeadingNumber(optRaw);
                                var text = ExtractTextWithoutLeadingNumber(optRaw);
                                // dedupe by text or score
                                var opts = q.Options ?? new List<Option>();
                                var exists = opts.Any(x => (!string.IsNullOrEmpty(x.Text) && x.Text == text) || (x.Score.HasValue && score.HasValue && x.Score == score));
                                if (!exists)
                                {
                                    opts.Add(new Option { Score = score, Text = text });
                                    q.Options = opts;
                                }
                            }
                        }

                        // convert map to ordered list and sort options
                        foreach (var kv in map)
                        {
                            var item = kv.Value;
                            // sort options: by Score ascending (nulls last), then by Text
                            var opts2 = item.Options ?? new List<Option>();
                            item.Options = opts2
                                .OrderBy(o => o.Score.HasValue ? 0 : 1)
                                .ThenBy(o => o.Score ?? int.MaxValue)
                                .ThenBy(o => o.Text)
                                .ToList();
                            questions.Add(item);
                        }
                    }
                }

                response.StatusCode = HttpStatusCode.OK;
                AddCorsHeaders(response, req);
                await response.WriteAsJsonAsync(questions);
                return response;
            }
            catch (Exception ex)
            {
                // Log full exception server-side
                _logger.LogError(ex, "DB取得またはトークン取得でエラーが発生しました。");

                // For local development make the error visible in the HTTP response body
                response.StatusCode = HttpStatusCode.InternalServerError;
                AddCorsHeaders(response, req);
                // Include exception message (and short stacktrace) in response to aid debugging.
                // Remove or restrict this in production to avoid leaking sensitive info.
                var errorText = $"Error: {ex.Message}\n{ex.StackTrace}";
                await response.WriteStringAsync(errorText);
                return response;
            }
        }

        private void AddCorsHeaders(HttpResponseData response, HttpRequestData request)
        {
            // 許可するOriginのリスト
            var allowedOrigins = new[]
            {
                "http://localhost:3000",    // React開発サーバー
                "http://localhost:5173",    // Vite開発サーバー  
                "http://localhost:4280",    // SWA CLI開発サーバー
                "https://orange-pebble-0db3cdd00.1.azurestaticapps.net" // 本番環境
            };

            var origin = request.Headers.GetValues("Origin")?.FirstOrDefault();
            
            if (!string.IsNullOrEmpty(origin) && allowedOrigins.Contains(origin))
            {
                response.Headers.Add("Access-Control-Allow-Origin", origin);
            }
            else
            {
                // デフォルトで本番環境を許可（後方互換性のため）
                response.Headers.Add("Access-Control-Allow-Origin", "https://orange-pebble-0db3cdd00.1.azurestaticapps.net");
            }
            
            response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
            response.Headers.Add("Access-Control-Allow-Headers", "Content-Type, Authorization");
            response.Headers.Add("Access-Control-Allow-Credentials", "false");
        }

        public class SurveyQuestion
        {
            public string? QuestionNumber { get; set; }
            public string? DaiItem { get; set; }
            public string? ChuItem { get; set; }
            public string? CheckItem { get; set; }
            public string? TargetEvaluation { get; set; }
            public string? Risk { get; set; }
            public List<Option>? Options { get; set; }
        }

        public class Option
        {
            public int? Score { get; set; }
            public string? Text { get; set; }
        }
    }
}
