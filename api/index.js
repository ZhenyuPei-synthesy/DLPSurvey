
module.exports = async function (context, req) {
  context.res = {
    status: 200,
    body: `Received: ${JSON.stringify(req.body)}`
  };
};
