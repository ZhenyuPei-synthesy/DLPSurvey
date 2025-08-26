using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using System.Net;

namespace Company.Function
{
    public class TestFunction
    {
        private readonly ILogger _logger;

        public TestFunction(ILoggerFactory loggerFactory)
        {
            _logger = loggerFactory.CreateLogger<TestFunction>();
        }

        [Function("Test")]
        public HttpResponseData Run([HttpTrigger(AuthorizationLevel.Anonymous, "get")] HttpRequestData req)
        {
            _logger.LogInformation("Test function processed a request.");

            var response = req.CreateResponse(HttpStatusCode.OK);
            response.Headers.Add("Content-Type", "application/json; charset=utf-8");
            response.WriteString("{\"message\": \"Azure Functions is working!\", \"timestamp\": \"" + DateTime.UtcNow.ToString() + "\"}");

            return response;
        }
    }
}
