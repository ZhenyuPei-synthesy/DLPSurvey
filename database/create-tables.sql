-- Azure SQL Database用のテーブル作成スクリプト

-- 回答保存用テーブル
CREATE TABLE SurveyAnswers (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    ItemId NVARCHAR(100) NOT NULL,
    Score INT NULL,
    Comment NVARCHAR(MAX) NULL,
    SubmissionDate DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    INDEX IX_SurveyAnswers_SubmissionDate (SubmissionDate),
    INDEX IX_SurveyAnswers_ItemId (ItemId)
);

-- 元のサーベイデータテーブル（既存の場合はスキップ）
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Servey$')
BEGIN
    -- legacy/mistyped table kept for compatibility
    CREATE TABLE [Servey$] (
        [大項目] NVARCHAR(255),
        [中項目] NVARCHAR(255),
        [チェック項目] NVARCHAR(MAX),
        [対策評価] NVARCHAR(MAX),
        [リスク] NVARCHAR(MAX)
    );
END;

-- Create the tables that the function's query expects when running locally
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SurveyTemplate$')
BEGIN
    CREATE TABLE [SurveyTemplate$] (
        [質問番号] NVARCHAR(100) NULL,
        [大項目] NVARCHAR(255) NULL,
        [中項目] NVARCHAR(255) NULL,
        [チェック項目] NVARCHAR(MAX) NULL,
        [リスク] NVARCHAR(MAX) NULL
    );
END;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'SurveyOptions$')
BEGIN
    CREATE TABLE [SurveyOptions$] (
        [質問番号] NVARCHAR(100) NULL,
        [対策評価] NVARCHAR(MAX) NULL
    );
END;
