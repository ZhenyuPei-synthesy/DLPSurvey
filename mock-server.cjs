// Mock server for local development
const http = require('http');

const mockData = [
    {
        DaiItem: "データ管理",
        ChuItem: "データ分類",
        CheckItem: "機密情報の適切な分類が実施されているか",
        TargetEvaluation: `[
            { "score": 4, "text": "規程に基づく分類ルールが確立され、完全に実行されている" },
            { "score": 3, "text": "分類ルールが確立され、概ね実行されている" },
            { "score": 2, "text": "分類ルールは存在するが、実行が不十分" },
            { "score": 1, "text": "分類ルールが不完全または実行されていない" }
        ]`,
        Risk: "機密情報の漏洩、不適切なアクセス制御"
    },
    {
        DaiItem: "データ管理", 
        ChuItem: "データ保存",
        CheckItem: "データの保存場所が適切に管理されているか",
        TargetEvaluation: `[
            { "score": 4, "text": "承認された保存場所でのみデータが保存され、完全に管理されている" },
            { "score": 3, "text": "承認された保存場所でデータが保存され、概ね管理されている" },
            { "score": 2, "text": "保存場所の管理が一部不十分" },
            { "score": 1, "text": "保存場所が適切に管理されていない" }
        ]`,
        Risk: "非承認の場所へのデータ保存によるセキュリティリスク"
    },
    {
        DaiItem: "アクセス制御",
        ChuItem: "ユーザー管理", 
        CheckItem: "ユーザーのアクセス権限が適切に管理されているか",
        TargetEvaluation: `[
            { "score": 4, "text": "最小権限の原則に基づくアクセス制御が完全に実装されている" },
            { "score": 3, "text": "適切なアクセス制御が概ね実装されている" },
            { "score": 2, "text": "アクセス制御の実装が一部不十分" },
            { "score": 1, "text": "アクセス制御が不適切または実装されていない" }
        ]`,
        Risk: "不正アクセス、権限昇格攻撃"
    }
];

const server = http.createServer((req, res) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    if (req.url === '/api/GetSurveyQuestions' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(mockData));
    } else if (req.url === '/api/SubmitSurveyAnswers' && req.method === 'POST') {
        // POST データを読み取る
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const submissionData = JSON.parse(body);
                console.log('Received submission data:', JSON.stringify(submissionData, null, 2));
                
                // 成功レスポンスを返す
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    success: true, 
                    message: 'Survey answers submitted successfully',
                    submissionId: Date.now() // 簡単な送信ID
                }));
            } catch (error) {
                console.error('Error parsing submission data:', error);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    success: false, 
                    error: 'Invalid JSON data' 
                }));
            }
        });
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    }
});

const port = 8080;
server.listen(port, 'localhost', () => {
    console.log(`Mock API server running on http://localhost:${port}`);
});

// エラーハンドリング
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.log(`Port ${port} is already in use`);
        process.exit(1);
    } else {
        console.error('Server error:', err);
    }
});
