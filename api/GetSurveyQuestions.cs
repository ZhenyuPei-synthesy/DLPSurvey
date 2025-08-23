using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.WebJobs;
using Microsoft.Azure.WebJobs.Extensions.Http;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;
using Microsoft.Data.SqlClient;
using Newtonsoft.Json;

namespace Company.Function
{
    public static class GetSurveyQuestions
    {
        [FunctionName("GetSurveyQuestions")]
        public static async Task<IActionResult> Run(
            [HttpTrigger(AuthorizationLevel.Function, "get", "post", Route = null)] HttpRequest req,
            ILogger log)
        {
            log.LogInformation("C# HTTP trigger function processed a request.");

            // 接続文字列取得
            var connectionString = Environment.GetEnvironmentVariable("SqlDbConnection", EnvironmentVariableTarget.Process);

            var questions = new List<SurveyQuestion>();

            try
            {
                using (var connection = new SqlConnection(connectionString))
                {
                    await connection.OpenAsync();
                    var cmd = new SqlCommand("SELECT 大項目, 中項目, チェック項目, 対策評価, リスク FROM dbo.Servey", connection);
                    using (var reader = await cmd.ExecuteReaderAsync())
                    {
                        while (await reader.ReadAsync())
                        {
                            questions.Add(new SurveyQuestion
                            {
                                DaiItem = reader["大項目"].ToString(),
                                ChuItem = reader["中項目"].ToString(),
                                CheckItem = reader["チェック項目"].ToString(),
                                TargetEvaluation = reader["対策評価"].ToString(),
                                Risk = reader["リスク"].ToString()
                            });
                        }
                    }
                }
                return new OkObjectResult(questions);
            }
            catch (Exception ex)
            {
                log.LogError(ex, "DB取得エラー");
                return new StatusCodeResult(500);
            }
        }

        public class SurveyQuestion
        {
            public string DaiItem { get; set; }
            public string ChuItem { get; set; }
            public string CheckItem { get; set; }
            public string TargetEvaluation { get; set; }
            public string Risk { get; set; }
        }
    }
}
