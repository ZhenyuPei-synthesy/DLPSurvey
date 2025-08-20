const { v4: uuidv4 } = require('uuid');

module.exports = async function (context, req) {
    context.log('SubmitAnswer function processed a request.');

    // 1. ユーザーIDの取得
    // Azure Static Web Appsの認証機能を使うと、このヘッダーにユーザー情報が自動的に入る
    const header = req.headers["x-ms-client-principal"];
    let userId = "anonymous"; // デフォルト値
    if (header) {
        const decoded = Buffer.from(header, "base64").toString("ascii");
        const clientPrincipal = JSON.parse(decoded);
        userId = clientPrincipal.userId;
    }

    // 2. リクエストボディ（回答データ）の取得
    const answers = req.body;
    if (!answers || Object.keys(answers).length === 0) {
        context.res = {
            status: 400,
            body: "Please pass answer data in the request body"
        };
        return;
    }

    // 3. Cosmos DBに保存するドキュメントを作成
    const documentToSave = {
        // 一意のIDを生成
        id: uuidv4(),
        userId: userId,
        answers: answers,
        // サーバー側のタイムスタンプを追加
        submittedAt: new Date().toISOString()
    };

    // 4. 出力バインディングを使ってCosmos DBに保存
    // function.jsonで定義した "outputDocument" にオブジェクトをセットするだけで保存が実行される
    context.bindings.outputDocument = documentToSave;

    // 5. 成功レスポンスをフロントエンドに返却
    context.res = {
        status: 200,
        body: { 
            message: "Answer submitted successfully.",
            id: documentToSave.id 
        }
    };
}